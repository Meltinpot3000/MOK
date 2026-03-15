-- 0022_strategy_cycle_analysis_rls.sql
-- Allow Strategy Cycle permissions to manage analysis/challenge derivation.
-- migrate:up

drop policy if exists analysis_entries_select on app.analysis_entries;
create policy analysis_entries_select on app.analysis_entries
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'nav.strategy-cycle.read')
);

drop policy if exists analysis_entries_modify on app.analysis_entries;
create policy analysis_entries_modify on app.analysis_entries
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
);

drop policy if exists strategic_challenges_select on app.strategic_challenges;
create policy strategic_challenges_select on app.strategic_challenges
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'nav.strategy-cycle.read')
);

drop policy if exists strategic_challenges_modify on app.strategic_challenges;
create policy strategic_challenges_modify on app.strategic_challenges
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
);

-- migrate:down
drop policy if exists strategic_challenges_modify on app.strategic_challenges;
create policy strategic_challenges_modify on app.strategic_challenges
for all using (app.has_permission(organization_id, 'nav.strategy-matrix.write'))
with check (app.has_permission(organization_id, 'nav.strategy-matrix.write'));

drop policy if exists strategic_challenges_select on app.strategic_challenges;
create policy strategic_challenges_select on app.strategic_challenges
for select using (app.has_permission(organization_id, 'nav.strategy-matrix.read'));

drop policy if exists analysis_entries_modify on app.analysis_entries;
create policy analysis_entries_modify on app.analysis_entries
for all using (app.has_permission(organization_id, 'nav.strategy-matrix.write'))
with check (app.has_permission(organization_id, 'nav.strategy-matrix.write'));

drop policy if exists analysis_entries_select on app.analysis_entries;
create policy analysis_entries_select on app.analysis_entries
for select using (app.has_permission(organization_id, 'nav.strategy-matrix.read'));
