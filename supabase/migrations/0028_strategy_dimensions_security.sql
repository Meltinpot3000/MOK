-- 0028_strategy_dimensions_security.sql
-- Permissions, grants and RLS for strategy dimensions.
-- migrate:up

insert into rbac.permissions (code, name, description)
values
  ('dimension.read', 'Strategy Dimensions Read', 'Read industry, business model and operating model'),
  ('dimension.write', 'Strategy Dimensions Write', 'Manage industry, business model and operating model'),
  ('nav.industries.read', 'Sidebar Industries Read', 'Read access to Industries sidebar area'),
  ('nav.industries.write', 'Sidebar Industries Write', 'Write access to Industries sidebar area'),
  ('nav.business-models.read', 'Sidebar Business Models Read', 'Read access to Business Models sidebar area'),
  ('nav.business-models.write', 'Sidebar Business Models Write', 'Write access to Business Models sidebar area'),
  ('nav.operating-models.read', 'Sidebar Operating Models Read', 'Read access to Operating Models sidebar area'),
  ('nav.operating-models.write', 'Sidebar Operating Models Write', 'Write access to Operating Models sidebar area')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'dimension.read','dimension.write',
  'nav.industries.read','nav.industries.write',
  'nav.business-models.read','nav.business-models.write',
  'nav.operating-models.read','nav.operating-models.write'
)
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'dimension.read',
  'nav.industries.read',
  'nav.business-models.read',
  'nav.operating-models.read'
)
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

grant select, insert, update, delete on app.industries to authenticated;
grant select, insert, update, delete on app.business_models to authenticated;
grant select, insert, update, delete on app.operating_models to authenticated;
grant select, insert, update, delete on app.business_model_industries to authenticated;
grant select, insert, update, delete on app.operating_model_industries to authenticated;
grant select, insert, update, delete on app.operating_model_business_models to authenticated;
grant select, insert, update, delete on app.strategic_direction_industries to authenticated;
grant select, insert, update, delete on app.strategic_direction_business_models to authenticated;
grant select, insert, update, delete on app.strategic_direction_operating_models to authenticated;
grant select, insert, update, delete on app.annual_target_industries to authenticated;
grant select, insert, update, delete on app.annual_target_business_models to authenticated;
grant select, insert, update, delete on app.annual_target_operating_models to authenticated;
grant select, insert, update, delete on app.initiative_industries to authenticated;
grant select, insert, update, delete on app.initiative_business_models to authenticated;
grant select, insert, update, delete on app.initiative_operating_models to authenticated;
grant select, insert, update, delete on app.objective_industries to authenticated;
grant select, insert, update, delete on app.objective_business_models to authenticated;
grant select, insert, update, delete on app.objective_operating_models to authenticated;
grant select, insert, update, delete on app.key_result_industries to authenticated;
grant select, insert, update, delete on app.key_result_business_models to authenticated;
grant select, insert, update, delete on app.key_result_operating_models to authenticated;

grant select on app.industries to anon;
grant select on app.business_models to anon;
grant select on app.operating_models to anon;
grant select on app.business_model_industries to anon;
grant select on app.operating_model_industries to anon;
grant select on app.operating_model_business_models to anon;
grant select on app.strategic_direction_industries to anon;
grant select on app.strategic_direction_business_models to anon;
grant select on app.strategic_direction_operating_models to anon;
grant select on app.annual_target_industries to anon;
grant select on app.annual_target_business_models to anon;
grant select on app.annual_target_operating_models to anon;
grant select on app.initiative_industries to anon;
grant select on app.initiative_business_models to anon;
grant select on app.initiative_operating_models to anon;
grant select on app.objective_industries to anon;
grant select on app.objective_business_models to anon;
grant select on app.objective_operating_models to anon;
grant select on app.key_result_industries to anon;
grant select on app.key_result_business_models to anon;
grant select on app.key_result_operating_models to anon;

alter table app.industries enable row level security;
alter table app.business_models enable row level security;
alter table app.operating_models enable row level security;
alter table app.business_model_industries enable row level security;
alter table app.operating_model_industries enable row level security;
alter table app.operating_model_business_models enable row level security;
alter table app.strategic_direction_industries enable row level security;
alter table app.strategic_direction_business_models enable row level security;
alter table app.strategic_direction_operating_models enable row level security;
alter table app.annual_target_industries enable row level security;
alter table app.annual_target_business_models enable row level security;
alter table app.annual_target_operating_models enable row level security;
alter table app.initiative_industries enable row level security;
alter table app.initiative_business_models enable row level security;
alter table app.initiative_operating_models enable row level security;
alter table app.objective_industries enable row level security;
alter table app.objective_business_models enable row level security;
alter table app.objective_operating_models enable row level security;
alter table app.key_result_industries enable row level security;
alter table app.key_result_business_models enable row level security;
alter table app.key_result_operating_models enable row level security;

drop policy if exists industries_select on app.industries;
create policy industries_select on app.industries
for select using (app.has_permission(organization_id, 'dimension.read'));
drop policy if exists industries_modify on app.industries;
create policy industries_modify on app.industries
for all using (app.has_permission(organization_id, 'dimension.write'))
with check (app.has_permission(organization_id, 'dimension.write'));

drop policy if exists business_models_select on app.business_models;
create policy business_models_select on app.business_models
for select using (app.has_permission(organization_id, 'dimension.read'));
drop policy if exists business_models_modify on app.business_models;
create policy business_models_modify on app.business_models
for all using (app.has_permission(organization_id, 'dimension.write'))
with check (app.has_permission(organization_id, 'dimension.write'));

drop policy if exists operating_models_select on app.operating_models;
create policy operating_models_select on app.operating_models
for select using (app.has_permission(organization_id, 'dimension.read'));
drop policy if exists operating_models_modify on app.operating_models;
create policy operating_models_modify on app.operating_models
for all using (app.has_permission(organization_id, 'dimension.write'))
with check (app.has_permission(organization_id, 'dimension.write'));

drop policy if exists business_model_industries_select on app.business_model_industries;
create policy business_model_industries_select on app.business_model_industries
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists business_model_industries_modify on app.business_model_industries;
create policy business_model_industries_modify on app.business_model_industries
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists operating_model_industries_select on app.operating_model_industries;
create policy operating_model_industries_select on app.operating_model_industries
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists operating_model_industries_modify on app.operating_model_industries;
create policy operating_model_industries_modify on app.operating_model_industries
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists operating_model_business_models_select on app.operating_model_business_models;
create policy operating_model_business_models_select on app.operating_model_business_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists operating_model_business_models_modify on app.operating_model_business_models;
create policy operating_model_business_models_modify on app.operating_model_business_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists strategic_direction_industries_select on app.strategic_direction_industries;
create policy strategic_direction_industries_select on app.strategic_direction_industries
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists strategic_direction_industries_modify on app.strategic_direction_industries;
create policy strategic_direction_industries_modify on app.strategic_direction_industries
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists strategic_direction_business_models_select on app.strategic_direction_business_models;
create policy strategic_direction_business_models_select on app.strategic_direction_business_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists strategic_direction_business_models_modify on app.strategic_direction_business_models;
create policy strategic_direction_business_models_modify on app.strategic_direction_business_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists strategic_direction_operating_models_select on app.strategic_direction_operating_models;
create policy strategic_direction_operating_models_select on app.strategic_direction_operating_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists strategic_direction_operating_models_modify on app.strategic_direction_operating_models;
create policy strategic_direction_operating_models_modify on app.strategic_direction_operating_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists annual_target_industries_select on app.annual_target_industries;
create policy annual_target_industries_select on app.annual_target_industries
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists annual_target_industries_modify on app.annual_target_industries;
create policy annual_target_industries_modify on app.annual_target_industries
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists annual_target_business_models_select on app.annual_target_business_models;
create policy annual_target_business_models_select on app.annual_target_business_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists annual_target_business_models_modify on app.annual_target_business_models;
create policy annual_target_business_models_modify on app.annual_target_business_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists annual_target_operating_models_select on app.annual_target_operating_models;
create policy annual_target_operating_models_select on app.annual_target_operating_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists annual_target_operating_models_modify on app.annual_target_operating_models;
create policy annual_target_operating_models_modify on app.annual_target_operating_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists initiative_industries_select on app.initiative_industries;
create policy initiative_industries_select on app.initiative_industries
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists initiative_industries_modify on app.initiative_industries;
create policy initiative_industries_modify on app.initiative_industries
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists initiative_business_models_select on app.initiative_business_models;
create policy initiative_business_models_select on app.initiative_business_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists initiative_business_models_modify on app.initiative_business_models;
create policy initiative_business_models_modify on app.initiative_business_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists initiative_operating_models_select on app.initiative_operating_models;
create policy initiative_operating_models_select on app.initiative_operating_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists initiative_operating_models_modify on app.initiative_operating_models;
create policy initiative_operating_models_modify on app.initiative_operating_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists objective_industries_select on app.objective_industries;
create policy objective_industries_select on app.objective_industries
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists objective_industries_modify on app.objective_industries;
create policy objective_industries_modify on app.objective_industries
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists objective_business_models_select on app.objective_business_models;
create policy objective_business_models_select on app.objective_business_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists objective_business_models_modify on app.objective_business_models;
create policy objective_business_models_modify on app.objective_business_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists objective_operating_models_select on app.objective_operating_models;
create policy objective_operating_models_select on app.objective_operating_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists objective_operating_models_modify on app.objective_operating_models;
create policy objective_operating_models_modify on app.objective_operating_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists key_result_industries_select on app.key_result_industries;
create policy key_result_industries_select on app.key_result_industries
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists key_result_industries_modify on app.key_result_industries;
create policy key_result_industries_modify on app.key_result_industries
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists key_result_business_models_select on app.key_result_business_models;
create policy key_result_business_models_select on app.key_result_business_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists key_result_business_models_modify on app.key_result_business_models;
create policy key_result_business_models_modify on app.key_result_business_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists key_result_operating_models_select on app.key_result_operating_models;
create policy key_result_operating_models_select on app.key_result_operating_models
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists key_result_operating_models_modify on app.key_result_operating_models;
create policy key_result_operating_models_modify on app.key_result_operating_models
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop trigger if exists trg_audit_industries on app.industries;
create trigger trg_audit_industries
after insert or update or delete on app.industries
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_business_models on app.business_models;
create trigger trg_audit_business_models
after insert or update or delete on app.business_models
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_operating_models on app.operating_models;
create trigger trg_audit_operating_models
after insert or update or delete on app.operating_models
for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_operating_models on app.operating_models;
drop trigger if exists trg_audit_business_models on app.business_models;
drop trigger if exists trg_audit_industries on app.industries;
