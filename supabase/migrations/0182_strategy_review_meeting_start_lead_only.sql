-- 0182_strategy_review_meeting_start_lead_only.sql
-- Meeting starten: nur Review-Leitung (Teilnehmerrolle lead), nicht Mitwirkende/Moderatoren allein.

-- migrate:up

create or replace function app.start_strategy_review_meeting(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_proc text;
  v_mid uuid;
  v_is_lead boolean;
begin
  select organization_id, procedure_status
  into v_org, v_proc
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'start_strategy_review_meeting: not found';
  end if;

  v_mid := app._strategy_review_current_membership(v_org);
  if v_mid is null then
    raise exception 'start_strategy_review_meeting: no membership';
  end if;

  v_is_lead := exists (
    select 1
    from app.strategy_review_participants p
    where p.review_id = p_review_id
      and p.membership_id = v_mid
      and p.review_role = 'lead'
  );

  if not v_is_lead then
    raise exception 'start_strategy_review_meeting: only review lead may start the meeting';
  end if;

  if v_proc not in ('pre_read_open', 'ready_for_review') then
    raise exception 'start_strategy_review_meeting: unexpected procedure_status %', v_proc;
  end if;

  update app.okr_reviews
  set procedure_status = 'review_in_progress'
  where id = p_review_id;
end;
$$;

comment on function app.start_strategy_review_meeting(uuid) is
  'Startet das Review-Meeting; nur Teilnehmer mit Rolle lead.';

-- migrate:down

create or replace function app.start_strategy_review_meeting(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_proc text;
begin
  select organization_id, procedure_status
  into v_org, v_proc
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'start_strategy_review_meeting: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'start_strategy_review_meeting: forbidden';
  end if;

  if v_proc not in ('pre_read_open', 'ready_for_review') then
    raise exception 'start_strategy_review_meeting: unexpected procedure_status %', v_proc;
  end if;

  update app.okr_reviews
  set procedure_status = 'review_in_progress'
  where id = p_review_id;
end;
$$;
