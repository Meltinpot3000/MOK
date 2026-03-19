-- 0056_objective_industries_business_models_rls.sql
-- Allow strategy-cycle and strategy-matrix permissions for objective industries/business models.
-- migrate:up

drop policy if exists objective_industries_modify on app.objective_industries;
create policy objective_industries_modify on app.objective_industries
for all using (
  app.has_permission(organization_id, 'traceability.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'traceability.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists objective_industries_select on app.objective_industries;
create policy objective_industries_select on app.objective_industries
for select using (
  app.has_permission(organization_id, 'traceability.read')
  or app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists objective_business_models_modify on app.objective_business_models;
create policy objective_business_models_modify on app.objective_business_models
for all using (
  app.has_permission(organization_id, 'traceability.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'traceability.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists objective_business_models_select on app.objective_business_models;
create policy objective_business_models_select on app.objective_business_models
for select using (
  app.has_permission(organization_id, 'traceability.read')
  or app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

-- migrate:down
drop policy if exists objective_industries_modify on app.objective_industries;
create policy objective_industries_modify on app.objective_industries
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists objective_industries_select on app.objective_industries;
create policy objective_industries_select on app.objective_industries
for select using (app.has_permission(organization_id, 'traceability.read'));

drop policy if exists objective_business_models_modify on app.objective_business_models;
create policy objective_business_models_modify on app.objective_business_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists objective_business_models_select on app.objective_business_models;
create policy objective_business_models_select on app.objective_business_models
for select using (app.has_permission(organization_id, 'traceability.read'));
