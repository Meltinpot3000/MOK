-- 0140_okr_completion_review.sql
-- KR-Check-in 100 %: Bestätigung durch Vorgesetzten (completion_review-Task), Feedback, Benachrichtigungen.
-- migrate:up

-- ---------------------------------------------------------------------------
-- 1) okr_updates.verification_status
-- ---------------------------------------------------------------------------

alter table app.okr_updates
  add column if not exists verification_status text;

alter table app.okr_updates drop constraint if exists okr_updates_verification_status_check;

alter table app.okr_updates
  add constraint okr_updates_verification_status_check check (
    verification_status is null
    or verification_status = any (
      array['pending'::text, 'confirmed'::text, 'rejected'::text, 'superseded'::text]
    )
  );

comment on column app.okr_updates.verification_status is
  'NULL = sofort wirksam (<100 %). pending/confirmed/rejected/superseded nur bei 100 %-Meldungen.';

-- ---------------------------------------------------------------------------
-- 2) Vorgesetzten-Feedback am Key Result (Reject)
-- ---------------------------------------------------------------------------

create table if not exists app.key_result_supervisor_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  key_result_id uuid not null references app.key_results (id) on delete cascade,
  okr_update_id uuid references app.okr_updates (id) on delete set null,
  task_id uuid references app.tasks (id) on delete set null,
  author_membership_id uuid not null references app.organization_memberships (id) on delete restrict,
  comment text not null,
  created_at timestamptz not null default now(),
  constraint key_result_supervisor_feedback_comment_nonempty check (char_length(trim(comment)) > 0)
);

create index if not exists idx_kr_supervisor_feedback_org_kr
  on app.key_result_supervisor_feedback (organization_id, key_result_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3) In-App-Benachrichtigungen (Glocke)
-- ---------------------------------------------------------------------------

create table if not exists app.member_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  recipient_membership_id uuid not null references app.organization_memberships (id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  key_result_id uuid references app.key_results (id) on delete set null,
  task_id uuid references app.tasks (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint member_notifications_type_check check (
    notification_type = any (array['kr_completion_rejected'::text])
  )
);

create index if not exists idx_member_notifications_recipient_unread
  on app.member_notifications (organization_id, recipient_membership_id, created_at desc)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- 4) tasks: completion_review
-- ---------------------------------------------------------------------------

alter table app.tasks drop constraint if exists tasks_task_type_check;

alter table app.tasks
  add constraint tasks_task_type_check check (
    task_type = any (array['approval'::text, 'completion_review'::text])
  );

drop index if exists idx_tasks_one_open_completion_review_per_kr;

create unique index idx_tasks_one_open_completion_review_per_kr
  on app.tasks (organization_id, source_object_id)
  where status = 'open' and task_type = 'completion_review' and source_object_type = 'key_result';

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------

alter table app.key_result_supervisor_feedback enable row level security;

drop policy if exists kr_supervisor_feedback_select on app.key_result_supervisor_feedback;

create policy kr_supervisor_feedback_select on app.key_result_supervisor_feedback
for select using (app.has_permission(organization_id, 'okr.read'::text));

drop policy if exists kr_supervisor_feedback_modify on app.key_result_supervisor_feedback;

create policy kr_supervisor_feedback_modify on app.key_result_supervisor_feedback
for all using (false) with check (false);

alter table app.member_notifications enable row level security;

drop policy if exists member_notifications_select on app.member_notifications;

create policy member_notifications_select on app.member_notifications
for select using (
  recipient_membership_id = app.current_membership_id(organization_id)
);

drop policy if exists member_notifications_update on app.member_notifications;

create policy member_notifications_update on app.member_notifications
for update using (
  recipient_membership_id = app.current_membership_id(organization_id)
) with check (
  recipient_membership_id = app.current_membership_id(organization_id)
);

drop policy if exists member_notifications_insert on app.member_notifications;

create policy member_notifications_insert on app.member_notifications
for insert with check (false);

grant select on app.key_result_supervisor_feedback to authenticated;
grant select, update on app.member_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Hilfsfunktion: Objective abschließen wenn alle KRs completed
-- ---------------------------------------------------------------------------

create or replace function app.try_complete_okr_objective_if_all_krs_done(p_okr_objective_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public
as $fn$
declare
  v_org uuid;
  v_status text;
  v_total int;
  v_completed int;
begin
  select organization_id, status
    into v_org, v_status
  from app.okr_objectives
  where id = p_okr_objective_id;

  if v_org is null or v_status is distinct from 'active' and v_status is distinct from 'at_risk' then
    return;
  end if;

  select count(*)::int, count(*) filter (where status = 'completed')::int
    into v_total, v_completed
  from app.key_results
  where okr_objective_id = p_okr_objective_id
    and organization_id = v_org;

  if v_total > 0 and v_total = v_completed then
    update app.okr_objectives
    set status = 'completed', updated_at = now()
    where id = p_okr_objective_id
      and organization_id = v_org;
  end if;
end;
$fn$;

revoke all on function app.try_complete_okr_objective_if_all_krs_done(uuid) from public;
grant execute on function app.try_complete_okr_objective_if_all_krs_done(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Offene Completion-Tasks stornieren + pending Updates superseded
-- ---------------------------------------------------------------------------

create or replace function app.completion_review_cancel_open_for_key_result(
  p_organization_id uuid,
  p_key_result_id uuid,
  p_cancel_reason text default 'superseded_by_new_checkin'
)
returns void
language plpgsql
security definer
set search_path = app, public
as $cancel$
begin
  update app.tasks t
  set
    status = 'cancelled',
    task_payload = coalesce(t.task_payload, '{}'::jsonb) || jsonb_build_object('cancelled_reason', p_cancel_reason),
    updated_at = now()
  where t.organization_id = p_organization_id
    and t.source_object_type = 'key_result'
    and t.source_object_id = p_key_result_id
    and t.task_type = 'completion_review'
    and t.status = 'open';

  update app.okr_updates u
  set verification_status = 'superseded'
  where u.organization_id = p_organization_id
    and u.key_result_id = p_key_result_id
    and u.verification_status = 'pending';
end;
$cancel$;

revoke all on function app.completion_review_cancel_open_for_key_result(uuid, uuid, text) from public;
grant execute on function app.completion_review_cancel_open_for_key_result(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) RPC: Completion-Review-Task eröffnen (nach 100 %-Check-in)
-- ---------------------------------------------------------------------------

create or replace function app.completion_review_submit(
  p_okr_update_id uuid,
  p_key_result_id uuid,
  p_assigned_membership_id uuid,
  p_routing_mode text,
  p_routing_reason text,
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = app, public, rbac
as $submit$
declare
  v_org uuid;
  v_actor uuid;
  v_kr app.key_results%rowtype;
  v_upd app.okr_updates%rowtype;
  v_task_id uuid;
begin
  select * into strict v_upd
  from app.okr_updates
  where id = p_okr_update_id;

  if v_upd.key_result_id is distinct from p_key_result_id then
    raise exception 'completion-invalid-update';
  end if;

  if v_upd.verification_status is distinct from 'pending' then
    raise exception 'completion-update-not-pending';
  end if;

  if v_upd.progress_value is null or v_upd.progress_value < 100 then
    raise exception 'completion-not-hundred-percent';
  end if;

  select * into strict v_kr
  from app.key_results
  where id = p_key_result_id
    and organization_id = v_upd.organization_id;

  v_org := v_upd.organization_id;
  v_actor := app.current_membership_id(v_org);

  if v_actor is null then
    raise exception 'completion-not-organization-member';
  end if;

  if v_upd.created_by_membership_id is distinct from v_actor then
    raise exception 'completion-forbidden';
  end if;

  if not exists (
    select 1 from app.organization_memberships m
    where m.id = p_assigned_membership_id
      and m.organization_id = v_org
      and m.status = 'active'
  ) then
    raise exception 'completion-invalid-assignee';
  end if;

  perform app.completion_review_cancel_open_for_key_result(v_org, p_key_result_id, 'superseded_by_new_hundred_checkin');

  insert into app.tasks (
    organization_id,
    task_type,
    title,
    description,
    status,
    priority,
    assigned_membership_id,
    created_by_membership_id,
    source_object_type,
    source_object_id,
    routing_mode,
    routing_reason,
    task_payload
  ) values (
    v_org,
    'completion_review',
    coalesce(nullif(trim(p_title), ''), 'KR-Abschluss bestätigen'),
    p_description,
    'open',
    'normal',
    p_assigned_membership_id,
    v_actor,
    'key_result',
    p_key_result_id,
    p_routing_mode,
    p_routing_reason,
    jsonb_build_object('okr_update_id', p_okr_update_id)
  )
  returning id into v_task_id;

  return v_task_id;
end;
$submit$;

revoke all on function app.completion_review_submit(uuid, uuid, uuid, text, text, text, text) from public;
grant execute on function app.completion_review_submit(uuid, uuid, uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) RPC: Entscheid (Approve / Reject)
-- ---------------------------------------------------------------------------

create or replace function app.completion_review_decide_task(
  p_task_id uuid,
  p_decision text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = app, public, rbac
as $decide$
declare
  trec app.tasks%rowtype;
  v_actor uuid;
  v_update_id uuid;
  v_kr app.key_results%rowtype;
  v_submitter uuid;
  v_kr_title text;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'completion-invalid-decision';
  end if;

  select * into strict trec from app.tasks where id = p_task_id;

  if trec.status is distinct from 'open' then
    raise exception 'completion-task-not-open';
  end if;

  if trec.task_type is distinct from 'completion_review' then
    raise exception 'completion-task-wrong-type';
  end if;

  if trec.source_object_type is distinct from 'key_result' then
    raise exception 'completion-invalid-source-type';
  end if;

  v_actor := app.current_membership_id(trec.organization_id);
  if v_actor is null or v_actor is distinct from trec.assigned_membership_id then
    raise exception 'completion-decide-not-assignee';
  end if;

  v_update_id := nullif(trec.task_payload ->> 'okr_update_id', '')::uuid;
  if v_update_id is null then
    raise exception 'completion-missing-update-id';
  end if;

  select * into strict v_kr
  from app.key_results
  where id = trec.source_object_id
    and organization_id = trec.organization_id;

  v_kr_title := coalesce(nullif(trim(v_kr.title), ''), 'Key Result');

  select created_by_membership_id into v_submitter
  from app.okr_updates
  where id = v_update_id;

  if p_decision = 'approve' then
    update app.okr_updates
    set verification_status = 'confirmed'
    where id = v_update_id
      and organization_id = trec.organization_id;

    update app.key_results
    set status = 'completed', updated_at = now()
    where id = v_kr.id
      and organization_id = trec.organization_id;

    perform app.try_complete_okr_objective_if_all_krs_done(v_kr.okr_objective_id);

    update app.tasks tk
    set
      status = 'completed',
      completed_at = now(),
      completed_by_membership_id = v_actor,
      decision_comment = nullif(trim(p_comment), ''),
      updated_at = now()
    where tk.id = p_task_id;

  else
    if p_comment is null or char_length(trim(p_comment)) = 0 then
      raise exception 'completion-reject-comment-required';
    end if;

    update app.okr_updates
    set verification_status = 'rejected'
    where id = v_update_id
      and organization_id = trec.organization_id;

    insert into app.key_result_supervisor_feedback (
      organization_id,
      key_result_id,
      okr_update_id,
      task_id,
      author_membership_id,
      comment
    ) values (
      trec.organization_id,
      v_kr.id,
      v_update_id,
      p_task_id,
      v_actor,
      trim(p_comment)
    );

    if v_submitter is not null then
      insert into app.member_notifications (
        organization_id,
        recipient_membership_id,
        notification_type,
        title,
        body,
        key_result_id,
        task_id
      ) values (
        trec.organization_id,
        v_submitter,
        'kr_completion_rejected',
        '100 % nicht bestätigt',
        format('Vorgesetzte/r hat deine 100-%%-Meldung für «%s» abgelehnt: %s', v_kr_title, trim(p_comment)),
        v_kr.id,
        p_task_id
      );
    end if;

    update app.tasks tk
    set
      status = 'completed',
      completed_at = now(),
      completed_by_membership_id = v_actor,
      decision_comment = trim(p_comment),
      updated_at = now()
    where tk.id = p_task_id;
  end if;
end;
$decide$;

revoke all on function app.completion_review_decide_task(uuid, text, text) from public;
grant execute on function app.completion_review_decide_task(uuid, text, text) to authenticated;

-- migrate:down

drop function if exists app.completion_review_decide_task(uuid, text, text);
drop function if exists app.completion_review_submit(uuid, uuid, uuid, text, text, text, text);
drop function if exists app.completion_review_cancel_open_for_key_result(uuid, uuid, text);
drop function if exists app.try_complete_okr_objective_if_all_krs_done(uuid);

drop policy if exists member_notifications_insert on app.member_notifications;
drop policy if exists member_notifications_update on app.member_notifications;
drop policy if exists member_notifications_select on app.member_notifications;
drop table if exists app.member_notifications;

drop policy if exists kr_supervisor_feedback_modify on app.key_result_supervisor_feedback;
drop policy if exists kr_supervisor_feedback_select on app.key_result_supervisor_feedback;
drop table if exists app.key_result_supervisor_feedback;

drop index if exists idx_tasks_one_open_completion_review_per_kr;

alter table app.tasks drop constraint if exists tasks_task_type_check;
alter table app.tasks
  add constraint tasks_task_type_check check (task_type = any (array['approval'::text]));

alter table app.okr_updates drop constraint if exists okr_updates_verification_status_check;
alter table app.okr_updates drop column if exists verification_status;
