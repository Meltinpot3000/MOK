-- 0096_okr_relationship_access_schema_and_rbac.sql
-- OKR relationship-based access: schema (deputy, reports_to) + RBAC object permissions.
-- migrate:up

-- A) Schema -----------------------------------------------------------------

alter table app.objectives
  add column if not exists deputy_membership_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'objectives_deputy_membership_id_fkey'
  ) then
    alter table app.objectives
      add constraint objectives_deputy_membership_id_fkey
      foreign key (deputy_membership_id)
      references app.organization_memberships(id)
      on delete set null;
  end if;
end $$;

alter table app.key_results
  add column if not exists deputy_membership_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'key_results_deputy_membership_id_fkey'
  ) then
    alter table app.key_results
      add constraint key_results_deputy_membership_id_fkey
      foreign key (deputy_membership_id)
      references app.organization_memberships(id)
      on delete set null;
  end if;
end $$;

alter table app.organization_memberships
  add column if not exists reports_to_membership_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_memberships_reports_to_membership_id_fkey'
  ) then
    alter table app.organization_memberships
      add constraint organization_memberships_reports_to_membership_id_fkey
      foreign key (reports_to_membership_id)
      references app.organization_memberships(id)
      on delete set null;
  end if;
end $$;

comment on column app.objectives.deputy_membership_id is 'Optional deputy (Stellvertretung) for the objective.';
comment on column app.key_results.deputy_membership_id is 'Optional KR deputy; inherits from objective deputy when null.';
comment on column app.organization_memberships.reports_to_membership_id is 'Direct manager line (same org); used for department-scoped OKR access.';

create index if not exists objectives_owner_membership_idx
  on app.objectives(owner_membership_id)
  where owner_membership_id is not null;

create index if not exists objectives_deputy_membership_idx
  on app.objectives(deputy_membership_id)
  where deputy_membership_id is not null;

create index if not exists key_results_deputy_membership_idx
  on app.key_results(deputy_membership_id)
  where deputy_membership_id is not null;

create index if not exists organization_memberships_reports_to_idx
  on app.organization_memberships(reports_to_membership_id)
  where reports_to_membership_id is not null;

-- B) Permissions ------------------------------------------------------------

insert into rbac.permissions (code, name, description)
values
  ('okr.objective.read.own', 'OKR Objective Read (own)', 'Read objectives where user is owner'),
  ('okr.objective.read.deputy', 'OKR Objective Read (deputy)', 'Read objectives where user is deputy'),
  ('okr.objective.read.department', 'OKR Objective Read (department)', 'Read objectives of direct reports'),
  ('okr.objective.read.all', 'OKR Objective Read (all)', 'Read all objectives in org'),
  ('okr.objective.update.own', 'OKR Objective Update (own)', 'Update objectives where user is owner'),
  ('okr.objective.update.deputy', 'OKR Objective Update (deputy)', 'Update objectives where user is deputy'),
  ('okr.objective.update.department', 'OKR Objective Update (department)', 'Update objectives of direct reports'),
  ('okr.objective.update.all', 'OKR Objective Update (all)', 'Update all objectives in org'),
  ('okr.key_result.read.own', 'OKR Key Result Read (own)', 'Read key results where user is effective owner'),
  ('okr.key_result.read.deputy', 'OKR Key Result Read (deputy)', 'Read key results where user is effective deputy'),
  ('okr.key_result.read.department', 'OKR Key Result Read (department)', 'Read key results of direct reports (via effective owner)'),
  ('okr.key_result.read.all', 'OKR Key Result Read (all)', 'Read all key results in org'),
  ('okr.key_result.update.own', 'OKR Key Result Update (own)', 'Update key results where user is effective owner'),
  ('okr.key_result.update.deputy', 'OKR Key Result Update (deputy)', 'Update key results where user is effective deputy'),
  ('okr.key_result.update.department', 'OKR Key Result Update (department)', 'Update key results of direct reports'),
  ('okr.key_result.update.all', 'OKR Key Result Update (all)', 'Update all key results in org')
on conflict (code) do nothing;

-- org_admin: all four .all
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p
  on p.code in (
    'okr.objective.read.all',
    'okr.objective.update.all',
    'okr.key_result.read.all',
    'okr.key_result.update.all'
  )
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

-- executive: read.all only for objectives + key results
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p
  on p.code in (
    'okr.objective.read.all',
    'okr.key_result.read.all'
  )
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

-- department_lead: department read+update
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p
  on p.code in (
    'okr.objective.read.department',
    'okr.objective.update.department',
    'okr.key_result.read.department',
    'okr.key_result.update.department'
  )
where r.code = 'department_lead'
on conflict (role_id, permission_id) do nothing;

-- team_member: own + deputy read/update for objectives and key results
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p
  on p.code in (
    'okr.objective.read.own',
    'okr.objective.update.own',
    'okr.objective.read.deputy',
    'okr.objective.update.deputy',
    'okr.key_result.read.own',
    'okr.key_result.update.own',
    'okr.key_result.read.deputy',
    'okr.key_result.update.deputy'
  )
where r.code = 'team_member'
on conflict (role_id, permission_id) do nothing;

-- migrate:down
delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions
  where code in (
    'okr.objective.read.own',
    'okr.objective.read.deputy',
    'okr.objective.read.department',
    'okr.objective.read.all',
    'okr.objective.update.own',
    'okr.objective.update.deputy',
    'okr.objective.update.department',
    'okr.objective.update.all',
    'okr.key_result.read.own',
    'okr.key_result.read.deputy',
    'okr.key_result.read.department',
    'okr.key_result.read.all',
    'okr.key_result.update.own',
    'okr.key_result.update.deputy',
    'okr.key_result.update.department',
    'okr.key_result.update.all'
  )
);

delete from rbac.permissions
where code in (
  'okr.objective.read.own',
  'okr.objective.read.deputy',
  'okr.objective.read.department',
  'okr.objective.read.all',
  'okr.objective.update.own',
  'okr.objective.update.deputy',
  'okr.objective.update.department',
  'okr.objective.update.all',
  'okr.key_result.read.own',
  'okr.key_result.read.deputy',
  'okr.key_result.read.department',
  'okr.key_result.read.all',
  'okr.key_result.update.own',
  'okr.key_result.update.deputy',
  'okr.key_result.update.department',
  'okr.key_result.update.all'
);

drop index if exists app.objectives_owner_membership_idx;
drop index if exists app.objectives_deputy_membership_idx;
drop index if exists app.key_results_deputy_membership_idx;
drop index if exists app.organization_memberships_reports_to_idx;

alter table app.organization_memberships
  drop constraint if exists organization_memberships_reports_to_membership_id_fkey;
alter table app.organization_memberships
  drop column if exists reports_to_membership_id;

alter table app.key_results
  drop constraint if exists key_results_deputy_membership_id_fkey;
alter table app.key_results
  drop column if exists deputy_membership_id;

alter table app.objectives
  drop constraint if exists objectives_deputy_membership_id_fkey;
alter table app.objectives
  drop column if exists deputy_membership_id;
