-- 0104_strategic_directions_okr_workspace_select.sql
-- Teammitglieder mit OKR-Arbeitsbereich sehen Stossrichtungen fuer Objective-Anlage (Dropdown),
-- ohne nav.strategy-cycle / strategy-matrix lesen zu muessen.

-- migrate:up

drop policy if exists strategic_directions_select on app.strategic_directions;
create policy strategic_directions_select on app.strategic_directions
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)
  or app.has_permission(organization_id, 'nav.strategy-cycle.read'::text)
  or app.has_permission(organization_id, 'review.read'::text)
  or app.has_permission(organization_id, 'nav.okr-workspace.read'::text)
);

-- migrate:down

drop policy if exists strategic_directions_select on app.strategic_directions;
create policy strategic_directions_select on app.strategic_directions
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)
  or app.has_permission(organization_id, 'nav.strategy-cycle.read'::text)
  or app.has_permission(organization_id, 'review.read'::text)
);
