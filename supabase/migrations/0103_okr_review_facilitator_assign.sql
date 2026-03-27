-- 0103_okr_review_facilitator_assign.sql
-- Governance: Facilitator nur mit okr.review.facilitator.assign; session.manage setzt keinen Facilitator mehr.

-- migrate:up

insert into rbac.permissions (code, name, description)
values (
  'okr.review.facilitator.assign',
  'OKR Review Facilitator zuweisen',
  'Darf den OKR Process Owner (Facilitator) fuer Review-Sessions setzen und aendern.'
)
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code = 'okr.review.facilitator.assign'
where r.code in ('org_admin', 'executive')
on conflict (role_id, permission_id) do nothing;

drop policy if exists okr_review_sessions_update on app.okr_review_sessions;

create policy okr_review_sessions_update on app.okr_review_sessions
for update using (
  app.has_permission(organization_id, 'okr.review.session.manage'::text)
  or facilitator_membership_id = app._strategy_review_current_membership(organization_id)
  or app.has_permission(organization_id, 'okr.review.facilitator.assign'::text)
)
with check (
  app.has_permission(organization_id, 'okr.review.session.manage'::text)
  or facilitator_membership_id = app._strategy_review_current_membership(organization_id)
  or app.has_permission(organization_id, 'okr.review.facilitator.assign'::text)
);

create or replace function app.tg_okr_review_sessions_column_guards()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_mid uuid;
  v_org uuid;
  v_other_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_org := new.organization_id;
    if new.facilitator_membership_id is not null then
      if not app.has_permission(v_org, 'okr.review.facilitator.assign'::text) then
        raise exception 'okr_review_sessions: facilitator setzen erfordert okr.review.facilitator.assign';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_org := new.organization_id;
    v_mid := app._strategy_review_current_membership(new.organization_id);

    if new.facilitator_membership_id is distinct from old.facilitator_membership_id then
      if not app.has_permission(v_org, 'okr.review.facilitator.assign'::text) then
        raise exception 'okr_review_sessions: facilitator aendern erfordert okr.review.facilitator.assign';
      end if;
    end if;

    v_other_changed :=
      new.title is distinct from old.title
      or new.session_type is distinct from old.session_type
      or new.status is distinct from old.status
      or new.scheduled_at is distinct from old.scheduled_at
      or new.summary is distinct from old.summary
      or new.meeting_notes is distinct from old.meeting_notes
      or new.discussion_notes is distinct from old.discussion_notes
      or new.decisions_next_steps is distinct from old.decisions_next_steps
      or new.cycle_instance_id is distinct from old.cycle_instance_id
      or new.okr_cycle_id is distinct from old.okr_cycle_id
      or new.created_by_membership_id is distinct from old.created_by_membership_id
      or new.organization_id is distinct from old.organization_id;

    if v_other_changed then
      if not (
        app.has_permission(v_org, 'okr.review.session.manage'::text)
        or (
          old.facilitator_membership_id is not null
          and old.facilitator_membership_id = v_mid
        )
      ) then
        raise exception
          'okr_review_sessions: aenderung an session-inhalten erfordert session.manage oder facilitator';
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_okr_review_sessions_column_guards on app.okr_review_sessions;
create trigger trg_okr_review_sessions_column_guards
before insert or update on app.okr_review_sessions
for each row
execute function app.tg_okr_review_sessions_column_guards();

-- migrate:down

drop trigger if exists trg_okr_review_sessions_column_guards on app.okr_review_sessions;
drop function if exists app.tg_okr_review_sessions_column_guards();

drop policy if exists okr_review_sessions_update on app.okr_review_sessions;

create policy okr_review_sessions_update on app.okr_review_sessions
for update using (
  app.has_permission(organization_id, 'okr.review.session.manage'::text)
  or facilitator_membership_id = app._strategy_review_current_membership(organization_id)
)
with check (
  app.has_permission(organization_id, 'okr.review.session.manage'::text)
  or facilitator_membership_id = app._strategy_review_current_membership(organization_id)
);

delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions where code = 'okr.review.facilitator.assign'
);
delete from rbac.permissions where code = 'okr.review.facilitator.assign';
