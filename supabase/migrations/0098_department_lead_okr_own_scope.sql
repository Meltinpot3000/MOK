-- 0098_department_lead_okr_own_scope.sql
-- department_lead: eigene OKRs (Owner/Deputy) ergänzen — bisher nur *.department;
-- Führungskräfte sind i. d. R. auch Contributor; Tracking filterte sonst „eigene“ Objectives aus.
-- migrate:up

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
where r.code = 'department_lead'
on conflict (role_id, permission_id) do nothing;

-- migrate:down

delete from rbac.role_permissions rp
using rbac.roles r, rbac.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'department_lead'
  and p.code in (
    'okr.objective.read.own',
    'okr.objective.update.own',
    'okr.objective.read.deputy',
    'okr.objective.update.deputy',
    'okr.key_result.read.own',
    'okr.key_result.update.own',
    'okr.key_result.read.deputy',
    'okr.key_result.update.deputy'
  );
