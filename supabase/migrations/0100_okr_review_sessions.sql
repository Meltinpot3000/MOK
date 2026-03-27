-- 0100_okr_review_sessions.sql
-- migrate:up

insert into rbac.permissions (code, name, description)
values
  (
    'okr.review.workspace.read',
    'OKR Review Workspace Read',
    'Review-Sessions lesen'
  ),
  (
    'okr.review.session.manage',
    'OKR Review Session Manage',
    'Sessions anlegen und loeschen'
  )
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('okr.review.workspace.read', 'okr.review.session.manage')
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code = 'okr.review.workspace.read'
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('okr.review.workspace.read', 'okr.review.session.manage')
where r.code = 'department_lead'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code = 'okr.review.workspace.read'
where r.code = 'team_member'
on conflict (role_id, permission_id) do nothing;

create table app.okr_review_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  okr_cycle_id uuid not null references app.okr_cycles(id) on delete cascade,
  title text not null default '',
  session_type text not null
    constraint okr_review_sessions_session_type_check check (
      session_type = any (array['mid_cycle'::text, 'end_of_cycle'::text])
    ),
  status text not null default 'draft'::text
    constraint okr_review_sessions_status_check check (
      status = any (
        array[
          'draft'::text,
          'scheduled'::text,
          'in_progress'::text,
          'completed'::text,
          'cancelled'::text
        ]
      )
    ),
  scheduled_at timestamptz,
  facilitator_membership_id uuid references app.organization_memberships(id) on delete set null,
  summary text,
  meeting_notes text,
  discussion_notes text,
  decisions_next_steps text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_okr_review_sessions_org_cycle_instance_okr
  on app.okr_review_sessions (organization_id, cycle_instance_id, okr_cycle_id);

create index idx_okr_review_sessions_org_scheduled
  on app.okr_review_sessions (organization_id, scheduled_at);

create trigger trg_okr_review_sessions_updated_at
before update on app.okr_review_sessions
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.okr_review_sessions to authenticated;
grant select on app.okr_review_sessions to anon;

alter table app.okr_review_sessions enable row level security;

create policy okr_review_sessions_select on app.okr_review_sessions
for select using (
  app.has_permission(organization_id, 'nav.okr-workspace.read'::text)
  or app.has_permission(organization_id, 'okr.review.workspace.read'::text)
  or app.has_permission(organization_id, 'okr.read'::text)
);

create policy okr_review_sessions_insert on app.okr_review_sessions
for insert with check (
  app.has_permission(organization_id, 'okr.review.session.manage'::text)
);

create policy okr_review_sessions_update on app.okr_review_sessions
for update using (
  app.has_permission(organization_id, 'okr.review.session.manage'::text)
  or facilitator_membership_id = app._strategy_review_current_membership(organization_id)
)
with check (
  app.has_permission(organization_id, 'okr.review.session.manage'::text)
  or facilitator_membership_id = app._strategy_review_current_membership(organization_id)
);

create policy okr_review_sessions_delete on app.okr_review_sessions
for delete using (app.has_permission(organization_id, 'okr.review.session.manage'::text));

-- migrate:down
drop trigger if exists trg_okr_review_sessions_updated_at on app.okr_review_sessions;
drop policy if exists okr_review_sessions_delete on app.okr_review_sessions;
drop policy if exists okr_review_sessions_update on app.okr_review_sessions;
drop policy if exists okr_review_sessions_insert on app.okr_review_sessions;
drop policy if exists okr_review_sessions_select on app.okr_review_sessions;
drop table if exists app.okr_review_sessions cascade;
delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions where code in ('okr.review.workspace.read', 'okr.review.session.manage')
);
delete from rbac.permissions
where code in ('okr.review.workspace.read', 'okr.review.session.manage');