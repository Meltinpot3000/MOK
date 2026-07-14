-- 0184_strategy_review_access_control_permissions.sql
-- Strategy-Review Capabilities für Access-Control (analog okr.review.*).

-- migrate:up

insert into rbac.permissions (code, name, description)
values
  (
    'strategy_review.read',
    'Strategy review read',
    'View strategy review procedure and participation status'
  ),
  (
    'strategy_review.lead_assign',
    'Strategy review lead assign',
    'Assign or change the review lead participant role'
  )
on conflict (code) do nothing;

-- Defaults für Standard-Rollen (wie im Access-Control-Preset)
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
cross join rbac.permissions p
where r.code = 'org_admin'
  and p.code in (
    'strategy_review.read',
    'strategy_review.feedback',
    'strategy_review.moderate',
    'strategy_review.lead_assign',
    'strategy_review.release',
    'strategy_review.force_ready'
  )
on conflict do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
cross join rbac.permissions p
where r.code = 'executive'
  and p.code in (
    'strategy_review.read',
    'strategy_review.feedback',
    'strategy_review.moderate',
    'strategy_review.lead_assign',
    'strategy_review.release'
  )
on conflict do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
cross join rbac.permissions p
where r.code = 'department_lead'
  and p.code in (
    'strategy_review.read',
    'strategy_review.feedback'
  )
on conflict do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
cross join rbac.permissions p
where r.code = 'team_member'
  and p.code = 'strategy_review.read'
on conflict do nothing;

-- Teilnehmer: Moderate oder Lead-Zuweisung darf Rollen pflegen
drop policy if exists strategy_review_participants_insert on app.strategy_review_participants;
create policy strategy_review_participants_insert on app.strategy_review_participants
  for insert with check (
    app.has_permission(organization_id, 'strategy_review.moderate')
    or app.has_permission(organization_id, 'strategy_review.lead_assign')
  );

drop policy if exists strategy_review_participants_update on app.strategy_review_participants;
create policy strategy_review_participants_update on app.strategy_review_participants
  for update using (
    app.has_permission(organization_id, 'strategy_review.moderate')
    or app.has_permission(organization_id, 'strategy_review.lead_assign')
  )
  with check (
    app.has_permission(organization_id, 'strategy_review.moderate')
    or app.has_permission(organization_id, 'strategy_review.lead_assign')
  );

-- migrate:down

drop policy if exists strategy_review_participants_insert on app.strategy_review_participants;
create policy strategy_review_participants_insert on app.strategy_review_participants
  for insert with check (app.has_permission(organization_id, 'strategy_review.moderate'));

drop policy if exists strategy_review_participants_update on app.strategy_review_participants;
create policy strategy_review_participants_update on app.strategy_review_participants
  for update using (app.has_permission(organization_id, 'strategy_review.moderate'))
  with check (app.has_permission(organization_id, 'strategy_review.moderate'));

delete from rbac.role_permissions rp
using rbac.permissions p
where rp.permission_id = p.id
  and p.code in ('strategy_review.read', 'strategy_review.lead_assign');

delete from rbac.permissions
where code in ('strategy_review.read', 'strategy_review.lead_assign');
