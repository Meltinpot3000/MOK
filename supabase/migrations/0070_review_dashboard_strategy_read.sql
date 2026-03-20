-- 0070_review_dashboard_strategy_read.sql
-- Review-Dashboard liest Programme/Stossrichtungen/Links: gleiche Sichtbarkeit wie review.read
-- (bisher nur nav.strategy-*), damit Daten nicht leer bleiben.
-- migrate:up

drop policy if exists strategy_programs_select on app.strategy_programs;
create policy strategy_programs_select on app.strategy_programs
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'review.read')
);

drop policy if exists strategic_directions_select on app.strategic_directions;
create policy strategic_directions_select on app.strategic_directions
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'review.read')
);

drop policy if exists strategic_direction_objective_links_select on app.strategic_direction_objective_links;
create policy strategic_direction_objective_links_select on app.strategic_direction_objective_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'review.read')
);

drop policy if exists initiatives_select on app.initiatives;
create policy initiatives_select on app.initiatives
for select using (
  app.has_permission(organization_id, 'initiative.read')
  or app.has_permission(organization_id, 'review.read')
);

-- migrate:down

drop policy if exists strategy_programs_select on app.strategy_programs;
create policy strategy_programs_select on app.strategy_programs
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategic_directions_select on app.strategic_directions;
create policy strategic_directions_select on app.strategic_directions
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategic_direction_objective_links_select on app.strategic_direction_objective_links;
create policy strategic_direction_objective_links_select on app.strategic_direction_objective_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists initiatives_select on app.initiatives;
create policy initiatives_select on app.initiatives
for select using (
  app.has_permission(organization_id, 'initiative.read')
);
