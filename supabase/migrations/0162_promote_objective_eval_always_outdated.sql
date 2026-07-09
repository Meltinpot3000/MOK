-- migrate:up

-- Bugfix: Beim Promoten einer Objective-Revision wurde der AI-Bewertungsstatus
-- aus dem Definition-Payload-Snapshot übernommen (v_ai ->> 'status'), sofern der
-- Definition-Hash unverändert war. Dieser Snapshot ist bei mehrfachen Revisionen
-- veraltet ('valid') und wurde dadurch faelschlich als "aktuell" angezeigt, obwohl
-- keine erneute Sentinel-Bewertung durchgefuehrt wurde.
--
-- Fix: Nach dem Promoten gilt die bisherige Bewertung grundsaetzlich als veraltet
-- ('outdated'). Die zuletzt bekannten Scores/Klassifikationen bleiben zur Anzeige
-- erhalten (coalesce), nur der Status signalisiert, dass eine Neubewertung noetig ist.

create or replace function app._sync_legacy_strategy_object_on_promotion(
  p_object_type text,
  p_old_revision_id uuid,
  p_new_revision_id uuid,
  p_title text,
  p_description text,
  p_definition_payload jsonb,
  p_legacy_status text,
  p_hash_changed boolean
)
returns void
language plpgsql
security definer
set search_path = app, public
as $fn$
declare
  v_old_challenge record;
  v_old_direction record;
  v_old_objective record;
  v_payload jsonb := coalesce(p_definition_payload, '{}'::jsonb);
  v_ai jsonb;
begin
  if p_object_type = 'strategic_challenge' then
    select * into v_old_challenge
    from app.strategic_challenges
    where id = p_old_revision_id;

    if v_old_challenge.id is null then
      raise exception 'strategy-object-legacy-challenge-not-found';
    end if;

    insert into app.strategic_challenges (
      id,
      organization_id,
      planning_cycle_id,
      cycle_instance_id,
      title,
      description,
      priority,
      visibility,
      impact_score,
      urgency_score,
      scope_score,
      root_cause_score,
      challenge_score,
      relevance_level,
      risk_level,
      source_cluster_id,
      source_analysis_entry_id,
      strategy_carry_source_id,
      strategy_carry_metadata,
      created_by_membership_id,
      created_by_source
    )
    values (
      p_new_revision_id,
      v_old_challenge.organization_id,
      v_old_challenge.planning_cycle_id,
      v_old_challenge.cycle_instance_id,
      p_title,
      p_description,
      coalesce((v_payload ->> 'priority')::smallint, v_old_challenge.priority),
      coalesce(v_payload ->> 'visibility', v_old_challenge.visibility),
      coalesce((v_payload ->> 'impact_score')::smallint, v_old_challenge.impact_score),
      coalesce((v_payload ->> 'urgency_score')::smallint, v_old_challenge.urgency_score),
      coalesce((v_payload ->> 'scope_score')::smallint, v_old_challenge.scope_score),
      coalesce((v_payload ->> 'root_cause_score')::smallint, v_old_challenge.root_cause_score),
      coalesce((v_payload ->> 'challenge_score')::smallint, v_old_challenge.challenge_score),
      coalesce((v_payload ->> 'relevance_level')::smallint, v_old_challenge.relevance_level),
      coalesce((v_payload ->> 'risk_level')::smallint, v_old_challenge.risk_level),
      coalesce((v_payload ->> 'source_cluster_id')::uuid, v_old_challenge.source_cluster_id),
      coalesce((v_payload ->> 'source_analysis_entry_id')::uuid, v_old_challenge.source_analysis_entry_id),
      v_old_challenge.strategy_carry_source_id,
      coalesce(v_payload -> 'strategy_carry_metadata', v_old_challenge.strategy_carry_metadata),
      v_old_challenge.created_by_membership_id,
      coalesce(v_payload ->> 'created_by_source', v_old_challenge.created_by_source)
    );

    return;
  end if;

  if p_object_type = 'strategic_direction' then
    select * into v_old_direction
    from app.strategic_directions
    where id = p_old_revision_id;

    if v_old_direction.id is null then
      raise exception 'strategy-object-legacy-direction-not-found';
    end if;

    insert into app.strategic_directions (
      id,
      organization_id,
      planning_cycle_id,
      cycle_instance_id,
      title,
      description,
      owner_membership_id,
      priority,
      status,
      grouping,
      relevance_level,
      risk_level,
      strategic_value_score,
      capability_fit_score,
      feasibility_score,
      strategy_carry_source_id,
      strategy_carry_metadata,
      created_by_membership_id
    )
    values (
      p_new_revision_id,
      v_old_direction.organization_id,
      v_old_direction.planning_cycle_id,
      v_old_direction.cycle_instance_id,
      p_title,
      p_description,
      v_old_direction.owner_membership_id,
      coalesce((v_payload ->> 'priority')::smallint, v_old_direction.priority),
      coalesce(p_legacy_status, v_old_direction.status),
      coalesce(v_payload ->> 'grouping', v_old_direction.grouping),
      coalesce((v_payload ->> 'relevance_level')::smallint, v_old_direction.relevance_level),
      coalesce((v_payload ->> 'risk_level')::smallint, v_old_direction.risk_level),
      coalesce((v_payload ->> 'strategic_value_score')::smallint, v_old_direction.strategic_value_score),
      coalesce((v_payload ->> 'capability_fit_score')::smallint, v_old_direction.capability_fit_score),
      coalesce((v_payload ->> 'feasibility_score')::smallint, v_old_direction.feasibility_score),
      v_old_direction.strategy_carry_source_id,
      coalesce(v_payload -> 'strategy_carry_metadata', v_old_direction.strategy_carry_metadata),
      v_old_direction.created_by_membership_id
    );

    update app.strategic_directions
    set status = 'archived'
    where id = p_old_revision_id
      and status <> 'archived';

    return;
  end if;

  if p_object_type = 'strategic_objective' then
    select * into v_old_objective
    from app.strategy_objectives
    where id = p_old_revision_id;

    if v_old_objective.id is null then
      raise exception 'strategy-object-legacy-objective-not-found';
    end if;

    v_ai := coalesce(v_payload -> 'ai_evaluation', '{}'::jsonb);

    insert into app.strategy_objectives (
      id,
      organization_id,
      cycle_id,
      cycle_instance_id,
      title,
      description,
      status,
      owner_membership_id,
      deputy_membership_id,
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
      strategy_carry_source_id,
      strategy_carry_metadata
    )
    values (
      p_new_revision_id,
      v_old_objective.organization_id,
      v_old_objective.cycle_id,
      v_old_objective.cycle_instance_id,
      p_title,
      p_description,
      coalesce(p_legacy_status, v_old_objective.status, 'active'),
      coalesce((v_payload ->> 'owner_membership_id')::uuid, v_old_objective.owner_membership_id),
      coalesce((v_payload ->> 'deputy_membership_id')::uuid, v_old_objective.deputy_membership_id),
      coalesce(v_payload ->> 'time_horizon', v_old_objective.time_horizon),
      coalesce((v_payload ->> 'importance_score')::smallint, v_old_objective.importance_score),
      coalesce((v_ai ->> 'clarity_score')::smallint, v_old_objective.ai_clarity_score),
      coalesce((v_ai ->> 'strategic_relevance_score')::smallint, v_old_objective.ai_strategic_relevance_score),
      coalesce((v_ai ->> 'feasibility_score')::smallint, v_old_objective.ai_feasibility_score),
      coalesce((v_ai ->> 'fit_to_company_score')::smallint, v_old_objective.ai_fit_to_company_score),
      coalesce((v_ai ->> 'confidence_score')::smallint, v_old_objective.ai_confidence_score),
      coalesce(v_ai ->> 'external_internal_classification', v_old_objective.ai_external_internal_classification),
      coalesce(v_ai ->> 'short_long_term_classification', v_old_objective.ai_short_long_term_classification),
      coalesce(v_ai ->> 'exploit_explore_classification', v_old_objective.ai_exploit_explore_classification),
      coalesce(v_ai -> 'issues_json', v_old_objective.ai_issues_json),
      coalesce(v_ai ->> 'suggestion', v_old_objective.ai_improvement_suggestion),
      coalesce(v_ai ->> 'summary', v_old_objective.ai_summary),
      coalesce((v_ai ->> 'objective_score')::numeric, v_old_objective.ai_objective_score),
      -- Nach Promotion gilt die Bewertung immer als veraltet, bis eine erneute
      -- Sentinel-Bewertung explizit durchgefuehrt wird. Der zuvor gespeicherte
      -- Payload-Status ('valid') wird bewusst ignoriert, weil er die neue,
      -- promovierte Definition nicht widerspiegelt.
      case
        when coalesce(v_old_objective.ai_evaluation_status, 'not_run') = 'not_run' then 'not_run'
        else 'outdated'
      end,
      coalesce((v_ai ->> 'evaluated_at')::timestamptz, v_old_objective.ai_evaluated_at),
      coalesce(v_ai ->> 'evaluation_version', v_old_objective.ai_evaluation_version),
      coalesce((v_ai ->> 'manual_override')::boolean, v_old_objective.ai_manual_override),
      coalesce(v_ai ->> 'manual_comment', v_old_objective.ai_manual_comment),
      v_old_objective.created_by_membership_id,
      coalesce(v_payload ->> 'created_by_source', v_old_objective.created_by_source),
      v_old_objective.strategy_carry_source_id,
      coalesce(v_payload -> 'strategy_carry_metadata', v_old_objective.strategy_carry_metadata)
    );

    update app.strategy_objectives
    set status = 'archived'
    where id = p_old_revision_id
      and status <> 'archived';

    return;
  end if;

  raise exception 'strategy-object-invalid-type';
end;
$fn$;

-- migrate:down

-- Wiederherstellung der vorherigen (fehlerhaften) Hash-basierten Status-Logik.
create or replace function app._sync_legacy_strategy_object_on_promotion(
  p_object_type text,
  p_old_revision_id uuid,
  p_new_revision_id uuid,
  p_title text,
  p_description text,
  p_definition_payload jsonb,
  p_legacy_status text,
  p_hash_changed boolean
)
returns void
language plpgsql
security definer
set search_path = app, public
as $fn$
declare
  v_old_challenge record;
  v_old_direction record;
  v_old_objective record;
  v_payload jsonb := coalesce(p_definition_payload, '{}'::jsonb);
  v_ai jsonb;
begin
  if p_object_type = 'strategic_challenge' then
    select * into v_old_challenge from app.strategic_challenges where id = p_old_revision_id;
    if v_old_challenge.id is null then raise exception 'strategy-object-legacy-challenge-not-found'; end if;
    insert into app.strategic_challenges (
      id, organization_id, planning_cycle_id, cycle_instance_id, title, description, priority, visibility,
      impact_score, urgency_score, scope_score, root_cause_score, challenge_score, relevance_level, risk_level,
      source_cluster_id, source_analysis_entry_id, strategy_carry_source_id, strategy_carry_metadata,
      created_by_membership_id, created_by_source
    )
    values (
      p_new_revision_id, v_old_challenge.organization_id, v_old_challenge.planning_cycle_id, v_old_challenge.cycle_instance_id,
      p_title, p_description,
      coalesce((v_payload ->> 'priority')::smallint, v_old_challenge.priority),
      coalesce(v_payload ->> 'visibility', v_old_challenge.visibility),
      coalesce((v_payload ->> 'impact_score')::smallint, v_old_challenge.impact_score),
      coalesce((v_payload ->> 'urgency_score')::smallint, v_old_challenge.urgency_score),
      coalesce((v_payload ->> 'scope_score')::smallint, v_old_challenge.scope_score),
      coalesce((v_payload ->> 'root_cause_score')::smallint, v_old_challenge.root_cause_score),
      coalesce((v_payload ->> 'challenge_score')::smallint, v_old_challenge.challenge_score),
      coalesce((v_payload ->> 'relevance_level')::smallint, v_old_challenge.relevance_level),
      coalesce((v_payload ->> 'risk_level')::smallint, v_old_challenge.risk_level),
      coalesce((v_payload ->> 'source_cluster_id')::uuid, v_old_challenge.source_cluster_id),
      coalesce((v_payload ->> 'source_analysis_entry_id')::uuid, v_old_challenge.source_analysis_entry_id),
      v_old_challenge.strategy_carry_source_id,
      coalesce(v_payload -> 'strategy_carry_metadata', v_old_challenge.strategy_carry_metadata),
      v_old_challenge.created_by_membership_id,
      coalesce(v_payload ->> 'created_by_source', v_old_challenge.created_by_source)
    );
    return;
  end if;

  if p_object_type = 'strategic_direction' then
    select * into v_old_direction from app.strategic_directions where id = p_old_revision_id;
    if v_old_direction.id is null then raise exception 'strategy-object-legacy-direction-not-found'; end if;
    insert into app.strategic_directions (
      id, organization_id, planning_cycle_id, cycle_instance_id, title, description, owner_membership_id, priority,
      status, grouping, relevance_level, risk_level, strategic_value_score, capability_fit_score, feasibility_score,
      strategy_carry_source_id, strategy_carry_metadata, created_by_membership_id
    )
    values (
      p_new_revision_id, v_old_direction.organization_id, v_old_direction.planning_cycle_id, v_old_direction.cycle_instance_id,
      p_title, p_description, v_old_direction.owner_membership_id,
      coalesce((v_payload ->> 'priority')::smallint, v_old_direction.priority),
      coalesce(p_legacy_status, v_old_direction.status),
      coalesce(v_payload ->> 'grouping', v_old_direction.grouping),
      coalesce((v_payload ->> 'relevance_level')::smallint, v_old_direction.relevance_level),
      coalesce((v_payload ->> 'risk_level')::smallint, v_old_direction.risk_level),
      coalesce((v_payload ->> 'strategic_value_score')::smallint, v_old_direction.strategic_value_score),
      coalesce((v_payload ->> 'capability_fit_score')::smallint, v_old_direction.capability_fit_score),
      coalesce((v_payload ->> 'feasibility_score')::smallint, v_old_direction.feasibility_score),
      v_old_direction.strategy_carry_source_id,
      coalesce(v_payload -> 'strategy_carry_metadata', v_old_direction.strategy_carry_metadata),
      v_old_direction.created_by_membership_id
    );
    update app.strategic_directions set status = 'archived' where id = p_old_revision_id and status <> 'archived';
    return;
  end if;

  if p_object_type = 'strategic_objective' then
    select * into v_old_objective from app.strategy_objectives where id = p_old_revision_id;
    if v_old_objective.id is null then raise exception 'strategy-object-legacy-objective-not-found'; end if;
    v_ai := coalesce(v_payload -> 'ai_evaluation', '{}'::jsonb);
    insert into app.strategy_objectives (
      id, organization_id, cycle_id, cycle_instance_id, title, description, status, owner_membership_id,
      deputy_membership_id, time_horizon, importance_score, ai_clarity_score, ai_strategic_relevance_score,
      ai_feasibility_score, ai_fit_to_company_score, ai_confidence_score, ai_external_internal_classification,
      ai_short_long_term_classification, ai_exploit_explore_classification, ai_issues_json, ai_improvement_suggestion,
      ai_summary, ai_objective_score, ai_evaluation_status, ai_evaluated_at, ai_evaluation_version, ai_manual_override,
      ai_manual_comment, created_by_membership_id, created_by_source, strategy_carry_source_id, strategy_carry_metadata
    )
    values (
      p_new_revision_id, v_old_objective.organization_id, v_old_objective.cycle_id, v_old_objective.cycle_instance_id,
      p_title, p_description,
      coalesce(p_legacy_status, v_old_objective.status, 'active'),
      coalesce((v_payload ->> 'owner_membership_id')::uuid, v_old_objective.owner_membership_id),
      coalesce((v_payload ->> 'deputy_membership_id')::uuid, v_old_objective.deputy_membership_id),
      coalesce(v_payload ->> 'time_horizon', v_old_objective.time_horizon),
      coalesce((v_payload ->> 'importance_score')::smallint, v_old_objective.importance_score),
      coalesce((v_ai ->> 'clarity_score')::smallint, v_old_objective.ai_clarity_score),
      coalesce((v_ai ->> 'strategic_relevance_score')::smallint, v_old_objective.ai_strategic_relevance_score),
      coalesce((v_ai ->> 'feasibility_score')::smallint, v_old_objective.ai_feasibility_score),
      coalesce((v_ai ->> 'fit_to_company_score')::smallint, v_old_objective.ai_fit_to_company_score),
      coalesce((v_ai ->> 'confidence_score')::smallint, v_old_objective.ai_confidence_score),
      coalesce(v_ai ->> 'external_internal_classification', v_old_objective.ai_external_internal_classification),
      coalesce(v_ai ->> 'short_long_term_classification', v_old_objective.ai_short_long_term_classification),
      coalesce(v_ai ->> 'exploit_explore_classification', v_old_objective.ai_exploit_explore_classification),
      coalesce(v_ai -> 'issues_json', v_old_objective.ai_issues_json),
      coalesce(v_ai ->> 'suggestion', v_old_objective.ai_improvement_suggestion),
      coalesce(v_ai ->> 'summary', v_old_objective.ai_summary),
      coalesce((v_ai ->> 'objective_score')::numeric, v_old_objective.ai_objective_score),
      case when p_hash_changed then 'outdated' else coalesce(v_ai ->> 'status', v_old_objective.ai_evaluation_status) end,
      coalesce((v_ai ->> 'evaluated_at')::timestamptz, v_old_objective.ai_evaluated_at),
      coalesce(v_ai ->> 'evaluation_version', v_old_objective.ai_evaluation_version),
      coalesce((v_ai ->> 'manual_override')::boolean, v_old_objective.ai_manual_override),
      coalesce(v_ai ->> 'manual_comment', v_old_objective.ai_manual_comment),
      v_old_objective.created_by_membership_id,
      coalesce(v_payload ->> 'created_by_source', v_old_objective.created_by_source),
      v_old_objective.strategy_carry_source_id,
      coalesce(v_payload -> 'strategy_carry_metadata', v_old_objective.strategy_carry_metadata)
    );
    update app.strategy_objectives set status = 'archived' where id = p_old_revision_id and status <> 'archived';
    return;
  end if;

  raise exception 'strategy-object-invalid-type';
end;
$fn$;
