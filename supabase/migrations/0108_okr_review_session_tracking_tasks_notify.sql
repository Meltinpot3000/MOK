-- 0108_okr_review_session_tracking_tasks_notify.sql
-- migrate:up

alter table app.organizations
  add column if not exists okr_review_notify_owners_on_schedule boolean not null default false;

comment on column app.organizations.okr_review_notify_owners_on_schedule is
  'Wenn true: Beim Planen einer OKR-Review-Session werden OKR-Owner benachrichtigt (Versand über App, sobald Provider vorhanden).';

alter table app.okr_review_sessions
  add column if not exists check_in_tracking_baseline_at timestamptz,
  add column if not exists started_at timestamptz;

comment on column app.okr_review_sessions.check_in_tracking_baseline_at is
  'Zeitpunkt ab dem Check-ins für das Session-Check-in-Tracking gezählt werden (bei Übergang zu geplant gesetzt).';

comment on column app.okr_review_sessions.started_at is
  'Zeitpunkt des Übergangs zu in_progress (Meeting gestartet).';

create table app.okr_review_session_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  okr_review_session_id uuid not null references app.okr_review_sessions(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_okr_review_session_tasks_session_sort
  on app.okr_review_session_tasks (okr_review_session_id, sort_order);

create trigger trg_okr_review_session_tasks_updated_at
before update on app.okr_review_session_tasks
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.okr_review_session_tasks to authenticated;
grant select on app.okr_review_session_tasks to anon;

alter table app.okr_review_session_tasks enable row level security;

create policy okr_review_session_tasks_select on app.okr_review_session_tasks
for select using (
  exists (
    select 1
    from app.okr_review_sessions s
    where s.id = okr_review_session_tasks.okr_review_session_id
      and (
        app.has_permission(s.organization_id, 'nav.okr-workspace.read'::text)
        or app.has_permission(s.organization_id, 'okr.review.workspace.read'::text)
        or app.has_permission(s.organization_id, 'okr.read'::text)
      )
  )
);

create policy okr_review_session_tasks_insert on app.okr_review_session_tasks
for insert with check (
  exists (
    select 1
    from app.okr_review_sessions s
    where s.id = okr_review_session_tasks.okr_review_session_id
      and s.organization_id = okr_review_session_tasks.organization_id
      and (
        app.has_permission(s.organization_id, 'okr.review.session.manage'::text)
        or s.facilitator_membership_id = app._strategy_review_current_membership(s.organization_id)
      )
  )
);

create policy okr_review_session_tasks_update on app.okr_review_session_tasks
for update using (
  exists (
    select 1
    from app.okr_review_sessions s
    where s.id = okr_review_session_tasks.okr_review_session_id
      and (
        app.has_permission(s.organization_id, 'okr.review.session.manage'::text)
        or s.facilitator_membership_id = app._strategy_review_current_membership(s.organization_id)
      )
  )
)
with check (
  exists (
    select 1
    from app.okr_review_sessions s
    where s.id = okr_review_session_tasks.okr_review_session_id
      and s.organization_id = okr_review_session_tasks.organization_id
      and (
        app.has_permission(s.organization_id, 'okr.review.session.manage'::text)
        or s.facilitator_membership_id = app._strategy_review_current_membership(s.organization_id)
      )
  )
);

create policy okr_review_session_tasks_delete on app.okr_review_session_tasks
for delete using (
  exists (
    select 1
    from app.okr_review_sessions s
    where s.id = okr_review_session_tasks.okr_review_session_id
      and (
        app.has_permission(s.organization_id, 'okr.review.session.manage'::text)
        or s.facilitator_membership_id = app._strategy_review_current_membership(s.organization_id)
      )
  )
);

update app.okr_review_sessions
set check_in_tracking_baseline_at = coalesce(scheduled_at, updated_at, created_at)
where status = 'scheduled'
  and check_in_tracking_baseline_at is null;

-- migrate:down
drop policy if exists okr_review_session_tasks_delete on app.okr_review_session_tasks;
drop policy if exists okr_review_session_tasks_update on app.okr_review_session_tasks;
drop policy if exists okr_review_session_tasks_insert on app.okr_review_session_tasks;
drop policy if exists okr_review_session_tasks_select on app.okr_review_session_tasks;
drop trigger if exists trg_okr_review_session_tasks_updated_at on app.okr_review_session_tasks;
drop table if exists app.okr_review_session_tasks;

alter table app.okr_review_sessions
  drop column if exists started_at,
  drop column if exists check_in_tracking_baseline_at;

alter table app.organizations
  drop column if exists okr_review_notify_owners_on_schedule;
