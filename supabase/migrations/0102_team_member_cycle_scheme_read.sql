-- 0102_team_member_cycle_scheme_read.sql
-- team_member und department_lead brauchen cycle_scheme.read, um Planungszyklen (cycle_instances)
-- fuer OKR-Workspace u. a. lesen zu koennen — gleiches Muster wie executive in 0035.
-- migrate:up

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code = 'cycle_scheme.read'
where r.code in ('team_member', 'department_lead')
on conflict (role_id, permission_id) do nothing;

-- migrate:down
delete from rbac.role_permissions rp
using rbac.roles r, rbac.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.code = 'cycle_scheme.read'
  and r.code in ('team_member', 'department_lead');
