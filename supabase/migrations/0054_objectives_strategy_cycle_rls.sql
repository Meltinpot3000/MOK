-- 0054_objectives_strategy_cycle_rls.sql
-- Allow strategy-cycle and strategy-matrix permissions to modify objectives (in addition to okr.write).
-- migrate:up

drop policy if exists objectives_modify on app.objectives;
create policy objectives_modify on app.objectives
for all using (
  app.has_permission(organization_id, 'okr.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'okr.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

-- migrate:down
drop policy if exists objectives_modify on app.objectives;
create policy objectives_modify on app.objectives
for all using (app.has_permission(organization_id, 'okr.write'))
with check (app.has_permission(organization_id, 'okr.write'));
