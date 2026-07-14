-- 0176_strategy_review_decision_inactivate_and_masks.sql
-- Entscheidungen: inactivate + replace für alle Themes; volle proposed_changes/replacement;
-- Identity-Inaktivierung bei Freigabe; Pre-Read mit Score-Feldern.

-- migrate:up

create or replace function app._strategy_review_inactivate_revision(
  p_organization_id uuid,
  p_revision_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
begin
  update app.strategy_object_identities i
  set lifecycle_state = 'inactive'
  from app.strategy_object_revisions r
  where r.id = p_revision_id
    and r.organization_id = p_organization_id
    and r.object_identity_id = i.id
    and i.organization_id = p_organization_id
    and i.lifecycle_state = 'active';
end;
$$;

create or replace function app.strategy_review_apply_inactivations(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_dec jsonb;
  v_elem jsonb;
  v_id uuid;
  v_decision text;
begin
  select organization_id, decision_payload
  into v_org, v_dec
  from app.okr_reviews
  where id = p_review_id;

  if v_org is null or v_dec is null then
    return;
  end if;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'challenges', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_id is not null and v_decision in ('inactivate', 'replace') then
      perform app._strategy_review_inactivate_revision(v_org, v_id);
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'focus_areas', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_id is not null and v_decision in ('inactivate', 'replace', 'stop') then
      perform app._strategy_review_inactivate_revision(v_org, v_id);
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'objectives', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_id is not null and v_decision in ('inactivate', 'replace', 'remove') then
      perform app._strategy_review_inactivate_revision(v_org, v_id);
    end if;
  end loop;
end;
$$;

create or replace function app.validate_strategy_decision_payload(
  p_decisions jsonb,
  p_pre_read jsonb
)
returns jsonb
language plpgsql stable security definer
set search_path to 'app', 'public'
as $$
declare
  v_scope_challenges uuid[] := array[]::uuid[];
  v_scope_focus uuid[] := array[]::uuid[];
  v_scope_objectives uuid[] := array[]::uuid[];
  v_errors text[] := array[]::text[];
  v_elem jsonb;
  v_id uuid;
  v_dec text;
  v_n int;
begin
  if p_pre_read is null or p_pre_read = '{}'::jsonb then
    return jsonb_build_object('valid', false, 'errors', jsonb_build_array('pre_read_payload missing'));
  end if;

  select coalesce(array_agg(x::uuid), array[]::uuid[])
  into v_scope_challenges
  from jsonb_array_elements_text(coalesce(p_pre_read #> '{scope,challenge_ids}', '[]'::jsonb)) x;

  if cardinality(v_scope_challenges) = 0 then
    select coalesce(array_agg((x->>'id')::uuid), array[]::uuid[])
    into v_scope_challenges
    from jsonb_array_elements(coalesce(p_pre_read -> 'challenges', '[]'::jsonb)) x
    where x ? 'id';
  end if;

  select coalesce(array_agg(x::uuid), array[]::uuid[])
  into v_scope_focus
  from jsonb_array_elements_text(coalesce(p_pre_read #> '{scope,focus_area_ids}', '[]'::jsonb)) x;

  if cardinality(v_scope_focus) = 0 then
    select coalesce(array_agg((x->>'id')::uuid), array[]::uuid[])
    into v_scope_focus
    from jsonb_array_elements(coalesce(p_pre_read -> 'focus_areas', '[]'::jsonb)) x
    where x ? 'id';
  end if;

  select coalesce(array_agg(x::uuid), array[]::uuid[])
  into v_scope_objectives
  from jsonb_array_elements_text(coalesce(p_pre_read #> '{scope,objective_ids}', '[]'::jsonb)) x;

  if cardinality(v_scope_objectives) = 0 then
    select coalesce(array_agg((x->>'id')::uuid), array[]::uuid[])
    into v_scope_objectives
    from jsonb_array_elements(coalesce(p_pre_read -> 'objectives', '[]'::jsonb)) x
    where x ? 'id';
  end if;

  if cardinality(v_scope_challenges) + cardinality(v_scope_focus) + cardinality(v_scope_objectives) = 0 then
    v_errors := array_append(v_errors, 'pre_read scope empty');
  end if;

  for v_elem in select * from jsonb_array_elements(coalesce(p_decisions -> 'challenges', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_dec := v_elem ->> 'decision';
    if v_id is null then
      v_errors := array_append(v_errors, 'challenge entry missing id');
      continue;
    end if;
    if not (v_id = any (v_scope_challenges)) then
      v_errors := array_append(v_errors, format('challenge %s not in scope', v_id));
    end if;
    if v_dec is null or v_dec not in ('keep', 'adjust', 'replace', 'inactivate') then
      v_errors := array_append(v_errors, format('challenge %s invalid decision', v_id));
    end if;
    if v_dec in ('adjust', 'replace', 'inactivate') and nullif(trim(v_elem ->> 'comment'), '') is null then
      v_errors := array_append(v_errors, format('challenge %s requires comment', v_id));
    end if;
    if v_dec = 'adjust' and not (v_elem ? 'proposed_changes') then
      v_errors := array_append(v_errors, format('challenge %s adjust needs proposed_changes', v_id));
    end if;
    if v_dec = 'replace' and not (v_elem ? 'replacement') then
      v_errors := array_append(v_errors, format('challenge %s replace needs replacement', v_id));
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(p_decisions -> 'focus_areas', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_dec := v_elem ->> 'decision';
    if v_id is null then
      v_errors := array_append(v_errors, 'focus_area entry missing id');
      continue;
    end if;
    if not (v_id = any (v_scope_focus)) then
      v_errors := array_append(v_errors, format('focus_area %s not in scope', v_id));
    end if;
    if v_dec is null or v_dec not in ('double_down', 'adjust', 'replace', 'inactivate', 'stop') then
      v_errors := array_append(v_errors, format('focus_area %s invalid decision', v_id));
    end if;
    if v_dec in ('adjust', 'replace', 'inactivate', 'stop') and nullif(trim(v_elem ->> 'comment'), '') is null then
      v_errors := array_append(v_errors, format('focus_area %s requires comment', v_id));
    end if;
    if v_dec = 'adjust' and not (v_elem ? 'proposed_changes') then
      v_errors := array_append(v_errors, format('focus_area %s adjust needs proposed_changes', v_id));
    end if;
    if v_dec = 'replace' and not (v_elem ? 'replacement') then
      v_errors := array_append(v_errors, format('focus_area %s replace needs replacement', v_id));
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(p_decisions -> 'objectives', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_dec := v_elem ->> 'decision';
    if v_id is null then
      v_errors := array_append(v_errors, 'objective entry missing id');
      continue;
    end if;
    if not (v_id = any (v_scope_objectives)) then
      v_errors := array_append(v_errors, format('objective %s not in scope', v_id));
    end if;
    if v_dec is null or v_dec not in ('keep', 'adjust', 'change', 'replace', 'inactivate', 'remove') then
      v_errors := array_append(v_errors, format('objective %s invalid decision', v_id));
    end if;
    if v_dec in ('adjust', 'change', 'replace', 'inactivate', 'remove') and nullif(trim(v_elem ->> 'comment'), '') is null then
      v_errors := array_append(v_errors, format('objective %s requires comment', v_id));
    end if;
    if v_dec in ('adjust', 'change') and not (v_elem ? 'proposed_changes') then
      v_errors := array_append(v_errors, format('objective %s adjust needs proposed_changes', v_id));
    end if;
    if v_dec = 'replace' and not (v_elem ? 'replacement') then
      v_errors := array_append(v_errors, format('objective %s replace needs replacement', v_id));
    end if;
  end loop;

  if cardinality(v_errors) = 0 then
    select count(*) into v_n from jsonb_array_elements(coalesce(p_decisions -> 'challenges', '[]'::jsonb));
    if v_n <> coalesce(cardinality(v_scope_challenges), 0) then
      v_errors := array_append(v_errors, 'challenges: decision count must match scope');
    end if;
    select count(*) into v_n from jsonb_array_elements(coalesce(p_decisions -> 'focus_areas', '[]'::jsonb));
    if v_n <> coalesce(cardinality(v_scope_focus), 0) then
      v_errors := array_append(v_errors, 'focus_areas: decision count must match scope');
    end if;
    select count(*) into v_n from jsonb_array_elements(coalesce(p_decisions -> 'objectives', '[]'::jsonb));
    if v_n <> coalesce(cardinality(v_scope_objectives), 0) then
      v_errors := array_append(v_errors, 'objectives: decision count must match scope');
    end if;
  end if;

  if cardinality(v_errors) > 0 then
    return jsonb_build_object('valid', false, 'errors', to_jsonb(v_errors));
  end if;

  return jsonb_build_object('valid', true, 'errors', '[]'::jsonb);
end;
$$;

-- execute_strategy_review_release: nach Apply Inaktivierungen setzen
create or replace function app.execute_strategy_review_release(p_review_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_rev record;
  v_to uuid;
  v_actor uuid;
  v_cf jsonb;
  v_apply jsonb;
  v_final jsonb;
begin
  select * into v_rev
  from app.okr_reviews
  where id = p_review_id
  for update;

  if v_rev.id is null then
    raise exception 'execute_strategy_review_release: not found';
  end if;

  if v_rev.review_mode <> 'strategy_review' then
    raise exception 'execute_strategy_review_release: not strategy review';
  end if;

  if v_rev.procedure_status <> 'decision_captured' then
    raise exception 'execute_strategy_review_release: expected decision_captured';
  end if;

  if v_rev.released_at is not null then
    raise exception 'execute_strategy_review_release: already released';
  end if;

  if not app.has_permission(v_rev.organization_id, 'strategy_review.release') then
    raise exception 'execute_strategy_review_release: forbidden';
  end if;

  v_actor := app._strategy_review_current_membership(v_rev.organization_id);

  v_to := app.resolve_successor_cycle_instance(v_rev.cycle_instance_id);
  if v_to is null then
    raise exception 'execute_strategy_review_release: no successor cycle_instance (materialize calendar first)';
  end if;

  v_cf := app.carry_forward_analysis_cycle_data(
    v_rev.organization_id,
    v_rev.cycle_instance_id,
    v_to,
    null,
    v_actor
  );

  v_apply := app.apply_strategy_review_decisions(
    p_review_id,
    v_rev.cycle_instance_id,
    v_to
  );

  perform app.strategy_review_apply_inactivations(p_review_id);

  v_final := jsonb_build_object(
    'analysis_carry_forward', v_cf,
    'apply', v_apply,
    'from_cycle_instance_id', v_rev.cycle_instance_id,
    'to_cycle_instance_id', v_to,
    'override_forced', v_rev.override_forced,
    'released_at', to_jsonb(now())
  );

  update app.okr_reviews
  set release_summary = v_final,
      released_to_cycle_instance_id = v_to,
      released_at = now(),
      procedure_status = 'released'
  where id = p_review_id;

  return v_final;
end;
$$;

-- Pre-Read: Score-Felder für Meeting-Masken
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
          'visibility', c.visibility,
          'impact_score', c.impact_score,
          'urgency_score', c.urgency_score,
          'scope_score', c.scope_score,
          'root_cause_score', c.root_cause_score,
          'challenge_score', c.challenge_score
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
          'priority', d.priority,
          'grouping', d.grouping,
          'strategic_value_score', d.strategic_value_score,
          'capability_fit_score', d.capability_fit_score,
          'feasibility_score', d.feasibility_score,
          'risk_score', d.risk_level
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
            'time_horizon', s.time_horizon,
            'importance_score', s.importance_score,
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
  where id = p_review_id;
end;
$$;

grant execute on function app.strategy_review_apply_inactivations(uuid) to authenticated;
grant execute on function app._strategy_review_inactivate_revision(uuid, uuid) to authenticated;

-- migrate:down

drop function if exists app.strategy_review_apply_inactivations(uuid);
drop function if exists app._strategy_review_inactivate_revision(uuid, uuid);
-- validate / prepare / execute: vorherige Versionen aus 0173/0083 bei Bedarf manuell wiederherstellen
