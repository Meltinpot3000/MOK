-- 0097_okr_object_rls_bridge.sql
-- Minimal RLS bridge: okr.write + relationship / granular okr.objective/key_result.update.* checks.
-- Strategy-matrix/cycle write paths for objectives stay bypass (legacy).
-- migrate:up

create or replace function app.current_membership_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select m.id
  from app.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function app.okr_is_direct_manager_of(
  p_manager_membership_id uuid,
  p_subordinate_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select coalesce(
    p_subordinate_membership_id is not null
    and p_manager_membership_id is not null
    and exists (
      select 1
      from app.organization_memberships s
      where s.id = p_subordinate_membership_id
        and s.reports_to_membership_id is not null
        and s.reports_to_membership_id = p_manager_membership_id
    ),
    false
  );
$$;

create or replace function app.okr_can_modify_objective(
  p_org uuid,
  p_owner uuid,
  p_deputy uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select
    app.has_permission(p_org, 'okr.objective.update.all')
    or (
      p_owner is not null
      and p_owner = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'okr.objective.update.own')
    )
    or (
      p_deputy is not null
      and p_deputy = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'okr.objective.update.deputy')
    )
    or (
      p_owner is not null
      and app.okr_is_direct_manager_of(app.current_membership_id(p_org), p_owner)
      and app.has_permission(p_org, 'okr.objective.update.department')
    );
$$;

create or replace function app.okr_can_modify_key_result(
  p_org uuid,
  p_kr_owner uuid,
  p_kr_deputy uuid,
  p_obj_owner uuid,
  p_obj_deputy uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select
    app.has_permission(p_org, 'okr.key_result.update.all')
    or (
      coalesce(p_kr_owner, p_obj_owner) is not null
      and coalesce(p_kr_owner, p_obj_owner) = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'okr.key_result.update.own')
    )
    or (
      coalesce(p_kr_deputy, p_obj_deputy) is not null
      and coalesce(p_kr_deputy, p_obj_deputy) = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'okr.key_result.update.deputy')
    )
    or (
      coalesce(p_kr_owner, p_obj_owner) is not null
      and app.okr_is_direct_manager_of(
        app.current_membership_id(p_org),
        coalesce(p_kr_owner, p_obj_owner)
      )
      and app.has_permission(p_org, 'okr.key_result.update.department')
    );
$$;

revoke all on function app.current_membership_id(uuid) from public;
revoke all on function app.okr_is_direct_manager_of(uuid, uuid) from public;
revoke all on function app.okr_can_modify_objective(uuid, uuid, uuid) from public;
revoke all on function app.okr_can_modify_key_result(uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function app.current_membership_id(uuid) to authenticated, anon;
grant execute on function app.okr_is_direct_manager_of(uuid, uuid) to authenticated, anon;
grant execute on function app.okr_can_modify_objective(uuid, uuid, uuid) to authenticated, anon;
grant execute on function app.okr_can_modify_key_result(uuid, uuid, uuid, uuid, uuid) to authenticated, anon;

drop policy if exists objectives_modify on app.objectives;
create policy objectives_modify on app.objectives
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or (
    app.has_permission(organization_id, 'okr.write')
    and app.okr_can_modify_objective(organization_id, owner_membership_id, deputy_membership_id)
  )
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or (
    app.has_permission(organization_id, 'okr.write')
    and app.okr_can_modify_objective(organization_id, owner_membership_id, deputy_membership_id)
  )
);

drop policy if exists key_results_modify on app.key_results;
create policy key_results_modify on app.key_results
for all using (
  app.has_permission(organization_id, 'okr.write')
  and exists (
    select 1
    from app.objectives o
    where o.id = objective_id
      and o.organization_id = key_results.organization_id
      and app.okr_can_modify_key_result(
        key_results.organization_id,
        key_results.owner_membership_id,
        key_results.deputy_membership_id,
        o.owner_membership_id,
        o.deputy_membership_id
      )
  )
)
with check (
  app.has_permission(organization_id, 'okr.write')
  and exists (
    select 1
    from app.objectives o
    where o.id = objective_id
      and o.organization_id = key_results.organization_id
      and app.okr_can_modify_key_result(
        key_results.organization_id,
        key_results.owner_membership_id,
        key_results.deputy_membership_id,
        o.owner_membership_id,
        o.deputy_membership_id
      )
  )
);

-- migrate:down
drop policy if exists objectives_modify on app.objectives;
create policy objectives_modify on app.objectives
for all using (
  app.has_permission(organization_id, 'okr.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'okr.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists key_results_modify on app.key_results;
create policy key_results_modify on app.key_results
for all using (app.has_permission(organization_id, 'okr.write'))
with check (app.has_permission(organization_id, 'okr.write'));

drop function if exists app.okr_can_modify_key_result(uuid, uuid, uuid, uuid, uuid);
drop function if exists app.okr_can_modify_objective(uuid, uuid, uuid);
drop function if exists app.okr_is_direct_manager_of(uuid, uuid);
drop function if exists app.current_membership_id(uuid);
