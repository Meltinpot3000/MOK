-- migrate:up
-- Jahresziele: Lesen symmetrisch zu Schreiben + alle aktiven Memberships des Users
-- (nicht nur app.current_membership_id limit 1).

create or replace function app.user_owns_membership_in_org(
  p_org uuid,
  p_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select coalesce(
    p_membership_id is not null
    and exists (
      select 1
      from app.organization_memberships m
      where m.organization_id = p_org
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.id = p_membership_id
    ),
    false
  );
$$;

revoke all on function app.user_owns_membership_in_org(uuid, uuid) from public;
grant execute on function app.user_owns_membership_in_org(uuid, uuid) to authenticated, anon;

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
      and app.user_owns_membership_in_org(p_org, p_owner_membership_id)
      and app.has_permission(p_org, 'annual_targets.write.own')
    )
    or (
      p_owner_membership_id is not null
      and exists (
        select 1
        from app.organization_memberships m
        where m.organization_id = p_org
          and m.user_id = auth.uid()
          and m.status = 'active'
          and app.okr_is_manager_of(m.id, p_owner_membership_id)
      )
      and app.has_permission(p_org, 'annual_targets.write.department')
    );
$$;

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
    app.annual_target_can_modify(p_org, p_owner_membership_id)
    or app.has_permission(p_org, 'nav.annual-targets.read')
    or app.has_permission(p_org, 'nav.strategy-matrix.read')
    or app.has_permission(p_org, 'annual_targets.read.all')
    or (
      p_owner_membership_id is not null
      and app.user_owns_membership_in_org(p_org, p_owner_membership_id)
      and app.has_permission(p_org, 'annual_targets.read.own')
    )
    or (
      p_owner_membership_id is not null
      and exists (
        select 1
        from app.organization_memberships m
        where m.organization_id = p_org
          and m.user_id = auth.uid()
          and m.status = 'active'
          and app.okr_is_manager_of(m.id, p_owner_membership_id)
      )
      and app.has_permission(p_org, 'annual_targets.read.department')
    );
$$;

comment on function app.user_owns_membership_in_org(uuid, uuid) is
  'True wenn auth.uid() eine aktive Membership mit dieser ID in der Organisation hat.';

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

drop function if exists app.user_owns_membership_in_org(uuid, uuid);
