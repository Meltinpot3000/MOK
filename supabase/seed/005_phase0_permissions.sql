-- 005_phase0_permissions.sql
-- Phase 0 permission catalog updates.
-- migrate:up
insert into rbac.permissions (code, name, description)
values
  ('org_unit.manage', 'Organization Structure Admin', 'Manage org units and hierarchy levels'),
  ('responsible.manage', 'Responsible Admin', 'Manage responsibles, assignments, and reporting lines'),
  ('cycle.clone', 'Cycle Clone', 'Create full-snapshot planning cycle clones')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('org_unit.manage', 'responsible.manage', 'cycle.clone')
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('cycle.clone')
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

-- migrate:down
delete from rbac.role_permissions rp
using rbac.roles r, rbac.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.code in ('org_unit.manage', 'responsible.manage', 'cycle.clone')
  and r.code in ('org_admin', 'executive');

delete from rbac.permissions
where code in ('org_unit.manage', 'responsible.manage', 'cycle.clone');
