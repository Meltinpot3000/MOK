-- 0013_phase0_member_invitations.sql
-- Invitation workflow for admin-managed onboarding.
-- migrate:up

create table if not exists app.member_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  invited_email text not null,
  role_code text not null default 'team_member',
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_member_invitations_updated_at
before update on app.member_invitations
for each row execute function app.set_updated_at();

create index if not exists idx_member_invitations_org_status
  on app.member_invitations (organization_id, status, created_at desc);

create index if not exists idx_member_invitations_email
  on app.member_invitations (lower(invited_email));

grant select, insert, update, delete on app.member_invitations to authenticated;
grant select on app.member_invitations to anon;

alter table app.member_invitations enable row level security;

drop policy if exists member_invitations_admin_manage on app.member_invitations;
create policy member_invitations_admin_manage on app.member_invitations
for all
using (app.has_permission(organization_id, 'membership.manage'))
with check (app.has_permission(organization_id, 'membership.manage'));

drop policy if exists member_invitations_invitee_select on app.member_invitations;
create policy member_invitations_invitee_select on app.member_invitations
for select
using (
  lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists member_invitations_invitee_accept on app.member_invitations;
create policy member_invitations_invitee_accept on app.member_invitations
for update
using (
  lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and status = 'pending'
)
with check (
  lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and status in ('pending', 'accepted')
);

-- migrate:down
drop policy if exists member_invitations_invitee_accept on app.member_invitations;
drop policy if exists member_invitations_invitee_select on app.member_invitations;
drop policy if exists member_invitations_admin_manage on app.member_invitations;
drop trigger if exists trg_member_invitations_updated_at on app.member_invitations;
drop table if exists app.member_invitations;
