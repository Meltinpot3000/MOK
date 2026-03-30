-- 0112_okr_review_session_task_assignee.sql
-- Tabelle okr_review_session_tasks idempotent anlegen (falls 0108 nie lief) + Verantwortliche.
-- migrate:up

create table if not exists app.okr_review_session_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  okr_review_session_id uuid not null references app.okr_review_sessions(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  assignee_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app.okr_review_session_tasks
  add column if not exists assignee_membership_id uuid references app.organization_memberships(id) on delete set null;

comment on column app.okr_review_session_tasks.assignee_membership_id is
  'Verantwortliche Person (Mitgliedschaft) fuer die Meeting-Aufgabe.';

create index if not exists idx_okr_review_session_tasks_session_sort
  on app.okr_review_session_tasks (okr_review_session_id, sort_order);

create index if not exists idx_okr_review_session_tasks_assignee
  on app.okr_review_session_tasks (assignee_membership_id)
  where assignee_membership_id is not null;

drop trigger if exists trg_okr_review_session_tasks_updated_at on app.okr_review_session_tasks;
create trigger trg_okr_review_session_tasks_updated_at
before update on app.okr_review_session_tasks
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.okr_review_session_tasks to authenticated;
grant select on app.okr_review_session_tasks to anon;

alter table app.okr_review_session_tasks enable row level security;

drop policy if exists okr_review_session_tasks_select on app.okr_review_session_tasks;
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

drop policy if exists okr_review_session_tasks_insert on app.okr_review_session_tasks;
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

drop policy if exists okr_review_session_tasks_update on app.okr_review_session_tasks;
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

drop policy if exists okr_review_session_tasks_delete on app.okr_review_session_tasks;
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

-- migrate:down

drop index if exists app.idx_okr_review_session_tasks_assignee;
alter table app.okr_review_session_tasks drop column if exists assignee_membership_id;
