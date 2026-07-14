-- 0173_strategy_review_pre_read_chain.sql
-- Pre-Read: Programme + Link-Kette; Feedback-Ratings für Stoßrichtung; Readiness nur focus_areas.

-- migrate:up

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_focus;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_focus check (
    subject_type <> 'focus_area'
    or rating is null
    or rating in (
      'high_impact',
      'medium_impact',
      'low_impact',
      'negative_impact',
      'continue',
      'adjust',
      'stop',
      'escalate',
      'revisit_direction',
      'revisit_objective'
    )
  );

-- Readiness: nur Stoßrichtungen (formelle Kettenprüfung), nicht Challenge/Ziel-Einzellisten
create or replace function app.compute_review_readiness(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_pre jsonb;
  v_ids uuid[] := array[]::uuid[];
  v_total int;
  v_with_feedback int;
begin
  select pre_read_payload
  into v_pre
  from app.okr_reviews
  where id = p_review_id;

  if v_pre is null then
    return;
  end if;

  select coalesce(array_agg(distinct u), array[]::uuid[])
  into v_ids
  from (
    select (x->>'id')::uuid as u
    from jsonb_array_elements(coalesce(v_pre -> 'focus_areas', '[]'::jsonb)) x
    where x ? 'id'
  ) s
  where u is not null;

  v_total := cardinality(v_ids);

  if v_total = 0 then
    update app.okr_reviews
    set readiness_status = 'not_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
    return;
  end if;

  select count(distinct f.subject_id)
  into v_with_feedback
  from app.strategy_review_feedback_entries f
  where f.review_id = p_review_id
    and f.subject_type = 'focus_area'
    and f.subject_id = any (v_ids)
    and f.rating is not null;

  if v_with_feedback = 0 then
    update app.okr_reviews
    set readiness_status = 'not_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
  elsif v_with_feedback < v_total then
    update app.okr_reviews
    set readiness_status = 'partially_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
  else
    update app.okr_reviews
    set readiness_status = 'ready',
        procedure_status = case
          when procedure_status = 'pre_read_open' then 'ready_for_review'
          else procedure_status
        end
    where id = p_review_id;
  end if;
end;
$$;

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
  v_program_ids uuid[];
  v_payload jsonb;
  v_cd_links jsonb;
  v_do_links jsonb;
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

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_program_ids
  from app.strategy_programs
  where organization_id = v_org
    and cycle_instance_id = any (v_cycle_ids);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'strategic_challenge_id', l.strategic_challenge_id,
      'strategic_direction_id', l.strategic_direction_id
    )
    order by l.strategic_direction_id, l.strategic_challenge_id
  ), '[]'::jsonb)
  into v_cd_links
  from app.challenge_direction_links l
  where l.organization_id = v_org
    and l.strategic_direction_id = any (v_focus_ids)
    and l.strategic_challenge_id = any (v_challenge_ids);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'strategic_direction_id', l.strategic_direction_id,
      'strategy_objective_id', l.strategy_objective_id
    )
    order by l.strategic_direction_id, l.strategy_objective_id
  ), '[]'::jsonb)
  into v_do_links
  from app.strategic_direction_objective_links l
  where l.organization_id = v_org
    and l.strategic_direction_id = any (v_focus_ids)
    and l.strategy_objective_id = any (v_obj_ids);

  v_payload := jsonb_build_object(
    'generated_at', to_jsonb(now()),
    'scope', jsonb_build_object(
      'challenge_ids', coalesce(to_jsonb(v_challenge_ids), '[]'::jsonb),
      'focus_area_ids', coalesce(to_jsonb(v_focus_ids), '[]'::jsonb),
      'objective_ids', coalesce(to_jsonb(v_obj_ids), '[]'::jsonb),
      'program_ids', coalesce(to_jsonb(v_program_ids), '[]'::jsonb),
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
    ), '[]'::jsonb),
    'programs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'description', p.description,
          'status', p.status,
          'strategic_direction_id', p.strategic_direction_id,
          'owner_label', coalesce(nullif(trim(m.display_name), ''), nullif(trim(r.full_name), ''), null)
        )
        order by p.title
      )
      from app.strategy_programs p
      left join app.organization_memberships m on m.id = p.owner_membership_id
      left join app.responsibles r on r.id = m.responsible_id
      where p.organization_id = v_org
        and p.cycle_instance_id = any (v_cycle_ids)
    ), '[]'::jsonb),
    'links', jsonb_build_object(
      'challenge_direction', coalesce(v_cd_links, '[]'::jsonb),
      'direction_objective', coalesce(v_do_links, '[]'::jsonb)
    )
  );

  update app.okr_reviews
  set
    pre_read_payload = v_payload,
    procedure_status = 'pre_read_open',
    readiness_status = 'not_ready'
  where id = p_review_id
    and procedure_status = 'announcement_sent';

  if not found then
    raise exception 'prepare_strategy_review: expected procedure_status announcement_sent';
  end if;
end;
$$;

-- migrate:down

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_focus;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_focus check (
    subject_type <> 'focus_area'
    or rating is null
    or rating in (
      'high_impact',
      'medium_impact',
      'low_impact',
      'negative_impact'
    )
  );

-- compute_review_readiness / prepare_strategy_review: bei Down 0172 erneut anwenden
