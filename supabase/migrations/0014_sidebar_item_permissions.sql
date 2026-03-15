-- 0014_sidebar_item_permissions.sql
-- Sidebar read/write permissions per role.
-- migrate:up

insert into rbac.permissions (code, name, description)
values
  ('nav.dashboard.read', 'Sidebar Dashboard Read', 'Read access to Dashboard sidebar area'),
  ('nav.dashboard.write', 'Sidebar Dashboard Write', 'Write access to Dashboard sidebar area'),
  ('nav.key-figures.read', 'Sidebar Key Figures Read', 'Read access to Key Figures sidebar area'),
  ('nav.key-figures.write', 'Sidebar Key Figures Write', 'Write access to Key Figures sidebar area'),
  ('nav.strategy-cycle.read', 'Sidebar Strategy Cycle Read', 'Read access to Strategy Cycle sidebar area'),
  ('nav.strategy-cycle.write', 'Sidebar Strategy Cycle Write', 'Write access to Strategy Cycle sidebar area'),
  ('nav.strategic-directions.read', 'Sidebar Strategic Directions Read', 'Read access to Strategic Directions sidebar area'),
  ('nav.strategic-directions.write', 'Sidebar Strategic Directions Write', 'Write access to Strategic Directions sidebar area'),
  ('nav.annual-targets.read', 'Sidebar Annual Targets Read', 'Read access to Annual Targets sidebar area'),
  ('nav.annual-targets.write', 'Sidebar Annual Targets Write', 'Write access to Annual Targets sidebar area'),
  ('nav.initiatives.read', 'Sidebar Initiatives Read', 'Read access to Initiatives sidebar area'),
  ('nav.initiatives.write', 'Sidebar Initiatives Write', 'Write access to Initiatives sidebar area'),
  ('nav.okr-workspace.read', 'Sidebar OKR Workspace Read', 'Read access to OKR Workspace sidebar area'),
  ('nav.okr-workspace.write', 'Sidebar OKR Workspace Write', 'Write access to OKR Workspace sidebar area'),
  ('nav.reviews.read', 'Sidebar Reviews Read', 'Read access to Reviews sidebar area'),
  ('nav.reviews.write', 'Sidebar Reviews Write', 'Write access to Reviews sidebar area'),
  ('nav.strategy-matrix.read', 'Sidebar Strategy Matrix Read', 'Read access to Strategy Matrix sidebar area'),
  ('nav.strategy-matrix.write', 'Sidebar Strategy Matrix Write', 'Write access to Strategy Matrix sidebar area'),
  ('nav.organization.read', 'Sidebar Organization Read', 'Read access to Organization sidebar area'),
  ('nav.organization.write', 'Sidebar Organization Write', 'Write access to Organization sidebar area'),
  ('nav.responsibles.read', 'Sidebar Responsibles Read', 'Read access to Responsibles sidebar area'),
  ('nav.responsibles.write', 'Sidebar Responsibles Write', 'Write access to Responsibles sidebar area'),
  ('nav.planning-cycles.read', 'Sidebar Planning Cycles Read', 'Read access to Planning Cycles sidebar area'),
  ('nav.planning-cycles.write', 'Sidebar Planning Cycles Write', 'Write access to Planning Cycles sidebar area'),
  ('nav.invitations.read', 'Sidebar Invitations Read', 'Read access to Invitations sidebar area'),
  ('nav.invitations.write', 'Sidebar Invitations Write', 'Write access to Invitations sidebar area'),
  ('nav.branding.read', 'Sidebar Branding Read', 'Read access to Branding sidebar area'),
  ('nav.branding.write', 'Sidebar Branding Write', 'Write access to Branding sidebar area'),
  ('nav.access-control.read', 'Sidebar Access Control Read', 'Read access to Access Control sidebar area'),
  ('nav.access-control.write', 'Sidebar Access Control Write', 'Write access to Access Control sidebar area')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code like 'nav.%'
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

-- Default for executive: read-only on all sidebar areas.
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code like 'nav.%.read'
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

-- migrate:down
delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions where code like 'nav.%'
);

delete from rbac.permissions
where code like 'nav.%';
