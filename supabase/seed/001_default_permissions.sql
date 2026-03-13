-- 001_default_permissions.sql
-- Idempotent default permission catalog.
-- migrate:up

insert into rbac.permissions (code, name, description)
values
  ('org.manage', 'Organization Admin', 'Manage organization profile and global settings'),
  ('membership.manage', 'Membership Admin', 'Invite, suspend, and manage memberships'),
  ('admin.manage_roles', 'Role Admin', 'Create roles and assign permissions'),
  ('cycle.write', 'Cycle Editor', 'Create and update planning cycles'),
  ('cycle.publish', 'Cycle Publisher', 'Publish planning cycles'),
  ('goal.read', 'Goal Reader', 'Read strategic goals'),
  ('goal.write', 'Goal Editor', 'Create and update strategic goals'),
  ('strategy.write', 'Functional Strategy Editor', 'Create and update functional strategies'),
  ('okr.read', 'OKR Reader', 'Read objectives and key results'),
  ('okr.write', 'OKR Editor', 'Create and update objectives and key results'),
  ('okr.approve', 'OKR Approver', 'Approve objective and key result updates'),
  ('link.write', 'Link Editor', 'Manage cross-entity strategy and OKR links'),
  ('audit.read', 'Audit Reader', 'Read revisions and revision events'),
  ('admin.manage_branding', 'Branding Admin', 'Manage tenant color palette and logo')
on conflict (code) do nothing;

-- migrate:down
delete from rbac.permissions
where code in (
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
);
