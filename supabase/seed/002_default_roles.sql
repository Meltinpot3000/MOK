-- 002_default_roles.sql
-- Idempotent default roles and role-permission mappings.
-- migrate:up

insert into rbac.roles (organization_id, code, name, description, is_system)
select
  o.id,
  v.code,
  v.name,
  v.description,
  true
from app.organizations o
cross join (
  values
    ('org_admin', 'Organization Admin', 'Full access for tenant administration'),
    ('executive', 'Executive', 'Leadership level with portfolio oversight'),
    ('department_lead', 'Department Lead', 'Mid-level owner for function and objective execution'),
    ('team_member', 'Team Member', 'Contributors updating assigned OKRs')
) as v(code, name, description)
on conflict (organization_id, code) do update
set
  name = excluded.name,
  description = excluded.description;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p
  on p.code in (
    'org.manage',
    'membership.manage',
    'admin.manage_roles',
    'cycle.write',
    'cycle.publish',
    'goal.read',
    'goal.write',
    'strategy.write',
    'okr.read',
    'okr.write',
    'okr.approve',
    'link.write',
    'audit.read',
    'admin.manage_branding'
  )
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p
  on p.code in (
    'cycle.write',
    'cycle.publish',
    'goal.read',
    'goal.write',
    'strategy.write',
    'okr.read',
    'okr.approve',
    'audit.read'
  )
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p
  on p.code in (
    'goal.read',
    'goal.write',
    'strategy.write',
    'okr.read',
    'okr.write',
    'link.write'
  )
where r.code = 'department_lead'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p
  on p.code in (
    'goal.read',
    'okr.read',
    'okr.write'
  )
where r.code = 'team_member'
on conflict (role_id, permission_id) do nothing;

-- migrate:down
delete from rbac.role_permissions rp
using rbac.roles r
where rp.role_id = r.id
  and r.code in ('org_admin', 'executive', 'department_lead', 'team_member');

delete from rbac.roles
where code in ('org_admin', 'executive', 'department_lead', 'team_member');
