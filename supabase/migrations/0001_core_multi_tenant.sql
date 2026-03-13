-- 0001_core_multi_tenant.sql
-- Core tenant model and shared helper functions.
-- migrate:up

create extension if not exists pgcrypto;

create schema if not exists app;
create schema if not exists rbac;
create schema if not exists audit;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists app.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organizations_updated_at
before update on app.organizations
for each row
execute function app.set_updated_at();

create table if not exists app.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  hierarchy_level integer check (hierarchy_level between 1 and 3),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create trigger trg_organization_memberships_updated_at
before update on app.organization_memberships
for each row
execute function app.set_updated_at();

create index if not exists idx_organization_memberships_org
  on app.organization_memberships (organization_id);

create index if not exists idx_organization_memberships_user
  on app.organization_memberships (user_id);

-- migrate:down
drop table if exists app.organization_memberships;
drop table if exists app.organizations;
drop function if exists app.set_updated_at();
drop schema if exists audit;
drop schema if exists rbac;
drop schema if exists app;
