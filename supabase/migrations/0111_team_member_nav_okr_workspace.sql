-- 0111_team_member_nav_okr_workspace.sql
-- migrate:up
-- Teammitglied: Sidebar-Zugriff auf OKR-Arbeitsbereich (read+write).
-- Modul-Rechte okr.read/okr.write (0038) reichen fuer RLS, Server-Actions prueften zusaetzlich nav.okr-workspace.write.

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('nav.okr-workspace.read', 'nav.okr-workspace.write')
where r.code = 'team_member'
on conflict (role_id, permission_id) do nothing;

-- migrate:down

delete from rbac.role_permissions rp
using rbac.roles r, rbac.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'team_member'
  and p.code in ('nav.okr-workspace.read', 'nav.okr-workspace.write');
