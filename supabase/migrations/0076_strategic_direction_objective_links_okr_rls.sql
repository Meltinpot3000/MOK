-- 0076_strategic_direction_objective_links_okr_rls.sql
-- OKR workspace: führende Stoßrichtung je OKR-Objective setzen darf mit okr.write funktionieren
-- (ohne nav.strategy-cycle.write).
-- migrate:up

drop policy if exists strategic_direction_objective_links_select on app.strategic_direction_objective_links;
create policy strategic_direction_objective_links_select on app.strategic_direction_objective_links
  for select using (
    app.has_permission(organization_id, 'nav.strategy-cycle.read')
    or app.has_permission(organization_id, 'nav.strategy-matrix.read')
    or app.has_permission(organization_id, 'review.read')
    or app.has_permission(organization_id, 'okr.read')
  );

drop policy if exists strategic_direction_objective_links_modify on app.strategic_direction_objective_links;
create policy strategic_direction_objective_links_modify on app.strategic_direction_objective_links
  for all using (
    app.has_permission(organization_id, 'nav.strategy-cycle.write')
    or app.has_permission(organization_id, 'nav.strategy-matrix.write')
    or app.has_permission(organization_id, 'okr.write')
  )
  with check (
    app.has_permission(organization_id, 'nav.strategy-cycle.write')
    or app.has_permission(organization_id, 'nav.strategy-matrix.write')
    or app.has_permission(organization_id, 'okr.write')
  );

-- migrate:down

drop policy if exists strategic_direction_objective_links_modify on app.strategic_direction_objective_links;
drop policy if exists strategic_direction_objective_links_select on app.strategic_direction_objective_links;

create policy strategic_direction_objective_links_select on app.strategic_direction_objective_links
  for select using (
    app.has_permission(organization_id, 'nav.strategy-cycle.read')
    or app.has_permission(organization_id, 'nav.strategy-matrix.read')
    or app.has_permission(organization_id, 'review.read')
  );

create policy strategic_direction_objective_links_modify on app.strategic_direction_objective_links
  for all using (
    app.has_permission(organization_id, 'nav.strategy-cycle.write')
    or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  )
  with check (
    app.has_permission(organization_id, 'nav.strategy-cycle.write')
    or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  );
