-- 0008_fix_rls_recursion.sql
-- Prevent recursive RLS evaluation in helper functions by using SECURITY DEFINER.
-- migrate:up
create or replace function app.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select auth.uid();
$$;

create or replace function app.is_member_of_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select exists (
    select 1
    from app.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function app.has_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select exists (
    select 1
    from app.organization_memberships m
    join rbac.member_roles mr on mr.membership_id = m.id
    join rbac.role_permissions rp on rp.role_id = mr.role_id
    join rbac.permissions p on p.id = rp.permission_id
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.code = p_permission_code
  );
$$;

revoke all on function app.current_user_id() from public;
revoke all on function app.is_member_of_org(uuid) from public;
revoke all on function app.has_permission(uuid, text) from public;
grant execute on function app.current_user_id() to authenticated, anon;
grant execute on function app.is_member_of_org(uuid) to authenticated, anon;
grant execute on function app.has_permission(uuid, text) to authenticated, anon;

-- migrate:down
create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function app.is_member_of_org(p_organization_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from app.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = app.current_user_id()
      and m.status = 'active'
  );
$$;

create or replace function app.has_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from app.organization_memberships m
    join rbac.member_roles mr on mr.membership_id = m.id
    join rbac.role_permissions rp on rp.role_id = mr.role_id
    join rbac.permissions p on p.id = rp.permission_id
    where m.organization_id = p_organization_id
      and m.user_id = app.current_user_id()
      and m.status = 'active'
      and p.code = p_permission_code
  );
$$;
