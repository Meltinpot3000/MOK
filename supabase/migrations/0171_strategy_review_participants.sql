-- 0171_strategy_review_participants.sql
-- Beteiligte am formellen Strategie-Review inkl. Review-Rolle.

-- migrate:up

create table if not exists app.strategy_review_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  review_id uuid not null references app.okr_reviews(id) on delete cascade,
  membership_id uuid not null references app.organization_memberships(id) on delete cascade,
  review_role text not null
    constraint strategy_review_participants_role_check check (
      review_role = any (
        array[
          'lead'::text,
          'stakeholder'::text,
          'decision_maker'::text,
          'contributor'::text,
          'observer'::text
        ]
      )
    ),
  invited_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_review_participants_review_membership_uq unique (review_id, membership_id)
);

create index if not exists idx_strategy_review_participants_review
  on app.strategy_review_participants (review_id, invited_at desc);

create index if not exists idx_strategy_review_participants_membership
  on app.strategy_review_participants (membership_id);

create or replace function app.tg_strategy_review_participants_sync()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_org uuid;
  v_mode text;
begin
  select r.organization_id, r.review_mode
    into v_org, v_mode
  from app.okr_reviews r
  where r.id = new.review_id;

  if v_org is null then
    raise exception 'strategy_review_participants: invalid review_id';
  end if;
  if v_mode is distinct from 'strategy_review' then
    raise exception 'strategy_review_participants: review must be strategy_review';
  end if;

  new.organization_id := v_org;

  if not exists (
    select 1
    from app.organization_memberships m
    where m.id = new.membership_id
      and m.organization_id = v_org
      and m.status in ('active', 'invited')
  ) then
    raise exception 'strategy_review_participants: membership not in organization';
  end if;

  if new.invited_by_membership_id is not null
     and not exists (
       select 1
       from app.organization_memberships m
       where m.id = new.invited_by_membership_id
         and m.organization_id = v_org
     ) then
    raise exception 'strategy_review_participants: invited_by not in organization';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_strategy_review_participants_sync on app.strategy_review_participants;
create trigger trg_strategy_review_participants_sync
  before insert or update of review_id, membership_id, invited_by_membership_id
  on app.strategy_review_participants
  for each row execute function app.tg_strategy_review_participants_sync();

drop trigger if exists trg_audit_strategy_review_participants on app.strategy_review_participants;
create trigger trg_audit_strategy_review_participants
  after insert or update or delete on app.strategy_review_participants
  for each row execute function audit.log_row_change();

drop trigger if exists trg_strategy_review_participants_updated_at on app.strategy_review_participants;
create trigger trg_strategy_review_participants_updated_at
  before update on app.strategy_review_participants
  for each row execute function app.set_updated_at();

alter table app.strategy_review_participants enable row level security;

drop policy if exists strategy_review_participants_select on app.strategy_review_participants;
create policy strategy_review_participants_select on app.strategy_review_participants
  for select using (app.has_permission(organization_id, 'review.read'));

drop policy if exists strategy_review_participants_insert on app.strategy_review_participants;
create policy strategy_review_participants_insert on app.strategy_review_participants
  for insert with check (app.has_permission(organization_id, 'strategy_review.moderate'));

drop policy if exists strategy_review_participants_update on app.strategy_review_participants;
create policy strategy_review_participants_update on app.strategy_review_participants
  for update using (app.has_permission(organization_id, 'strategy_review.moderate'))
  with check (app.has_permission(organization_id, 'strategy_review.moderate'));

drop policy if exists strategy_review_participants_delete on app.strategy_review_participants;
create policy strategy_review_participants_delete on app.strategy_review_participants
  for delete using (app.has_permission(organization_id, 'strategy_review.moderate'));

grant select, insert, update, delete on app.strategy_review_participants to authenticated;
grant select on app.strategy_review_participants to anon;

comment on table app.strategy_review_participants is
  'Personen mit Review-Rolle am formellen Strategie-Review (nicht Org-RBAC).';

-- migrate:down

drop policy if exists strategy_review_participants_delete on app.strategy_review_participants;
drop policy if exists strategy_review_participants_update on app.strategy_review_participants;
drop policy if exists strategy_review_participants_insert on app.strategy_review_participants;
drop policy if exists strategy_review_participants_select on app.strategy_review_participants;
drop trigger if exists trg_strategy_review_participants_updated_at on app.strategy_review_participants;
drop trigger if exists trg_audit_strategy_review_participants on app.strategy_review_participants;
drop trigger if exists trg_strategy_review_participants_sync on app.strategy_review_participants;
drop function if exists app.tg_strategy_review_participants_sync();
drop table if exists app.strategy_review_participants;
