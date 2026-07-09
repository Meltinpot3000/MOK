-- 0141_okr_progress_reminder_notifications.sql
-- In-App-Erinnerungen an OKR-Owner bei Rückstand vs. linearem Plan.
-- migrate:up

alter table app.member_notifications
  drop constraint if exists member_notifications_type_check;

alter table app.member_notifications
  add constraint member_notifications_type_check check (
    notification_type = any (
      array['kr_completion_rejected'::text, 'okr_progress_reminder'::text]
    )
  );

create or replace function app.send_okr_behind_plan_reminders(
  p_organization_id uuid,
  p_okr_objective_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = app, public
as $fn$
declare
  v_actor uuid;
  v_sent integer := 0;
  v_obj record;
begin
  v_actor := app.current_membership_id(p_organization_id);
  if v_actor is null then
    raise exception 'okr-reminder-not-authenticated';
  end if;

  if not app.has_permission(p_organization_id, 'okr.write'::text) then
    raise exception 'okr-reminder-forbidden';
  end if;

  if p_okr_objective_ids is null or cardinality(p_okr_objective_ids) = 0 then
    return jsonb_build_object('sent', 0);
  end if;

  for v_obj in
    select o.id, o.title, o.owner_membership_id
    from app.okr_objectives o
    where o.organization_id = p_organization_id
      and o.id = any (p_okr_objective_ids)
      and o.owner_membership_id is not null
      and o.status = any (array['active'::text, 'at_risk'::text])
  loop
    insert into app.member_notifications (
      organization_id,
      recipient_membership_id,
      notification_type,
      title,
      body
    ) values (
      p_organization_id,
      v_obj.owner_membership_id,
      'okr_progress_reminder',
      'OKR hinter dem Plan',
      format(
        'Ihr OKR «%s» liegt hinter dem linearen Planfortschritt. Bitte prüfen Sie Fortschritt und nächste Schritte im OKR-Tracking.',
        v_obj.title
      )
    );
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object('sent', v_sent);
end;
$fn$;

revoke all on function app.send_okr_behind_plan_reminders(uuid, uuid[]) from public;
grant execute on function app.send_okr_behind_plan_reminders(uuid, uuid[]) to authenticated;

-- migrate:down

revoke all on function app.send_okr_behind_plan_reminders(uuid, uuid[]) from public;
drop function if exists app.send_okr_behind_plan_reminders(uuid, uuid[]);

alter table app.member_notifications
  drop constraint if exists member_notifications_type_check;

alter table app.member_notifications
  add constraint member_notifications_type_check check (
    notification_type = any (array['kr_completion_rejected'::text])
  );

delete from app.member_notifications where notification_type = 'okr_progress_reminder';
