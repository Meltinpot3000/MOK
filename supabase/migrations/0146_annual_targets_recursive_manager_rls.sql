-- 0146_annual_targets_recursive_manager_rls.sql
-- Jahresziele: department-Scope über gesamte Unterstellten-Hierarchie (nicht nur direkte Reports).
-- migrate:up

create or replace function app.okr_is_manager_of(
  p_manager_membership_id uuid,
  p_subordinate_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  with recursive ancestors as (
    select id, reports_to_membership_id
    from app.organization_memberships
    where id = p_subordinate_membership_id
    union all
    select m.id, m.reports_to_membership_id
    from app.organization_memberships m
    inner join ancestors a on m.id = a.reports_to_membership_id
    where a.reports_to_membership_id is not null
  )
  select coalesce(
    p_subordinate_membership_id is not null
    and p_manager_membership_id is not null
    and exists (
      select 1
      from ancestors
      where reports_to_membership_id = p_manager_membership_id
    ),
    false
  );
$$;

revoke all on function app.okr_is_manager_of(uuid, uuid) from public;
grant execute on function app.okr_is_manager_of(uuid, uuid) to authenticated, anon;

create or replace function app.annual_target_can_read(
  p_org uuid,
  p_owner_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select
    app.has_permission(p_org, 'nav.annual-targets.read')
    or app.has_permission(p_org, 'nav.strategy-matrix.read')
    or app.has_permission(p_org, 'annual_targets.read.all')
    or (
      p_owner_membership_id is not null
      and p_owner_membership_id = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'annual_targets.read.own')
    )
    or (
      p_owner_membership_id is not null
      and app.okr_is_manager_of(app.current_membership_id(p_org), p_owner_membership_id)
      and app.has_permission(p_org, 'annual_targets.read.department')
    );
$$;

create or replace function app.annual_target_can_modify(
  p_org uuid,
  p_owner_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select
    app.has_permission(p_org, 'nav.annual-targets.write')
    or app.has_permission(p_org, 'nav.strategy-matrix.write')
    or app.has_permission(p_org, 'annual_targets.write.all')
    or (
      p_owner_membership_id is not null
      and p_owner_membership_id = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'annual_targets.write.own')
    )
    or (
      p_owner_membership_id is not null
      and app.okr_is_manager_of(app.current_membership_id(p_org), p_owner_membership_id)
      and app.has_permission(p_org, 'annual_targets.write.department')
    );
$$;

-- migrate:down
create or replace function app.annual_target_can_read(
  p_org uuid,
  p_owner_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select
    app.has_permission(p_org, 'nav.annual-targets.read')
    or app.has_permission(p_org, 'nav.strategy-matrix.read')
    or app.has_permission(p_org, 'annual_targets.read.all')
    or (
      p_owner_membership_id is not null
      and p_owner_membership_id = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'annual_targets.read.own')
    )
    or (
      p_owner_membership_id is not null
      and app.okr_is_direct_manager_of(app.current_membership_id(p_org), p_owner_membership_id)
      and app.has_permission(p_org, 'annual_targets.read.department')
    );
$$;

create or replace function app.annual_target_can_modify(
  p_org uuid,
  p_owner_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select
    app.has_permission(p_org, 'nav.annual-targets.write')
    or app.has_permission(p_org, 'nav.strategy-matrix.write')
    or app.has_permission(p_org, 'annual_targets.write.all')
    or (
      p_owner_membership_id is not null
      and p_owner_membership_id = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'annual_targets.write.own')
    )
    or (
      p_owner_membership_id is not null
      and app.okr_is_direct_manager_of(app.current_membership_id(p_org), p_owner_membership_id)
      and app.has_permission(p_org, 'annual_targets.write.department')
    );
$$;

drop function if exists app.okr_is_manager_of(uuid, uuid);
