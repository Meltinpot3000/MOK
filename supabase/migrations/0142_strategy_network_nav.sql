-- 0142_strategy_network_nav.sql
-- Navigation «Strategienetzwerk» unter Organisation.
-- migrate:up

insert into rbac.permissions (code, name, description)
values
  ('nav.strategy-network.read', 'Sidebar Strategienetzwerk Read', 'Read access to strategy network graph'),
  ('nav.strategy-network.write', 'Sidebar Strategienetzwerk Write', 'Write access to strategy network graph')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code like 'nav.strategy-network.%'
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code = 'nav.strategy-network.read'
where r.code in ('executive', 'department_lead')
on conflict (role_id, permission_id) do nothing;

-- Bestehende Rollen mit Organisations-Nav-Lesen erhalten Strategienetzwerk-Lesen.
insert into rbac.role_permissions (role_id, permission_id)
select distinct rp.role_id, p.id
from rbac.role_permissions rp
join rbac.permissions existing on existing.id = rp.permission_id and existing.code = 'nav.organization.read'
join rbac.permissions p on p.code = 'nav.strategy-network.read'
on conflict (role_id, permission_id) do nothing;

-- migrate:down

delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions where code like 'nav.strategy-network.%'
);

delete from rbac.permissions
where code like 'nav.strategy-network.%';
