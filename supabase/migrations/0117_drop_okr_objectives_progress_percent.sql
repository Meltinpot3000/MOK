-- migrate:up
-- OKR-Objective: progress_percent entfernt (Fortschritt nur Tracking/Rollup aus KRs/Check-ins).

create or replace function app.okr_shift_objective_to_next_cycle (
  p_organization_id uuid,
  p_cycle_instance_id uuid,
  p_objective_id uuid,
  p_from_okr_cycle_id uuid,
  p_to_okr_cycle_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to app, public
as $$
declare
  v_mid uuid;
  v_obj record;
  v_from_oc record;
  v_to_oc record;
  v_scope uuid[];
  v_sid uuid;
  v_new_okr_id uuid;
  v_kr record;
  v_new_kr_id uuid;
  v_to_end date;
begin
  v_mid := app.current_membership_id (p_organization_id);
  if v_mid is null then
    return jsonb_build_object('error', 'Nicht angemeldet oder keine Mitgliedschaft.');
  end if;

  if p_from_okr_cycle_id = p_to_okr_cycle_id then
    return jsonb_build_object('error', 'Quell- und Ziel-OKR-Zyklus duerfen nicht identisch sein.');
  end if;

  select
    o.*
  into v_obj
  from
    app.okr_objectives o
  where
    o.id = p_objective_id
    and o.organization_id = p_organization_id
    and o.cycle_instance_id = p_cycle_instance_id
    and o.okr_cycle_id = p_from_okr_cycle_id;

  if v_obj.id is null then
    return jsonb_build_object('error', 'OKR-Objective nicht gefunden oder falscher Zeitraum.');
  end if;

  if v_obj.status in ('shifted', 'archived') then
    return jsonb_build_object('error', 'OKR-Objective kann nicht verschoben werden (Status).');
  end if;

  if not (
    app.has_permission (p_organization_id, 'nav.strategy-cycle.write')
    or app.has_permission (p_organization_id, 'nav.strategy-matrix.write')
    or (
      app.has_permission (p_organization_id, 'okr.write')
      and app.okr_can_modify_objective (
        p_organization_id,
        v_obj.owner_membership_id,
        v_obj.deputy_membership_id
      )
    )
  ) then
    return jsonb_build_object('error', 'Keine Berechtigung zum Verschieben.');
  end if;

  select
    oc.id,
    oc.organization_id,
    oc.cycle_instance_id
  into v_from_oc
  from
    app.okr_cycles oc
  where
    oc.id = p_from_okr_cycle_id
    and oc.organization_id = p_organization_id;

  if v_from_oc.id is null then
    return jsonb_build_object('error', 'Ungueltiger Quell-OKR-Zyklus.');
  end if;

  select
    oc.id,
    oc.organization_id,
    oc.cycle_instance_id,
    oc.end_date
  into v_to_oc
  from
    app.okr_cycles oc
  where
    oc.id = p_to_okr_cycle_id
    and oc.organization_id = p_organization_id;

  if v_to_oc.id is null then
    return jsonb_build_object('error', 'Ungueltiger Ziel-OKR-Zyklus.');
  end if;

  v_scope := app.okr_cycle_instance_scope_ids (p_organization_id, p_cycle_instance_id);

  if not (
    v_from_oc.cycle_instance_id = any (v_scope)
    and v_to_oc.cycle_instance_id = any (v_scope)
  ) then
    return jsonb_build_object('error', 'OKR-Zyklus liegt ausserhalb des gueltigen Scopes.');
  end if;

  select
    j.strategy_objective_id
  into v_sid
  from
    app.okr_objective_strategy_objectives j
  where
    j.okr_objective_id = p_objective_id
  order by
    j.created_at asc
  limit 1;

  if v_sid is null then
    return jsonb_build_object('error', 'Kein Strategie-Ziel verknuepft — Verschieben abgebrochen.');
  end if;

  v_to_end := v_to_oc.end_date;

  update app.okr_objectives
  set
    status = 'shifted',
    updated_at = now()
  where
    id = p_objective_id
    and organization_id = p_organization_id;

  insert into app.okr_objectives (
    organization_id,
    cycle_instance_id,
    cycle_id,
    okr_cycle_id,
    title,
    description,
    status,
    owner_membership_id,
    deputy_membership_id,
    confidence_level,
    importance_score,
    time_horizon,
    created_by_membership_id,
    created_by_source
  )
  values (
    p_organization_id,
    p_cycle_instance_id,
    v_obj.cycle_id,
    p_to_okr_cycle_id,
    v_obj.title,
    v_obj.description,
    'draft',
    v_obj.owner_membership_id,
    v_obj.deputy_membership_id,
    v_obj.confidence_level,
    v_obj.importance_score,
    v_obj.time_horizon,
    v_mid,
    coalesce (v_obj.created_by_source, 'user')
  )
  returning id into v_new_okr_id;

  insert into app.okr_objective_strategy_objectives (okr_objective_id, strategy_objective_id)
  values (v_new_okr_id, v_sid);

  for v_kr in
    select
      kr.*
    from
      app.key_results kr
    where
      kr.okr_objective_id = p_objective_id
      and kr.organization_id = p_organization_id
      and app.kr_metric_progress_pct (
        kr.metric_type,
        kr.start_value,
        kr.target_value,
        kr.current_value
      ) < 100
    order by
      kr.created_at asc,
      kr.id asc
  loop
    insert into app.key_results (
      organization_id,
      okr_objective_id,
      title,
      metric_type,
      start_value,
      target_value,
      current_value,
      status,
      due_date,
      measurement_unit,
      owner_membership_id,
      deputy_membership_id,
      created_by_membership_id,
      created_by_source
    )
    values (
      p_organization_id,
      v_new_okr_id,
      v_kr.title,
      v_kr.metric_type,
      v_kr.start_value,
      v_kr.target_value,
      v_kr.current_value,
      v_kr.status,
      v_to_end,
      v_kr.measurement_unit,
      v_kr.owner_membership_id,
      v_kr.deputy_membership_id,
      coalesce (v_kr.created_by_membership_id, v_mid),
      coalesce (v_kr.created_by_source, 'user')
    )
    returning id into v_new_kr_id;

    update app.initiative_key_result_links l
    set
      key_result_id = v_new_kr_id
    where
      l.organization_id = p_organization_id
      and l.cycle_instance_id = p_cycle_instance_id
      and l.key_result_id = v_kr.id;

    insert into app.okr_updates (
      id,
      organization_id,
      planning_cycle_id,
      okr_cycle_id,
      key_result_id,
      progress_value,
      confidence_level,
      comment,
      created_by_membership_id,
      created_at,
      cycle_instance_id
    )
    select
      gen_random_uuid (),
      u.organization_id,
      u.planning_cycle_id,
      p_to_okr_cycle_id,
      v_new_kr_id,
      u.progress_value,
      u.confidence_level,
      u.comment,
      u.created_by_membership_id,
      u.created_at,
      p_cycle_instance_id
    from
      app.okr_updates u
    where
      u.key_result_id = v_kr.id
      and u.organization_id = p_organization_id;
  end loop;

  return jsonb_build_object(
    'new_objective_id',
    v_new_okr_id,
    'new_okr_cycle_id',
    p_to_okr_cycle_id
  );
end;
$$;

revoke all on function app.okr_shift_objective_to_next_cycle (uuid, uuid, uuid, uuid, uuid)
from public;

grant execute on function app.okr_shift_objective_to_next_cycle (uuid, uuid, uuid, uuid, uuid) to authenticated;

create or replace function app.apply_strategy_review_decisions (
  p_review_id uuid,
  p_from_cycle_instance_id uuid,
  p_to_cycle_instance_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to app, public
as $$
declare
  v_org uuid;
  v_planning_to uuid;
  v_dec jsonb;
  v_challenge_map jsonb := '{}'::jsonb;
  v_direction_map jsonb := '{}'::jsonb;
  v_strategy_objective_map jsonb := '{}'::jsonb;
  v_okr_objective_map jsonb := '{}'::jsonb;
  v_kr_map jsonb := '{}'::jsonb;
  v_program_map jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_old uuid;
  v_new_str uuid;
  v_new_okr uuid;
  v_decision text;
  v_rec record;
  v_summary jsonb := '{}'::jsonb;
  v_programs_skipped jsonb := '[]'::jsonb;
  v_inits_skipped jsonb := '[]'::jsonb;
  v_kr record;
  v_new_kr uuid;
  v_prog record;
  v_init record;
  v_new_prog uuid;
  v_new_init uuid;
  v_supported uuid[];
  v_mapped uuid[];
  v_dir_ok boolean;
  v_ch_ok boolean;
  v_okr record;
  v_to_okr uuid;
begin
  select
    organization_id,
    decision_payload into v_org,
    v_dec
  from
    app.okr_reviews
  where
    id = p_review_id;

  if v_org is null or v_dec is null or v_dec = '{}'::jsonb then
    raise exception 'apply_strategy_review_decisions: missing review or decisions';
  end if;

  select
    legacy_planning_cycle_id into v_planning_to
  from
    app.cycle_instances
  where
    id = p_to_cycle_instance_id
    and organization_id = v_org;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'challenges', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('keep', 'adjust') then
      select
        * into v_rec
      from
        app.strategic_challenges
      where
        id = v_old
        and organization_id = v_org;
      if not found then
        raise exception 'challenge % not found', v_old;
      end if;
      insert into app.strategic_challenges (
        organization_id,
        planning_cycle_id,
        title,
        priority,
        visibility,
        created_by_membership_id,
        source_analysis_entry_id,
        cycle_instance_id,
        relevance_level,
        risk_level,
        description,
        impact_score,
        urgency_score,
        scope_score,
        root_cause_score,
        challenge_score,
        created_by_source,
        source_cluster_id,
        strategy_carry_source_id,
        strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case
          when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title)
          else v_rec.title
        end,
        v_rec.priority,
        v_rec.visibility,
        v_rec.created_by_membership_id,
        v_rec.source_analysis_entry_id,
        p_to_cycle_instance_id,
        v_rec.relevance_level,
        v_rec.risk_level,
        case
          when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description)
          else v_rec.description
        end,
        v_rec.impact_score,
        v_rec.urgency_score,
        v_rec.scope_score,
        v_rec.root_cause_score,
        v_rec.challenge_score,
        v_rec.created_by_source,
        v_rec.source_cluster_id,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object(
          'strategy_review_carry',
          true,
          'decision',
          v_decision
        )
      )
      returning id into v_new_str;
      v_challenge_map := v_challenge_map || jsonb_build_object(v_old::text, v_new_str);
    elsif v_decision = 'replace' then
      insert into app.strategic_challenges (
        organization_id,
        planning_cycle_id,
        title,
        priority,
        visibility,
        cycle_instance_id,
        relevance_level,
        risk_level,
        description,
        impact_score,
        urgency_score,
        scope_score,
        root_cause_score,
        challenge_score,
        created_by_source,
        strategy_carry_metadata
      )
      values (
        v_org,
        v_planning_to,
        coalesce(v_elem #>> '{replacement,title}', 'Challenge'),
        3,
        'internal',
        p_to_cycle_instance_id,
        3,
        3,
        v_elem #>> '{replacement,description}',
        3,
        3,
        3,
        3,
        3,
        'user',
        jsonb_build_object('strategy_review_replace_of', v_old::text)
      )
      returning id into v_new_str;
      v_challenge_map := v_challenge_map || jsonb_build_object(v_old::text, v_new_str);
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'focus_areas', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('double_down', 'adjust') then
      select
        * into v_rec
      from
        app.strategic_directions
      where
        id = v_old
        and organization_id = v_org;
      if not found then
        raise exception 'direction % not found', v_old;
      end if;
      insert into app.strategic_directions (
        organization_id,
        planning_cycle_id,
        title,
        description,
        owner_membership_id,
        priority,
        status,
        grouping,
        created_by_membership_id,
        cycle_instance_id,
        relevance_level,
        risk_level,
        strategic_value_score,
        capability_fit_score,
        feasibility_score,
        created_by_source,
        review_comment,
        strategy_carry_source_id,
        strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case
          when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title)
          else v_rec.title
        end,
        case
          when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description)
          else v_rec.description
        end,
        v_rec.owner_membership_id,
        v_rec.priority,
        v_rec.status,
        v_rec.grouping,
        v_rec.created_by_membership_id,
        p_to_cycle_instance_id,
        v_rec.relevance_level,
        v_rec.risk_level,
        v_rec.strategic_value_score,
        v_rec.capability_fit_score,
        v_rec.feasibility_score,
        v_rec.created_by_source,
        v_rec.review_comment,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object(
          'strategy_review_carry',
          true,
          'decision',
          v_decision
        )
      )
      returning id into v_new_str;
      v_direction_map := v_direction_map || jsonb_build_object(v_old::text, v_new_str);
    end if;
  end loop;

  select
    decision_payload into v_dec
  from
    app.okr_reviews
  where
    id = p_review_id;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'objectives', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('keep', 'change') then
      select
        * into v_rec
      from
        app.strategy_objectives
      where
        id = v_old
        and organization_id = v_org;
      if not found then
        raise exception 'strategy objective % not found', v_old;
      end if;
      insert into app.strategy_objectives (
        organization_id,
        cycle_id,
        title,
        description,
        status,
        owner_membership_id,
        deputy_membership_id,
        progress_percent,
        cycle_instance_id,
        time_horizon,
        importance_score,
        ai_clarity_score,
        ai_strategic_relevance_score,
        ai_feasibility_score,
        ai_fit_to_company_score,
        ai_confidence_score,
        ai_external_internal_classification,
        ai_short_long_term_classification,
        ai_exploit_explore_classification,
        ai_issues_json,
        ai_improvement_suggestion,
        ai_summary,
        ai_objective_score,
        ai_evaluation_status,
        ai_evaluated_at,
        ai_evaluation_version,
        ai_manual_override,
        ai_manual_comment,
        created_by_membership_id,
        created_by_source,
        objective_health_override,
        objective_health_override_by_membership_id,
        objective_health_override_at,
        objective_review_comment,
        strategy_carry_source_id,
        strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case
          when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title)
          else v_rec.title
        end,
        case
          when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description)
          else v_rec.description
        end,
        v_rec.status,
        v_rec.owner_membership_id,
        v_rec.deputy_membership_id,
        v_rec.progress_percent,
        p_to_cycle_instance_id,
        case
          when v_decision = 'change' then coalesce(
            v_elem #>> '{proposed_changes,time_horizon}',
            v_rec.time_horizon
          )
          else v_rec.time_horizon
        end,
        v_rec.importance_score,
        v_rec.ai_clarity_score,
        v_rec.ai_strategic_relevance_score,
        v_rec.ai_feasibility_score,
        v_rec.ai_fit_to_company_score,
        v_rec.ai_confidence_score,
        v_rec.ai_external_internal_classification,
        v_rec.ai_short_long_term_classification,
        v_rec.ai_exploit_explore_classification,
        v_rec.ai_issues_json,
        v_rec.ai_improvement_suggestion,
        v_rec.ai_summary,
        v_rec.ai_objective_score,
        v_rec.ai_evaluation_status,
        v_rec.ai_evaluated_at,
        v_rec.ai_evaluation_version,
        v_rec.ai_manual_override,
        v_rec.ai_manual_comment,
        v_rec.created_by_membership_id,
        v_rec.created_by_source,
        v_rec.objective_health_override,
        v_rec.objective_health_override_by_membership_id,
        v_rec.objective_health_override_at,
        v_rec.objective_review_comment,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object(
          'strategy_review_carry',
          true,
          'decision',
          v_decision
        )
      )
      returning id into v_new_str;
      v_strategy_objective_map := v_strategy_objective_map || jsonb_build_object(v_old::text, v_new_str);

      for v_okr in
        select
          o.*
        from
          app.okr_objectives o
          join app.okr_objective_strategy_objectives j on j.okr_objective_id = o.id
        where
          j.strategy_objective_id = v_old
          and o.organization_id = v_org
          and o.cycle_instance_id = p_from_cycle_instance_id
      loop
        select
          oc2.id into v_to_okr
        from
          app.okr_cycles oc1
          join app.okr_cycles oc2
            on oc1.organization_id = oc2.organization_id
            and oc1.start_date = oc2.start_date
            and oc1.end_date = oc2.end_date
        where
          oc1.id = v_okr.okr_cycle_id
          and oc2.cycle_instance_id = p_to_cycle_instance_id
        limit 1;
        if v_to_okr is null then
          continue;
        end if;
        insert into app.okr_objectives (
          organization_id,
          cycle_id,
          cycle_instance_id,
          okr_cycle_id,
          title,
          description,
          status,
          owner_membership_id,
          deputy_membership_id,
          confidence_level,
          importance_score,
          time_horizon,
          created_by_membership_id,
          created_by_source
        )
        values (
          v_okr.organization_id,
          v_planning_to,
          p_to_cycle_instance_id,
          v_to_okr,
          v_okr.title,
          v_okr.description,
          case v_okr.status
            when 'shifted' then 'draft'::text
            else v_okr.status
          end,
          v_okr.owner_membership_id,
          v_okr.deputy_membership_id,
          v_okr.confidence_level,
          v_okr.importance_score,
          v_okr.time_horizon,
          v_okr.created_by_membership_id,
          v_okr.created_by_source
        )
        returning id into v_new_okr;
        v_okr_objective_map := v_okr_objective_map || jsonb_build_object(v_okr.id::text, v_new_okr);
        insert into app.okr_objective_strategy_objectives (okr_objective_id, strategy_objective_id)
        values (v_new_okr, v_new_str);
        for v_kr in
          select
            kr.*
          from
            app.key_results kr
          where
            kr.okr_objective_id = v_okr.id
        loop
          insert into app.key_results (
            organization_id,
            okr_objective_id,
            title,
            metric_type,
            start_value,
            target_value,
            current_value,
            status,
            due_date,
            measurement_unit,
            created_by_membership_id,
            created_by_source,
            owner_membership_id,
            deputy_membership_id
          )
          values (
            v_kr.organization_id,
            v_new_okr,
            v_kr.title,
            v_kr.metric_type,
            v_kr.start_value,
            v_kr.target_value,
            v_kr.current_value,
            v_kr.status,
            v_kr.due_date,
            v_kr.measurement_unit,
            v_kr.created_by_membership_id,
            v_kr.created_by_source,
            v_kr.owner_membership_id,
            v_kr.deputy_membership_id
          )
          returning id into v_new_kr;
          v_kr_map := v_kr_map || jsonb_build_object(v_kr.id::text, v_new_kr);
        end loop;
      end loop;
    end if;
  end loop;

  insert into app.objective_direction_links (
    organization_id,
    planning_cycle_id,
    strategy_objective_id,
    strategic_direction_id,
    contribution_level,
    comment,
    cycle_instance_id
  )
  select
    l.organization_id,
    v_planning_to,
    (v_strategy_objective_map ->> l.strategy_objective_id::text)::uuid,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    l.contribution_level,
    l.comment,
    p_to_cycle_instance_id
  from
    app.objective_direction_links l
  where
    l.cycle_instance_id = p_from_cycle_instance_id
    and v_strategy_objective_map ? l.strategy_objective_id::text
    and v_direction_map ? l.strategic_direction_id::text;

  insert into app.strategic_direction_objective_links (
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    strategic_direction_id,
    strategy_objective_id,
    created_by_membership_id,
    contribution_level
  )
  select
    l.organization_id,
    v_planning_to,
    p_to_cycle_instance_id,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    (v_strategy_objective_map ->> l.strategy_objective_id::text)::uuid,
    l.created_by_membership_id,
    l.contribution_level
  from
    app.strategic_direction_objective_links l
  where
    l.cycle_instance_id = p_from_cycle_instance_id
    and v_strategy_objective_map ? l.strategy_objective_id::text
    and v_direction_map ? l.strategic_direction_id::text;

  insert into app.challenge_direction_links (
    organization_id,
    planning_cycle_id,
    strategic_direction_id,
    strategic_challenge_id,
    contribution_level,
    note,
    created_by_membership_id,
    cycle_instance_id
  )
  select
    l.organization_id,
    v_planning_to,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    (v_challenge_map ->> l.strategic_challenge_id::text)::uuid,
    l.contribution_level,
    l.note,
    l.created_by_membership_id,
    p_to_cycle_instance_id
  from
    app.challenge_direction_links l
  where
    l.cycle_instance_id = p_from_cycle_instance_id
    and v_direction_map ? l.strategic_direction_id::text
    and v_challenge_map ? l.strategic_challenge_id::text;

  for v_prog in
    select
      *
    from
      app.strategy_programs
    where
      organization_id = v_org
      and cycle_instance_id = p_from_cycle_instance_id
  loop
    v_ch_ok := v_prog.strategic_challenge_id is null
    or v_challenge_map ? v_prog.strategic_challenge_id::text;
    v_dir_ok := v_prog.strategic_direction_id is null
    or v_direction_map ? v_prog.strategic_direction_id::text;
    v_supported := v_prog.supported_objective_ids;
    v_mapped := app._remap_uuid_array_from_map (v_supported, v_strategy_objective_map);
    if v_ch_ok
    and v_dir_ok
    and (
      cardinality(v_supported) = 0
      or cardinality(v_mapped) > 0
    ) then
      insert into app.strategy_programs (
        organization_id,
        planning_cycle_id,
        cycle_instance_id,
        strategic_direction_id,
        title,
        description,
        owner_membership_id,
        budget_total,
        timeline,
        created_by_membership_id,
        status,
        review_comment,
        strategic_challenge_id,
        program_origin,
        matrix_cell_score,
        supported_objective_ids,
        start_date,
        end_date
      )
      values (
        v_prog.organization_id,
        v_planning_to,
        p_to_cycle_instance_id,
        case
          when v_prog.strategic_direction_id is not null then (
            v_direction_map ->> v_prog.strategic_direction_id::text
          )::uuid
        end,
        v_prog.title,
        v_prog.description,
        v_prog.owner_membership_id,
        v_prog.budget_total,
        v_prog.timeline,
        v_prog.created_by_membership_id,
        v_prog.status,
        v_prog.review_comment,
        case
          when v_prog.strategic_challenge_id is not null then (
            v_challenge_map ->> v_prog.strategic_challenge_id::text
          )::uuid
        end,
        v_prog.program_origin,
        v_prog.matrix_cell_score,
        case
          when cardinality(v_supported) = 0 then v_supported
          else v_mapped
        end,
        v_prog.start_date,
        v_prog.end_date
      )
      returning id into v_new_prog;
      v_program_map := v_program_map || jsonb_build_object(v_prog.id::text, v_new_prog);
    else
      v_programs_skipped := v_programs_skipped || jsonb_build_object(
        'program_id',
        v_prog.id,
        'reason',
        'references_not_carried'
      );
    end if;
  end loop;

  for v_init in
    select
      *
    from
      app.initiatives
    where
      organization_id = v_org
      and cycle_instance_id = p_from_cycle_instance_id
  loop
    if not (v_program_map ? v_init.program_id::text) then
      v_inits_skipped := v_inits_skipped || jsonb_build_object('initiative_id', v_init.id, 'reason', 'program_not_carried');
      continue;
    end if;
    if not exists (
      select
        1
      from
        app.initiative_key_result_links l
      where
        l.initiative_id = v_init.id
        and l.cycle_instance_id = p_from_cycle_instance_id
        and v_kr_map ? l.key_result_id::text
    ) then
      v_inits_skipped := v_inits_skipped || jsonb_build_object('initiative_id', v_init.id, 'reason', 'no_carried_kr_link');
      continue;
    end if;
    insert into app.initiatives (
      organization_id,
      planning_cycle_id,
      title,
      description,
      owner_membership_id,
      start_date,
      end_date,
      status,
      priority,
      budget,
      created_by_membership_id,
      cycle_instance_id,
      program_id,
      linked_okrs,
      deliverables,
      created_by_source,
      execution_health_override,
      execution_health_override_by_membership_id,
      execution_health_override_at,
      review_comment,
      weight,
      progress_percent,
      last_review_update_at
    )
    values (
      v_init.organization_id,
      v_planning_to,
      v_init.title,
      v_init.description,
      v_init.owner_membership_id,
      v_init.start_date,
      v_init.end_date,
      v_init.status,
      v_init.priority,
      v_init.budget,
      v_init.created_by_membership_id,
      p_to_cycle_instance_id,
      (v_program_map ->> v_init.program_id::text)::uuid,
      v_init.linked_okrs,
      v_init.deliverables,
      v_init.created_by_source,
      v_init.execution_health_override,
      v_init.execution_health_override_by_membership_id,
      v_init.execution_health_override_at,
      v_init.review_comment,
      v_init.weight,
      v_init.progress_percent,
      v_init.last_review_update_at
    )
    returning id into v_new_init;
    insert into app.initiative_key_result_links (
      organization_id,
      cycle_instance_id,
      initiative_id,
      key_result_id
    )
    select
      v_init.organization_id,
      p_to_cycle_instance_id,
      v_new_init,
      (v_kr_map ->> l.key_result_id::text)::uuid
    from
      app.initiative_key_result_links l
    where
      l.initiative_id = v_init.id
      and l.cycle_instance_id = p_from_cycle_instance_id
      and v_kr_map ? l.key_result_id::text;
  end loop;

  v_summary := jsonb_build_object(
    'challenge_map',
    v_challenge_map,
    'direction_map',
    v_direction_map,
    'strategy_objective_map',
    v_strategy_objective_map,
    'okr_objective_map',
    v_okr_objective_map,
    'key_result_map',
    v_kr_map,
    'program_map',
    v_program_map,
    'programs_skipped',
    v_programs_skipped,
    'initiatives_skipped',
    v_inits_skipped
  );
  return v_summary;
end;
$$;

alter table app.okr_objectives
  drop constraint if exists okr_objectives_progress_percent_check;

alter table app.okr_objectives
  drop column if exists progress_percent;

-- migrate:down
-- Nicht rueckgaengig: Spalte und RPCs waeren manuell wiederherzustellen.
