-- 0002_rbac.sql
-- RBAC tables and tenant consistency checks.
-- migrate:up

create table if not exists rbac.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create trigger trg_roles_updated_at
before update on rbac.roles
for each row
execute function app.set_updated_at();

create index if not exists idx_roles_org
  on rbac.roles (organization_id);

create table if not exists rbac.permissions (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists rbac.role_permissions (
  role_id uuid not null references rbac.roles(id) on delete cascade,
  permission_id bigint not null references rbac.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists rbac.member_roles (
  membership_id uuid not null references app.organization_memberships(id) on delete cascade,
  role_id uuid not null references rbac.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (membership_id, role_id)
);

create index if not exists idx_member_roles_role
  on rbac.member_roles (role_id);

create or replace function rbac.ensure_member_role_same_org()
returns trigger
language plpgsql
as $$
declare
  membership_org_id uuid;
  role_org_id uuid;
begin
  select organization_id into membership_org_id
  from app.organization_memberships
  where id = new.membership_id;

  select organization_id into role_org_id
  from rbac.roles
  where id = new.role_id;

  if membership_org_id is null or role_org_id is null then
    raise exception 'membership or role does not exist';
  end if;

  if membership_org_id <> role_org_id then
    raise exception 'member_roles cross-tenant assignment is not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_member_roles_same_org on rbac.member_roles;
create trigger trg_member_roles_same_org
before insert or update on rbac.member_roles
for each row
execute function rbac.ensure_member_role_same_org();

-- migrate:down
drop trigger if exists trg_member_roles_same_org on rbac.member_roles;
drop function if exists rbac.ensure_member_role_same_org();
drop table if exists rbac.member_roles;
drop table if exists rbac.role_permissions;
drop table if exists rbac.permissions;
drop table if exists rbac.roles;
