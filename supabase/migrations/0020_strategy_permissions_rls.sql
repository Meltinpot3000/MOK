-- 0020_strategy_permissions_rls.sql
-- Permission catalog + RLS policies for new strategy/execution entities.
-- migrate:up

insert into rbac.permissions (code, name, description)
values
  ('metric.read', 'Strategic Metrics Read', 'Read strategic metrics'),
  ('metric.write', 'Strategic Metrics Write', 'Create and update strategic metrics'),
  ('challenge.read', 'Strategic Challenges Read', 'Read strategic challenges'),
  ('challenge.write', 'Strategic Challenges Write', 'Create and update strategic challenges'),
  ('direction.read', 'Strategic Directions Read', 'Read strategic directions'),
  ('direction.write', 'Strategic Directions Write', 'Create and update strategic directions'),
  ('target.read', 'Annual Targets Read', 'Read annual targets'),
  ('target.write', 'Annual Targets Write', 'Create and update annual targets'),
  ('initiative.read', 'Initiatives Read', 'Read initiatives'),
  ('initiative.write', 'Initiatives Write', 'Create and update initiatives'),
  ('okr.read', 'OKR Read', 'Read OKR cycles, objectives, key results and updates'),
  ('okr.write', 'OKR Write', 'Create and update OKR cycles, objectives, key results and updates'),
  ('review.read', 'Reviews Read', 'Read review/retrospective data'),
  ('review.write', 'Reviews Write', 'Create and update review/retrospective data'),
  ('traceability.read', 'Traceability Read', 'Read strategy traceability links'),
  ('traceability.write', 'Traceability Write', 'Create and update strategy traceability links')
on conflict (code) do nothing;

-- grant all new strategy permissions to org_admin
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'metric.read','metric.write','challenge.read','challenge.write','direction.read','direction.write',
  'target.read','target.write','initiative.read','initiative.write','okr.read','okr.write',
  'review.read','review.write','traceability.read','traceability.write'
)
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

-- read defaults for executive
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'metric.read','challenge.read','direction.read','target.read','initiative.read',
  'okr.read','review.read','traceability.read'
)
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

grant select, insert, update, delete on app.strategic_metrics to authenticated;
grant select on app.strategic_metrics to anon;
grant select, insert, update, delete on app.initiatives to authenticated;
grant select on app.initiatives to anon;
grant select, insert, update, delete on app.okr_cycles to authenticated;
grant select on app.okr_cycles to anon;
grant select, insert, update, delete on app.direction_metric_links to authenticated;
grant select on app.direction_metric_links to anon;
grant select, insert, update, delete on app.target_metric_links to authenticated;
grant select on app.target_metric_links to anon;
grant select, insert, update, delete on app.initiative_target_links to authenticated;
grant select on app.initiative_target_links to anon;
grant select, insert, update, delete on app.objective_target_links to authenticated;
grant select on app.objective_target_links to anon;
grant select, insert, update, delete on app.objective_direction_links to authenticated;
grant select on app.objective_direction_links to anon;
grant select, insert, update, delete on app.key_result_target_links to authenticated;
grant select on app.key_result_target_links to anon;
grant select, insert, update, delete on app.responsibility_assignments to authenticated;
grant select on app.responsibility_assignments to anon;
grant select, insert, update, delete on app.okr_updates to authenticated;
grant select on app.okr_updates to anon;
grant select, insert, update, delete on app.okr_reviews to authenticated;
grant select on app.okr_reviews to anon;

alter table app.strategic_metrics enable row level security;
alter table app.initiatives enable row level security;
alter table app.okr_cycles enable row level security;
alter table app.direction_metric_links enable row level security;
alter table app.target_metric_links enable row level security;
alter table app.initiative_target_links enable row level security;
alter table app.objective_target_links enable row level security;
alter table app.objective_direction_links enable row level security;
alter table app.key_result_target_links enable row level security;
alter table app.responsibility_assignments enable row level security;
alter table app.okr_updates enable row level security;
alter table app.okr_reviews enable row level security;

drop policy if exists strategic_metrics_select on app.strategic_metrics;
create policy strategic_metrics_select on app.strategic_metrics
for select using (app.has_permission(organization_id, 'metric.read'));
drop policy if exists strategic_metrics_modify on app.strategic_metrics;
create policy strategic_metrics_modify on app.strategic_metrics
for all using (app.has_permission(organization_id, 'metric.write'))
with check (app.has_permission(organization_id, 'metric.write'));

drop policy if exists initiatives_select on app.initiatives;
create policy initiatives_select on app.initiatives
for select using (app.has_permission(organization_id, 'initiative.read'));
drop policy if exists initiatives_modify on app.initiatives;
create policy initiatives_modify on app.initiatives
for all using (app.has_permission(organization_id, 'initiative.write'))
with check (app.has_permission(organization_id, 'initiative.write'));

drop policy if exists okr_cycles_select on app.okr_cycles;
create policy okr_cycles_select on app.okr_cycles
for select using (app.has_permission(organization_id, 'okr.read'));
drop policy if exists okr_cycles_modify on app.okr_cycles;
create policy okr_cycles_modify on app.okr_cycles
for all using (app.has_permission(organization_id, 'okr.write'))
with check (app.has_permission(organization_id, 'okr.write'));

drop policy if exists direction_metric_links_select on app.direction_metric_links;
create policy direction_metric_links_select on app.direction_metric_links
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists direction_metric_links_modify on app.direction_metric_links;
create policy direction_metric_links_modify on app.direction_metric_links
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists target_metric_links_select on app.target_metric_links;
create policy target_metric_links_select on app.target_metric_links
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists target_metric_links_modify on app.target_metric_links;
create policy target_metric_links_modify on app.target_metric_links
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists initiative_target_links_select on app.initiative_target_links;
create policy initiative_target_links_select on app.initiative_target_links
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists initiative_target_links_modify on app.initiative_target_links;
create policy initiative_target_links_modify on app.initiative_target_links
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists objective_target_links_select on app.objective_target_links;
create policy objective_target_links_select on app.objective_target_links
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists objective_target_links_modify on app.objective_target_links;
create policy objective_target_links_modify on app.objective_target_links
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists objective_direction_links_select on app.objective_direction_links;
create policy objective_direction_links_select on app.objective_direction_links
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists objective_direction_links_modify on app.objective_direction_links;
create policy objective_direction_links_modify on app.objective_direction_links
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists key_result_target_links_select on app.key_result_target_links;
create policy key_result_target_links_select on app.key_result_target_links
for select using (app.has_permission(organization_id, 'traceability.read'));
drop policy if exists key_result_target_links_modify on app.key_result_target_links;
create policy key_result_target_links_modify on app.key_result_target_links
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists responsibility_assignments_select on app.responsibility_assignments;
create policy responsibility_assignments_select on app.responsibility_assignments
for select using (app.is_member_of_org(organization_id));
drop policy if exists responsibility_assignments_modify on app.responsibility_assignments;
create policy responsibility_assignments_modify on app.responsibility_assignments
for all using (app.has_permission(organization_id, 'admin.manage_roles'))
with check (app.has_permission(organization_id, 'admin.manage_roles'));

drop policy if exists okr_updates_select on app.okr_updates;
create policy okr_updates_select on app.okr_updates
for select using (app.has_permission(organization_id, 'okr.read'));
drop policy if exists okr_updates_modify on app.okr_updates;
create policy okr_updates_modify on app.okr_updates
for all using (app.has_permission(organization_id, 'okr.write'))
with check (app.has_permission(organization_id, 'okr.write'));

drop policy if exists okr_reviews_select on app.okr_reviews;
create policy okr_reviews_select on app.okr_reviews
for select using (app.has_permission(organization_id, 'review.read'));
drop policy if exists okr_reviews_modify on app.okr_reviews;
create policy okr_reviews_modify on app.okr_reviews
for all using (app.has_permission(organization_id, 'review.write'))
with check (app.has_permission(organization_id, 'review.write'));

drop trigger if exists trg_audit_strategic_metrics on app.strategic_metrics;
create trigger trg_audit_strategic_metrics
after insert or update or delete on app.strategic_metrics
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_initiatives on app.initiatives;
create trigger trg_audit_initiatives
after insert or update or delete on app.initiatives
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_okr_cycles on app.okr_cycles;
create trigger trg_audit_okr_cycles
after insert or update or delete on app.okr_cycles
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_annual_targets on app.annual_targets;
create trigger trg_audit_annual_targets
after insert or update or delete on app.annual_targets
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_okr_updates on app.okr_updates;
create trigger trg_audit_okr_updates
after insert or update or delete on app.okr_updates
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_okr_reviews on app.okr_reviews;
create trigger trg_audit_okr_reviews
after insert or update or delete on app.okr_reviews
for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_okr_reviews on app.okr_reviews;
drop trigger if exists trg_audit_okr_updates on app.okr_updates;
drop trigger if exists trg_audit_annual_targets on app.annual_targets;
drop trigger if exists trg_audit_okr_cycles on app.okr_cycles;
drop trigger if exists trg_audit_initiatives on app.initiatives;
drop trigger if exists trg_audit_strategic_metrics on app.strategic_metrics;

drop policy if exists okr_reviews_modify on app.okr_reviews;
drop policy if exists okr_reviews_select on app.okr_reviews;
drop policy if exists okr_updates_modify on app.okr_updates;
drop policy if exists okr_updates_select on app.okr_updates;
drop policy if exists responsibility_assignments_modify on app.responsibility_assignments;
drop policy if exists responsibility_assignments_select on app.responsibility_assignments;
drop policy if exists key_result_target_links_modify on app.key_result_target_links;
drop policy if exists key_result_target_links_select on app.key_result_target_links;
drop policy if exists objective_direction_links_modify on app.objective_direction_links;
drop policy if exists objective_direction_links_select on app.objective_direction_links;
drop policy if exists objective_target_links_modify on app.objective_target_links;
drop policy if exists objective_target_links_select on app.objective_target_links;
drop policy if exists initiative_target_links_modify on app.initiative_target_links;
drop policy if exists initiative_target_links_select on app.initiative_target_links;
drop policy if exists target_metric_links_modify on app.target_metric_links;
drop policy if exists target_metric_links_select on app.target_metric_links;
drop policy if exists direction_metric_links_modify on app.direction_metric_links;
drop policy if exists direction_metric_links_select on app.direction_metric_links;
drop policy if exists okr_cycles_modify on app.okr_cycles;
drop policy if exists okr_cycles_select on app.okr_cycles;
drop policy if exists initiatives_modify on app.initiatives;
drop policy if exists initiatives_select on app.initiatives;
drop policy if exists strategic_metrics_modify on app.strategic_metrics;
drop policy if exists strategic_metrics_select on app.strategic_metrics;
