-- 0069_review_feedback.sql
-- Review feedback: strategic steering decisions (continue, adjust, stop, escalate, revisit_direction, revisit_objective).
-- migrate:up

create table if not exists app.review_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  feedback_type text not null check (feedback_type in (
    'continue', 'adjust', 'stop', 'escalate', 'revisit_direction', 'revisit_objective'
  )),
  object_type text not null check (object_type in (
    'objective', 'strategic_direction', 'strategy_program', 'initiative', 'key_result'
  )),
  object_id uuid not null,
  comment text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_review_feedback_org_cycle
  on app.review_feedback (organization_id, cycle_instance_id, created_at desc);
create index if not exists idx_review_feedback_object
  on app.review_feedback (object_type, object_id);

alter table app.review_feedback enable row level security;

drop policy if exists review_feedback_select on app.review_feedback;
create policy review_feedback_select on app.review_feedback
  for select using (app.has_permission(organization_id, 'review.read'));

drop policy if exists review_feedback_modify on app.review_feedback;
create policy review_feedback_modify on app.review_feedback
  for all using (app.has_permission(organization_id, 'review.write'))
  with check (app.has_permission(organization_id, 'review.write'));

grant select, insert, update, delete on app.review_feedback to authenticated;
grant select on app.review_feedback to anon;

drop trigger if exists trg_audit_review_feedback on app.review_feedback;
create trigger trg_audit_review_feedback
  after insert or update or delete on app.review_feedback
  for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_review_feedback on app.review_feedback;
drop policy if exists review_feedback_modify on app.review_feedback;
drop policy if exists review_feedback_select on app.review_feedback;
drop table if exists app.review_feedback;
