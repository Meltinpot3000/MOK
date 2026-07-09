-- 0153_strategy_object_revision_rpcs.sql
-- Phase 3: Generic revision workflow RPCs + P0 link remap on promotion.
-- migrate:up

create or replace function app._remap_uuid_array_from_map(p_arr uuid[], p_map jsonb)
returns uuid[]
language sql
immutable
parallel safe
as $$
  select coalesce(
    array_agg(
      case
        when p_map ? x::text then (p_map ->> x::text)::uuid
        else x
      end
      order by ord
    ),
    '{}'::uuid[]
  )
  from unnest(coalesce(p_arr, '{}'::uuid[])) with ordinality as t(x, ord);
$$;

create or replace function app._strategy_object_assert_write_access(p_organization_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_actor uuid;
begin
  v_actor := app.current_membership_id(p_organization_id);
  if v_actor is null then
    raise exception 'strategy-object-auth-required';
  end if;
  if not (
    app.has_permission(p_organization_id, 'nav.strategy-cycle.write')
    or app.has_permission(p_organization_id, 'nav.strategy-matrix.write')
    or app.has_permission(p_organization_id, 'okr.write')
  ) then
    raise exception 'strategy-object-write-forbidden';
  end if;
  return v_actor;
end;
$fn$;

create or replace function app.assert_strategy_object_definition_editable(p_revision_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_org uuid;
  v_revision_state text;
  v_lifecycle_state text;
begin
  select r.organization_id, r.revision_state, i.lifecycle_state
    into v_org, v_revision_state, v_lifecycle_state
  from app.strategy_object_revisions r
  join app.strategy_object_identities i on i.id = r.object_identity_id
  where r.id = p_revision_id;

  if v_org is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  perform app._strategy_object_assert_write_access(v_org);

  if v_revision_state = 'current' and v_lifecycle_state <> 'draft' then
    raise exception 'strategy-object-definition-locked';
  end if;
end;
$fn$;

create or replace function app.create_strategy_object_draft(p_base_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_actor uuid;
  v_base record;
  v_next_number integer;
  v_open_count integer;
  v_new_id uuid;
  v_hash text;
begin
  select
    r.id,
    r.object_identity_id,
    r.organization_id,
    r.cycle_instance_id,
    r.revision_state,
    r.revision_number,
    r.title,
    r.description,
    r.definition_payload,
    r.legacy_status,
    i.object_type,
    i.lifecycle_state
  into v_base
  from app.strategy_object_revisions r
  join app.strategy_object_identities i on i.id = r.object_identity_id
  where r.id = p_base_revision_id;

  if v_base.id is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  v_actor := app._strategy_object_assert_write_access(v_base.organization_id);

  if v_base.revision_state <> 'current' then
    raise exception 'strategy-object-draft-base-not-current';
  end if;

  select count(*)::integer
    into v_open_count
  from app.strategy_object_revisions r
  where r.object_identity_id = v_base.object_identity_id
    and r.cycle_instance_id = v_base.cycle_instance_id
    and r.revision_state in ('draft', 'pending_approval');

  if v_open_count > 0 then
    raise exception 'strategy-object-draft-already-exists';
  end if;

  select coalesce(max(r.revision_number), 0) + 1
    into v_next_number
  from app.strategy_object_revisions r
  where r.object_identity_id = v_base.object_identity_id
    and r.cycle_instance_id = v_base.cycle_instance_id;

  v_hash := app.strategy_object_definition_hash(
    v_base.object_type,
    v_base.title,
    v_base.description,
    v_base.definition_payload
  );

  v_new_id := gen_random_uuid();

  insert into app.strategy_object_revisions (
    id,
    object_identity_id,
    organization_id,
    cycle_instance_id,
    revision_number,
    revision_state,
    title,
    description,
    definition_payload,
    definition_hash,
    supersedes_revision_id,
    legacy_status,
    created_by_membership_id
  )
  values (
    v_new_id,
    v_base.object_identity_id,
    v_base.organization_id,
    v_base.cycle_instance_id,
    v_next_number,
    'draft',
    v_base.title,
    v_base.description,
    v_base.definition_payload,
    v_hash,
    v_base.id,
    v_base.legacy_status,
    v_actor
  );

  return v_new_id;
end;
$fn$;

create or replace function app.update_strategy_object_draft(
  p_revision_id uuid,
  p_title text,
  p_description text,
  p_definition_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_rec record;
  v_hash text;
begin
  select
    r.organization_id,
    r.revision_state,
    i.object_type
  into v_rec
  from app.strategy_object_revisions r
  join app.strategy_object_identities i on i.id = r.object_identity_id
  where r.id = p_revision_id;

  if v_rec.organization_id is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  perform app._strategy_object_assert_write_access(v_rec.organization_id);

  if v_rec.revision_state not in ('draft', 'pending_approval') then
    raise exception 'strategy-object-revision-not-editable';
  end if;

  v_hash := app.strategy_object_definition_hash(
    v_rec.object_type,
    p_title,
    p_description,
    coalesce(p_definition_payload, '{}'::jsonb)
  );

  update app.strategy_object_revisions r
  set
    title = coalesce(nullif(btrim(p_title), ''), r.title),
    description = p_description,
    definition_payload = coalesce(p_definition_payload, '{}'::jsonb),
    definition_hash = v_hash
  where r.id = p_revision_id;
end;
$fn$;

create or replace function app.submit_strategy_object_revision(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_org uuid;
  v_state text;
begin
  select r.organization_id, r.revision_state
    into v_org, v_state
  from app.strategy_object_revisions r
  where r.id = p_revision_id;

  if v_org is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  perform app._strategy_object_assert_write_access(v_org);

  if v_state <> 'draft' then
    raise exception 'strategy-object-revision-not-submittable';
  end if;

  update app.strategy_object_revisions
  set revision_state = 'pending_approval'
  where id = p_revision_id;
end;
$fn$;

create or replace function app.reject_strategy_object_revision(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_org uuid;
  v_state text;
begin
  select r.organization_id, r.revision_state
    into v_org, v_state
  from app.strategy_object_revisions r
  where r.id = p_revision_id;

  if v_org is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  perform app._strategy_object_assert_write_access(v_org);

  if v_state not in ('draft', 'pending_approval') then
    raise exception 'strategy-object-revision-not-rejectable';
  end if;

  update app.strategy_object_revisions
  set revision_state = 'archived'
  where id = p_revision_id;
end;
$fn$;

create or replace function app.remap_strategy_object_links_on_promotion(
  p_organization_id uuid,
  p_cycle_instance_id uuid,
  p_object_type text,
  p_old_revision_id uuid,
  p_new_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = app, public
as $fn$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
  v_map jsonb;
begin
  if p_object_type = 'strategic_challenge' then
    update app.challenge_direction_links
    set strategic_challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('challenge_direction_links.challenge', v_n);

    update app.strategy_programs
    set strategic_challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.challenge', v_n);

    update app.strategy_correlation_status_overrides
    set challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.challenge', v_n);
  elsif p_object_type = 'strategic_direction' then
    update app.challenge_direction_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('challenge_direction_links.direction', v_n);

    update app.strategic_direction_objective_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategic_direction_objective_links', v_n);

    update app.objective_direction_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_direction_links.direction', v_n);

    update app.annual_targets
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('annual_targets', v_n);

    update app.strategy_programs
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.direction', v_n);

    update app.okr_objectives
    set leading_strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and leading_strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('okr_objectives.leading_direction', v_n);

    update app.strategy_correlation_status_overrides
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.direction', v_n);
  elsif p_object_type = 'strategic_objective' then
    update app.strategic_direction_objective_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategic_direction_objective_links.objective', v_n);

    update app.objective_direction_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_direction_links.objective', v_n);

    update app.okr_objective_strategy_objectives
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('okr_objective_strategy_objectives', v_n);

    update app.objective_target_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_target_links', v_n);

    v_map := jsonb_build_object(p_old_revision_id::text, p_new_revision_id);
    update app.strategy_programs p
    set supported_objective_ids = app._remap_uuid_array_from_map(p.supported_objective_ids, v_map)
    where p.organization_id = p_organization_id
      and p.cycle_instance_id = p_cycle_instance_id
      and p_old_revision_id = any (p.supported_objective_ids);
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.supported_objective_ids', v_n);

    update app.strategy_correlation_status_overrides
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.objective', v_n);
  end if;

  return v_counts;
end;
$fn$;

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
      case
        when p_hash_changed then 'outdated'
        else coalesce(v_ai ->> 'status', v_old_objective.ai_evaluation_status)
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

create or replace function app.promote_strategy_object_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_actor uuid;
  v_new record;
  v_old_current_id uuid;
  v_old_hash text;
  v_hash_changed boolean;
  v_legacy_table text;
  v_remap_counts jsonb;
begin
  select
    r.id,
    r.object_identity_id,
    r.organization_id,
    r.cycle_instance_id,
    r.revision_state,
    r.title,
    r.description,
    r.definition_payload,
    r.definition_hash,
    r.legacy_status,
    i.object_type
  into v_new
  from app.strategy_object_revisions r
  join app.strategy_object_identities i on i.id = r.object_identity_id
  where r.id = p_revision_id;

  if v_new.id is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  v_actor := app._strategy_object_assert_write_access(v_new.organization_id);

  if v_new.revision_state not in ('draft', 'pending_approval') then
    raise exception 'strategy-object-revision-not-promotable';
  end if;

  select r.id, r.definition_hash
    into v_old_current_id, v_old_hash
  from app.strategy_object_revisions r
  where r.object_identity_id = v_new.object_identity_id
    and r.cycle_instance_id = v_new.cycle_instance_id
    and r.revision_state = 'current'
  for update;

  if v_old_current_id is null then
    raise exception 'strategy-object-current-revision-missing';
  end if;

  v_hash_changed := v_old_hash is distinct from v_new.definition_hash;

  update app.strategy_object_revisions
  set revision_state = 'superseded'
  where id = v_old_current_id;

  update app.strategy_object_revisions
  set revision_state = 'current'
  where id = p_revision_id;

  if v_hash_changed then
    v_remap_counts := app.remap_strategy_object_links_on_promotion(
      v_new.organization_id,
      v_new.cycle_instance_id,
      v_new.object_type,
      v_old_current_id,
      p_revision_id
    );

    perform app._sync_legacy_strategy_object_on_promotion(
      v_new.object_type,
      v_old_current_id,
      p_revision_id,
      v_new.title,
      v_new.description,
      v_new.definition_payload,
      v_new.legacy_status,
      v_hash_changed
    );

    v_legacy_table := case v_new.object_type
      when 'strategic_challenge' then 'strategic_challenges'
      when 'strategic_direction' then 'strategic_directions'
      else 'strategy_objectives'
    end;

    insert into app.strategy_object_migration_map (
      organization_id,
      legacy_table,
      legacy_id,
      object_identity_id,
      revision_id,
      legacy_id_preserved
    )
    values (
      v_new.organization_id,
      v_legacy_table,
      p_revision_id,
      v_new.object_identity_id,
      p_revision_id,
      false
    )
    on conflict (legacy_table, legacy_id) do nothing;
  end if;

  return p_revision_id;
end;
$fn$;

create or replace function app.upsert_strategy_object_assessment(
  p_object_identity_id uuid,
  p_revision_id uuid,
  p_operational_signal text,
  p_review_decision text,
  p_review_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_actor uuid;
  v_identity record;
  v_assessment_id uuid;
begin
  select i.organization_id, i.object_type, i.lifecycle_state
    into v_identity
  from app.strategy_object_identities i
  where i.id = p_object_identity_id;

  if v_identity.organization_id is null then
    raise exception 'strategy-object-identity-not-found';
  end if;

  v_actor := app._strategy_object_assert_write_access(v_identity.organization_id);

  if p_operational_signal not in ('on_track', 'watch', 'at_risk', 'completed', 'retired', 'removed') then
    raise exception 'strategy-object-invalid-operational-signal';
  end if;

  if p_review_decision not in (
    'reconfirm', 'escalate', 'deprioritize', 'revise', 'complete', 'retire', 'remove'
  ) then
    raise exception 'strategy-object-invalid-review-decision';
  end if;

  insert into app.strategy_object_review_assessments (
    organization_id,
    object_identity_id,
    revision_id,
    cycle_instance_id,
    assessment_source,
    review_decision,
    operational_signal,
    review_comment,
    assessed_by_membership_id
  )
  select
    v_identity.organization_id,
    p_object_identity_id,
    p_revision_id,
    r.cycle_instance_id,
    'manual',
    p_review_decision,
    p_operational_signal,
    p_review_comment,
    v_actor
  from app.strategy_object_revisions r
  where r.id = p_revision_id
  returning id into v_assessment_id;

  if v_assessment_id is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  return v_assessment_id;
end;
$fn$;

revoke all on function app._strategy_object_assert_write_access(uuid) from public;
grant execute on function app.assert_strategy_object_definition_editable(uuid) to authenticated;
grant execute on function app.create_strategy_object_draft(uuid) to authenticated;
grant execute on function app.update_strategy_object_draft(uuid, text, text, jsonb) to authenticated;
grant execute on function app.submit_strategy_object_revision(uuid) to authenticated;
grant execute on function app.reject_strategy_object_revision(uuid) to authenticated;
grant execute on function app.promote_strategy_object_revision(uuid) to authenticated;
grant execute on function app.remap_strategy_object_links_on_promotion(uuid, uuid, text, uuid, uuid) to authenticated;
grant execute on function app.upsert_strategy_object_assessment(uuid, uuid, text, text, text) to authenticated;

-- migrate:down

revoke execute on function app.upsert_strategy_object_assessment(uuid, uuid, text, text, text) from authenticated;
revoke execute on function app.remap_strategy_object_links_on_promotion(uuid, uuid, text, uuid, uuid) from authenticated;
revoke execute on function app.promote_strategy_object_revision(uuid) from authenticated;
revoke execute on function app.reject_strategy_object_revision(uuid) from authenticated;
revoke execute on function app.submit_strategy_object_revision(uuid) from authenticated;
revoke execute on function app.update_strategy_object_draft(uuid, text, text, jsonb) from authenticated;
revoke execute on function app.create_strategy_object_draft(uuid) from authenticated;
revoke execute on function app.assert_strategy_object_definition_editable(uuid) from authenticated;

drop function if exists app.upsert_strategy_object_assessment(uuid, uuid, text, text, text);
drop function if exists app.promote_strategy_object_revision(uuid);
drop function if exists app._sync_legacy_strategy_object_on_promotion(text, uuid, uuid, text, text, jsonb, text, boolean);
drop function if exists app.remap_strategy_object_links_on_promotion(uuid, uuid, text, uuid, uuid);
drop function if exists app.reject_strategy_object_revision(uuid);
drop function if exists app.submit_strategy_object_revision(uuid);
drop function if exists app.update_strategy_object_draft(uuid, text, text, jsonb);
drop function if exists app.create_strategy_object_draft(uuid);
drop function if exists app.assert_strategy_object_definition_editable(uuid);
drop function if exists app._strategy_object_assert_write_access(uuid);
