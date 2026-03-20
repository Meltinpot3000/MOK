-- 0067_review_cycle_schema.sql
-- Review Cycle: objective health override, initiative execution health, program status, review snapshots.
-- migrate:up

-- 1.1 Objective Health Layer (override only; derived values computed on demand)
alter table app.objectives
  add column if not exists objective_health_override text
    check (objective_health_override is null or objective_health_override in ('on_track', 'at_risk', 'off_track')),
  add column if not exists objective_health_override_by_membership_id uuid
    references app.organization_memberships(id) on delete set null,
  add column if not exists objective_health_override_at timestamptz,
  add column if not exists objective_review_comment text;

-- 1.3 Initiative Review Layer (override for execution health; measures execution confidence, not strategic success)
alter table app.initiatives
  add column if not exists execution_health_override text
    check (execution_health_override is null or execution_health_override in ('on_track', 'at_risk', 'off_track')),
  add column if not exists execution_health_override_by_membership_id uuid
    references app.organization_memberships(id) on delete set null,
  add column if not exists execution_health_override_at timestamptz,
  add column if not exists review_comment text;

-- 1.4 Program Review Layer (status = lifecycle; review_health derived, not persisted)
alter table app.strategy_programs
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'archived')),
  add column if not exists review_comment text;

-- 1.5 Strategic Direction Performance Layer (review_comment only; performance derived)
alter table app.strategic_directions
  add column if not exists review_comment text;

-- 1.6 Review Snapshots (lean MVP: summary_json only, no review_snapshot_items)
create table if not exists app.review_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  snapshot_type text not null check (snapshot_type in ('periodic', 'ad_hoc', 'quarterly')),
  snapshot_at timestamptz not null default now(),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  summary_json jsonb,
  comment text
);

create index if not exists idx_review_snapshots_org_cycle
  on app.review_snapshots (organization_id, cycle_instance_id, snapshot_at desc);

-- RLS and grants for review_snapshots
alter table app.review_snapshots enable row level security;

drop policy if exists review_snapshots_select on app.review_snapshots;
create policy review_snapshots_select on app.review_snapshots
  for select using (app.has_permission(organization_id, 'review.read'));

drop policy if exists review_snapshots_modify on app.review_snapshots;
create policy review_snapshots_modify on app.review_snapshots
  for all using (app.has_permission(organization_id, 'review.write'))
  with check (app.has_permission(organization_id, 'review.write'));

grant select, insert, update, delete on app.review_snapshots to authenticated;
grant select on app.review_snapshots to anon;

drop trigger if exists trg_audit_review_snapshots on app.review_snapshots;
create trigger trg_audit_review_snapshots
  after insert or update or delete on app.review_snapshots
  for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_review_snapshots on app.review_snapshots;
drop policy if exists review_snapshots_modify on app.review_snapshots;
drop policy if exists review_snapshots_select on app.review_snapshots;
drop table if exists app.review_snapshots;

alter table app.strategic_directions drop column if exists review_comment;
alter table app.strategy_programs drop column if exists review_comment;
alter table app.strategy_programs drop column if exists status;

alter table app.initiatives drop column if exists review_comment;
alter table app.initiatives drop column if exists execution_health_override_at;
alter table app.initiatives drop column if exists execution_health_override_by_membership_id;
alter table app.initiatives drop column if exists execution_health_override;

alter table app.objectives drop column if exists objective_review_comment;
alter table app.objectives drop column if exists objective_health_override_at;
alter table app.objectives drop column if exists objective_health_override_by_membership_id;
alter table app.objectives drop column if exists objective_health_override;
