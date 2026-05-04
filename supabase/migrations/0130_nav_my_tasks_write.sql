-- nav.my-tasks.write: fehlte neben nav.my-tasks.read (0124); Rollenmatrix und Sidebar nutzen getWritePermissionCode('my-tasks').
-- migrate:up

insert into rbac.permissions (code, name, description)
values (
  'nav.my-tasks.write',
  'Sidebar Meine Aufgaben Write',
  'Write access to Meine Aufgaben sidebar area (Entscheidungen / Aufgabenabschluss wo durch RLS erlaubt)'
)
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code = 'nav.my-tasks.write'
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

-- migrate:down

delete from rbac.role_permissions
where permission_id in (select id from rbac.permissions where code = 'nav.my-tasks.write');

delete from rbac.permissions where code = 'nav.my-tasks.write';
