-- 0172_strategy_review_procedure_start_gates.sql
-- Ankündigung / Vorab-Aufbereitung: Review-Leitung oder Moderate; Lead-Fenster außer Moderate-Override.

-- migrate:up

create or replace function app.assert_strategy_review_procedure_start(p_review_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'rbac'
as $$
declare
  v_org uuid;
  v_lead_days int;
  v_ends_on date;
  v_days int;
  v_mid uuid;
  v_is_moderate boolean;
  v_is_lead boolean;
begin
  select
    r.organization_id,
    r.review_lead_time_days,
    ci.ends_on
  into v_org, v_lead_days, v_ends_on
  from app.okr_reviews r
  join app.cycle_instances ci on ci.id = r.cycle_instance_id
  where r.id = p_review_id
    and r.review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'strategy_review: review not found';
  end if;

  v_mid := app._strategy_review_current_membership(v_org);
  v_is_moderate := app.has_permission(v_org, 'strategy_review.moderate');

  v_is_lead := exists (
    select 1
    from app.strategy_review_participants p
    where p.review_id = p_review_id
      and p.membership_id = v_mid
      and p.review_role = 'lead'
  );

  if not v_is_moderate and not v_is_lead then
    raise exception
      'strategy_review: Ankündigung nur durch Review-Leitung oder mit Moderationsrecht';
  end if;

  v_days := (v_ends_on - current_date);

  if v_days > v_lead_days and not v_is_moderate then
    raise exception
      'strategy_review: Lead-Fenster noch nicht offen (noch % Tage bis Periodenende, Vorlauf % Tage). Override nur mit Moderationsrecht.',
      v_days,
      v_lead_days;
  end if;
end;
$$;

comment on function app.assert_strategy_review_procedure_start(uuid) is
  'Gates für Verfahrensstart: Review-Leitung|Moderate und Lead-Fenster (Override: Moderate).';

create or replace function app.record_strategy_review_announcement(
  p_review_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
begin
  perform app.assert_strategy_review_procedure_start(p_review_id);

  update app.okr_reviews
  set announcement_payload = coalesce(p_payload, '{}'::jsonb),
      announcement_sent_at = now(),
      procedure_status = 'announcement_sent'
  where id = p_review_id
    and review_mode = 'strategy_review'
    and procedure_status = 'not_started';

  if not found then
    raise exception 'record_strategy_review_announcement: invalid state or not strategy review';
  end if;
end;
$$;

-- prepare_strategy_review: 0170-Logik + Start-Gates statt reinem Moderate-Check
create or replace function app.prepare_strategy_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to app, public
as $$
declare
  v_org uuid;
  v_ci uuid;
  v_cycle_ids uuid[];
  v_challenge_ids uuid[];
  v_focus_ids uuid[];
  v_obj_ids uuid[];
  v_payload jsonb;
begin
  perform app.assert_strategy_review_procedure_start(p_review_id);

  select organization_id, cycle_instance_id
  into v_org, v_ci
  from app.okr_reviews
  where id = p_review_id
    and review_mode = 'strategy_review';

  if v_ci is null then
    raise exception 'prepare_strategy_review: not found';
  end if;

  v_cycle_ids := app.cycle_instance_related_ids(v_ci);

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_challenge_ids
  from app.strategic_challenges
  where organization_id = v_org
    and cycle_instance_id = any (v_cycle_ids);

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_focus_ids
  from app.strategic_directions
  where organization_id = v_org
    and cycle_instance_id = any (v_cycle_ids);

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_obj_ids
  from app.strategy_objectives
  where organization_id = v_org
    and cycle_instance_id = any (v_cycle_ids);

  v_payload := jsonb_build_object(
    'generated_at', to_jsonb(now()),
    'scope', jsonb_build_object(
      'challenge_ids', coalesce(to_jsonb(v_challenge_ids), '[]'::jsonb),
      'focus_area_ids', coalesce(to_jsonb(v_focus_ids), '[]'::jsonb),
      'objective_ids', coalesce(to_jsonb(v_obj_ids), '[]'::jsonb),
      'cycle_instance_ids', coalesce(to_jsonb(v_cycle_ids), '[]'::jsonb)
    ),
    'challenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'description', c.description,
          'priority', c.priority,
          'visibility', c.visibility
        )
        order by c.title
      )
      from app.strategic_challenges c
      where c.organization_id = v_org
        and c.cycle_instance_id = any (v_cycle_ids)
    ), '[]'::jsonb),
    'focus_areas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'title', d.title,
          'description', d.description,
          'status', d.status,
          'priority', d.priority
        )
        order by d.title
      )
      from app.strategic_directions d
      where d.organization_id = v_org
        and d.cycle_instance_id = any (v_cycle_ids)
    ), '[]'::jsonb),
    'objectives', coalesce((
      select jsonb_agg(x.obj order by x.sort_title)
      from (
        select
          s.title as sort_title,
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'description', s.description,
            'status', s.status,
            'progress_percent', s.progress_percent,
            'key_results', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', kr.id,
                  'title', kr.title,
                  'metric_type', kr.metric_type,
                  'target_value', kr.target_value,
                  'current_value', kr.current_value
                )
                order by kr.title
              )
              from app.key_results kr
              join app.okr_objective_strategy_objectives j on j.okr_objective_id = kr.okr_objective_id
              where j.strategy_objective_id = s.id
            ), '[]'::jsonb)
          ) as obj
        from app.strategy_objectives s
        where s.organization_id = v_org
          and s.cycle_instance_id = any (v_cycle_ids)
      ) x
    ), '[]'::jsonb)
  );

  update app.okr_reviews
  set
    pre_read_payload = v_payload,
    procedure_status = 'pre_read_open'
  where id = p_review_id
    and procedure_status = 'announcement_sent';

  if not found then
    raise exception 'prepare_strategy_review: expected procedure_status announcement_sent';
  end if;
end;
$$;

grant execute on function app.assert_strategy_review_procedure_start(uuid) to authenticated;

-- migrate:down

create or replace function app.record_strategy_review_announcement(
  p_review_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from app.okr_reviews where id = p_review_id;
  if v_org is null then
    raise exception 'record_strategy_review_announcement: not found';
  end if;
  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'record_strategy_review_announcement: forbidden';
  end if;

  update app.okr_reviews
  set announcement_payload = coalesce(p_payload, '{}'::jsonb),
      announcement_sent_at = now(),
      procedure_status = 'announcement_sent'
  where id = p_review_id
    and review_mode = 'strategy_review'
    and procedure_status = 'not_started';

  if not found then
    raise exception 'record_strategy_review_announcement: invalid state or not strategy review';
  end if;
end;
$$;

drop function if exists app.assert_strategy_review_procedure_start(uuid);
-- prepare_strategy_review: bei Down erneut 0170 anwenden
