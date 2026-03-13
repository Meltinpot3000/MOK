-- 0012_phase0_security_audit.sql
-- Phase 0 security: grants, RLS policies, and audit hooks.
-- migrate:up
grant usage on schema app to authenticated, anon;
grant select, insert, update, delete on app.org_units to authenticated;
grant select, insert, update, delete on app.responsibles to authenticated;
grant select, insert, update, delete on app.responsible_assignments to authenticated;
grant select, insert, update, delete on app.responsible_hierarchy to authenticated;
grant select on app.org_units, app.responsibles, app.responsible_assignments, app.responsible_hierarchy to anon;

alter table app.org_units enable row level security;
alter table app.responsibles enable row level security;
alter table app.responsible_assignments enable row level security;
alter table app.responsible_hierarchy enable row level security;

drop policy if exists org_units_select on app.org_units;
create policy org_units_select on app.org_units
for select using (app.is_member_of_org(organization_id));

drop policy if exists org_units_modify on app.org_units;
create policy org_units_modify on app.org_units
for all using (app.has_permission(organization_id, 'org_unit.manage'))
with check (app.has_permission(organization_id, 'org_unit.manage'));

drop policy if exists responsibles_select on app.responsibles;
create policy responsibles_select on app.responsibles
for select using (app.is_member_of_org(organization_id));

drop policy if exists responsibles_modify on app.responsibles;
create policy responsibles_modify on app.responsibles
for all using (app.has_permission(organization_id, 'responsible.manage'))
with check (app.has_permission(organization_id, 'responsible.manage'));

drop policy if exists responsible_assignments_select on app.responsible_assignments;
create policy responsible_assignments_select on app.responsible_assignments
for select using (app.is_member_of_org(organization_id));

drop policy if exists responsible_assignments_modify on app.responsible_assignments;
create policy responsible_assignments_modify on app.responsible_assignments
for all using (app.has_permission(organization_id, 'responsible.manage'))
with check (app.has_permission(organization_id, 'responsible.manage'));

drop policy if exists responsible_hierarchy_select on app.responsible_hierarchy;
create policy responsible_hierarchy_select on app.responsible_hierarchy
for select using (app.is_member_of_org(organization_id));

drop policy if exists responsible_hierarchy_modify on app.responsible_hierarchy;
create policy responsible_hierarchy_modify on app.responsible_hierarchy
for all using (app.has_permission(organization_id, 'responsible.manage'))
with check (app.has_permission(organization_id, 'responsible.manage'));

drop trigger if exists trg_audit_org_units on app.org_units;
create trigger trg_audit_org_units
after insert or update or delete on app.org_units
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_responsibles on app.responsibles;
create trigger trg_audit_responsibles
after insert or update or delete on app.responsibles
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_responsible_assignments on app.responsible_assignments;
create trigger trg_audit_responsible_assignments
after insert or update or delete on app.responsible_assignments
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_responsible_hierarchy on app.responsible_hierarchy;
create trigger trg_audit_responsible_hierarchy
after insert or update or delete on app.responsible_hierarchy
for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_responsible_hierarchy on app.responsible_hierarchy;
drop trigger if exists trg_audit_responsible_assignments on app.responsible_assignments;
drop trigger if exists trg_audit_responsibles on app.responsibles;
drop trigger if exists trg_audit_org_units on app.org_units;

drop policy if exists responsible_hierarchy_modify on app.responsible_hierarchy;
drop policy if exists responsible_hierarchy_select on app.responsible_hierarchy;
drop policy if exists responsible_assignments_modify on app.responsible_assignments;
drop policy if exists responsible_assignments_select on app.responsible_assignments;
drop policy if exists responsibles_modify on app.responsibles;
drop policy if exists responsibles_select on app.responsibles;
drop policy if exists org_units_modify on app.org_units;
drop policy if exists org_units_select on app.org_units;

alter table app.responsible_hierarchy disable row level security;
alter table app.responsible_assignments disable row level security;
alter table app.responsibles disable row level security;
alter table app.org_units disable row level security;
