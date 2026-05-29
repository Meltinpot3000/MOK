-- 0134_directory_sync_entra.sql
-- Optional Entra ID directory sync (preview/apply), external mappings, group-role mappings.
-- migrate:up

create table if not exists app.directory_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references app.organizations(id) on delete cascade,
  provider text not null default 'entra_id' check (provider in ('entra_id')),
  sync_enabled boolean not null default false,
  azure_tenant_id text,
  client_id text,
  user_provisioning_policy text not null default 'invite_only'
    check (user_provisioning_policy in ('none', 'invite_only', 'create_auth_user')),
  attribute_priority text[] not null default array['department', 'officeLocation', 'companyName'],
  department_path_separator text,
  last_sync_at timestamptz,
  last_preview_run_id uuid,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_directory_connections_updated_at
before update on app.directory_connections
for each row execute function app.set_updated_at();

create table if not exists app.directory_external_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('user', 'organization_unit', 'group')),
  external_provider text not null default 'entra_id' check (external_provider in ('entra_id')),
  external_id text not null,
  internal_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, external_provider, external_id)
);

create index if not exists idx_directory_external_mappings_internal
  on app.directory_external_mappings (organization_id, entity_type, internal_id);

create trigger trg_directory_external_mappings_updated_at
before update on app.directory_external_mappings
for each row execute function app.set_updated_at();

create table if not exists app.directory_group_role_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  entra_group_id text not null,
  entra_group_display_name text,
  role_id uuid not null references rbac.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, entra_group_id, role_id)
);

create index if not exists idx_directory_group_role_mappings_org
  on app.directory_group_role_mappings (organization_id);

create table if not exists app.directory_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  mode text not null check (mode in ('preview', 'apply')),
  preview_run_id uuid references app.directory_sync_runs(id) on delete set null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  diff_summary jsonb not null default '{}'::jsonb,
  error_message text,
  stats jsonb not null default '{}'::jsonb,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_directory_sync_runs_org_started
  on app.directory_sync_runs (organization_id, started_at desc);

alter table app.organization_unit
  add column if not exists managed_by_directory_sync boolean not null default false;

alter table app.organization_memberships
  add column if not exists managed_by_directory_sync boolean not null default false;

alter table rbac.member_roles
  add column if not exists assignment_source text not null default 'manual'
    check (assignment_source in ('manual', 'invitation', 'entra_sync'));

update rbac.member_roles set assignment_source = 'manual' where assignment_source is null;

grant select, insert, update, delete on app.directory_connections to authenticated;
grant select, insert, update, delete on app.directory_external_mappings to authenticated;
grant select, insert, update, delete on app.directory_group_role_mappings to authenticated;
grant select, insert, update on app.directory_sync_runs to authenticated;

alter table app.directory_connections enable row level security;
alter table app.directory_external_mappings enable row level security;
alter table app.directory_group_role_mappings enable row level security;
alter table app.directory_sync_runs enable row level security;

drop policy if exists directory_connections_manage on app.directory_connections;
create policy directory_connections_manage on app.directory_connections
for all
using (app.has_permission(organization_id, 'membership.manage'))
with check (app.has_permission(organization_id, 'membership.manage'));

drop policy if exists directory_external_mappings_manage on app.directory_external_mappings;
create policy directory_external_mappings_manage on app.directory_external_mappings
for all
using (app.has_permission(organization_id, 'membership.manage'))
with check (app.has_permission(organization_id, 'membership.manage'));

drop policy if exists directory_group_role_mappings_manage on app.directory_group_role_mappings;
create policy directory_group_role_mappings_manage on app.directory_group_role_mappings
for all
using (app.has_permission(organization_id, 'membership.manage'))
with check (app.has_permission(organization_id, 'membership.manage'));

drop policy if exists directory_sync_runs_select on app.directory_sync_runs;
create policy directory_sync_runs_select on app.directory_sync_runs
for select
using (app.is_member_of_org(organization_id));

drop policy if exists directory_sync_runs_insert on app.directory_sync_runs;
create policy directory_sync_runs_insert on app.directory_sync_runs
for insert
with check (app.has_permission(organization_id, 'membership.manage'));

drop policy if exists directory_sync_runs_update on app.directory_sync_runs;
create policy directory_sync_runs_update on app.directory_sync_runs
for update
using (app.has_permission(organization_id, 'membership.manage'))
with check (app.has_permission(organization_id, 'membership.manage'));

insert into rbac.permissions (code, name, description)
values
  ('nav.directory-sync.read', 'Sidebar Entra Directory Sync Read', 'Read Entra directory sync settings and previews'),
  ('nav.directory-sync.write', 'Sidebar Entra Directory Sync Write', 'Configure and apply Entra directory sync')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('nav.directory-sync.read', 'nav.directory-sync.write')
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

-- migrate:down

delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions where code in ('nav.directory-sync.read', 'nav.directory-sync.write')
);
delete from rbac.permissions where code in ('nav.directory-sync.read', 'nav.directory-sync.write');

drop policy if exists directory_sync_runs_update on app.directory_sync_runs;
drop policy if exists directory_sync_runs_insert on app.directory_sync_runs;
drop policy if exists directory_sync_runs_select on app.directory_sync_runs;
drop policy if exists directory_group_role_mappings_manage on app.directory_group_role_mappings;
drop policy if exists directory_external_mappings_manage on app.directory_external_mappings;
drop policy if exists directory_connections_manage on app.directory_connections;

drop table if exists app.directory_sync_runs;
drop table if exists app.directory_group_role_mappings;
drop table if exists app.directory_external_mappings;
drop trigger if exists trg_directory_connections_updated_at on app.directory_connections;
drop table if exists app.directory_connections;

alter table rbac.member_roles drop column if exists assignment_source;
alter table app.organization_memberships drop column if exists managed_by_directory_sync;
alter table app.organization_unit drop column if exists managed_by_directory_sync;
