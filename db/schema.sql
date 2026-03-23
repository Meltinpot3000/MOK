\restrict dbmate

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--
-- Name: audit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA audit;


--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: rbac; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA rbac;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: _remap_uuid_array_from_map(uuid[], jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app._remap_uuid_array_from_map(p_arr uuid[], p_map jsonb) RETURNS uuid[]
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(
    array_agg((p_map ->> x::text)::uuid) filter (where p_map ? x::text),
    array[]::uuid[]
  )
  from unnest(coalesce(p_arr, array[]::uuid[])) as x;
$$;


--
-- Name: _strategy_review_current_membership(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app._strategy_review_current_membership(p_organization_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app', 'rbac', 'auth'
    AS $$
  select m.id
  from app.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;


--
-- Name: apply_strategy_review_decisions(uuid, uuid, uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.apply_strategy_review_decisions(p_review_id uuid, p_from_cycle_instance_id uuid, p_to_cycle_instance_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_org uuid;
  v_planning_to uuid;
  v_dec jsonb;
  v_challenge_map jsonb := '{}'::jsonb;
  v_direction_map jsonb := '{}'::jsonb;
  v_objective_map jsonb := '{}'::jsonb;
  v_kr_map jsonb := '{}'::jsonb;
  v_program_map jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_old uuid;
  v_new_obj uuid;
  v_new_kr uuid;
  v_decision text;
  v_rec record;
  v_summary jsonb := '{}'::jsonb;
  v_programs_skipped jsonb := '[]'::jsonb;
  v_inits_skipped jsonb := '[]'::jsonb;
  v_kr record;
  v_prog record;
  v_init record;
  v_new_prog uuid;
  v_new_init uuid;
  v_supported uuid[];
  v_mapped uuid[];
  v_dir_ok boolean;
  v_ch_ok boolean;
begin
  select organization_id, decision_payload
  into v_org, v_dec
  from app.okr_reviews
  where id = p_review_id;

  if v_org is null or v_dec is null or v_dec = '{}'::jsonb then
    raise exception 'apply_strategy_review_decisions: missing review or decisions';
  end if;

  select legacy_planning_cycle_id into v_planning_to
  from app.cycle_instances
  where id = p_to_cycle_instance_id and organization_id = v_org;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'challenges', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('keep', 'adjust') then
      select * into v_rec from app.strategic_challenges where id = v_old and organization_id = v_org;
      if not found then
        raise exception 'challenge % not found', v_old;
      end if;
      insert into app.strategic_challenges (
        organization_id, planning_cycle_id, title, priority, visibility,
        created_by_membership_id, source_analysis_entry_id, cycle_instance_id,
        relevance_level, risk_level, description, impact_score, urgency_score,
        scope_score, root_cause_score, challenge_score, created_by_source, source_cluster_id,
        strategy_carry_source_id, strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title) else v_rec.title end,
        v_rec.priority,
        v_rec.visibility,
        v_rec.created_by_membership_id,
        v_rec.source_analysis_entry_id,
        p_to_cycle_instance_id,
        v_rec.relevance_level,
        v_rec.risk_level,
        case when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description) else v_rec.description end,
        v_rec.impact_score,
        v_rec.urgency_score,
        v_rec.scope_score,
        v_rec.root_cause_score,
        v_rec.challenge_score,
        v_rec.created_by_source,
        v_rec.source_cluster_id,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object('strategy_review_carry', true, 'decision', v_decision)
      )
      returning id into v_new_obj;
      v_challenge_map := v_challenge_map || jsonb_build_object(v_old::text, v_new_obj);
    elsif v_decision = 'replace' then
      insert into app.strategic_challenges (
        organization_id, planning_cycle_id, title, priority, visibility,
        cycle_instance_id, relevance_level, risk_level, description,
        impact_score, urgency_score, scope_score, root_cause_score, challenge_score,
        created_by_source, strategy_carry_metadata
      )
      values (
        v_org,
        v_planning_to,
        coalesce(v_elem #>> '{replacement,title}', 'Challenge'),
        3,
        'internal',
        p_to_cycle_instance_id,
        3, 3,
        v_elem #>> '{replacement,description}',
        3, 3, 3, 3, 3,
        'user',
        jsonb_build_object('strategy_review_replace_of', v_old::text)
      )
      returning id into v_new_obj;
      v_challenge_map := v_challenge_map || jsonb_build_object(v_old::text, v_new_obj);
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'focus_areas', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('double_down', 'adjust') then
      select * into v_rec from app.strategic_directions where id = v_old and organization_id = v_org;
      if not found then
        raise exception 'direction % not found', v_old;
      end if;
      insert into app.strategic_directions (
        organization_id, planning_cycle_id, title, description, owner_membership_id,
        priority, status, grouping, created_by_membership_id, cycle_instance_id,
        relevance_level, risk_level, strategic_value_score, capability_fit_score,
        feasibility_score, created_by_source, review_comment,
        strategy_carry_source_id, strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title) else v_rec.title end,
        case when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description) else v_rec.description end,
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
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object('strategy_review_carry', true, 'decision', v_decision)
      )
      returning id into v_new_obj;
      v_direction_map := v_direction_map || jsonb_build_object(v_old::text, v_new_obj);
    end if;
  end loop;

  select decision_payload into v_dec from app.okr_reviews where id = p_review_id;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'objectives', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('keep', 'change') then
      select * into v_rec from app.objectives where id = v_old and organization_id = v_org;
      if not found then
        raise exception 'objective % not found', v_old;
      end if;
      insert into app.objectives (
        organization_id, cycle_id, title, description, status, owner_membership_id,
        progress_percent, okr_cycle_id, confidence_level, cycle_instance_id,
        time_horizon, importance_score,
        ai_clarity_score, ai_strategic_relevance_score, ai_feasibility_score,
        ai_fit_to_company_score, ai_confidence_score,
        ai_external_internal_classification, ai_short_long_term_classification,
        ai_exploit_explore_classification, ai_issues_json, ai_improvement_suggestion,
        ai_summary, ai_objective_score, ai_evaluation_status, ai_evaluated_at,
        ai_evaluation_version, ai_manual_override, ai_manual_comment,
        created_by_membership_id, created_by_source,
        objective_health_override, objective_health_override_by_membership_id,
        objective_health_override_at, objective_review_comment,
        strategy_carry_source_id, strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title) else v_rec.title end,
        case when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description) else v_rec.description end,
        v_rec.status,
        v_rec.owner_membership_id,
        v_rec.progress_percent,
        v_rec.okr_cycle_id,
        v_rec.confidence_level,
        p_to_cycle_instance_id,
        case when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,time_horizon}', v_rec.time_horizon) else v_rec.time_horizon end,
        v_rec.importance_score,
        v_rec.ai_clarity_score, v_rec.ai_strategic_relevance_score, v_rec.ai_feasibility_score,
        v_rec.ai_fit_to_company_score, v_rec.ai_confidence_score,
        v_rec.ai_external_internal_classification, v_rec.ai_short_long_term_classification,
        v_rec.ai_exploit_explore_classification, v_rec.ai_issues_json, v_rec.ai_improvement_suggestion,
        v_rec.ai_summary, v_rec.ai_objective_score, v_rec.ai_evaluation_status, v_rec.ai_evaluated_at,
        v_rec.ai_evaluation_version, v_rec.ai_manual_override, v_rec.ai_manual_comment,
        v_rec.created_by_membership_id, v_rec.created_by_source,
        v_rec.objective_health_override, v_rec.objective_health_override_by_membership_id,
        v_rec.objective_health_override_at, v_rec.objective_review_comment,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object('strategy_review_carry', true, 'decision', v_decision)
      )
      returning id into v_new_obj;
      v_objective_map := v_objective_map || jsonb_build_object(v_old::text, v_new_obj);

      for v_kr in select * from app.key_results where objective_id = v_old
      loop
        insert into app.key_results (
          organization_id, objective_id, title, metric_type, start_value, target_value,
          current_value, status, due_date, measurement_unit, created_by_membership_id,
          created_by_source, owner_membership_id
        )
        values (
          v_kr.organization_id,
          v_new_obj,
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
          v_kr.owner_membership_id
        )
        returning id into v_new_kr;
        v_kr_map := v_kr_map || jsonb_build_object(v_kr.id::text, v_new_kr);
      end loop;
    end if;
  end loop;

  insert into app.objective_direction_links (
    organization_id, planning_cycle_id, objective_id, strategic_direction_id,
    contribution_level, comment, cycle_instance_id
  )
  select
    l.organization_id,
    v_planning_to,
    (v_objective_map ->> l.objective_id::text)::uuid,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    l.contribution_level,
    l.comment,
    p_to_cycle_instance_id
  from app.objective_direction_links l
  where l.cycle_instance_id = p_from_cycle_instance_id
    and v_objective_map ? l.objective_id::text
    and v_direction_map ? l.strategic_direction_id::text;

  insert into app.strategic_direction_objective_links (
    organization_id, planning_cycle_id, cycle_instance_id, strategic_direction_id,
    objective_id, created_by_membership_id, contribution_level
  )
  select
    l.organization_id,
    v_planning_to,
    p_to_cycle_instance_id,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    (v_objective_map ->> l.objective_id::text)::uuid,
    l.created_by_membership_id,
    l.contribution_level
  from app.strategic_direction_objective_links l
  where l.cycle_instance_id = p_from_cycle_instance_id
    and v_objective_map ? l.objective_id::text
    and v_direction_map ? l.strategic_direction_id::text;

  insert into app.challenge_direction_links (
    organization_id, planning_cycle_id, strategic_direction_id, strategic_challenge_id,
    contribution_level, note, created_by_membership_id, cycle_instance_id
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
  from app.challenge_direction_links l
  where l.cycle_instance_id = p_from_cycle_instance_id
    and v_direction_map ? l.strategic_direction_id::text
    and v_challenge_map ? l.strategic_challenge_id::text;

  for v_prog in
    select * from app.strategy_programs
    where organization_id = v_org and cycle_instance_id = p_from_cycle_instance_id
  loop
    v_ch_ok := v_prog.strategic_challenge_id is null
      or v_challenge_map ? v_prog.strategic_challenge_id::text;
    v_dir_ok := v_prog.strategic_direction_id is null
      or v_direction_map ? v_prog.strategic_direction_id::text;
    v_supported := v_prog.supported_objective_ids;
    v_mapped := app._remap_uuid_array_from_map(v_supported, v_objective_map);
    if v_ch_ok and v_dir_ok
       and (cardinality(v_supported) = 0 or cardinality(v_mapped) > 0) then
      insert into app.strategy_programs (
        organization_id, planning_cycle_id, cycle_instance_id, strategic_direction_id,
        title, description, owner_membership_id, budget_total, timeline,
        created_by_membership_id, status, review_comment, strategic_challenge_id,
        program_origin, matrix_cell_score, supported_objective_ids, start_date, end_date
      )
      values (
        v_prog.organization_id,
        v_planning_to,
        p_to_cycle_instance_id,
        case when v_prog.strategic_direction_id is not null
          then (v_direction_map ->> v_prog.strategic_direction_id::text)::uuid end,
        v_prog.title,
        v_prog.description,
        v_prog.owner_membership_id,
        v_prog.budget_total,
        v_prog.timeline,
        v_prog.created_by_membership_id,
        v_prog.status,
        v_prog.review_comment,
        case when v_prog.strategic_challenge_id is not null
          then (v_challenge_map ->> v_prog.strategic_challenge_id::text)::uuid end,
        v_prog.program_origin,
        v_prog.matrix_cell_score,
        case when cardinality(v_supported) = 0 then v_supported else v_mapped end,
        v_prog.start_date,
        v_prog.end_date
      )
      returning id into v_new_prog;
      v_program_map := v_program_map || jsonb_build_object(v_prog.id::text, v_new_prog);
    else
      v_programs_skipped := v_programs_skipped || jsonb_build_object(
        'program_id', v_prog.id,
        'reason', 'references_not_carried'
      );
    end if;
  end loop;

  for v_init in
    select * from app.initiatives
    where organization_id = v_org and cycle_instance_id = p_from_cycle_instance_id
  loop
    if not (v_program_map ? v_init.program_id::text) then
      v_inits_skipped := v_inits_skipped || jsonb_build_object('initiative_id', v_init.id, 'reason', 'program_not_carried');
      continue;
    end if;
    if not exists (
      select 1 from app.initiative_key_result_links l
      where l.initiative_id = v_init.id
        and l.cycle_instance_id = p_from_cycle_instance_id
        and v_kr_map ? l.key_result_id::text
    ) then
      v_inits_skipped := v_inits_skipped || jsonb_build_object('initiative_id', v_init.id, 'reason', 'no_carried_kr_link');
      continue;
    end if;

    insert into app.initiatives (
      organization_id, planning_cycle_id, title, description, owner_membership_id,
      start_date, end_date, status, priority, budget, created_by_membership_id,
      cycle_instance_id, program_id, linked_okrs, deliverables, created_by_source,
      execution_health_override, execution_health_override_by_membership_id,
      execution_health_override_at, review_comment,
      weight, progress_percent, last_review_update_at
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
      organization_id, cycle_instance_id, initiative_id, key_result_id
    )
    select
      v_init.organization_id,
      p_to_cycle_instance_id,
      v_new_init,
      (v_kr_map ->> l.key_result_id::text)::uuid
    from app.initiative_key_result_links l
    where l.initiative_id = v_init.id
      and l.cycle_instance_id = p_from_cycle_instance_id
      and v_kr_map ? l.key_result_id::text;
  end loop;

  v_summary := jsonb_build_object(
    'challenge_map', v_challenge_map,
    'direction_map', v_direction_map,
    'objective_map', v_objective_map,
    'key_result_map', v_kr_map,
    'program_map', v_program_map,
    'programs_skipped', v_programs_skipped,
    'initiatives_skipped', v_inits_skipped
  );

  return v_summary;
end;
$$;


--
-- Name: capture_strategy_review_decisions(uuid, jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.capture_strategy_review_decisions(p_review_id uuid, p_decisions jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_org uuid;
  v_pre jsonb;
  v_val jsonb;
begin
  select organization_id, pre_read_payload into v_org, v_pre
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'capture_strategy_review_decisions: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'capture_strategy_review_decisions: forbidden';
  end if;

  v_val := app.validate_strategy_decision_payload(p_decisions, v_pre);
  if coalesce((v_val ->> 'valid')::boolean, false) is not true then
    raise exception 'capture_strategy_review_decisions: validation failed %', v_val -> 'errors';
  end if;

  update app.okr_reviews
  set decision_payload = p_decisions,
      procedure_status = 'decision_captured'
  where id = p_review_id
    and procedure_status = 'review_in_progress';

  if not found then
    raise exception 'capture_strategy_review_decisions: expected review_in_progress';
  end if;
end;
$$;


--
-- Name: carry_forward_analysis_cycle_data(uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.carry_forward_analysis_cycle_data(p_organization_id uuid, p_from_cycle_instance_id uuid, p_to_cycle_instance_id uuid, p_cutover_id uuid DEFAULT NULL::uuid, p_actor_membership_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_from_exists boolean;
  v_to_exists boolean;
  v_to_legacy_id uuid;
  v_entries integer := 0;
  v_links_draft integer := 0;
  v_links integer := 0;
  v_clusters integer := 0;
  v_cluster_members integer := 0;
  v_gap_findings integer := 0;
  v_summary jsonb;
begin
  select exists(
    select 1
    from app.cycle_instances ci
    where ci.id = p_from_cycle_instance_id
      and ci.organization_id = p_organization_id
  ) into v_from_exists;

  select exists(
    select 1
    from app.cycle_instances ci
    where ci.id = p_to_cycle_instance_id
      and ci.organization_id = p_organization_id
  ) into v_to_exists;

  if not v_from_exists or not v_to_exists then
    raise exception 'invalid cycle instance pair for organization';
  end if;

  select legacy_planning_cycle_id
  into v_to_legacy_id
  from app.cycle_instances
  where id = p_to_cycle_instance_id;

  insert into app.analysis_entries (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    analysis_type,
    sub_type,
    title,
    description,
    impact_level,
    uncertainty_level,
    created_by_membership_id,
    created_at,
    updated_at
  )
  select
    app.stable_md5_uuid(format('analysis_entry:%s:%s', ae.id, p_to_cycle_instance_id)),
    ae.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    ae.analysis_type,
    ae.sub_type,
    ae.title,
    ae.description,
    ae.impact_level,
    ae.uncertainty_level,
    ae.created_by_membership_id,
    ae.created_at,
    now()
  from app.analysis_entries ae
  where ae.organization_id = p_organization_id
    and ae.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    analysis_type = excluded.analysis_type,
    sub_type = excluded.sub_type,
    title = excluded.title,
    description = excluded.description,
    impact_level = excluded.impact_level,
    uncertainty_level = excluded.uncertainty_level,
    updated_at = now();
  get diagnostics v_entries = row_count;

  insert into app.analysis_item_link_draft (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    source_analysis_item_id,
    target_analysis_item_id,
    link_type,
    strength,
    confidence,
    comment,
    origin,
    provider,
    model,
    prompt_version,
    status,
    created_by_membership_id,
    reviewed_by_membership_id,
    created_at,
    updated_at,
    reviewed_at,
    metadata
  )
  select
    app.stable_md5_uuid(format('analysis_item_link_draft:%s:%s', d.id, p_to_cycle_instance_id)),
    d.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    app.stable_md5_uuid(format('analysis_entry:%s:%s', d.source_analysis_item_id, p_to_cycle_instance_id)),
    app.stable_md5_uuid(format('analysis_entry:%s:%s', d.target_analysis_item_id, p_to_cycle_instance_id)),
    d.link_type,
    d.strength,
    d.confidence,
    d.comment,
    d.origin,
    d.provider,
    d.model,
    d.prompt_version,
    d.status,
    d.created_by_membership_id,
    d.reviewed_by_membership_id,
    d.created_at,
    now(),
    d.reviewed_at,
    coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
      'carried_forward_from_draft_id',
      d.id::text,
      'carried_forward_from_cycle_instance_id',
      p_from_cycle_instance_id::text
    )
  from app.analysis_item_link_draft d
  where d.organization_id = p_organization_id
    and d.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    link_type = excluded.link_type,
    strength = excluded.strength,
    confidence = excluded.confidence,
    comment = excluded.comment,
    status = excluded.status,
    reviewed_at = excluded.reviewed_at,
    metadata = excluded.metadata,
    updated_at = now();
  get diagnostics v_links_draft = row_count;

  insert into app.analysis_item_link (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    source_analysis_item_id,
    target_analysis_item_id,
    link_type,
    strength,
    confidence,
    comment,
    source_draft_id,
    activated_by_membership_id,
    created_at,
    updated_at,
    metadata
  )
  select
    app.stable_md5_uuid(format('analysis_item_link:%s:%s', l.id, p_to_cycle_instance_id)),
    l.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    app.stable_md5_uuid(format('analysis_entry:%s:%s', l.source_analysis_item_id, p_to_cycle_instance_id)),
    app.stable_md5_uuid(format('analysis_entry:%s:%s', l.target_analysis_item_id, p_to_cycle_instance_id)),
    l.link_type,
    l.strength,
    l.confidence,
    l.comment,
    case
      when l.source_draft_id is null then null
      else app.stable_md5_uuid(format('analysis_item_link_draft:%s:%s', l.source_draft_id, p_to_cycle_instance_id))
    end,
    l.activated_by_membership_id,
    l.created_at,
    now(),
    coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
      'carried_forward_from_link_id',
      l.id::text,
      'carried_forward_from_cycle_instance_id',
      p_from_cycle_instance_id::text
    )
  from app.analysis_item_link l
  where l.organization_id = p_organization_id
    and l.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    link_type = excluded.link_type,
    strength = excluded.strength,
    confidence = excluded.confidence,
    comment = excluded.comment,
    source_draft_id = excluded.source_draft_id,
    metadata = excluded.metadata,
    updated_at = now();
  get diagnostics v_links = row_count;

  insert into app.analysis_clusters (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    label,
    summary,
    cluster_score,
    method,
    created_by_membership_id,
    created_at,
    updated_at,
    metadata
  )
  select
    app.stable_md5_uuid(format('analysis_cluster:%s:%s', c.id, p_to_cycle_instance_id)),
    c.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    c.label,
    c.summary,
    c.cluster_score,
    c.method,
    c.created_by_membership_id,
    c.created_at,
    now(),
    coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'carried_forward_from_cluster_id',
      c.id::text,
      'carried_forward_from_cycle_instance_id',
      p_from_cycle_instance_id::text
    )
  from app.analysis_clusters c
  where c.organization_id = p_organization_id
    and c.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    label = excluded.label,
    summary = excluded.summary,
    cluster_score = excluded.cluster_score,
    method = excluded.method,
    metadata = excluded.metadata,
    updated_at = now();
  get diagnostics v_clusters = row_count;

  insert into app.analysis_cluster_members (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    cluster_id,
    entry_id,
    membership_strength,
    created_at
  )
  select
    app.stable_md5_uuid(format('analysis_cluster_member:%s:%s', m.id, p_to_cycle_instance_id)),
    m.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    app.stable_md5_uuid(format('analysis_cluster:%s:%s', m.cluster_id, p_to_cycle_instance_id)),
    app.stable_md5_uuid(format('analysis_entry:%s:%s', m.entry_id, p_to_cycle_instance_id)),
    m.membership_strength,
    m.created_at
  from app.analysis_cluster_members m
  where m.organization_id = p_organization_id
    and m.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set membership_strength = excluded.membership_strength;
  get diagnostics v_cluster_members = row_count;

  insert into app.analysis_gap_findings (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    dimension,
    gap_type,
    severity,
    recommendation,
    status,
    related_cluster_id,
    created_by_membership_id,
    created_at,
    updated_at,
    metadata
  )
  select
    app.stable_md5_uuid(format('analysis_gap_finding:%s:%s', g.id, p_to_cycle_instance_id)),
    g.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    g.dimension,
    g.gap_type,
    g.severity,
    g.recommendation,
    g.status,
    case
      when g.related_cluster_id is null then null
      else app.stable_md5_uuid(format('analysis_cluster:%s:%s', g.related_cluster_id, p_to_cycle_instance_id))
    end,
    g.created_by_membership_id,
    g.created_at,
    now(),
    coalesce(g.metadata, '{}'::jsonb) || jsonb_build_object(
      'carried_forward_from_gap_finding_id',
      g.id::text,
      'carried_forward_from_cycle_instance_id',
      p_from_cycle_instance_id::text
    )
  from app.analysis_gap_findings g
  where g.organization_id = p_organization_id
    and g.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    dimension = excluded.dimension,
    gap_type = excluded.gap_type,
    severity = excluded.severity,
    recommendation = excluded.recommendation,
    status = excluded.status,
    related_cluster_id = excluded.related_cluster_id,
    metadata = excluded.metadata,
    updated_at = now();
  get diagnostics v_gap_findings = row_count;

  v_summary := jsonb_build_object(
    'from_cycle_instance_id', p_from_cycle_instance_id,
    'to_cycle_instance_id', p_to_cycle_instance_id,
    'analysis_entries', v_entries,
    'analysis_item_link_draft', v_links_draft,
    'analysis_item_link', v_links,
    'analysis_clusters', v_clusters,
    'analysis_cluster_members', v_cluster_members,
    'analysis_gap_findings', v_gap_findings
  );

  insert into app.cycle_cutover_snapshots (
    organization_id,
    cutover_id,
    from_cycle_instance_id,
    to_cycle_instance_id,
    snapshot_type,
    summary,
    created_by_membership_id
  )
  values (
    p_organization_id,
    p_cutover_id,
    p_from_cycle_instance_id,
    p_to_cycle_instance_id,
    'analysis_carry_forward',
    v_summary,
    p_actor_membership_id
  )
  on conflict (cutover_id, from_cycle_instance_id, to_cycle_instance_id, snapshot_type) do update
  set
    summary = excluded.summary,
    created_by_membership_id = excluded.created_by_membership_id,
    created_at = now();

  return v_summary;
end;
$$;


--
-- Name: clone_planning_cycle_full_snapshot(uuid, uuid, text, text, date, date, uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.clone_planning_cycle_full_snapshot(p_organization_id uuid, p_source_cycle_id uuid, p_new_code text, p_new_name text, p_start_date date, p_end_date date, p_actor_membership_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'app', 'rbac', 'audit'
    AS $$
declare
  v_new_cycle_id uuid;
  v_goal record;
  v_strategy record;
  v_objective record;
  v_kr record;
  v_link record;
  v_new_id uuid;
  v_new_from uuid;
  v_new_to uuid;
begin
  if p_start_date > p_end_date then
    raise exception 'start date must be before or equal to end date';
  end if;

  insert into app.planning_cycles (
    organization_id,
    code,
    name,
    start_date,
    end_date,
    status,
    rolling_window_months,
    created_by_membership_id,
    source_cycle_id,
    clone_type,
    cloned_at,
    cloned_by_membership_id
  )
  select
    p_organization_id,
    p_new_code,
    p_new_name,
    p_start_date,
    p_end_date,
    'draft',
    rolling_window_months,
    p_actor_membership_id,
    id,
    'full_snapshot',
    now(),
    p_actor_membership_id
  from app.planning_cycles
  where id = p_source_cycle_id
    and organization_id = p_organization_id
  returning id into v_new_cycle_id;

  if v_new_cycle_id is null then
    raise exception 'source cycle not found in organization';
  end if;

  create temporary table if not exists tmp_goal_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table if not exists tmp_strategy_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table if not exists tmp_objective_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table if not exists tmp_kr_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  for v_goal in
    select *
    from app.strategic_goals
    where organization_id = p_organization_id
      and cycle_id = p_source_cycle_id
  loop
    insert into app.strategic_goals (
      organization_id, cycle_id, title, description, status, priority, owner_membership_id, due_date
    )
    values (
      v_goal.organization_id, v_new_cycle_id, v_goal.title, v_goal.description, v_goal.status,
      v_goal.priority, v_goal.owner_membership_id, v_goal.due_date
    )
    returning id into v_new_id;

    insert into tmp_goal_map(old_id, new_id) values (v_goal.id, v_new_id);
  end loop;

  for v_strategy in
    select *
    from app.functional_strategies
    where organization_id = p_organization_id
      and cycle_id = p_source_cycle_id
  loop
    insert into app.functional_strategies (
      organization_id, cycle_id, function_name, title, description, status, owner_membership_id
    )
    values (
      v_strategy.organization_id, v_new_cycle_id, v_strategy.function_name, v_strategy.title,
      v_strategy.description, v_strategy.status, v_strategy.owner_membership_id
    )
    returning id into v_new_id;

    insert into tmp_strategy_map(old_id, new_id) values (v_strategy.id, v_new_id);
  end loop;

  for v_objective in
    select *
    from app.objectives
    where organization_id = p_organization_id
      and cycle_id = p_source_cycle_id
  loop
    insert into app.objectives (
      organization_id, cycle_id, title, description, status, owner_membership_id, progress_percent
    )
    values (
      v_objective.organization_id, v_new_cycle_id, v_objective.title, v_objective.description,
      v_objective.status, v_objective.owner_membership_id, v_objective.progress_percent
    )
    returning id into v_new_id;

    insert into tmp_objective_map(old_id, new_id) values (v_objective.id, v_new_id);
  end loop;

  for v_kr in
    select *
    from app.key_results
    where organization_id = p_organization_id
      and objective_id in (select old_id from tmp_objective_map)
  loop
    insert into app.key_results (
      organization_id, objective_id, title, metric_type, start_value, target_value, current_value,
      status, due_date
    )
    values (
      v_kr.organization_id,
      (select new_id from tmp_objective_map where old_id = v_kr.objective_id),
      v_kr.title, v_kr.metric_type, v_kr.start_value, v_kr.target_value, v_kr.current_value,
      v_kr.status, v_kr.due_date
    )
    returning id into v_new_id;

    insert into tmp_kr_map(old_id, new_id) values (v_kr.id, v_new_id);
  end loop;

  for v_link in
    select *
    from app.entity_links
    where organization_id = p_organization_id
      and (
        (from_type = 'strategic_goal' and from_id in (select old_id from tmp_goal_map)) or
        (from_type = 'functional_strategy' and from_id in (select old_id from tmp_strategy_map)) or
        (from_type = 'objective' and from_id in (select old_id from tmp_objective_map)) or
        (from_type = 'key_result' and from_id in (select old_id from tmp_kr_map)) or
        (to_type = 'strategic_goal' and to_id in (select old_id from tmp_goal_map)) or
        (to_type = 'functional_strategy' and to_id in (select old_id from tmp_strategy_map)) or
        (to_type = 'objective' and to_id in (select old_id from tmp_objective_map)) or
        (to_type = 'key_result' and to_id in (select old_id from tmp_kr_map))
      )
  loop
    v_new_from := case
      when v_link.from_type = 'strategic_goal' then (select new_id from tmp_goal_map where old_id = v_link.from_id)
      when v_link.from_type = 'functional_strategy' then (select new_id from tmp_strategy_map where old_id = v_link.from_id)
      when v_link.from_type = 'objective' then (select new_id from tmp_objective_map where old_id = v_link.from_id)
      when v_link.from_type = 'key_result' then (select new_id from tmp_kr_map where old_id = v_link.from_id)
      else null
    end;

    v_new_to := case
      when v_link.to_type = 'strategic_goal' then (select new_id from tmp_goal_map where old_id = v_link.to_id)
      when v_link.to_type = 'functional_strategy' then (select new_id from tmp_strategy_map where old_id = v_link.to_id)
      when v_link.to_type = 'objective' then (select new_id from tmp_objective_map where old_id = v_link.to_id)
      when v_link.to_type = 'key_result' then (select new_id from tmp_kr_map where old_id = v_link.to_id)
      else null
    end;

    if v_new_from is not null and v_new_to is not null then
      insert into app.entity_links (
        organization_id, from_type, from_id, to_type, to_id, relation_type
      )
      values (
        p_organization_id, v_link.from_type, v_new_from, v_link.to_type, v_new_to, v_link.relation_type
      )
      on conflict do nothing;
    end if;
  end loop;

  return v_new_cycle_id;
end;
$$;


--
-- Name: compute_review_readiness(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.compute_review_readiness(p_review_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_pre jsonb;
  v_org uuid;
  v_ci uuid;
  v_ids uuid[] := array[]::uuid[];
  v_total int;
  v_with_feedback int;
  v_proc text;
begin
  select pre_read_payload, organization_id, cycle_instance_id, procedure_status
  into v_pre, v_org, v_ci, v_proc
  from app.okr_reviews
  where id = p_review_id;

  if v_pre is null then
    return;
  end if;

  select coalesce(array_agg(distinct u), array[]::uuid[])
  into v_ids
  from (
    select (x->>'id')::uuid as u
    from jsonb_array_elements(coalesce(v_pre -> 'challenges', '[]'::jsonb)) x
    where x ? 'id'
    union
    select (x->>'id')::uuid
    from jsonb_array_elements(coalesce(v_pre -> 'focus_areas', '[]'::jsonb)) x
    where x ? 'id'
    union
    select (x->>'id')::uuid
    from jsonb_array_elements(coalesce(v_pre -> 'objectives', '[]'::jsonb)) x
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


--
-- Name: current_user_id(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app', 'rbac', 'auth'
    AS $$
  select auth.uid();
$$;


--
-- Name: enforce_direction_activation_links(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.enforce_direction_activation_links() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'pg_temp'
    AS $$
declare
  challenge_count integer;
begin
  if new.status = 'active' then
    select count(*) into challenge_count
    from app.challenge_direction_links
    where organization_id = new.organization_id
      and cycle_instance_id = new.cycle_instance_id
      and strategic_direction_id = new.id;
    if challenge_count < 1 then
      raise exception 'direction-needs-challenge-link';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: FUNCTION enforce_direction_activation_links(); Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON FUNCTION app.enforce_direction_activation_links() IS 'Vor status=active: mindestens eine challenge_direction_links-Zeile. SECURITY DEFINER um RLS zu umgehen.';


--
-- Name: enforce_program_activation_has_active_initiative(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.enforce_program_activation_has_active_initiative() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'pg_temp'
    AS $$
declare
  active_count integer;
begin
  if new.status = 'active' then
    select count(*)::integer into active_count
    from app.initiatives
    where program_id = new.id
      and status = 'active';
    if active_count < 1 then
      raise exception 'program-needs-active-initiative'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: FUNCTION enforce_program_activation_has_active_initiative(); Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON FUNCTION app.enforce_program_activation_has_active_initiative() IS 'Vor status=active: mindestens eine Initiative mit status=active. SECURITY DEFINER um RLS zu umgehen.';


--
-- Name: ensure_key_result_context(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.ensure_key_result_context() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_cycle_id uuid;
  v_cycle_instance_id uuid;
  v_org_id uuid;
  v_has_objective_links boolean;
begin
  select o.cycle_id, o.cycle_instance_id, o.organization_id
  into v_cycle_id, v_cycle_instance_id, v_org_id
  from app.objectives o
  where o.id = new.objective_id;

  if v_org_id is null then
    raise exception 'Cannot create key result: objective context not found.';
  end if;

  if v_org_id <> new.organization_id then
    raise exception 'Cannot create key result: objective organization mismatch.';
  end if;

  if v_cycle_id is null and v_cycle_instance_id is null then
    raise exception 'Cannot create key result: objective has no cycle_id or cycle_instance_id.';
  end if;

  v_has_objective_links := false;

  if v_cycle_id is not null then
    select exists (
      select 1
      from app.objective_target_links l
      where l.organization_id = new.organization_id
        and l.planning_cycle_id = v_cycle_id
        and l.objective_id = new.objective_id
    ) into v_has_objective_links;

    if not v_has_objective_links then
      select exists (
        select 1
        from app.objective_direction_links l
        where l.organization_id = new.organization_id
          and l.planning_cycle_id = v_cycle_id
          and l.objective_id = new.objective_id
      ) into v_has_objective_links;
    end if;
  end if;

  if not v_has_objective_links and v_cycle_instance_id is not null then
    select exists (
      select 1
      from app.strategic_direction_objective_links l
      where l.organization_id = new.organization_id
        and l.objective_id = new.objective_id
        and l.cycle_instance_id = v_cycle_instance_id
    ) into v_has_objective_links;
  end if;

  if not v_has_objective_links then
    raise exception 'Cannot create key result: objective is not linked to annual target or strategic direction.';
  end if;

  return new;
end;
$$;


--
-- Name: ensure_objective_context(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.ensure_objective_context() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_has_directions boolean;
  v_has_targets boolean;
  v_cycle_id uuid;
begin
  -- When using cycle_instance_id (v3 strategy framework), allow objectives without pre-existing directions/targets.
  if new.cycle_instance_id is not null then
    return new;
  end if;

  v_cycle_id := new.cycle_id;
  if v_cycle_id is null then
    raise exception 'Cannot create objective: cycle_id or cycle_instance_id required.';
  end if;

  select exists (
    select 1
    from app.strategic_directions d
    where d.organization_id = new.organization_id
      and (d.planning_cycle_id = v_cycle_id or d.cycle_instance_id = v_cycle_id)
  ) into v_has_directions;

  if not v_has_directions then
    raise exception 'Cannot create objective: no strategic directions exist for this planning cycle.';
  end if;

  select exists (
    select 1
    from app.annual_targets t
    where t.organization_id = new.organization_id
      and (t.planning_cycle_id = v_cycle_id or t.cycle_instance_id = v_cycle_id)
  ) into v_has_targets;

  if not v_has_targets then
    raise exception 'Cannot create objective: no annual targets exist for this planning cycle.';
  end if;

  return new;
end;
$$;


--
-- Name: ensure_strategy_review(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.ensure_strategy_review(p_cycle_instance_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_org uuid;
  v_existing uuid;
  v_new uuid;
begin
  select organization_id into v_org
  from app.cycle_instances
  where id = p_cycle_instance_id;

  if v_org is null then
    raise exception 'ensure_strategy_review: invalid cycle_instance_id';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate')
     and not app.has_permission(v_org, 'review.write') then
    raise exception 'ensure_strategy_review: forbidden';
  end if;

  select id into v_existing
  from app.okr_reviews
  where organization_id = v_org
    and cycle_instance_id = p_cycle_instance_id
    and review_mode = 'strategy_review'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into app.okr_reviews (
    organization_id,
    cycle_instance_id,
    review_type,
    review_mode,
    procedure_status,
    summary
  )
  values (
    v_org,
    p_cycle_instance_id,
    'annual_review',
    'strategy_review',
    'not_started',
    'Strategy Review'
  )
  returning id into v_new;

  return v_new;
end;
$$;


--
-- Name: execute_due_cycle_cutovers(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.execute_due_cycle_cutovers() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_count integer := 0;
  rec record;
  v_horizon integer;
  v_from_instance_id uuid;
  v_to_instance_id uuid;
begin
  for rec in
    select
      c.id,
      c.organization_id,
      c.from_cycle_scheme_id,
      c.to_cycle_scheme_id,
      c.cutover_at,
      c.created_by_membership_id,
      s.top_level_duration_months
    from app.cycle_cutovers c
    join app.cycle_schemes s on s.id = c.to_cycle_scheme_id
    where c.status = 'scheduled'
      and c.cutover_at <= now()
    order by c.cutover_at asc
  loop
    begin
      update app.cycle_schemes
      set is_active = false
      where organization_id = rec.organization_id
        and id = rec.from_cycle_scheme_id;

      update app.cycle_schemes
      set is_active = true
      where organization_id = rec.organization_id
        and id = rec.to_cycle_scheme_id;

      v_horizon := greatest(1, rec.top_level_duration_months * 2);
      perform app.regenerate_cycle_instances(rec.to_cycle_scheme_id, v_horizon, rec.created_by_membership_id);

      select ci.id
      into v_from_instance_id
      from app.cycle_instances ci
      where ci.organization_id = rec.organization_id
        and ci.cycle_scheme_id = rec.from_cycle_scheme_id
        and ci.starts_on <= rec.cutover_at::date
        and ci.ends_on > rec.cutover_at::date
      order by ci.level_no desc, ci.starts_on desc
      limit 1;

      select ci.id
      into v_to_instance_id
      from app.cycle_instances ci
      where ci.organization_id = rec.organization_id
        and ci.cycle_scheme_id = rec.to_cycle_scheme_id
        and ci.starts_on <= rec.cutover_at::date
        and ci.ends_on > rec.cutover_at::date
      order by ci.level_no desc, ci.starts_on desc
      limit 1;

      if v_from_instance_id is not null and v_to_instance_id is not null then
        perform app.carry_forward_analysis_cycle_data(
          rec.organization_id,
          v_from_instance_id,
          v_to_instance_id,
          rec.id,
          rec.created_by_membership_id
        );
      end if;

      update app.cycle_cutovers
      set status = 'executed',
          executed_at = now()
      where id = rec.id;

      v_count := v_count + 1;
    exception when others then
      update app.cycle_cutovers
      set status = 'failed',
          notes = coalesce(notes, '') || case when notes is null or notes = '' then '' else E'\n' end || sqlerrm
      where id = rec.id;
    end;
  end loop;

  return v_count;
end;
$$;


--
-- Name: execute_strategy_review_release(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.execute_strategy_review_release(p_review_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
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

  insert into app.cycle_cutover_snapshots (
    organization_id,
    cutover_id,
    from_cycle_instance_id,
    to_cycle_instance_id,
    snapshot_type,
    summary,
    created_by_membership_id,
    review_id
  )
  values (
    v_rev.organization_id,
    null,
    v_rev.cycle_instance_id,
    v_to,
    'strategy_review_release',
    v_final,
    v_actor,
    p_review_id
  );

  return v_final;
end;
$$;


--
-- Name: force_review_ready(uuid, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.force_review_ready(p_review_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_org uuid;
  v_mid uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'force_review_ready: reason required';
  end if;

  select organization_id into v_org
  from app.okr_reviews
  where id = p_review_id;

  if v_org is null then
    raise exception 'force_review_ready: review not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.force_ready') then
    raise exception 'force_review_ready: forbidden';
  end if;

  v_mid := app._strategy_review_current_membership(v_org);
  if v_mid is null then
    raise exception 'force_review_ready: no active membership';
  end if;

  update app.okr_reviews
  set override_forced = true,
      override_reason = p_reason,
      override_forced_by = v_mid,
      override_forced_at = now()
  where id = p_review_id;
end;
$$;


--
-- Name: generate_cycle_instances_for_scheme(uuid, integer, uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.generate_cycle_instances_for_scheme(p_cycle_scheme_id uuid, p_horizon_months integer DEFAULT 36, p_actor_membership_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
  select app.regenerate_cycle_instances(p_cycle_scheme_id, p_horizon_months, p_actor_membership_id);
$$;


--
-- Name: get_review_trigger_state(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.get_review_trigger_state(p_cycle_instance_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_ci record;
  v_rev record;
  v_days int;
  v_lead int;
  v_visible boolean := false;
  v_state text := 'hidden';
  v_label text := '';
  v_override boolean := false;
begin
  select * into v_ci
  from app.cycle_instances
  where id = p_cycle_instance_id;

  if v_ci.id is null then
    return jsonb_build_object(
      'visible', false,
      'state', 'invalid_instance',
      'label', '',
      'days_to_end', null,
      'is_override', false
    );
  end if;

  select * into v_rev
  from app.okr_reviews
  where cycle_instance_id = p_cycle_instance_id
    and review_mode = 'strategy_review'
  limit 1;

  v_days := (v_ci.ends_on - current_date);

  if v_rev.id is null then
    return jsonb_build_object(
      'visible', false,
      'state', 'no_review',
      'label', 'Strategy Review anlegen',
      'days_to_end', v_days,
      'is_override', false
    );
  end if;

  v_lead := v_rev.review_lead_time_days;
  v_override := coalesce(v_rev.override_forced, false);

  if v_days > v_lead then
    return jsonb_build_object(
      'visible', false,
      'state', 'outside_lead_time',
      'label', '',
      'days_to_end', v_days,
      'is_override', v_override
    );
  end if;

  v_visible := true;

  if v_rev.procedure_status in ('released', 'cancelled') then
    v_state := 'completed';
    v_label := case when v_rev.procedure_status = 'released' then 'Review abgeschlossen' else 'Review abgebrochen' end;
  elsif v_rev.procedure_status = 'review_in_progress' then
    v_state := 'in_progress';
    v_label := 'Review läuft';
  elsif v_rev.procedure_status = 'decision_captured' then
    v_state := 'decision_captured';
    v_label := 'Entscheidungen erfasst – Release möglich';
  elsif v_rev.procedure_status = 'ready_for_review' or (v_rev.readiness_status = 'ready' and v_rev.procedure_status = 'pre_read_open') then
    v_state := 'ready_for_review';
    v_label := case when v_override then 'Review abhalten (Override)' else 'Review abhalten' end;
  elsif v_rev.procedure_status in ('not_started', 'announcement_sent', 'pre_read_open') then
    v_state := 'preparation';
    v_label := format('Review vorbereiten (noch %s Tage)', v_days);
  else
    v_state := 'preparation';
    v_label := 'Review vorbereiten';
  end if;

  return jsonb_build_object(
    'visible', v_visible,
    'state', v_state,
    'label', v_label,
    'days_to_end', v_days,
    'is_override', v_override,
    'procedure_status', v_rev.procedure_status,
    'readiness_status', v_rev.readiness_status,
    'review_id', v_rev.id
  );
end;
$$;


--
-- Name: has_permission(uuid, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.has_permission(p_organization_id uuid, p_permission_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app', 'rbac', 'auth'
    AS $$
  select exists (
    select 1
    from app.organization_memberships m
    join rbac.member_roles mr on mr.membership_id = m.id
    join rbac.role_permissions rp on rp.role_id = mr.role_id
    join rbac.permissions p on p.id = rp.permission_id
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.code = p_permission_code
  );
$$;


--
-- Name: is_member_of_org(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.is_member_of_org(p_organization_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app', 'rbac', 'auth'
    AS $$
  select exists (
    select 1
    from app.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;


--
-- Name: prepare_strategy_review(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.prepare_strategy_review(p_review_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_org uuid;
  v_ci uuid;
  v_payload jsonb;
  v_challenge_ids uuid[];
  v_focus_ids uuid[];
  v_obj_ids uuid[];
begin
  select organization_id, cycle_instance_id into v_org, v_ci
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_ci is null then
    raise exception 'prepare_strategy_review: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'prepare_strategy_review: forbidden';
  end if;

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_challenge_ids
  from app.strategic_challenges
  where organization_id = v_org and cycle_instance_id = v_ci;

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_focus_ids
  from app.strategic_directions
  where organization_id = v_org and cycle_instance_id = v_ci;

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_obj_ids
  from app.objectives
  where organization_id = v_org and cycle_instance_id = v_ci;

  v_payload := jsonb_build_object(
    'generated_at', to_jsonb(now()),
    'scope', jsonb_build_object(
      'challenge_ids', coalesce(to_jsonb(v_challenge_ids), '[]'::jsonb),
      'focus_area_ids', coalesce(to_jsonb(v_focus_ids), '[]'::jsonb),
      'objective_ids', coalesce(to_jsonb(v_obj_ids), '[]'::jsonb)
    ),
    'challenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'description', c.description,
          'priority', c.priority,
          'visibility', c.visibility
        ) order by c.title
      )
      from app.strategic_challenges c
      where c.organization_id = v_org and c.cycle_instance_id = v_ci
    ), '[]'::jsonb),
    'focus_areas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'title', d.title,
          'description', d.description,
          'status', d.status,
          'priority', d.priority
        ) order by d.title
      )
      from app.strategic_directions d
      where d.organization_id = v_org and d.cycle_instance_id = v_ci
    ), '[]'::jsonb),
    'objectives', coalesce((
      select jsonb_agg(x.obj order by x.sort_title)
      from (
        select o.title as sort_title,
          jsonb_build_object(
            'id', o.id,
            'title', o.title,
            'description', o.description,
            'status', o.status,
            'progress_percent', o.progress_percent,
            'key_results', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', kr.id,
                  'title', kr.title,
                  'metric_type', kr.metric_type,
                  'target_value', kr.target_value,
                  'current_value', kr.current_value
                ) order by kr.title
              )
              from app.key_results kr
              where kr.objective_id = o.id
            ), '[]'::jsonb)
          ) as obj
        from app.objectives o
        where o.organization_id = v_org and o.cycle_instance_id = v_ci
      ) x
    ), '[]'::jsonb)
  );

  update app.okr_reviews
  set pre_read_payload = v_payload,
      procedure_status = 'pre_read_open'
  where id = p_review_id
    and procedure_status = 'announcement_sent';

  if not found then
    raise exception 'prepare_strategy_review: expected procedure_status announcement_sent';
  end if;

  perform app.compute_review_readiness(p_review_id);
end;
$$;


--
-- Name: record_strategy_review_announcement(uuid, jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.record_strategy_review_announcement(p_review_id uuid, p_payload jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
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


--
-- Name: regenerate_cycle_instances(uuid, integer, uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.regenerate_cycle_instances(p_cycle_scheme_id uuid, p_horizon_months integer DEFAULT NULL::integer, p_actor_membership_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_scheme app.cycle_schemes%rowtype;
  v_horizon integer;
  v_top_months integer;
  v_level2_months integer;
  v_level3_months integer;
  v_top_count integer;
  v_top_idx integer;
  v_level2_count integer;
  v_level2_idx integer;
  v_level3_count integer;
  v_level3_idx integer;
  v_l1_start date;
  v_l1_end date;
  v_l2_start date;
  v_l2_end date;
  v_l3_start date;
  v_l3_end date;
  v_parent_l1 uuid;
  v_parent_l2 uuid;
  v_created integer := 0;
begin
  select * into v_scheme
  from app.cycle_schemes
  where id = p_cycle_scheme_id;

  if v_scheme.id is null then
    raise exception 'cycle scheme not found: %', p_cycle_scheme_id;
  end if;

  perform app.validate_cycle_scheme_levels(p_cycle_scheme_id);

  select duration_months into v_top_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 1;

  select duration_months into v_level2_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 2;

  select duration_months into v_level3_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 3;

  v_horizon := coalesce(p_horizon_months, greatest(v_top_months, 12));
  v_top_count := greatest(1, ceil(v_horizon::numeric / v_top_months::numeric)::integer);

  delete from app.cycle_instances
  where cycle_scheme_id = p_cycle_scheme_id
    and legacy_planning_cycle_id is null;

  for v_top_idx in 0..(v_top_count - 1) loop
    v_l1_start := (v_scheme.starts_on + make_interval(months => v_top_idx * v_top_months))::date;
    v_l1_end := (v_l1_start + make_interval(months => v_top_months))::date;

    insert into app.cycle_instances (
      organization_id, cycle_scheme_id, level_no, parent_instance_id,
      starts_on, ends_on, status, code, name, sequence_no
    )
    values (
      v_scheme.organization_id,
      p_cycle_scheme_id,
      1,
      null,
      v_l1_start,
      v_l1_end,
      'planned',
      format('%s-L1-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0')),
      format('%s / Ebene 1 #%s', v_scheme.name, v_top_idx + 1),
      v_top_idx + 1
    )
    returning id into v_parent_l1;

    v_created := v_created + 1;

    if v_level2_months is not null then
      v_level2_count := v_top_months / v_level2_months;
      for v_level2_idx in 0..(v_level2_count - 1) loop
        v_l2_start := (v_l1_start + make_interval(months => v_level2_idx * v_level2_months))::date;
        v_l2_end := (v_l2_start + make_interval(months => v_level2_months))::date;

        insert into app.cycle_instances (
          organization_id, cycle_scheme_id, level_no, parent_instance_id,
          starts_on, ends_on, status, code, name, sequence_no
        )
        values (
          v_scheme.organization_id,
          p_cycle_scheme_id,
          2,
          v_parent_l1,
          v_l2_start,
          v_l2_end,
          'planned',
          format('%s-L2-%s-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0'), lpad((v_level2_idx + 1)::text, 3, '0')),
          format('%s / Ebene 2 #%s.%s', v_scheme.name, v_top_idx + 1, v_level2_idx + 1),
          (v_top_idx * v_level2_count) + v_level2_idx + 1
        )
        returning id into v_parent_l2;

        v_created := v_created + 1;

        if v_level3_months is not null then
          v_level3_count := v_level2_months / v_level3_months;
          for v_level3_idx in 0..(v_level3_count - 1) loop
            v_l3_start := (v_l2_start + make_interval(months => v_level3_idx * v_level3_months))::date;
            v_l3_end := (v_l3_start + make_interval(months => v_level3_months))::date;

            insert into app.cycle_instances (
              organization_id, cycle_scheme_id, level_no, parent_instance_id,
              starts_on, ends_on, status, code, name, sequence_no
            )
            values (
              v_scheme.organization_id,
              p_cycle_scheme_id,
              3,
              v_parent_l2,
              v_l3_start,
              v_l3_end,
              'planned',
              format('%s-L3-%s-%s-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0'), lpad((v_level2_idx + 1)::text, 3, '0'), lpad((v_level3_idx + 1)::text, 3, '0')),
              format('%s / Ebene 3 #%s.%s.%s', v_scheme.name, v_top_idx + 1, v_level2_idx + 1, v_level3_idx + 1),
              ((v_top_idx * v_level2_count * v_level3_count) + (v_level2_idx * v_level3_count) + v_level3_idx + 1)
            );

            v_created := v_created + 1;
          end loop;
        end if;
      end loop;
    end if;
  end loop;

  return v_created;
end;
$$;


--
-- Name: resolve_active_cycle_instance(uuid, integer); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.resolve_active_cycle_instance(p_organization_id uuid, p_level_no integer DEFAULT NULL::integer) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  with now_date as (
    select now()::date as d
  )
  select ci.id
  from app.cycle_instances ci
  join app.cycle_schemes cs on cs.id = ci.cycle_scheme_id
  join now_date n on true
  where ci.organization_id = p_organization_id
    and cs.is_active = true
    and (p_level_no is null or ci.level_no = p_level_no)
    and ci.starts_on <= n.d
    and ci.ends_on > n.d
  order by ci.level_no desc, ci.starts_on desc
  limit 1;
$$;


--
-- Name: resolve_successor_cycle_instance(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.resolve_successor_cycle_instance(p_from_instance_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
  select c2.id
  from app.cycle_instances c1
  join app.cycle_instances c2
    on c2.organization_id = c1.organization_id
   and c2.cycle_scheme_id = c1.cycle_scheme_id
   and c2.level_no = c1.level_no
   and c2.parent_instance_id is not distinct from c1.parent_instance_id
   and c2.starts_on = c1.ends_on + 1
  where c1.id = p_from_instance_id
  limit 1;
$$;


--
-- Name: save_strategy_review_feedback(uuid, uuid, jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.save_strategy_review_feedback(p_review_id uuid, p_actor_membership_id uuid, p_feedback jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_org uuid;
  v_elem jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_rating text;
  v_comment text;
begin
  select organization_id into v_org from app.okr_reviews where id = p_review_id;
  if v_org is null then
    raise exception 'save_strategy_review_feedback: review not found';
  end if;

  if p_actor_membership_id is distinct from app._strategy_review_current_membership(v_org) then
    raise exception 'save_strategy_review_feedback: actor must be current user membership';
  end if;

  if not app.has_permission(v_org, 'strategy_review.feedback') then
    raise exception 'save_strategy_review_feedback: forbidden';
  end if;

  for v_elem in select * from jsonb_array_elements(coalesce(p_feedback -> 'entries', '[]'::jsonb))
  loop
    v_subject_type := v_elem ->> 'subject_type';
    v_subject_id := nullif(v_elem ->> 'subject_id', '')::uuid;
    v_rating := v_elem ->> 'rating';
    v_comment := v_elem ->> 'comment';

    insert into app.strategy_review_feedback_entries (
      review_id, subject_type, subject_id, actor_id, rating, comment
    ) values (
      p_review_id, v_subject_type, v_subject_id, p_actor_membership_id, v_rating, v_comment
    );
  end loop;

  update app.okr_reviews r
  set stakeholder_feedback_payload = jsonb_build_object(
    'updated_at', to_jsonb(now()),
    'entry_count', (select count(*)::int from app.strategy_review_feedback_entries f where f.review_id = p_review_id)
  )
  where r.id = p_review_id;

  perform app.compute_review_readiness(p_review_id);
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: stable_md5_uuid(text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.stable_md5_uuid(p_input text) RETURNS uuid
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  select (
    substr(md5(p_input), 1, 8) || '-' ||
    substr(md5(p_input), 9, 4) || '-' ||
    substr(md5(p_input), 13, 4) || '-' ||
    substr(md5(p_input), 17, 4) || '-' ||
    substr(md5(p_input), 21, 12)
  )::uuid;
$$;


--
-- Name: start_strategy_review_meeting(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.start_strategy_review_meeting(p_review_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
declare
  v_org uuid;
  v_ready text;
  v_proc text;
  v_override boolean;
begin
  select organization_id, readiness_status, procedure_status, override_forced
  into v_org, v_ready, v_proc, v_override
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'start_strategy_review_meeting: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'start_strategy_review_meeting: forbidden';
  end if;

  if not (
    (v_ready = 'ready' and v_proc = 'ready_for_review')
    or (v_override and v_proc in ('pre_read_open', 'ready_for_review'))
  ) then
    raise exception 'start_strategy_review_meeting: readiness / state guard failed';
  end if;

  update app.okr_reviews
  set procedure_status = 'review_in_progress'
  where id = p_review_id;
end;
$$;


--
-- Name: sync_legacy_cycle_columns(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.sync_legacy_cycle_columns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  payload jsonb := to_jsonb(new);
  v_cycle_instance_id uuid := nullif(payload ->> 'cycle_instance_id', '')::uuid;
  v_planning_cycle_id uuid := nullif(payload ->> 'planning_cycle_id', '')::uuid;
  v_cycle_id uuid := nullif(payload ->> 'cycle_id', '')::uuid;
  v_legacy_cycle_id uuid;
begin
  if v_cycle_instance_id is null and payload ? 'planning_cycle_id' and v_planning_cycle_id is not null then
    select id into v_cycle_instance_id
    from app.cycle_instances
    where legacy_planning_cycle_id = v_planning_cycle_id
    limit 1;

    if v_cycle_instance_id is null then
      select id into v_cycle_instance_id
      from app.cycle_instances
      where id = v_planning_cycle_id
      limit 1;
    end if;
  end if;

  if v_cycle_instance_id is null and payload ? 'cycle_id' and v_cycle_id is not null then
    select id into v_cycle_instance_id
    from app.cycle_instances
    where legacy_planning_cycle_id = v_cycle_id
    limit 1;

    if v_cycle_instance_id is null then
      select id into v_cycle_instance_id
      from app.cycle_instances
      where id = v_cycle_id
      limit 1;
    end if;
  end if;

  -- planning_cycle_id must reference planning_cycles(id). Use ONLY legacy_planning_cycle_id.
  -- When null, set planning_cycle_id to null (avoids FK violation: cycle_instances.id != planning_cycles.id).
  if payload ? 'planning_cycle_id' and v_cycle_instance_id is not null then
    select legacy_planning_cycle_id into v_legacy_cycle_id
    from app.cycle_instances
    where id = v_cycle_instance_id
    limit 1;

    new := jsonb_populate_record(new, jsonb_build_object('planning_cycle_id', v_legacy_cycle_id));
  end if;

  if payload ? 'cycle_id' and v_cycle_instance_id is not null then
    select coalesce(legacy_planning_cycle_id, id) into v_legacy_cycle_id
    from app.cycle_instances
    where id = v_cycle_instance_id
    limit 1;

    new := jsonb_populate_record(new, jsonb_build_object('cycle_id', v_legacy_cycle_id));
  end if;

  if payload ? 'cycle_instance_id' then
    new := jsonb_populate_record(new, jsonb_build_object('cycle_instance_id', v_cycle_instance_id));
  end if;

  return new;
end;
$$;


--
-- Name: tg_strategy_review_feedback_sync(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.tg_strategy_review_feedback_sync() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_org uuid;
  v_ci uuid;
begin
  select r.organization_id, r.cycle_instance_id
  into v_org, v_ci
  from app.okr_reviews r
  where r.id = new.review_id;

  if v_org is null then
    raise exception 'strategy_review_feedback: invalid review_id';
  end if;

  new.organization_id := v_org;
  new.cycle_instance_id := v_ci;
  return new;
end;
$$;


--
-- Name: tg_touch_updated_at(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.tg_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: tg_validate_cycle_scheme_levels(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.tg_validate_cycle_scheme_levels() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_cycle_scheme_id uuid;
begin
  v_cycle_scheme_id := coalesce(new.cycle_scheme_id, old.cycle_scheme_id);
  perform app.validate_cycle_scheme_levels(v_cycle_scheme_id);
  return coalesce(new, old);
end;
$$;


--
-- Name: validate_cycle_scheme_levels(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_cycle_scheme_levels(p_cycle_scheme_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_top integer;
  v_level1 integer;
  v_level2 integer;
  v_level3 integer;
begin
  select top_level_duration_months into v_top
  from app.cycle_schemes
  where id = p_cycle_scheme_id;

  if v_top is null then
    raise exception 'Cycle scheme not found: %', p_cycle_scheme_id;
  end if;

  select duration_months into v_level1
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 1;

  if v_level1 is null then
    raise exception 'Cycle scheme % must define level 1', p_cycle_scheme_id;
  end if;

  if v_top % v_level1 <> 0 then
    raise exception 'Level 1 duration must divide top level duration (% %% % != 0)', v_top, v_level1;
  end if;

  select duration_months into v_level2
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 2;

  if v_level2 is not null and v_level1 % v_level2 <> 0 then
    raise exception 'Level 2 duration must divide level 1 duration (% %% % != 0)', v_level1, v_level2;
  end if;

  select duration_months into v_level3
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 3;

  if v_level3 is not null then
    if v_level2 is null then
      raise exception 'Level 3 requires level 2';
    end if;
    if v_level2 % v_level3 <> 0 then
      raise exception 'Level 3 duration must divide level 2 duration (% %% % != 0)', v_level2, v_level3;
    end if;
  end if;
end;
$$;


--
-- Name: validate_membership_responsible_org(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_membership_responsible_org() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_responsible_org_id uuid;
begin
  if new.responsible_id is null then
    return new;
  end if;

  select organization_id
  into v_responsible_org_id
  from app.responsibles
  where id = new.responsible_id;

  if v_responsible_org_id is null then
    raise exception 'membership responsible does not exist';
  end if;

  if v_responsible_org_id <> new.organization_id then
    raise exception 'membership responsible cross-organization mismatch';
  end if;

  return new;
end;
$$;


--
-- Name: validate_org_unit_dimension_link_cross_org(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_org_unit_dimension_link_cross_org() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_org_id uuid;
  v_cycle_id uuid;
begin
  select organization_id into v_org_id
  from app.organization_unit
  where id = new.organization_unit_id;

  if v_org_id is null or v_org_id <> new.organization_id then
    raise exception 'organization unit cross-organization mismatch';
  end if;

  if tg_table_name = 'organization_unit_industries' then
    select organization_id, planning_cycle_id into v_org_id, v_cycle_id
    from app.industries
    where id = new.industry_id;
  elsif tg_table_name = 'organization_unit_business_models' then
    select organization_id, planning_cycle_id into v_org_id, v_cycle_id
    from app.business_models
    where id = new.business_model_id;
  else
    raise exception 'unsupported link table %', tg_table_name;
  end if;

  if v_org_id is null or v_org_id <> new.organization_id then
    raise exception 'dimension link cross-organization mismatch';
  end if;

  if v_cycle_id is null or v_cycle_id <> new.planning_cycle_id then
    raise exception 'dimension link planning cycle mismatch';
  end if;

  return new;
end;
$$;


--
-- Name: validate_organization_unit_cycle(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_organization_unit_cycle() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_loop_detected boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  with recursive parent_chain as (
    select u.id, u.parent_id
    from app.organization_unit u
    where u.id = new.parent_id
    union all
    select p.id, p.parent_id
    from app.organization_unit p
    join parent_chain c on c.parent_id = p.id
  )
  select exists(select 1 from parent_chain where id = new.id)
    into v_loop_detected;

  if v_loop_detected then
    raise exception 'circular parent relationship is not allowed';
  end if;

  return new;
end;
$$;


--
-- Name: validate_organization_unit_hierarchy(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_organization_unit_hierarchy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_parent_id uuid;
  v_parent_org uuid;
  v_type_exists boolean;
begin
  if new.parent_id is not null and new.parent_id = new.id then
    raise exception 'organization unit cannot be its own parent';
  end if;

  select exists (
    select 1
    from app.organization_unit_type t
    where t.id = new.organization_unit_type_id
      and t.is_active = true
  ) into v_type_exists;
  if not v_type_exists then
    raise exception 'organization unit type does not exist or is inactive';
  end if;

  if new.parent_id is not null then
    select u.id, u.organization_id
      into v_parent_id, v_parent_org
    from app.organization_unit u
    where u.id = new.parent_id;

    if v_parent_id is null then
      raise exception 'parent organization unit not found';
    end if;

    if v_parent_org <> new.organization_id then
      raise exception 'parent must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: validate_responsible_cross_org(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_responsible_cross_org() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_org_id uuid;
begin
  if tg_table_name = 'responsible_assignments' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'responsible assignment cross-organization mismatch';
    end if;

    select organization_id into v_org_id
    from app.organization_unit
    where id = new.organization_unit_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'organization unit assignment cross-organization mismatch';
    end if;
  elsif tg_table_name = 'responsible_hierarchy' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.manager_responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'manager cross-organization mismatch';
    end if;

    select organization_id into v_org_id
    from app.responsibles
    where id = new.report_responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'report cross-organization mismatch';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: validate_strategy_decision_payload(jsonb, jsonb); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.validate_strategy_decision_payload(p_decisions jsonb, p_pre_read jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'app', 'public'
    AS $$
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
    if v_dec is null or v_dec not in ('keep', 'adjust', 'replace') then
      v_errors := array_append(v_errors, format('challenge %s invalid decision', v_id));
    end if;
    if v_dec in ('adjust', 'replace') and (v_elem ->> 'comment') is null then
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
    if v_dec is null or v_dec not in ('double_down', 'adjust', 'stop') then
      v_errors := array_append(v_errors, format('focus_area %s invalid decision', v_id));
    end if;
    if v_dec in ('adjust', 'stop') and (v_elem ->> 'comment') is null then
      v_errors := array_append(v_errors, format('focus_area %s requires comment', v_id));
    end if;
    if v_dec = 'adjust' and not (v_elem ? 'proposed_changes') then
      v_errors := array_append(v_errors, format('focus_area %s adjust needs proposed_changes', v_id));
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
    if v_dec is null or v_dec not in ('keep', 'change', 'remove') then
      v_errors := array_append(v_errors, format('objective %s invalid decision', v_id));
    end if;
    if v_dec in ('change', 'remove') and (v_elem ->> 'comment') is null then
      v_errors := array_append(v_errors, format('objective %s requires comment', v_id));
    end if;
    if v_dec = 'change' and not (v_elem ? 'proposed_changes') then
      v_errors := array_append(v_errors, format('objective %s change needs proposed_changes', v_id));
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


--
-- Name: log_row_change(); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.log_row_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_revision_id bigint;
  v_revision_text text;
  v_action text;
  v_org_id uuid;
  v_row_pk uuid;
  v_user_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'INSERT';
    v_before := null;
    v_after := to_jsonb(new);
    v_org_id := (v_after ->> 'organization_id')::uuid;
    v_row_pk := (v_after ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    v_action := 'UPDATE';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_org_id := coalesce((v_after ->> 'organization_id')::uuid, (v_before ->> 'organization_id')::uuid);
    v_row_pk := coalesce((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid);
  else
    v_action := 'DELETE';
    v_before := to_jsonb(old);
    v_after := null;
    v_org_id := (v_before ->> 'organization_id')::uuid;
    v_row_pk := (v_before ->> 'id')::uuid;
  end if;

  v_revision_text := nullif(current_setting('app.current_revision_id', true), '');

  if v_revision_text is null then
    begin
      v_user_id := auth.uid();
    exception
      when others then
        v_user_id := null;
    end;

    insert into audit.revisions (organization_id, actor_user_id, source, reason)
    values (v_org_id, v_user_id, 'trigger', 'implicit row change')
    returning id into v_revision_id;
  else
    v_revision_id := v_revision_text::bigint;
  end if;

  insert into audit.revision_events (
    revision_id,
    organization_id,
    table_schema,
    table_name,
    row_pk,
    action,
    before_data,
    after_data
  )
  values (
    v_revision_id,
    v_org_id,
    tg_table_schema,
    tg_table_name,
    v_row_pk,
    v_action,
    v_before,
    v_after
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


--
-- Name: start_revision(uuid, uuid, text, text); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.start_revision(p_organization_id uuid, p_actor_membership_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text, p_source text DEFAULT 'api'::text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
declare
  v_revision_id bigint;
  v_user_id uuid;
begin
  begin
    v_user_id := auth.uid();
  exception
    when others then
      v_user_id := null;
  end;

  insert into audit.revisions (
    organization_id,
    actor_user_id,
    actor_membership_id,
    source,
    reason
  )
  values (
    p_organization_id,
    v_user_id,
    p_actor_membership_id,
    p_source,
    p_reason
  )
  returning id into v_revision_id;

  perform set_config('app.current_revision_id', v_revision_id::text, true);
  return v_revision_id;
end;
$$;


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: ensure_member_role_same_org(); Type: FUNCTION; Schema: rbac; Owner: -
--

CREATE FUNCTION rbac.ensure_member_role_same_org() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  membership_org_id uuid;
  role_org_id uuid;
begin
  select organization_id into membership_org_id
  from app.organization_memberships
  where id = new.membership_id;

  select organization_id into role_org_id
  from rbac.roles
  where id = new.role_id;

  if membership_org_id is null or role_org_id is null then
    raise exception 'membership or role does not exist';
  end if;

  if membership_org_id <> role_org_id then
    raise exception 'member_roles cross-tenant assignment is not allowed';
  end if;

  return new;
end;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analysis_background_jobs; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.analysis_background_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_instance_id uuid NOT NULL,
    job_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    progress_done integer DEFAULT 0 NOT NULL,
    progress_total integer DEFAULT 0 NOT NULL,
    cursor text,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    last_error text,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analysis_background_jobs_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT analysis_background_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['quality_backfill'::text, 'graph_layout_recompute'::text, 'entry_embedding_backfill'::text, 'objective_evaluation_backfill'::text, 'link_draft_generation'::text, 'cluster_recompute'::text, 'gaps_recompute'::text]))),
    CONSTRAINT analysis_background_jobs_max_attempts_check CHECK ((max_attempts >= 1)),
    CONSTRAINT analysis_background_jobs_progress_done_check CHECK ((progress_done >= 0)),
    CONSTRAINT analysis_background_jobs_progress_total_check CHECK ((progress_total >= 0)),
    CONSTRAINT analysis_background_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: analysis_challenge_candidates; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.analysis_challenge_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_instance_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    priority smallint DEFAULT 3 NOT NULL,
    source_type text NOT NULL,
    source_ref text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT analysis_challenge_candidates_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT analysis_challenge_candidates_priority_check CHECK (((priority >= 1) AND (priority <= 5))),
    CONSTRAINT analysis_challenge_candidates_source_type_check CHECK ((source_type = ANY (ARRAY['cluster'::text, 'gap'::text]))),
    CONSTRAINT analysis_challenge_candidates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'promoted'::text, 'dismissed'::text])))
);


--
-- Name: analysis_cluster_members; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.analysis_cluster_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cluster_id uuid NOT NULL,
    entry_id uuid NOT NULL,
    membership_strength numeric(5,4) DEFAULT 0.5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT analysis_cluster_members_membership_strength_check CHECK (((membership_strength >= (0)::numeric) AND (membership_strength <= (1)::numeric)))
);


--
-- Name: analysis_clusters; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.analysis_clusters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    label text NOT NULL,
    summary text,
    cluster_score numeric(8,4) DEFAULT 0 NOT NULL,
    method text DEFAULT 'graph-v1'::text NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    cycle_instance_id uuid NOT NULL,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT analysis_clusters_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text])))
);


--
-- Name: analysis_entries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.analysis_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    analysis_type text NOT NULL,
    sub_type text,
    title text NOT NULL,
    description text,
    impact_level smallint,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    uncertainty_level smallint,
    cycle_instance_id uuid NOT NULL,
    quality_score smallint,
    quality_band text,
    quality_source text,
    quality_explanation text,
    quality_calculated_at timestamp with time zone,
    quality_fallback_reason text,
    quality_provider text,
    quality_model text,
    quality_prompt_version text,
    graph_layout_x double precision,
    graph_layout_y double precision,
    graph_layout_z double precision,
    graph_layout_confidence double precision,
    graph_layout_reason text,
    graph_layout_source text,
    graph_layout_fallback_reason text,
    graph_layout_provider text,
    graph_layout_model text,
    graph_layout_prompt_version text,
    graph_layout_calculated_at timestamp with time zone,
    semantic_embedding public.vector(768),
    semantic_embedding_model text,
    semantic_embedding_version text,
    semantic_embedding_calculated_at timestamp with time zone,
    semantic_embedding_status text,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT analysis_entries_analysis_type_check CHECK ((analysis_type = ANY (ARRAY['environment'::text, 'company'::text, 'competitor'::text, 'swot'::text, 'pestel'::text, 'workshop'::text, 'other'::text]))),
    CONSTRAINT analysis_entries_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT analysis_entries_graph_layout_confidence_check CHECK (((graph_layout_confidence IS NULL) OR ((graph_layout_confidence >= (0)::double precision) AND (graph_layout_confidence <= (1)::double precision)))),
    CONSTRAINT analysis_entries_graph_layout_fallback_reason_check CHECK (((graph_layout_fallback_reason IS NULL) OR (graph_layout_fallback_reason = ANY (ARRAY['llm_not_requested'::text, 'llm_no_result'::text])))),
    CONSTRAINT analysis_entries_graph_layout_source_check CHECK (((graph_layout_source IS NULL) OR (graph_layout_source = ANY (ARRAY['llm'::text, 'rule'::text])))),
    CONSTRAINT analysis_entries_graph_layout_x_check CHECK (((graph_layout_x IS NULL) OR ((graph_layout_x >= ('-1'::integer)::double precision) AND (graph_layout_x <= (1)::double precision)))),
    CONSTRAINT analysis_entries_graph_layout_y_check CHECK (((graph_layout_y IS NULL) OR ((graph_layout_y >= ('-1'::integer)::double precision) AND (graph_layout_y <= (1)::double precision)))),
    CONSTRAINT analysis_entries_graph_layout_z_check CHECK (((graph_layout_z IS NULL) OR ((graph_layout_z >= ('-1'::integer)::double precision) AND (graph_layout_z <= (1)::double precision)))),
    CONSTRAINT analysis_entries_impact_level_check CHECK (((impact_level >= 1) AND (impact_level <= 5))),
    CONSTRAINT analysis_entries_quality_band_check CHECK (((quality_band IS NULL) OR (quality_band = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))),
    CONSTRAINT analysis_entries_quality_fallback_reason_check CHECK (((quality_fallback_reason IS NULL) OR (quality_fallback_reason = ANY (ARRAY['llm_not_requested'::text, 'llm_no_result'::text])))),
    CONSTRAINT analysis_entries_quality_score_check CHECK (((quality_score IS NULL) OR ((quality_score >= 0) AND (quality_score <= 100)))),
    CONSTRAINT analysis_entries_quality_source_check CHECK (((quality_source IS NULL) OR (quality_source = ANY (ARRAY['llm'::text, 'rule'::text])))),
    CONSTRAINT analysis_entries_semantic_embedding_status_check CHECK (((semantic_embedding_status IS NULL) OR (semantic_embedding_status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text])))),
    CONSTRAINT analysis_entries_uncertainty_level_check CHECK (((uncertainty_level >= 1) AND (uncertainty_level <= 5)))
);


--
-- Name: analysis_gap_findings; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.analysis_gap_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    dimension text NOT NULL,
    gap_type text NOT NULL,
    severity smallint DEFAULT 3 NOT NULL,
    recommendation text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    related_cluster_id uuid,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    cycle_instance_id uuid NOT NULL,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT analysis_gap_findings_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT analysis_gap_findings_gap_type_check CHECK ((gap_type = ANY (ARRAY['coverage'::text, 'connectivity'::text, 'traceability'::text, 'evidence'::text]))),
    CONSTRAINT analysis_gap_findings_severity_check CHECK (((severity >= 1) AND (severity <= 5))),
    CONSTRAINT analysis_gap_findings_status_check CHECK ((status = ANY (ARRAY['open'::text, 'accepted'::text, 'resolved'::text])))
);


--
-- Name: analysis_item_link; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.analysis_item_link (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    source_analysis_item_id uuid NOT NULL,
    target_analysis_item_id uuid NOT NULL,
    link_type text NOT NULL,
    strength smallint DEFAULT 3 NOT NULL,
    confidence numeric(5,4) DEFAULT 0.5000 NOT NULL,
    comment text,
    source_draft_id uuid,
    activated_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    cycle_instance_id uuid NOT NULL,
    created_by_membership_id uuid,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT analysis_item_link_check CHECK ((source_analysis_item_id <> target_analysis_item_id)),
    CONSTRAINT analysis_item_link_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT analysis_item_link_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT analysis_item_link_link_type_check CHECK ((link_type = ANY (ARRAY['related_to'::text, 'causes'::text, 'supports'::text, 'contradicts'::text, 'amplifies'::text, 'depends_on'::text, 'duplicates'::text]))),
    CONSTRAINT analysis_item_link_strength_check CHECK (((strength >= 1) AND (strength <= 5)))
);


--
-- Name: analysis_item_link_draft; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.analysis_item_link_draft (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    source_analysis_item_id uuid NOT NULL,
    target_analysis_item_id uuid NOT NULL,
    link_type text NOT NULL,
    strength smallint DEFAULT 3 NOT NULL,
    confidence numeric(5,4) DEFAULT 0.5000 NOT NULL,
    comment text,
    origin text DEFAULT 'hybrid'::text NOT NULL,
    provider text,
    model text,
    prompt_version text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by_membership_id uuid,
    reviewed_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    cycle_instance_id uuid NOT NULL,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT analysis_item_link_draft_check CHECK ((source_analysis_item_id <> target_analysis_item_id)),
    CONSTRAINT analysis_item_link_draft_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT analysis_item_link_draft_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT analysis_item_link_draft_link_type_check CHECK ((link_type = ANY (ARRAY['related_to'::text, 'causes'::text, 'supports'::text, 'contradicts'::text, 'amplifies'::text, 'depends_on'::text, 'duplicates'::text]))),
    CONSTRAINT analysis_item_link_draft_origin_check CHECK ((origin = ANY (ARRAY['rule'::text, 'llm'::text, 'hybrid'::text, 'manual'::text]))),
    CONSTRAINT analysis_item_link_draft_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT analysis_item_link_draft_strength_check CHECK (((strength >= 1) AND (strength <= 5)))
);


--
-- Name: annual_target_business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.annual_target_business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    annual_target_id uuid NOT NULL,
    business_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: annual_target_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.annual_target_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    annual_target_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: annual_target_operating_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.annual_target_operating_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    annual_target_id uuid NOT NULL,
    operating_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: annual_targets; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.annual_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    strategic_direction_id uuid NOT NULL,
    title text NOT NULL,
    baseline numeric(18,4),
    current_measure numeric(18,4),
    progress_percent numeric(5,2) DEFAULT 0 NOT NULL,
    comment text,
    is_primary boolean DEFAULT false NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT annual_targets_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT annual_targets_progress_percent_check CHECK (((progress_percent >= (0)::numeric) AND (progress_percent <= (100)::numeric)))
);


--
-- Name: business_model_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.business_model_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    business_model_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active'::text NOT NULL,
    version_no integer DEFAULT 1 NOT NULL,
    customer_segments jsonb DEFAULT '[]'::jsonb NOT NULL,
    value_proposition jsonb DEFAULT '[]'::jsonb NOT NULL,
    channels jsonb DEFAULT '[]'::jsonb NOT NULL,
    customer_relationships jsonb DEFAULT '[]'::jsonb NOT NULL,
    revenue_streams jsonb DEFAULT '[]'::jsonb NOT NULL,
    key_resources jsonb DEFAULT '[]'::jsonb NOT NULL,
    key_activities jsonb DEFAULT '[]'::jsonb NOT NULL,
    key_partners jsonb DEFAULT '[]'::jsonb NOT NULL,
    cost_structure jsonb DEFAULT '[]'::jsonb NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT business_models_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text]))),
    CONSTRAINT business_models_version_no_check CHECK ((version_no >= 1))
);


--
-- Name: challenge_direction_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.challenge_direction_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    strategic_direction_id uuid NOT NULL,
    strategic_challenge_id uuid NOT NULL,
    contribution_level text DEFAULT 'medium'::text NOT NULL,
    note text,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT challenge_direction_links_contribution_level_check CHECK ((contribution_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: cluster_objective_relations; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.cluster_objective_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    objective_id uuid NOT NULL,
    relation_strength smallint DEFAULT 1 NOT NULL,
    gap_score numeric(10,2) DEFAULT 0 NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cluster_objective_relations_relation_strength_check CHECK (((relation_strength >= 0) AND (relation_strength <= 3)))
);


--
-- Name: cycle_cutover_snapshots; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.cycle_cutover_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cutover_id uuid,
    from_cycle_instance_id uuid NOT NULL,
    to_cycle_instance_id uuid NOT NULL,
    snapshot_type text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    review_id uuid,
    CONSTRAINT cycle_cutover_snapshots_snapshot_type_check CHECK ((snapshot_type = ANY (ARRAY['analysis_carry_forward'::text, 'strategy_review_release'::text])))
);


--
-- Name: cycle_cutovers; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.cycle_cutovers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    from_cycle_scheme_id uuid NOT NULL,
    to_cycle_scheme_id uuid NOT NULL,
    cutover_at timestamp with time zone NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    executed_at timestamp with time zone,
    CONSTRAINT cycle_cutovers_check CHECK ((from_cycle_scheme_id <> to_cycle_scheme_id)),
    CONSTRAINT cycle_cutovers_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'executed'::text, 'cancelled'::text, 'failed'::text])))
);


--
-- Name: cycle_instance_lock; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.cycle_instance_lock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    locked_by_membership_id uuid,
    reason text,
    locked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cycle_instance_portfolio_evaluation; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.cycle_instance_portfolio_evaluation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_instance_id uuid NOT NULL,
    balance_score smallint,
    distribution_internal_external_json jsonb DEFAULT '{}'::jsonb,
    distribution_exploit_explore_json jsonb DEFAULT '{}'::jsonb,
    distribution_short_long_json jsonb DEFAULT '{}'::jsonb,
    portfolio_gaps_json jsonb DEFAULT '[]'::jsonb,
    portfolio_risks_json jsonb DEFAULT '[]'::jsonb,
    portfolio_recommendation text,
    portfolio_evaluated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cycle_instance_portfolio_evaluation_balance_score_check CHECK (((balance_score IS NULL) OR ((balance_score >= 1) AND (balance_score <= 5))))
);


--
-- Name: cycle_instances; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.cycle_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_scheme_id uuid NOT NULL,
    level_no integer NOT NULL,
    parent_instance_id uuid,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sequence_no integer DEFAULT 1 NOT NULL,
    legacy_planning_cycle_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cycle_instances_check CHECK ((ends_on > starts_on)),
    CONSTRAINT cycle_instances_level_no_check CHECK (((level_no >= 1) AND (level_no <= 3))),
    CONSTRAINT cycle_instances_sequence_no_check CHECK ((sequence_no > 0)),
    CONSTRAINT cycle_instances_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'active'::text, 'closed'::text, 'locked'::text])))
);


--
-- Name: cycle_scheme_levels; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.cycle_scheme_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cycle_scheme_id uuid NOT NULL,
    level_no integer NOT NULL,
    label text NOT NULL,
    duration_months integer NOT NULL,
    divisor_of_parent integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cycle_scheme_levels_check CHECK ((((level_no = 1) AND (divisor_of_parent IS NULL)) OR ((level_no > 1) AND (divisor_of_parent IS NOT NULL) AND (divisor_of_parent > 0)))),
    CONSTRAINT cycle_scheme_levels_duration_months_check CHECK ((duration_months > 0)),
    CONSTRAINT cycle_scheme_levels_level_no_check CHECK (((level_no >= 1) AND (level_no <= 3)))
);


--
-- Name: cycle_schemes; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.cycle_schemes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    starts_on date NOT NULL,
    top_level_duration_months integer NOT NULL,
    max_levels integer DEFAULT 3 NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cycle_schemes_max_levels_check CHECK (((max_levels >= 1) AND (max_levels <= 3))),
    CONSTRAINT cycle_schemes_top_level_duration_months_check CHECK (((top_level_duration_months >= 1) AND (top_level_duration_months <= 600)))
);


--
-- Name: dashboard_column_config; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.dashboard_column_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    challenge_id uuid NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: dashboard_comments; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.dashboard_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    comment_text text NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT dashboard_comments_object_type_check CHECK ((object_type = ANY (ARRAY['direction'::text, 'challenge'::text, 'cell'::text, 'annual_target'::text])))
);


--
-- Name: dashboard_row_config; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.dashboard_row_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    direction_id uuid NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: direction_metric_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.direction_metric_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    strategic_direction_id uuid NOT NULL,
    strategic_metric_id uuid NOT NULL,
    contribution_level text DEFAULT 'medium'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT direction_metric_links_contribution_level_check CHECK ((contribution_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: entity_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.entity_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    from_type text NOT NULL,
    from_id uuid NOT NULL,
    to_type text NOT NULL,
    to_id uuid NOT NULL,
    relation_type text DEFAULT 'supports'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entity_links_check CHECK (((from_type <> to_type) OR (from_id <> to_id))),
    CONSTRAINT entity_links_from_type_check CHECK ((from_type = ANY (ARRAY['strategic_goal'::text, 'functional_strategy'::text, 'objective'::text, 'key_result'::text]))),
    CONSTRAINT entity_links_to_type_check CHECK ((to_type = ANY (ARRAY['strategic_goal'::text, 'functional_strategy'::text, 'objective'::text, 'key_result'::text])))
);


--
-- Name: functional_strategies; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.functional_strategies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_id uuid,
    function_name text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    owner_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT functional_strategies_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'on_hold'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    name text NOT NULL,
    description text,
    market_characteristics text,
    growth_rate numeric(6,3),
    strategic_importance text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    portfolio_share numeric(6,3),
    CONSTRAINT industries_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text]))),
    CONSTRAINT industries_strategic_importance_check CHECK ((strategic_importance = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: initiative_business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.initiative_business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    initiative_id uuid NOT NULL,
    business_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: initiative_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.initiative_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    initiative_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: initiative_key_result_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.initiative_key_result_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    initiative_id uuid NOT NULL,
    key_result_id uuid NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE initiative_key_result_links; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON TABLE app.initiative_key_result_links IS 'Initiative–Key Result links: implementation drivers for outcomes; canonical for OKR workspace (not linked_okrs JSON).';


--
-- Name: initiative_operating_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.initiative_operating_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    initiative_id uuid NOT NULL,
    operating_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: initiative_target_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.initiative_target_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    initiative_id uuid NOT NULL,
    annual_target_id uuid NOT NULL,
    contribution_level text DEFAULT 'medium'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT initiative_target_links_contribution_level_check CHECK ((contribution_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: initiatives; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.initiatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    title text NOT NULL,
    description text,
    owner_membership_id uuid,
    start_date date,
    end_date date,
    status text DEFAULT 'draft'::text NOT NULL,
    priority smallint DEFAULT 3 NOT NULL,
    budget numeric(18,2),
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    program_id uuid NOT NULL,
    linked_okrs jsonb DEFAULT '[]'::jsonb NOT NULL,
    deliverables jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    execution_health_override text,
    execution_health_override_by_membership_id uuid,
    execution_health_override_at timestamp with time zone,
    review_comment text,
    weight integer DEFAULT 3 NOT NULL,
    progress_percent integer DEFAULT 0 NOT NULL,
    last_review_update_at timestamp with time zone,
    CONSTRAINT initiatives_check CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (start_date <= end_date))),
    CONSTRAINT initiatives_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT initiatives_execution_health_override_check CHECK (((execution_health_override IS NULL) OR (execution_health_override = ANY (ARRAY['on_track'::text, 'at_risk'::text, 'off_track'::text])))),
    CONSTRAINT initiatives_priority_check CHECK (((priority >= 1) AND (priority <= 5))),
    CONSTRAINT initiatives_progress_check CHECK (((progress_percent >= 0) AND (progress_percent <= 100))),
    CONSTRAINT initiatives_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'planned'::text, 'active'::text, 'at_risk'::text, 'on_hold'::text, 'completed'::text, 'archived'::text]))),
    CONSTRAINT initiatives_weight_review_check CHECK ((weight = ANY (ARRAY[1, 2, 3, 5, 8])))
);


--
-- Name: COLUMN initiatives.weight; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.initiatives.weight IS 'Relative Gewichtung fuer gewichteten Stossrichtungsfortschritt im Reviewzyklus.';


--
-- Name: COLUMN initiatives.progress_percent; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.initiatives.progress_percent IS 'Manuell gepflegter Umsetzungsfortschritt 0–100 im Reviewzyklus.';


--
-- Name: COLUMN initiatives.last_review_update_at; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.initiatives.last_review_update_at IS 'Letztes bewusstes Review-Update (nicht technisches updated_at).';


--
-- Name: key_result_business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.key_result_business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    key_result_id uuid NOT NULL,
    business_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: key_result_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.key_result_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    key_result_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: key_result_operating_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.key_result_operating_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    key_result_id uuid NOT NULL,
    operating_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: key_result_target_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.key_result_target_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    key_result_id uuid NOT NULL,
    annual_target_id uuid NOT NULL,
    contribution_level text DEFAULT 'medium'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT key_result_target_links_contribution_level_check CHECK ((contribution_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: key_results; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.key_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    objective_id uuid NOT NULL,
    title text NOT NULL,
    metric_type text DEFAULT 'numeric'::text NOT NULL,
    start_value numeric(18,4),
    target_value numeric(18,4),
    current_value numeric(18,4),
    status text DEFAULT 'draft'::text NOT NULL,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    measurement_unit text,
    created_by_membership_id uuid,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    owner_membership_id uuid,
    CONSTRAINT key_results_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT key_results_metric_type_check CHECK ((metric_type = ANY (ARRAY['numeric'::text, 'percent'::text, 'boolean'::text]))),
    CONSTRAINT key_results_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'at_risk'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: TABLE key_results; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON TABLE app.key_results IS 'Key Result outcome metrics (baseline/target/current); not initiative implementation progress.';


--
-- Name: COLUMN key_results.owner_membership_id; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.key_results.owner_membership_id IS 'Optional KR owner; UI falls back to objectives.owner_membership_id when null.';


--
-- Name: llm_model_health_status; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.llm_model_health_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    feature text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    status text NOT NULL,
    fallback_active boolean DEFAULT false NOT NULL,
    fallback_mode text DEFAULT 'none'::text NOT NULL,
    latency_ms integer,
    http_status integer,
    error_code text,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT llm_model_health_status_fallback_mode_check CHECK ((fallback_mode = ANY (ARRAY['none'::text, 'groq'::text, 'gemini'::text, 'rule'::text]))),
    CONSTRAINT llm_model_health_status_provider_check CHECK ((provider = ANY (ARRAY['gemini'::text, 'groq'::text]))),
    CONSTRAINT llm_model_health_status_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'down'::text])))
);


--
-- Name: llm_usage_events; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.llm_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_instance_id uuid,
    feature text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    prompt_version text,
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    billable_cost numeric(12,6),
    usage_missing boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT llm_usage_events_completion_tokens_check CHECK (((completion_tokens IS NULL) OR (completion_tokens >= 0))),
    CONSTRAINT llm_usage_events_prompt_tokens_check CHECK (((prompt_tokens IS NULL) OR (prompt_tokens >= 0))),
    CONSTRAINT llm_usage_events_total_tokens_check CHECK (((total_tokens IS NULL) OR (total_tokens >= 0)))
);


--
-- Name: member_invitations; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.member_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    invited_email text NOT NULL,
    role_code text DEFAULT 'team_member'::text NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    created_by_membership_id uuid,
    accepted_by_user_id uuid,
    accepted_at timestamp with time zone,
    last_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT member_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])))
);


--
-- Name: objective_business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.objective_business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    objective_id uuid NOT NULL,
    business_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: objective_direction_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.objective_direction_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    objective_id uuid NOT NULL,
    strategic_direction_id uuid NOT NULL,
    contribution_level text DEFAULT 'medium'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT objective_direction_links_contribution_level_check CHECK ((contribution_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: objective_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.objective_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    objective_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: objective_operating_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.objective_operating_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    objective_id uuid NOT NULL,
    operating_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: objective_target_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.objective_target_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    objective_id uuid NOT NULL,
    annual_target_id uuid NOT NULL,
    contribution_level text DEFAULT 'medium'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT objective_target_links_contribution_level_check CHECK ((contribution_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: objectives; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.objectives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_id uuid,
    title text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    owner_membership_id uuid,
    progress_percent numeric(5,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    okr_cycle_id uuid,
    confidence_level smallint,
    cycle_instance_id uuid NOT NULL,
    time_horizon text,
    importance_score smallint DEFAULT 3 NOT NULL,
    ai_clarity_score smallint,
    ai_strategic_relevance_score smallint,
    ai_feasibility_score smallint,
    ai_fit_to_company_score smallint,
    ai_confidence_score smallint,
    ai_external_internal_classification text,
    ai_short_long_term_classification text,
    ai_exploit_explore_classification text,
    ai_issues_json jsonb DEFAULT '[]'::jsonb,
    ai_improvement_suggestion text,
    ai_summary text,
    ai_objective_score numeric(6,2),
    ai_evaluation_status text DEFAULT 'not_run'::text,
    ai_evaluated_at timestamp with time zone,
    ai_evaluation_version text,
    ai_manual_override boolean DEFAULT false NOT NULL,
    ai_manual_comment text,
    created_by_membership_id uuid,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    objective_health_override text,
    objective_health_override_by_membership_id uuid,
    objective_health_override_at timestamp with time zone,
    objective_review_comment text,
    strategy_carry_source_id uuid,
    strategy_carry_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT objectives_ai_clarity_score_check CHECK (((ai_clarity_score IS NULL) OR ((ai_clarity_score >= 1) AND (ai_clarity_score <= 5)))),
    CONSTRAINT objectives_ai_confidence_score_check CHECK (((ai_confidence_score IS NULL) OR ((ai_confidence_score >= 1) AND (ai_confidence_score <= 5)))),
    CONSTRAINT objectives_ai_evaluation_status_check CHECK ((ai_evaluation_status = ANY (ARRAY['not_run'::text, 'valid'::text, 'outdated'::text, 'failed'::text]))),
    CONSTRAINT objectives_ai_exploit_explore_classification_check CHECK (((ai_exploit_explore_classification IS NULL) OR (ai_exploit_explore_classification = ANY (ARRAY['exploit'::text, 'explore'::text, 'balanced'::text])))),
    CONSTRAINT objectives_ai_external_internal_classification_check CHECK (((ai_external_internal_classification IS NULL) OR (ai_external_internal_classification = ANY (ARRAY['internal'::text, 'external'::text, 'balanced'::text])))),
    CONSTRAINT objectives_ai_feasibility_score_check CHECK (((ai_feasibility_score IS NULL) OR ((ai_feasibility_score >= 1) AND (ai_feasibility_score <= 5)))),
    CONSTRAINT objectives_ai_fit_to_company_score_check CHECK (((ai_fit_to_company_score IS NULL) OR ((ai_fit_to_company_score >= 1) AND (ai_fit_to_company_score <= 5)))),
    CONSTRAINT objectives_ai_short_long_term_classification_check CHECK (((ai_short_long_term_classification IS NULL) OR (ai_short_long_term_classification = ANY (ARRAY['short'::text, 'mid'::text, 'long'::text])))),
    CONSTRAINT objectives_ai_strategic_relevance_score_check CHECK (((ai_strategic_relevance_score IS NULL) OR ((ai_strategic_relevance_score >= 1) AND (ai_strategic_relevance_score <= 5)))),
    CONSTRAINT objectives_confidence_level_check CHECK (((confidence_level >= 1) AND (confidence_level <= 10))),
    CONSTRAINT objectives_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT objectives_importance_score_check CHECK (((importance_score >= 1) AND (importance_score <= 5))),
    CONSTRAINT objectives_objective_health_override_check CHECK (((objective_health_override IS NULL) OR (objective_health_override = ANY (ARRAY['on_track'::text, 'at_risk'::text, 'off_track'::text])))),
    CONSTRAINT objectives_progress_percent_check CHECK (((progress_percent >= (0)::numeric) AND (progress_percent <= (100)::numeric))),
    CONSTRAINT objectives_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'at_risk'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: TABLE objectives; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON TABLE app.objectives IS 'Objectives row: strategic design and/or OKR-objectives (okr_cycle_id). Review progress lives on initiatives; OKR outcome metrics on key_results.';


--
-- Name: okr_cycles; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.okr_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    name text NOT NULL,
    code text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT okr_cycles_check CHECK ((start_date <= end_date)),
    CONSTRAINT okr_cycles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text, 'archived'::text])))
);


--
-- Name: okr_reviews; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.okr_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    okr_cycle_id uuid,
    review_type text DEFAULT 'quarterly_review'::text NOT NULL,
    summary text,
    successes text,
    problems text,
    lessons_learned text,
    next_actions text,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    review_mode text DEFAULT 'okr_execution'::text NOT NULL,
    procedure_status text DEFAULT 'not_started'::text NOT NULL,
    review_lead_time_days integer DEFAULT 90 NOT NULL,
    pre_read_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    stakeholder_feedback_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    decision_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    release_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    readiness_status text DEFAULT 'not_ready'::text NOT NULL,
    override_forced boolean DEFAULT false NOT NULL,
    override_reason text,
    override_forced_by uuid,
    override_forced_at timestamp with time zone,
    released_to_cycle_instance_id uuid,
    released_at timestamp with time zone,
    announcement_sent_at timestamp with time zone,
    announcement_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT okr_reviews_procedure_status_check CHECK ((procedure_status = ANY (ARRAY['not_started'::text, 'announcement_sent'::text, 'pre_read_open'::text, 'ready_for_review'::text, 'review_in_progress'::text, 'decision_captured'::text, 'released'::text, 'cancelled'::text]))),
    CONSTRAINT okr_reviews_readiness_status_check CHECK ((readiness_status = ANY (ARRAY['not_ready'::text, 'partially_ready'::text, 'ready'::text]))),
    CONSTRAINT okr_reviews_review_lead_time_days_check CHECK (((review_lead_time_days >= 1) AND (review_lead_time_days <= 730))),
    CONSTRAINT okr_reviews_review_mode_check CHECK ((review_mode = ANY (ARRAY['okr_execution'::text, 'strategy_review'::text]))),
    CONSTRAINT okr_reviews_review_type_check CHECK ((review_type = ANY (ARRAY['quarterly_review'::text, 'retrospective'::text, 'annual_review'::text])))
);


--
-- Name: okr_updates; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.okr_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    okr_cycle_id uuid,
    key_result_id uuid NOT NULL,
    progress_value numeric(18,4),
    confidence_level smallint,
    comment text,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT okr_updates_confidence_level_check CHECK (((confidence_level >= 1) AND (confidence_level <= 10)))
);


--
-- Name: operating_model_business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.operating_model_business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    operating_model_id uuid NOT NULL,
    business_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: operating_model_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.operating_model_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    operating_model_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: operating_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.operating_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active'::text NOT NULL,
    version_no integer DEFAULT 1 NOT NULL,
    processes jsonb DEFAULT '[]'::jsonb NOT NULL,
    organization_design jsonb DEFAULT '[]'::jsonb NOT NULL,
    capabilities jsonb DEFAULT '[]'::jsonb NOT NULL,
    technology jsonb DEFAULT '[]'::jsonb NOT NULL,
    data_assets jsonb DEFAULT '[]'::jsonb NOT NULL,
    governance jsonb DEFAULT '[]'::jsonb NOT NULL,
    locations jsonb DEFAULT '[]'::jsonb NOT NULL,
    partners jsonb DEFAULT '[]'::jsonb NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT operating_models_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text]))),
    CONSTRAINT operating_models_version_no_check CHECK ((version_no >= 1))
);


--
-- Name: organization_memberships; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.organization_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    hierarchy_level integer,
    title text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    responsible_id uuid,
    CONSTRAINT organization_memberships_hierarchy_level_check CHECK (((hierarchy_level >= 1) AND (hierarchy_level <= 3))),
    CONSTRAINT organization_memberships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'invited'::text, 'suspended'::text])))
);


--
-- Name: organization_unit; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.organization_unit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    organization_unit_type_id uuid NOT NULL,
    parent_id uuid,
    description text,
    status text DEFAULT 'active'::text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_unit_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: organization_unit_business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.organization_unit_business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    organization_unit_id uuid NOT NULL,
    business_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: organization_unit_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.organization_unit_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    organization_unit_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: organization_unit_type; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.organization_unit_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: planning_cycles; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.planning_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    rolling_window_months integer DEFAULT 18 NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT planning_cycles_check CHECK ((start_date <= end_date)),
    CONSTRAINT planning_cycles_rolling_window_months_check CHECK (((rolling_window_months >= 3) AND (rolling_window_months <= 60))),
    CONSTRAINT planning_cycles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: responsibility_assignments; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.responsibility_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    role_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT responsibility_assignments_object_type_check CHECK ((object_type = ANY (ARRAY['strategic_challenge'::text, 'strategic_direction'::text, 'annual_target'::text, 'initiative'::text, 'okr_cycle'::text, 'objective'::text, 'key_result'::text]))),
    CONSTRAINT responsibility_assignments_role_type_check CHECK ((role_type = ANY (ARRAY['owner'::text, 'contributor'::text, 'reviewer'::text, 'sponsor'::text])))
);


--
-- Name: responsible_assignments; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.responsible_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    responsible_id uuid NOT NULL,
    assignment_type text DEFAULT 'owner'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_unit_id uuid NOT NULL,
    assignment_role_de text,
    CONSTRAINT responsible_assignments_assignment_role_de_chk CHECK (((assignment_role_de IS NULL) OR (assignment_role_de = ANY (ARRAY['Hauptverantwortung'::text, 'Unterstuetzung'::text, 'Stakeholder'::text])))),
    CONSTRAINT responsible_assignments_assignment_type_check CHECK ((assignment_type = ANY (ARRAY['owner'::text, 'support'::text, 'stakeholder'::text])))
);


--
-- Name: responsible_hierarchy; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.responsible_hierarchy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    manager_responsible_id uuid NOT NULL,
    report_responsible_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT responsible_hierarchy_check CHECK ((manager_responsible_id <> report_responsible_id))
);


--
-- Name: responsibles; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.responsibles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    membership_id uuid,
    full_name text NOT NULL,
    email text,
    role_title text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_feedback; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.review_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_instance_id uuid NOT NULL,
    feedback_type text NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    comment text,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_feedback_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['continue'::text, 'adjust'::text, 'stop'::text, 'escalate'::text, 'revisit_direction'::text, 'revisit_objective'::text]))),
    CONSTRAINT review_feedback_object_type_check CHECK ((object_type = ANY (ARRAY['objective'::text, 'strategic_direction'::text, 'strategy_program'::text, 'initiative'::text, 'key_result'::text])))
);


--
-- Name: review_snapshots; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.review_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_instance_id uuid NOT NULL,
    snapshot_type text NOT NULL,
    snapshot_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_membership_id uuid,
    summary_json jsonb,
    comment text,
    CONSTRAINT review_snapshots_snapshot_type_check CHECK ((snapshot_type = ANY (ARRAY['periodic'::text, 'ad_hoc'::text, 'quarterly'::text])))
);


--
-- Name: strategic_challenge_business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_challenge_business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    strategic_challenge_id uuid NOT NULL,
    business_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: strategic_challenge_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_challenge_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    strategic_challenge_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: strategic_challenges; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    title text NOT NULL,
    priority smallint DEFAULT 3 NOT NULL,
    visibility text DEFAULT 'internal'::text NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_analysis_entry_id uuid,
    cycle_instance_id uuid NOT NULL,
    relevance_level smallint DEFAULT 3 NOT NULL,
    risk_level smallint DEFAULT 3 NOT NULL,
    description text,
    impact_score smallint DEFAULT 3 NOT NULL,
    urgency_score smallint DEFAULT 3 NOT NULL,
    scope_score smallint DEFAULT 3 NOT NULL,
    root_cause_score smallint DEFAULT 3 NOT NULL,
    challenge_score numeric(6,2) DEFAULT 3.00 NOT NULL,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    source_cluster_id uuid,
    strategy_carry_source_id uuid,
    strategy_carry_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT strategic_challenges_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT strategic_challenges_impact_score_check CHECK (((impact_score >= 1) AND (impact_score <= 5))),
    CONSTRAINT strategic_challenges_priority_check CHECK (((priority >= 1) AND (priority <= 5))),
    CONSTRAINT strategic_challenges_relevance_level_check CHECK (((relevance_level >= 1) AND (relevance_level <= 5))),
    CONSTRAINT strategic_challenges_risk_level_check CHECK (((risk_level >= 1) AND (risk_level <= 5))),
    CONSTRAINT strategic_challenges_root_cause_score_check CHECK (((root_cause_score >= 1) AND (root_cause_score <= 5))),
    CONSTRAINT strategic_challenges_scope_score_check CHECK (((scope_score >= 1) AND (scope_score <= 5))),
    CONSTRAINT strategic_challenges_urgency_score_check CHECK (((urgency_score >= 1) AND (urgency_score <= 5))),
    CONSTRAINT strategic_challenges_visibility_check CHECK ((visibility = ANY (ARRAY['internal'::text, 'private'::text, 'public'::text])))
);


--
-- Name: strategic_context_cache; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_context_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    context_json jsonb NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    provider text,
    model text,
    prompt_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: strategic_direction_business_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_direction_business_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    strategic_direction_id uuid NOT NULL,
    business_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: strategic_direction_cluster_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_direction_cluster_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    strategic_direction_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: strategic_direction_gap_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_direction_gap_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    strategic_direction_id uuid NOT NULL,
    cluster_objective_relation_id uuid NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: strategic_direction_industries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_direction_industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    strategic_direction_id uuid NOT NULL,
    industry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: strategic_direction_objective_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_direction_objective_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    strategic_direction_id uuid NOT NULL,
    objective_id uuid NOT NULL,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    contribution_level text DEFAULT 'medium'::text NOT NULL,
    CONSTRAINT strategic_direction_objective_links_contribution_level_check CHECK ((contribution_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: strategic_direction_operating_models; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_direction_operating_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    strategic_direction_id uuid NOT NULL,
    operating_model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL
);


--
-- Name: strategic_directions; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_directions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    title text NOT NULL,
    description text,
    owner_membership_id uuid,
    priority numeric(6,2) DEFAULT 3.00 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "grouping" text,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    relevance_level smallint DEFAULT 3 NOT NULL,
    risk_level smallint DEFAULT 3 NOT NULL,
    strategic_value_score smallint DEFAULT 3 NOT NULL,
    capability_fit_score smallint DEFAULT 3 NOT NULL,
    feasibility_score smallint DEFAULT 3 NOT NULL,
    created_by_source text DEFAULT 'user'::text NOT NULL,
    review_comment text,
    strategy_carry_source_id uuid,
    strategy_carry_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT strategic_directions_capability_fit_score_check CHECK (((capability_fit_score >= 1) AND (capability_fit_score <= 5))),
    CONSTRAINT strategic_directions_created_by_source_check CHECK ((created_by_source = ANY (ARRAY['user'::text, 'sentinel'::text]))),
    CONSTRAINT strategic_directions_feasibility_score_check CHECK (((feasibility_score >= 1) AND (feasibility_score <= 5))),
    CONSTRAINT strategic_directions_priority_check CHECK (((priority >= 1.00) AND (priority <= 5.00))),
    CONSTRAINT strategic_directions_relevance_level_check CHECK (((relevance_level >= 1) AND (relevance_level <= 5))),
    CONSTRAINT strategic_directions_risk_level_check CHECK (((risk_level >= 1) AND (risk_level <= 5))),
    CONSTRAINT strategic_directions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'active'::text, 'on_hold'::text, 'closed'::text]))),
    CONSTRAINT strategic_directions_strategic_value_score_check CHECK (((strategic_value_score >= 1) AND (strategic_value_score <= 5)))
);


--
-- Name: COLUMN strategic_directions.priority; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.strategic_directions.priority IS 'Gewichteter Score aus strategischem Wert, Passung, Machbarkeit und Risiko (1–5, zwei Nachkommastellen).';


--
-- Name: COLUMN strategic_directions.status; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.strategic_directions.status IS 'Lifecycle: draft, approved, active, on_hold, closed.';


--
-- Name: strategic_goals; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cycle_id uuid,
    title text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    priority smallint DEFAULT 3 NOT NULL,
    owner_membership_id uuid,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT strategic_goals_priority_check CHECK (((priority >= 1) AND (priority <= 5))),
    CONSTRAINT strategic_goals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'on_hold'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: strategic_metrics; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategic_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    current_state text,
    desired_state text,
    importance_level smallint DEFAULT 3 NOT NULL,
    owner_membership_id uuid,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT strategic_metrics_importance_level_check CHECK (((importance_level >= 1) AND (importance_level <= 5)))
);


--
-- Name: strategy_correlation_status_overrides; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategy_correlation_status_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    objective_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    strategic_direction_id uuid NOT NULL,
    status text DEFAULT 'unknown'::text NOT NULL,
    note text,
    updated_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT strategy_correlation_status_overrides_status_check CHECK ((status = ANY (ARRAY['green'::text, 'yellow'::text, 'red'::text, 'unknown'::text])))
);


--
-- Name: strategy_dimension_alignment; Type: VIEW; Schema: app; Owner: -
--

CREATE VIEW app.strategy_dimension_alignment AS
 SELECT 'strategic_direction'::text AS object_type,
    sdi.strategic_direction_id AS object_id,
    sdi.organization_id,
    sdi.planning_cycle_id,
    i.id AS industry_id,
    NULL::uuid AS business_model_id,
    NULL::uuid AS operating_model_id
   FROM (app.strategic_direction_industries sdi
     JOIN app.industries i ON ((i.id = sdi.industry_id)))
UNION ALL
 SELECT 'strategic_direction'::text AS object_type,
    sdbm.strategic_direction_id AS object_id,
    sdbm.organization_id,
    sdbm.planning_cycle_id,
    NULL::uuid AS industry_id,
    bm.id AS business_model_id,
    NULL::uuid AS operating_model_id
   FROM (app.strategic_direction_business_models sdbm
     JOIN app.business_models bm ON ((bm.id = sdbm.business_model_id)))
UNION ALL
 SELECT 'strategic_direction'::text AS object_type,
    sdom.strategic_direction_id AS object_id,
    sdom.organization_id,
    sdom.planning_cycle_id,
    NULL::uuid AS industry_id,
    NULL::uuid AS business_model_id,
    om.id AS operating_model_id
   FROM (app.strategic_direction_operating_models sdom
     JOIN app.operating_models om ON ((om.id = sdom.operating_model_id)));


--
-- Name: strategy_programs; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategy_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    cycle_instance_id uuid NOT NULL,
    strategic_direction_id uuid,
    title text NOT NULL,
    description text,
    owner_membership_id uuid,
    budget_total numeric(18,2),
    timeline text,
    created_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    review_comment text,
    strategic_challenge_id uuid,
    program_origin text DEFAULT 'manual'::text NOT NULL,
    matrix_cell_score numeric(10,2),
    supported_objective_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    start_date date,
    end_date date,
    CONSTRAINT strategy_programs_date_range_check CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (start_date <= end_date))),
    CONSTRAINT strategy_programs_program_origin_check CHECK ((program_origin = ANY (ARRAY['manual'::text, 'matrix'::text]))),
    CONSTRAINT strategy_programs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'on_hold'::text, 'closed'::text])))
);


--
-- Name: COLUMN strategy_programs.strategic_challenge_id; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.strategy_programs.strategic_challenge_id IS 'Optional: strategische Herausforderung (z. B. aus Mapping-Matrix).';


--
-- Name: COLUMN strategy_programs.program_origin; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.strategy_programs.program_origin IS 'manual | matrix';


--
-- Name: COLUMN strategy_programs.matrix_cell_score; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.strategy_programs.matrix_cell_score IS 'Snapshot des Matrix-Zellen-Scores bei Erzeugung aus der Matrix.';


--
-- Name: COLUMN strategy_programs.supported_objective_ids; Type: COMMENT; Schema: app; Owner: -
--

COMMENT ON COLUMN app.strategy_programs.supported_objective_ids IS 'Objectives, die das Programm laut Matrix-Kontext unterstuetzt.';


--
-- Name: strategy_review_feedback_entries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.strategy_review_feedback_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    cycle_instance_id uuid NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    rating text,
    comment text,
    is_required_role boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT strategy_review_feedback_entries_subject_type_check CHECK ((subject_type = ANY (ARRAY['challenge'::text, 'focus_area'::text, 'objective'::text]))),
    CONSTRAINT strategy_review_feedback_rating_challenge CHECK (((subject_type <> 'challenge'::text) OR (rating IS NULL) OR (rating = ANY (ARRAY['improved'::text, 'unchanged'::text, 'worsened'::text])))),
    CONSTRAINT strategy_review_feedback_rating_focus CHECK (((subject_type <> 'focus_area'::text) OR (rating IS NULL) OR (rating = ANY (ARRAY['high_impact'::text, 'medium_impact'::text, 'low_impact'::text, 'negative_impact'::text])))),
    CONSTRAINT strategy_review_feedback_rating_objective CHECK (((subject_type <> 'objective'::text) OR (rating IS NULL) OR (rating = ANY (ARRAY['keep'::text, 'sharpen'::text, 'questionable'::text]))))
);


--
-- Name: target_metric_links; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.target_metric_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    planning_cycle_id uuid,
    annual_target_id uuid NOT NULL,
    strategic_metric_id uuid NOT NULL,
    contribution_level text DEFAULT 'medium'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cycle_instance_id uuid NOT NULL,
    CONSTRAINT target_metric_links_contribution_level_check CHECK ((contribution_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: tenant_branding; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.tenant_branding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    primary_color text DEFAULT '#1D4ED8'::text NOT NULL,
    secondary_color text DEFAULT '#0F172A'::text NOT NULL,
    accent_color text DEFAULT '#14B8A6'::text NOT NULL,
    logo_url text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by_membership_id uuid,
    updated_by_membership_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    branding_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT tenant_branding_accent_color_check CHECK ((accent_color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT tenant_branding_primary_color_check CHECK ((primary_color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT tenant_branding_secondary_color_check CHECK ((secondary_color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT tenant_branding_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: v_program_overview; Type: VIEW; Schema: app; Owner: -
--

CREATE VIEW app.v_program_overview AS
SELECT
    NULL::uuid AS id,
    NULL::text AS title,
    NULL::text AS status,
    NULL::uuid AS owner_membership_id,
    NULL::date AS start_date,
    NULL::date AS end_date,
    NULL::numeric(18,2) AS budget_total,
    NULL::bigint AS initiative_count,
    NULL::bigint AS initiative_active_count,
    NULL::bigint AS initiative_done_count,
    NULL::numeric AS progress_percent;


--
-- Name: revision_events; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE audit.revision_events (
    id bigint NOT NULL,
    revision_id bigint NOT NULL,
    organization_id uuid,
    table_schema text NOT NULL,
    table_name text NOT NULL,
    row_pk uuid,
    action text NOT NULL,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT revision_events_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: revision_events_id_seq; Type: SEQUENCE; Schema: audit; Owner: -
--

ALTER TABLE audit.revision_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME audit.revision_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: revisions; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE audit.revisions (
    id bigint NOT NULL,
    organization_id uuid,
    actor_user_id uuid,
    actor_membership_id uuid,
    source text DEFAULT 'api'::text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: revisions_id_seq; Type: SEQUENCE; Schema: audit; Owner: -
--

ALTER TABLE audit.revisions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME audit.revisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: member_roles; Type: TABLE; Schema: rbac; Owner: -
--

CREATE TABLE rbac.member_roles (
    membership_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: rbac; Owner: -
--

CREATE TABLE rbac.permissions (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: rbac; Owner: -
--

ALTER TABLE rbac.permissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rbac.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: role_permissions; Type: TABLE; Schema: rbac; Owner: -
--

CREATE TABLE rbac.role_permissions (
    role_id uuid NOT NULL,
    permission_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: rbac; Owner: -
--

CREATE TABLE rbac.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: analysis_background_jobs analysis_background_jobs_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_background_jobs
    ADD CONSTRAINT analysis_background_jobs_pkey PRIMARY KEY (id);


--
-- Name: analysis_challenge_candidates analysis_challenge_candidates_cycle_instance_id_source_type_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_challenge_candidates
    ADD CONSTRAINT analysis_challenge_candidates_cycle_instance_id_source_type_key UNIQUE (cycle_instance_id, source_type, source_ref, title);


--
-- Name: analysis_challenge_candidates analysis_challenge_candidates_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_challenge_candidates
    ADD CONSTRAINT analysis_challenge_candidates_pkey PRIMARY KEY (id);


--
-- Name: analysis_cluster_members analysis_cluster_members_cluster_id_entry_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_cluster_members
    ADD CONSTRAINT analysis_cluster_members_cluster_id_entry_id_key UNIQUE (cluster_id, entry_id);


--
-- Name: analysis_cluster_members analysis_cluster_members_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_cluster_members
    ADD CONSTRAINT analysis_cluster_members_pkey PRIMARY KEY (id);


--
-- Name: analysis_clusters analysis_clusters_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_clusters
    ADD CONSTRAINT analysis_clusters_pkey PRIMARY KEY (id);


--
-- Name: analysis_entries analysis_entries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_entries
    ADD CONSTRAINT analysis_entries_pkey PRIMARY KEY (id);


--
-- Name: analysis_gap_findings analysis_gap_findings_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_gap_findings
    ADD CONSTRAINT analysis_gap_findings_pkey PRIMARY KEY (id);


--
-- Name: analysis_item_link_draft analysis_item_link_draft_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link_draft
    ADD CONSTRAINT analysis_item_link_draft_pkey PRIMARY KEY (id);


--
-- Name: analysis_item_link_draft analysis_item_link_draft_planning_cycle_id_source_analysis__key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link_draft
    ADD CONSTRAINT analysis_item_link_draft_planning_cycle_id_source_analysis__key UNIQUE (planning_cycle_id, source_analysis_item_id, target_analysis_item_id, link_type);


--
-- Name: analysis_item_link analysis_item_link_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_pkey PRIMARY KEY (id);


--
-- Name: analysis_item_link analysis_item_link_planning_cycle_id_source_analysis_item_i_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_planning_cycle_id_source_analysis_item_i_key UNIQUE (planning_cycle_id, source_analysis_item_id, target_analysis_item_id, link_type);


--
-- Name: annual_target_business_models annual_target_business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_business_models
    ADD CONSTRAINT annual_target_business_models_pkey PRIMARY KEY (id);


--
-- Name: annual_target_business_models annual_target_business_models_planning_cycle_id_annual_targ_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_business_models
    ADD CONSTRAINT annual_target_business_models_planning_cycle_id_annual_targ_key UNIQUE (planning_cycle_id, annual_target_id, business_model_id);


--
-- Name: annual_target_industries annual_target_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_industries
    ADD CONSTRAINT annual_target_industries_pkey PRIMARY KEY (id);


--
-- Name: annual_target_industries annual_target_industries_planning_cycle_id_annual_target_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_industries
    ADD CONSTRAINT annual_target_industries_planning_cycle_id_annual_target_id_key UNIQUE (planning_cycle_id, annual_target_id, industry_id);


--
-- Name: annual_target_operating_models annual_target_operating_model_planning_cycle_id_annual_targ_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_operating_models
    ADD CONSTRAINT annual_target_operating_model_planning_cycle_id_annual_targ_key UNIQUE (planning_cycle_id, annual_target_id, operating_model_id);


--
-- Name: annual_target_operating_models annual_target_operating_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_operating_models
    ADD CONSTRAINT annual_target_operating_models_pkey PRIMARY KEY (id);


--
-- Name: annual_targets annual_targets_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_targets
    ADD CONSTRAINT annual_targets_pkey PRIMARY KEY (id);


--
-- Name: business_model_industries business_model_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_model_industries
    ADD CONSTRAINT business_model_industries_pkey PRIMARY KEY (id);


--
-- Name: business_model_industries business_model_industries_planning_cycle_id_business_model__key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_model_industries
    ADD CONSTRAINT business_model_industries_planning_cycle_id_business_model__key UNIQUE (planning_cycle_id, business_model_id, industry_id);


--
-- Name: business_models business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_models
    ADD CONSTRAINT business_models_pkey PRIMARY KEY (id);


--
-- Name: business_models business_models_planning_cycle_id_name_version_no_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_models
    ADD CONSTRAINT business_models_planning_cycle_id_name_version_no_key UNIQUE (planning_cycle_id, name, version_no);


--
-- Name: challenge_direction_links challenge_direction_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.challenge_direction_links
    ADD CONSTRAINT challenge_direction_links_pkey PRIMARY KEY (id);


--
-- Name: challenge_direction_links challenge_direction_links_planning_cycle_id_strategic_direc_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.challenge_direction_links
    ADD CONSTRAINT challenge_direction_links_planning_cycle_id_strategic_direc_key UNIQUE (planning_cycle_id, strategic_direction_id, strategic_challenge_id);


--
-- Name: cluster_objective_relations cluster_objective_relations_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cluster_objective_relations
    ADD CONSTRAINT cluster_objective_relations_pkey PRIMARY KEY (id);


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_cutover_id_from_cycle_instance_id_t_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutover_snapshots
    ADD CONSTRAINT cycle_cutover_snapshots_cutover_id_from_cycle_instance_id_t_key UNIQUE (cutover_id, from_cycle_instance_id, to_cycle_instance_id, snapshot_type);


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutover_snapshots
    ADD CONSTRAINT cycle_cutover_snapshots_pkey PRIMARY KEY (id);


--
-- Name: cycle_cutovers cycle_cutovers_organization_id_to_cycle_scheme_id_cutover_a_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutovers
    ADD CONSTRAINT cycle_cutovers_organization_id_to_cycle_scheme_id_cutover_a_key UNIQUE (organization_id, to_cycle_scheme_id, cutover_at);


--
-- Name: cycle_cutovers cycle_cutovers_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutovers
    ADD CONSTRAINT cycle_cutovers_pkey PRIMARY KEY (id);


--
-- Name: cycle_instance_lock cycle_instance_lock_cycle_instance_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instance_lock
    ADD CONSTRAINT cycle_instance_lock_cycle_instance_id_key UNIQUE (cycle_instance_id);


--
-- Name: cycle_instance_lock cycle_instance_lock_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instance_lock
    ADD CONSTRAINT cycle_instance_lock_pkey PRIMARY KEY (id);


--
-- Name: cycle_instance_portfolio_evaluation cycle_instance_portfolio_evaluation_cycle_instance_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instance_portfolio_evaluation
    ADD CONSTRAINT cycle_instance_portfolio_evaluation_cycle_instance_id_key UNIQUE (cycle_instance_id);


--
-- Name: cycle_instance_portfolio_evaluation cycle_instance_portfolio_evaluation_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instance_portfolio_evaluation
    ADD CONSTRAINT cycle_instance_portfolio_evaluation_pkey PRIMARY KEY (id);


--
-- Name: cycle_instances cycle_instances_cycle_scheme_id_level_no_sequence_no_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instances
    ADD CONSTRAINT cycle_instances_cycle_scheme_id_level_no_sequence_no_key UNIQUE (cycle_scheme_id, level_no, sequence_no);


--
-- Name: cycle_instances cycle_instances_legacy_planning_cycle_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instances
    ADD CONSTRAINT cycle_instances_legacy_planning_cycle_id_key UNIQUE (legacy_planning_cycle_id);


--
-- Name: cycle_instances cycle_instances_organization_id_level_no_starts_on_ends_on_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instances
    ADD CONSTRAINT cycle_instances_organization_id_level_no_starts_on_ends_on_key UNIQUE (organization_id, level_no, starts_on, ends_on);


--
-- Name: cycle_instances cycle_instances_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instances
    ADD CONSTRAINT cycle_instances_pkey PRIMARY KEY (id);


--
-- Name: cycle_scheme_levels cycle_scheme_levels_cycle_scheme_id_level_no_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_scheme_levels
    ADD CONSTRAINT cycle_scheme_levels_cycle_scheme_id_level_no_key UNIQUE (cycle_scheme_id, level_no);


--
-- Name: cycle_scheme_levels cycle_scheme_levels_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_scheme_levels
    ADD CONSTRAINT cycle_scheme_levels_pkey PRIMARY KEY (id);


--
-- Name: cycle_schemes cycle_schemes_organization_id_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_schemes
    ADD CONSTRAINT cycle_schemes_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: cycle_schemes cycle_schemes_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_schemes
    ADD CONSTRAINT cycle_schemes_pkey PRIMARY KEY (id);


--
-- Name: dashboard_column_config dashboard_column_config_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_column_config
    ADD CONSTRAINT dashboard_column_config_pkey PRIMARY KEY (id);


--
-- Name: dashboard_column_config dashboard_column_config_planning_cycle_id_challenge_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_column_config
    ADD CONSTRAINT dashboard_column_config_planning_cycle_id_challenge_id_key UNIQUE (planning_cycle_id, challenge_id);


--
-- Name: dashboard_comments dashboard_comments_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_comments
    ADD CONSTRAINT dashboard_comments_pkey PRIMARY KEY (id);


--
-- Name: dashboard_row_config dashboard_row_config_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_row_config
    ADD CONSTRAINT dashboard_row_config_pkey PRIMARY KEY (id);


--
-- Name: dashboard_row_config dashboard_row_config_planning_cycle_id_direction_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_row_config
    ADD CONSTRAINT dashboard_row_config_planning_cycle_id_direction_id_key UNIQUE (planning_cycle_id, direction_id);


--
-- Name: direction_metric_links direction_metric_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.direction_metric_links
    ADD CONSTRAINT direction_metric_links_pkey PRIMARY KEY (id);


--
-- Name: direction_metric_links direction_metric_links_planning_cycle_id_strategic_directio_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.direction_metric_links
    ADD CONSTRAINT direction_metric_links_planning_cycle_id_strategic_directio_key UNIQUE (planning_cycle_id, strategic_direction_id, strategic_metric_id);


--
-- Name: entity_links entity_links_organization_id_from_type_from_id_to_type_to_i_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.entity_links
    ADD CONSTRAINT entity_links_organization_id_from_type_from_id_to_type_to_i_key UNIQUE (organization_id, from_type, from_id, to_type, to_id, relation_type);


--
-- Name: entity_links entity_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.entity_links
    ADD CONSTRAINT entity_links_pkey PRIMARY KEY (id);


--
-- Name: functional_strategies functional_strategies_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.functional_strategies
    ADD CONSTRAINT functional_strategies_pkey PRIMARY KEY (id);


--
-- Name: industries industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.industries
    ADD CONSTRAINT industries_pkey PRIMARY KEY (id);


--
-- Name: industries industries_planning_cycle_id_name_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.industries
    ADD CONSTRAINT industries_planning_cycle_id_name_key UNIQUE (planning_cycle_id, name);


--
-- Name: initiative_business_models initiative_business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_business_models
    ADD CONSTRAINT initiative_business_models_pkey PRIMARY KEY (id);


--
-- Name: initiative_business_models initiative_business_models_planning_cycle_id_initiative_id__key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_business_models
    ADD CONSTRAINT initiative_business_models_planning_cycle_id_initiative_id__key UNIQUE (planning_cycle_id, initiative_id, business_model_id);


--
-- Name: initiative_industries initiative_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_industries
    ADD CONSTRAINT initiative_industries_pkey PRIMARY KEY (id);


--
-- Name: initiative_industries initiative_industries_planning_cycle_id_initiative_id_indus_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_industries
    ADD CONSTRAINT initiative_industries_planning_cycle_id_initiative_id_indus_key UNIQUE (planning_cycle_id, initiative_id, industry_id);


--
-- Name: initiative_key_result_links initiative_key_result_links_cycle_instance_id_initiative_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_key_result_links
    ADD CONSTRAINT initiative_key_result_links_cycle_instance_id_initiative_id_key UNIQUE (cycle_instance_id, initiative_id, key_result_id);


--
-- Name: initiative_key_result_links initiative_key_result_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_key_result_links
    ADD CONSTRAINT initiative_key_result_links_pkey PRIMARY KEY (id);


--
-- Name: initiative_operating_models initiative_operating_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_operating_models
    ADD CONSTRAINT initiative_operating_models_pkey PRIMARY KEY (id);


--
-- Name: initiative_operating_models initiative_operating_models_planning_cycle_id_initiative_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_operating_models
    ADD CONSTRAINT initiative_operating_models_planning_cycle_id_initiative_id_key UNIQUE (planning_cycle_id, initiative_id, operating_model_id);


--
-- Name: initiative_target_links initiative_target_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_target_links
    ADD CONSTRAINT initiative_target_links_pkey PRIMARY KEY (id);


--
-- Name: initiative_target_links initiative_target_links_planning_cycle_id_initiative_id_ann_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_target_links
    ADD CONSTRAINT initiative_target_links_planning_cycle_id_initiative_id_ann_key UNIQUE (planning_cycle_id, initiative_id, annual_target_id);


--
-- Name: initiatives initiatives_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiatives
    ADD CONSTRAINT initiatives_pkey PRIMARY KEY (id);


--
-- Name: key_result_business_models key_result_business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_business_models
    ADD CONSTRAINT key_result_business_models_pkey PRIMARY KEY (id);


--
-- Name: key_result_business_models key_result_business_models_planning_cycle_id_key_result_id__key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_business_models
    ADD CONSTRAINT key_result_business_models_planning_cycle_id_key_result_id__key UNIQUE (planning_cycle_id, key_result_id, business_model_id);


--
-- Name: key_result_industries key_result_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_industries
    ADD CONSTRAINT key_result_industries_pkey PRIMARY KEY (id);


--
-- Name: key_result_industries key_result_industries_planning_cycle_id_key_result_id_indus_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_industries
    ADD CONSTRAINT key_result_industries_planning_cycle_id_key_result_id_indus_key UNIQUE (planning_cycle_id, key_result_id, industry_id);


--
-- Name: key_result_operating_models key_result_operating_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_operating_models
    ADD CONSTRAINT key_result_operating_models_pkey PRIMARY KEY (id);


--
-- Name: key_result_operating_models key_result_operating_models_planning_cycle_id_key_result_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_operating_models
    ADD CONSTRAINT key_result_operating_models_planning_cycle_id_key_result_id_key UNIQUE (planning_cycle_id, key_result_id, operating_model_id);


--
-- Name: key_result_target_links key_result_target_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_target_links
    ADD CONSTRAINT key_result_target_links_pkey PRIMARY KEY (id);


--
-- Name: key_result_target_links key_result_target_links_planning_cycle_id_key_result_id_ann_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_target_links
    ADD CONSTRAINT key_result_target_links_planning_cycle_id_key_result_id_ann_key UNIQUE (planning_cycle_id, key_result_id, annual_target_id);


--
-- Name: key_results key_results_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_results
    ADD CONSTRAINT key_results_pkey PRIMARY KEY (id);


--
-- Name: llm_model_health_status llm_model_health_status_organization_id_feature_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.llm_model_health_status
    ADD CONSTRAINT llm_model_health_status_organization_id_feature_key UNIQUE (organization_id, feature);


--
-- Name: llm_model_health_status llm_model_health_status_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.llm_model_health_status
    ADD CONSTRAINT llm_model_health_status_pkey PRIMARY KEY (id);


--
-- Name: llm_usage_events llm_usage_events_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.llm_usage_events
    ADD CONSTRAINT llm_usage_events_pkey PRIMARY KEY (id);


--
-- Name: member_invitations member_invitations_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.member_invitations
    ADD CONSTRAINT member_invitations_pkey PRIMARY KEY (id);


--
-- Name: member_invitations member_invitations_token_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.member_invitations
    ADD CONSTRAINT member_invitations_token_key UNIQUE (token);


--
-- Name: objective_business_models objective_business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_business_models
    ADD CONSTRAINT objective_business_models_pkey PRIMARY KEY (id);


--
-- Name: objective_business_models objective_business_models_planning_cycle_id_objective_id_bu_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_business_models
    ADD CONSTRAINT objective_business_models_planning_cycle_id_objective_id_bu_key UNIQUE (planning_cycle_id, objective_id, business_model_id);


--
-- Name: objective_direction_links objective_direction_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_direction_links
    ADD CONSTRAINT objective_direction_links_pkey PRIMARY KEY (id);


--
-- Name: objective_direction_links objective_direction_links_planning_cycle_id_objective_id_st_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_direction_links
    ADD CONSTRAINT objective_direction_links_planning_cycle_id_objective_id_st_key UNIQUE (planning_cycle_id, objective_id, strategic_direction_id);


--
-- Name: objective_industries objective_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_industries
    ADD CONSTRAINT objective_industries_pkey PRIMARY KEY (id);


--
-- Name: objective_industries objective_industries_planning_cycle_id_objective_id_industr_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_industries
    ADD CONSTRAINT objective_industries_planning_cycle_id_objective_id_industr_key UNIQUE (planning_cycle_id, objective_id, industry_id);


--
-- Name: objective_operating_models objective_operating_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_operating_models
    ADD CONSTRAINT objective_operating_models_pkey PRIMARY KEY (id);


--
-- Name: objective_operating_models objective_operating_models_planning_cycle_id_objective_id_o_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_operating_models
    ADD CONSTRAINT objective_operating_models_planning_cycle_id_objective_id_o_key UNIQUE (planning_cycle_id, objective_id, operating_model_id);


--
-- Name: objective_target_links objective_target_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_target_links
    ADD CONSTRAINT objective_target_links_pkey PRIMARY KEY (id);


--
-- Name: objective_target_links objective_target_links_planning_cycle_id_objective_id_annua_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_target_links
    ADD CONSTRAINT objective_target_links_planning_cycle_id_objective_id_annua_key UNIQUE (planning_cycle_id, objective_id, annual_target_id);


--
-- Name: objectives objectives_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objectives
    ADD CONSTRAINT objectives_pkey PRIMARY KEY (id);


--
-- Name: okr_cycles okr_cycles_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_cycles
    ADD CONSTRAINT okr_cycles_pkey PRIMARY KEY (id);


--
-- Name: okr_cycles okr_cycles_planning_cycle_id_name_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_cycles
    ADD CONSTRAINT okr_cycles_planning_cycle_id_name_key UNIQUE (planning_cycle_id, name);


--
-- Name: okr_reviews okr_reviews_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_reviews
    ADD CONSTRAINT okr_reviews_pkey PRIMARY KEY (id);


--
-- Name: okr_updates okr_updates_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_updates
    ADD CONSTRAINT okr_updates_pkey PRIMARY KEY (id);


--
-- Name: operating_model_business_models operating_model_business_mode_planning_cycle_id_operating_m_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_business_models
    ADD CONSTRAINT operating_model_business_mode_planning_cycle_id_operating_m_key UNIQUE (planning_cycle_id, operating_model_id, business_model_id);


--
-- Name: operating_model_business_models operating_model_business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_business_models
    ADD CONSTRAINT operating_model_business_models_pkey PRIMARY KEY (id);


--
-- Name: operating_model_industries operating_model_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_industries
    ADD CONSTRAINT operating_model_industries_pkey PRIMARY KEY (id);


--
-- Name: operating_model_industries operating_model_industries_planning_cycle_id_operating_mode_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_industries
    ADD CONSTRAINT operating_model_industries_planning_cycle_id_operating_mode_key UNIQUE (planning_cycle_id, operating_model_id, industry_id);


--
-- Name: operating_models operating_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_models
    ADD CONSTRAINT operating_models_pkey PRIMARY KEY (id);


--
-- Name: operating_models operating_models_planning_cycle_id_name_version_no_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_models
    ADD CONSTRAINT operating_models_planning_cycle_id_name_version_no_key UNIQUE (planning_cycle_id, name, version_no);


--
-- Name: organization_memberships organization_memberships_organization_id_user_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_memberships
    ADD CONSTRAINT organization_memberships_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (id);


--
-- Name: organization_unit_business_models organization_unit_business_mo_planning_cycle_id_organizatio_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_business_models
    ADD CONSTRAINT organization_unit_business_mo_planning_cycle_id_organizatio_key UNIQUE (planning_cycle_id, organization_unit_id, business_model_id);


--
-- Name: organization_unit_business_models organization_unit_business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_business_models
    ADD CONSTRAINT organization_unit_business_models_pkey PRIMARY KEY (id);


--
-- Name: organization_unit_industries organization_unit_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_industries
    ADD CONSTRAINT organization_unit_industries_pkey PRIMARY KEY (id);


--
-- Name: organization_unit_industries organization_unit_industries_planning_cycle_id_organization_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_industries
    ADD CONSTRAINT organization_unit_industries_planning_cycle_id_organization_key UNIQUE (planning_cycle_id, organization_unit_id, industry_id);


--
-- Name: organization_unit organization_unit_organization_id_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit
    ADD CONSTRAINT organization_unit_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: organization_unit organization_unit_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit
    ADD CONSTRAINT organization_unit_pkey PRIMARY KEY (id);


--
-- Name: organization_unit_type organization_unit_type_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_type
    ADD CONSTRAINT organization_unit_type_code_key UNIQUE (code);


--
-- Name: organization_unit_type organization_unit_type_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_type
    ADD CONSTRAINT organization_unit_type_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: planning_cycles planning_cycles_organization_id_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.planning_cycles
    ADD CONSTRAINT planning_cycles_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: planning_cycles planning_cycles_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.planning_cycles
    ADD CONSTRAINT planning_cycles_pkey PRIMARY KEY (id);


--
-- Name: responsibility_assignments responsibility_assignments_organization_id_object_type_obje_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibility_assignments
    ADD CONSTRAINT responsibility_assignments_organization_id_object_type_obje_key UNIQUE (organization_id, object_type, object_id, membership_id, role_type);


--
-- Name: responsibility_assignments responsibility_assignments_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibility_assignments
    ADD CONSTRAINT responsibility_assignments_pkey PRIMARY KEY (id);


--
-- Name: responsible_assignments responsible_assignments_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_assignments
    ADD CONSTRAINT responsible_assignments_pkey PRIMARY KEY (id);


--
-- Name: responsible_assignments responsible_assignments_responsible_id_organization_unit_id_ass; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_assignments
    ADD CONSTRAINT responsible_assignments_responsible_id_organization_unit_id_ass UNIQUE (responsible_id, organization_unit_id, assignment_type);


--
-- Name: responsible_hierarchy responsible_hierarchy_manager_responsible_id_report_respons_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_hierarchy
    ADD CONSTRAINT responsible_hierarchy_manager_responsible_id_report_respons_key UNIQUE (manager_responsible_id, report_responsible_id);


--
-- Name: responsible_hierarchy responsible_hierarchy_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_hierarchy
    ADD CONSTRAINT responsible_hierarchy_pkey PRIMARY KEY (id);


--
-- Name: responsibles responsibles_organization_id_email_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibles
    ADD CONSTRAINT responsibles_organization_id_email_key UNIQUE (organization_id, email);


--
-- Name: responsibles responsibles_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibles
    ADD CONSTRAINT responsibles_pkey PRIMARY KEY (id);


--
-- Name: review_feedback review_feedback_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.review_feedback
    ADD CONSTRAINT review_feedback_pkey PRIMARY KEY (id);


--
-- Name: review_snapshots review_snapshots_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.review_snapshots
    ADD CONSTRAINT review_snapshots_pkey PRIMARY KEY (id);


--
-- Name: strategic_challenge_business_models strategic_challenge_business__planning_cycle_id_strategic_c_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_business_models
    ADD CONSTRAINT strategic_challenge_business__planning_cycle_id_strategic_c_key UNIQUE (planning_cycle_id, strategic_challenge_id, business_model_id);


--
-- Name: strategic_challenge_business_models strategic_challenge_business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_business_models
    ADD CONSTRAINT strategic_challenge_business_models_pkey PRIMARY KEY (id);


--
-- Name: strategic_challenge_industries strategic_challenge_industrie_planning_cycle_id_strategic_c_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_industries
    ADD CONSTRAINT strategic_challenge_industrie_planning_cycle_id_strategic_c_key UNIQUE (planning_cycle_id, strategic_challenge_id, industry_id);


--
-- Name: strategic_challenge_industries strategic_challenge_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_industries
    ADD CONSTRAINT strategic_challenge_industries_pkey PRIMARY KEY (id);


--
-- Name: strategic_challenges strategic_challenges_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenges
    ADD CONSTRAINT strategic_challenges_pkey PRIMARY KEY (id);


--
-- Name: strategic_context_cache strategic_context_cache_organization_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_context_cache
    ADD CONSTRAINT strategic_context_cache_organization_id_key UNIQUE (organization_id);


--
-- Name: strategic_context_cache strategic_context_cache_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_context_cache
    ADD CONSTRAINT strategic_context_cache_pkey PRIMARY KEY (id);


--
-- Name: strategic_direction_business_models strategic_direction_business__planning_cycle_id_strategic_d_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_business_models
    ADD CONSTRAINT strategic_direction_business__planning_cycle_id_strategic_d_key UNIQUE (planning_cycle_id, strategic_direction_id, business_model_id);


--
-- Name: strategic_direction_business_models strategic_direction_business_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_business_models
    ADD CONSTRAINT strategic_direction_business_models_pkey PRIMARY KEY (id);


--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_cluster_links
    ADD CONSTRAINT strategic_direction_cluster_links_pkey PRIMARY KEY (id);


--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_gap_links
    ADD CONSTRAINT strategic_direction_gap_links_pkey PRIMARY KEY (id);


--
-- Name: strategic_direction_industries strategic_direction_industrie_planning_cycle_id_strategic_d_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_industries
    ADD CONSTRAINT strategic_direction_industrie_planning_cycle_id_strategic_d_key UNIQUE (planning_cycle_id, strategic_direction_id, industry_id);


--
-- Name: strategic_direction_industries strategic_direction_industries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_industries
    ADD CONSTRAINT strategic_direction_industries_pkey PRIMARY KEY (id);


--
-- Name: strategic_direction_objective_links strategic_direction_objective_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_objective_links
    ADD CONSTRAINT strategic_direction_objective_links_pkey PRIMARY KEY (id);


--
-- Name: strategic_direction_operating_models strategic_direction_operating_models_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_operating_models
    ADD CONSTRAINT strategic_direction_operating_models_pkey PRIMARY KEY (id);


--
-- Name: strategic_direction_operating_models strategic_direction_operating_planning_cycle_id_strategic_d_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_operating_models
    ADD CONSTRAINT strategic_direction_operating_planning_cycle_id_strategic_d_key UNIQUE (planning_cycle_id, strategic_direction_id, operating_model_id);


--
-- Name: strategic_directions strategic_directions_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_directions
    ADD CONSTRAINT strategic_directions_pkey PRIMARY KEY (id);


--
-- Name: strategic_goals strategic_goals_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_goals
    ADD CONSTRAINT strategic_goals_pkey PRIMARY KEY (id);


--
-- Name: strategic_metrics strategic_metrics_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_metrics
    ADD CONSTRAINT strategic_metrics_pkey PRIMARY KEY (id);


--
-- Name: strategic_metrics strategic_metrics_planning_cycle_id_name_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_metrics
    ADD CONSTRAINT strategic_metrics_planning_cycle_id_name_key UNIQUE (planning_cycle_id, name);


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrides_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_correlation_status_overrides
    ADD CONSTRAINT strategy_correlation_status_overrides_pkey PRIMARY KEY (id);


--
-- Name: strategy_programs strategy_programs_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_programs
    ADD CONSTRAINT strategy_programs_pkey PRIMARY KEY (id);


--
-- Name: strategy_review_feedback_entries strategy_review_feedback_entries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_review_feedback_entries
    ADD CONSTRAINT strategy_review_feedback_entries_pkey PRIMARY KEY (id);


--
-- Name: target_metric_links target_metric_links_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.target_metric_links
    ADD CONSTRAINT target_metric_links_pkey PRIMARY KEY (id);


--
-- Name: target_metric_links target_metric_links_planning_cycle_id_annual_target_id_stra_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.target_metric_links
    ADD CONSTRAINT target_metric_links_planning_cycle_id_annual_target_id_stra_key UNIQUE (planning_cycle_id, annual_target_id, strategic_metric_id);


--
-- Name: tenant_branding tenant_branding_organization_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_branding
    ADD CONSTRAINT tenant_branding_organization_id_key UNIQUE (organization_id);


--
-- Name: tenant_branding tenant_branding_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_branding
    ADD CONSTRAINT tenant_branding_pkey PRIMARY KEY (id);


--
-- Name: revision_events revision_events_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.revision_events
    ADD CONSTRAINT revision_events_pkey PRIMARY KEY (id);


--
-- Name: revisions revisions_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.revisions
    ADD CONSTRAINT revisions_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: member_roles member_roles_pkey; Type: CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.member_roles
    ADD CONSTRAINT member_roles_pkey PRIMARY KEY (membership_id, role_id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_organization_id_code_key; Type: CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.roles
    ADD CONSTRAINT roles_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: idx_analysis_background_jobs_lookup; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_background_jobs_lookup ON app.analysis_background_jobs USING btree (organization_id, cycle_instance_id, job_type, status, created_at DESC);


--
-- Name: idx_analysis_background_jobs_pending; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_background_jobs_pending ON app.analysis_background_jobs USING btree (status, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'running'::text]));


--
-- Name: idx_analysis_challenge_candidates_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_challenge_candidates_org_cycle ON app.analysis_challenge_candidates USING btree (organization_id, cycle_instance_id, status, priority DESC);


--
-- Name: idx_analysis_cluster_members_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_cluster_members_org_cycle ON app.analysis_cluster_members USING btree (organization_id, planning_cycle_id, cluster_id);


--
-- Name: idx_analysis_cluster_members_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_cluster_members_org_cycle_instance ON app.analysis_cluster_members USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_analysis_clusters_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_clusters_org_cycle ON app.analysis_clusters USING btree (organization_id, planning_cycle_id, cluster_score DESC);


--
-- Name: idx_analysis_clusters_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_clusters_org_cycle_instance ON app.analysis_clusters USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_analysis_entries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_entries_org_cycle ON app.analysis_entries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_analysis_entries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_entries_org_cycle_instance ON app.analysis_entries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_analysis_entries_semantic_embedding_status; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_entries_semantic_embedding_status ON app.analysis_entries USING btree (organization_id, cycle_instance_id, semantic_embedding_status);


--
-- Name: idx_analysis_gap_findings_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_gap_findings_org_cycle ON app.analysis_gap_findings USING btree (organization_id, planning_cycle_id, severity DESC, status);


--
-- Name: idx_analysis_gap_findings_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_gap_findings_org_cycle_instance ON app.analysis_gap_findings USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_analysis_item_link_draft_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_item_link_draft_org_cycle ON app.analysis_item_link_draft USING btree (organization_id, planning_cycle_id, status);


--
-- Name: idx_analysis_item_link_draft_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_item_link_draft_org_cycle_instance ON app.analysis_item_link_draft USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_analysis_item_link_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_item_link_org_cycle ON app.analysis_item_link USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_analysis_item_link_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_analysis_item_link_org_cycle_instance ON app.analysis_item_link USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_annual_target_business_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_annual_target_business_models_org_cycle ON app.annual_target_business_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_annual_target_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_annual_target_business_models_org_cycle_instance ON app.annual_target_business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_annual_target_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_annual_target_industries_org_cycle ON app.annual_target_industries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_annual_target_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_annual_target_industries_org_cycle_instance ON app.annual_target_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_annual_target_operating_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_annual_target_operating_models_org_cycle ON app.annual_target_operating_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_annual_target_operating_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_annual_target_operating_models_org_cycle_instance ON app.annual_target_operating_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_annual_targets_org_cycle_direction; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_annual_targets_org_cycle_direction ON app.annual_targets USING btree (organization_id, planning_cycle_id, strategic_direction_id);


--
-- Name: idx_annual_targets_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_annual_targets_org_cycle_instance ON app.annual_targets USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_business_model_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_business_model_industries_org_cycle ON app.business_model_industries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_business_model_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_business_model_industries_org_cycle_instance ON app.business_model_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_business_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_business_models_org_cycle ON app.business_models USING btree (organization_id, planning_cycle_id, status);


--
-- Name: idx_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_business_models_org_cycle_instance ON app.business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_challenge_direction_links_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_challenge_direction_links_org_cycle ON app.challenge_direction_links USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_challenge_direction_links_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_challenge_direction_links_org_cycle_instance ON app.challenge_direction_links USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_cycle_cutover_snapshots_org_created; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_cycle_cutover_snapshots_org_created ON app.cycle_cutover_snapshots USING btree (organization_id, created_at DESC);


--
-- Name: idx_cycle_cutover_snapshots_review; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_cycle_cutover_snapshots_review ON app.cycle_cutover_snapshots USING btree (review_id) WHERE (review_id IS NOT NULL);


--
-- Name: idx_cycle_cutovers_org_status_cutover; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_cycle_cutovers_org_status_cutover ON app.cycle_cutovers USING btree (organization_id, status, cutover_at);


--
-- Name: idx_cycle_instance_portfolio_eval_org; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_cycle_instance_portfolio_eval_org ON app.cycle_instance_portfolio_evaluation USING btree (organization_id);


--
-- Name: idx_cycle_instances_org_level_dates; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_cycle_instances_org_level_dates ON app.cycle_instances USING btree (organization_id, level_no, starts_on, ends_on);


--
-- Name: idx_cycle_instances_parent; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_cycle_instances_parent ON app.cycle_instances USING btree (parent_instance_id);


--
-- Name: idx_dashboard_column_config_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_dashboard_column_config_org_cycle ON app.dashboard_column_config USING btree (organization_id, planning_cycle_id, display_order);


--
-- Name: idx_dashboard_column_config_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_dashboard_column_config_org_cycle_instance ON app.dashboard_column_config USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_dashboard_comments_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_dashboard_comments_org_cycle_instance ON app.dashboard_comments USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_dashboard_comments_org_cycle_object; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_dashboard_comments_org_cycle_object ON app.dashboard_comments USING btree (organization_id, planning_cycle_id, object_type, object_id, created_at DESC);


--
-- Name: idx_dashboard_row_config_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_dashboard_row_config_org_cycle ON app.dashboard_row_config USING btree (organization_id, planning_cycle_id, display_order);


--
-- Name: idx_dashboard_row_config_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_dashboard_row_config_org_cycle_instance ON app.dashboard_row_config USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_direction_metric_links_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_direction_metric_links_org_cycle ON app.direction_metric_links USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_direction_metric_links_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_direction_metric_links_org_cycle_instance ON app.direction_metric_links USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_entity_links_org_from; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_entity_links_org_from ON app.entity_links USING btree (organization_id, from_type, from_id);


--
-- Name: idx_entity_links_org_to; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_entity_links_org_to ON app.entity_links USING btree (organization_id, to_type, to_id);


--
-- Name: idx_functional_strategies_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_functional_strategies_org_cycle ON app.functional_strategies USING btree (organization_id, cycle_id);


--
-- Name: idx_functional_strategies_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_functional_strategies_org_cycle_instance ON app.functional_strategies USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_industries_org_cycle ON app.industries USING btree (organization_id, planning_cycle_id, status);


--
-- Name: idx_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_industries_org_cycle_instance ON app.industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_initiative_business_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_business_models_org_cycle ON app.initiative_business_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_initiative_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_business_models_org_cycle_instance ON app.initiative_business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_initiative_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_industries_org_cycle ON app.initiative_industries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_initiative_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_industries_org_cycle_instance ON app.initiative_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_initiative_key_result_links_initiative; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_key_result_links_initiative ON app.initiative_key_result_links USING btree (initiative_id);


--
-- Name: idx_initiative_key_result_links_key_result; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_key_result_links_key_result ON app.initiative_key_result_links USING btree (key_result_id);


--
-- Name: idx_initiative_key_result_links_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_key_result_links_org_cycle ON app.initiative_key_result_links USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_initiative_operating_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_operating_models_org_cycle ON app.initiative_operating_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_initiative_operating_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_operating_models_org_cycle_instance ON app.initiative_operating_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_initiative_target_links_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_target_links_org_cycle ON app.initiative_target_links USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_initiative_target_links_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiative_target_links_org_cycle_instance ON app.initiative_target_links USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_initiatives_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiatives_org_cycle ON app.initiatives USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_initiatives_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_initiatives_org_cycle_instance ON app.initiatives USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_key_result_business_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_result_business_models_org_cycle ON app.key_result_business_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_key_result_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_result_business_models_org_cycle_instance ON app.key_result_business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_key_result_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_result_industries_org_cycle ON app.key_result_industries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_key_result_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_result_industries_org_cycle_instance ON app.key_result_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_key_result_operating_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_result_operating_models_org_cycle ON app.key_result_operating_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_key_result_operating_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_result_operating_models_org_cycle_instance ON app.key_result_operating_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_key_result_target_links_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_result_target_links_org_cycle ON app.key_result_target_links USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_key_result_target_links_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_result_target_links_org_cycle_instance ON app.key_result_target_links USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_key_results_org_objective; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_results_org_objective ON app.key_results USING btree (organization_id, objective_id);


--
-- Name: idx_key_results_owner_membership; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_key_results_owner_membership ON app.key_results USING btree (organization_id, owner_membership_id) WHERE (owner_membership_id IS NOT NULL);


--
-- Name: idx_llm_model_health_status_org_checked; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_llm_model_health_status_org_checked ON app.llm_model_health_status USING btree (organization_id, checked_at DESC);


--
-- Name: idx_llm_model_health_status_org_status; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_llm_model_health_status_org_status ON app.llm_model_health_status USING btree (organization_id, status);


--
-- Name: idx_llm_usage_events_feature_created; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_llm_usage_events_feature_created ON app.llm_usage_events USING btree (organization_id, feature, created_at DESC);


--
-- Name: idx_llm_usage_events_org_created; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_llm_usage_events_org_created ON app.llm_usage_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_member_invitations_email; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_member_invitations_email ON app.member_invitations USING btree (lower(invited_email));


--
-- Name: idx_member_invitations_org_status; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_member_invitations_org_status ON app.member_invitations USING btree (organization_id, status, created_at DESC);


--
-- Name: idx_objective_business_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_business_models_org_cycle ON app.objective_business_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_objective_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_business_models_org_cycle_instance ON app.objective_business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_objective_direction_links_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_direction_links_org_cycle ON app.objective_direction_links USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_objective_direction_links_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_direction_links_org_cycle_instance ON app.objective_direction_links USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_objective_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_industries_org_cycle ON app.objective_industries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_objective_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_industries_org_cycle_instance ON app.objective_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_objective_operating_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_operating_models_org_cycle ON app.objective_operating_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_objective_operating_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_operating_models_org_cycle_instance ON app.objective_operating_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_objective_target_links_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_target_links_org_cycle ON app.objective_target_links USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_objective_target_links_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objective_target_links_org_cycle_instance ON app.objective_target_links USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_objectives_okr_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objectives_okr_cycle ON app.objectives USING btree (organization_id, okr_cycle_id);


--
-- Name: idx_objectives_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objectives_org_cycle ON app.objectives USING btree (organization_id, cycle_id);


--
-- Name: idx_objectives_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_objectives_org_cycle_instance ON app.objectives USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_okr_cycles_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_okr_cycles_org_cycle ON app.okr_cycles USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_okr_cycles_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_okr_cycles_org_cycle_instance ON app.okr_cycles USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_okr_reviews_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_okr_reviews_org_cycle ON app.okr_reviews USING btree (organization_id, planning_cycle_id, okr_cycle_id);


--
-- Name: idx_okr_reviews_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_okr_reviews_org_cycle_instance ON app.okr_reviews USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_okr_updates_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_okr_updates_org_cycle_instance ON app.okr_updates USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_okr_updates_org_cycle_kr; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_okr_updates_org_cycle_kr ON app.okr_updates USING btree (organization_id, planning_cycle_id, key_result_id, created_at DESC);


--
-- Name: idx_operating_model_business_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_operating_model_business_models_org_cycle ON app.operating_model_business_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_operating_model_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_operating_model_business_models_org_cycle_instance ON app.operating_model_business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_operating_model_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_operating_model_industries_org_cycle ON app.operating_model_industries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_operating_model_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_operating_model_industries_org_cycle_instance ON app.operating_model_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_operating_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_operating_models_org_cycle ON app.operating_models USING btree (organization_id, planning_cycle_id, status);


--
-- Name: idx_operating_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_operating_models_org_cycle_instance ON app.operating_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_org_memberships_responsible_unique; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX idx_org_memberships_responsible_unique ON app.organization_memberships USING btree (responsible_id) WHERE (responsible_id IS NOT NULL);


--
-- Name: idx_org_unit_business_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_org_unit_business_models_org_cycle ON app.organization_unit_business_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_org_unit_business_models_unit; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_org_unit_business_models_unit ON app.organization_unit_business_models USING btree (organization_unit_id);


--
-- Name: idx_org_unit_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_org_unit_industries_org_cycle ON app.organization_unit_industries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_org_unit_industries_unit; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_org_unit_industries_unit ON app.organization_unit_industries USING btree (organization_unit_id);


--
-- Name: idx_organization_memberships_org; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_organization_memberships_org ON app.organization_memberships USING btree (organization_id);


--
-- Name: idx_organization_memberships_user; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_organization_memberships_user ON app.organization_memberships USING btree (user_id);


--
-- Name: idx_organization_unit_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_organization_unit_business_models_org_cycle_instance ON app.organization_unit_business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_organization_unit_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_organization_unit_industries_org_cycle_instance ON app.organization_unit_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_organization_unit_org; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_organization_unit_org ON app.organization_unit USING btree (organization_id);


--
-- Name: idx_organization_unit_parent; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_organization_unit_parent ON app.organization_unit USING btree (parent_id);


--
-- Name: idx_organization_unit_status_sort; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_organization_unit_status_sort ON app.organization_unit USING btree (status, sort_order, name);


--
-- Name: idx_organization_unit_type; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_organization_unit_type ON app.organization_unit USING btree (organization_unit_type_id);


--
-- Name: idx_planning_cycles_org; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_planning_cycles_org ON app.planning_cycles USING btree (organization_id);


--
-- Name: idx_responsibility_assignments_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_responsibility_assignments_org_cycle_instance ON app.responsibility_assignments USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_responsibility_assignments_org_obj; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_responsibility_assignments_org_obj ON app.responsibility_assignments USING btree (organization_id, object_type, object_id);


--
-- Name: idx_responsible_assignments_org; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_responsible_assignments_org ON app.responsible_assignments USING btree (organization_id);


--
-- Name: idx_responsible_hierarchy_org; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_responsible_hierarchy_org ON app.responsible_hierarchy USING btree (organization_id);


--
-- Name: idx_responsibles_org; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_responsibles_org ON app.responsibles USING btree (organization_id);


--
-- Name: idx_review_feedback_object; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_review_feedback_object ON app.review_feedback USING btree (object_type, object_id);


--
-- Name: idx_review_feedback_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_review_feedback_org_cycle ON app.review_feedback USING btree (organization_id, cycle_instance_id, created_at DESC);


--
-- Name: idx_review_snapshots_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_review_snapshots_org_cycle ON app.review_snapshots USING btree (organization_id, cycle_instance_id, snapshot_at DESC);


--
-- Name: idx_strategic_challenge_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_challenge_business_models_org_cycle_instance ON app.strategic_challenge_business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategic_challenge_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_challenge_industries_org_cycle_instance ON app.strategic_challenge_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategic_challenges_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_challenges_org_cycle ON app.strategic_challenges USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_strategic_challenges_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_challenges_org_cycle_instance ON app.strategic_challenges USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategic_challenges_source_cluster_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_challenges_source_cluster_id ON app.strategic_challenges USING btree (source_cluster_id) WHERE (source_cluster_id IS NOT NULL);


--
-- Name: idx_strategic_context_cache_org_current; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_context_cache_org_current ON app.strategic_context_cache USING btree (organization_id, is_current) WHERE (is_current = true);


--
-- Name: idx_strategic_direction_business_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_direction_business_models_org_cycle ON app.strategic_direction_business_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_strategic_direction_business_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_direction_business_models_org_cycle_instance ON app.strategic_direction_business_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategic_direction_industries_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_direction_industries_org_cycle ON app.strategic_direction_industries USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_strategic_direction_industries_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_direction_industries_org_cycle_instance ON app.strategic_direction_industries USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategic_direction_operating_models_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_direction_operating_models_org_cycle ON app.strategic_direction_operating_models USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_strategic_direction_operating_models_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_direction_operating_models_org_cycle_instance ON app.strategic_direction_operating_models USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategic_directions_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_directions_org_cycle ON app.strategic_directions USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_strategic_directions_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_directions_org_cycle_instance ON app.strategic_directions USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategic_goals_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_goals_org_cycle ON app.strategic_goals USING btree (organization_id, cycle_id);


--
-- Name: idx_strategic_goals_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_goals_org_cycle_instance ON app.strategic_goals USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategic_metrics_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_metrics_org_cycle ON app.strategic_metrics USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_strategic_metrics_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategic_metrics_org_cycle_instance ON app.strategic_metrics USING btree (organization_id, cycle_instance_id);


--
-- Name: idx_strategy_correlation_status_overrides_lookup; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategy_correlation_status_overrides_lookup ON app.strategy_correlation_status_overrides USING btree (cycle_instance_id, objective_id, challenge_id);


--
-- Name: idx_strategy_programs_challenge; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategy_programs_challenge ON app.strategy_programs USING btree (organization_id, cycle_instance_id, strategic_challenge_id) WHERE (strategic_challenge_id IS NOT NULL);


--
-- Name: idx_strategy_review_feedback_review; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategy_review_feedback_review ON app.strategy_review_feedback_entries USING btree (review_id, created_at DESC);


--
-- Name: idx_strategy_review_feedback_subject; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_strategy_review_feedback_subject ON app.strategy_review_feedback_entries USING btree (subject_type, subject_id);


--
-- Name: idx_target_metric_links_org_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_target_metric_links_org_cycle ON app.target_metric_links USING btree (organization_id, planning_cycle_id);


--
-- Name: idx_target_metric_links_org_cycle_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_target_metric_links_org_cycle_instance ON app.target_metric_links USING btree (organization_id, cycle_instance_id);


--
-- Name: okr_reviews_one_per_okr_session; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX okr_reviews_one_per_okr_session ON app.okr_reviews USING btree (organization_id, okr_cycle_id, cycle_instance_id, review_type) WHERE (okr_cycle_id IS NOT NULL);


--
-- Name: okr_reviews_one_strategy_per_instance; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX okr_reviews_one_strategy_per_instance ON app.okr_reviews USING btree (organization_id, cycle_instance_id) WHERE (review_mode = 'strategy_review'::text);


--
-- Name: uq_analysis_item_link_cycle_instance_source_target_type; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_analysis_item_link_cycle_instance_source_target_type ON app.analysis_item_link USING btree (cycle_instance_id, source_analysis_item_id, target_analysis_item_id, link_type);


--
-- Name: uq_challenge_direction_links_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_challenge_direction_links_cycle ON app.challenge_direction_links USING btree (cycle_instance_id, strategic_direction_id, strategic_challenge_id);


--
-- Name: uq_cluster_objective_relations_cycle_cluster_objective; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_cluster_objective_relations_cycle_cluster_objective ON app.cluster_objective_relations USING btree (cycle_instance_id, cluster_id, objective_id);


--
-- Name: uq_direction_cluster_links_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_direction_cluster_links_cycle ON app.strategic_direction_cluster_links USING btree (cycle_instance_id, strategic_direction_id, cluster_id);


--
-- Name: uq_direction_gap_links_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_direction_gap_links_cycle ON app.strategic_direction_gap_links USING btree (cycle_instance_id, strategic_direction_id, cluster_objective_relation_id);


--
-- Name: uq_direction_objective_links_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_direction_objective_links_cycle ON app.strategic_direction_objective_links USING btree (cycle_instance_id, strategic_direction_id, objective_id);


--
-- Name: uq_initiative_target_links_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_initiative_target_links_cycle ON app.initiative_target_links USING btree (cycle_instance_id, initiative_id, annual_target_id);


--
-- Name: uq_objective_direction_links_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_objective_direction_links_cycle ON app.objective_direction_links USING btree (cycle_instance_id, objective_id, strategic_direction_id);


--
-- Name: uq_objective_target_links_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_objective_target_links_cycle ON app.objective_target_links USING btree (cycle_instance_id, objective_id, annual_target_id);


--
-- Name: uq_strategic_challenge_business_models_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_strategic_challenge_business_models_cycle ON app.strategic_challenge_business_models USING btree (cycle_instance_id, strategic_challenge_id, business_model_id);


--
-- Name: uq_strategic_challenge_industries_cycle; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_strategic_challenge_industries_cycle ON app.strategic_challenge_industries USING btree (cycle_instance_id, strategic_challenge_id, industry_id);


--
-- Name: uq_strategy_correlation_status_overrides_triplet; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_strategy_correlation_status_overrides_triplet ON app.strategy_correlation_status_overrides USING btree (cycle_instance_id, objective_id, challenge_id, strategic_direction_id);


--
-- Name: uq_strategy_programs_cycle_title; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX uq_strategy_programs_cycle_title ON app.strategy_programs USING btree (cycle_instance_id, title);


--
-- Name: ux_cycle_schemes_active_per_org; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX ux_cycle_schemes_active_per_org ON app.cycle_schemes USING btree (organization_id) WHERE (is_active = true);


--
-- Name: idx_revision_events_org_created; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX idx_revision_events_org_created ON audit.revision_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_revision_events_payload_gin_after; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX idx_revision_events_payload_gin_after ON audit.revision_events USING gin (after_data);


--
-- Name: idx_revision_events_payload_gin_before; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX idx_revision_events_payload_gin_before ON audit.revision_events USING gin (before_data);


--
-- Name: idx_revision_events_row_lookup; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX idx_revision_events_row_lookup ON audit.revision_events USING btree (table_schema, table_name, row_pk, created_at DESC);


--
-- Name: idx_revisions_org_created; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX idx_revisions_org_created ON audit.revisions USING btree (organization_id, created_at DESC);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: idx_member_roles_role; Type: INDEX; Schema: rbac; Owner: -
--

CREATE INDEX idx_member_roles_role ON rbac.member_roles USING btree (role_id);


--
-- Name: idx_roles_org; Type: INDEX; Schema: rbac; Owner: -
--

CREATE INDEX idx_roles_org ON rbac.roles USING btree (organization_id);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: v_program_overview _RETURN; Type: RULE; Schema: app; Owner: -
--

CREATE OR REPLACE VIEW app.v_program_overview AS
 SELECT p.id,
    p.title,
    p.status,
    p.owner_membership_id,
    p.start_date,
    p.end_date,
    p.budget_total,
    count(i.id) AS initiative_count,
    count(i.id) FILTER (WHERE (i.status = 'active'::text)) AS initiative_active_count,
    count(i.id) FILTER (WHERE (i.status = ANY (ARRAY['completed'::text, 'archived'::text]))) AS initiative_done_count,
    COALESCE(avg((i.progress_percent)::numeric), (0)::numeric) AS progress_percent
   FROM (app.strategy_programs p
     LEFT JOIN app.initiatives i ON ((i.program_id = p.id)))
  GROUP BY p.id;


--
-- Name: analysis_background_jobs trg_analysis_background_jobs_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_analysis_background_jobs_updated_at BEFORE UPDATE ON app.analysis_background_jobs FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: analysis_challenge_candidates trg_analysis_challenge_candidates_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_analysis_challenge_candidates_updated_at BEFORE UPDATE ON app.analysis_challenge_candidates FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: analysis_clusters trg_analysis_clusters_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_analysis_clusters_updated_at BEFORE UPDATE ON app.analysis_clusters FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: analysis_entries trg_analysis_entries_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_analysis_entries_updated_at BEFORE UPDATE ON app.analysis_entries FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: analysis_gap_findings trg_analysis_gap_findings_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_analysis_gap_findings_updated_at BEFORE UPDATE ON app.analysis_gap_findings FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: analysis_item_link_draft trg_analysis_item_link_draft_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_analysis_item_link_draft_updated_at BEFORE UPDATE ON app.analysis_item_link_draft FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: analysis_item_link trg_analysis_item_link_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_analysis_item_link_updated_at BEFORE UPDATE ON app.analysis_item_link FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: annual_targets trg_annual_targets_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_annual_targets_updated_at BEFORE UPDATE ON app.annual_targets FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: analysis_clusters trg_audit_analysis_clusters; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_analysis_clusters AFTER INSERT OR DELETE OR UPDATE ON app.analysis_clusters FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: analysis_gap_findings trg_audit_analysis_gap_findings; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_analysis_gap_findings AFTER INSERT OR DELETE OR UPDATE ON app.analysis_gap_findings FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: analysis_item_link trg_audit_analysis_item_link; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_analysis_item_link AFTER INSERT OR DELETE OR UPDATE ON app.analysis_item_link FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: analysis_item_link_draft trg_audit_analysis_item_link_draft; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_analysis_item_link_draft AFTER INSERT OR DELETE OR UPDATE ON app.analysis_item_link_draft FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: annual_targets trg_audit_annual_targets; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_annual_targets AFTER INSERT OR DELETE OR UPDATE ON app.annual_targets FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: business_models trg_audit_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_business_models AFTER INSERT OR DELETE OR UPDATE ON app.business_models FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: entity_links trg_audit_entity_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_entity_links AFTER INSERT OR DELETE OR UPDATE ON app.entity_links FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: functional_strategies trg_audit_functional_strategies; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_functional_strategies AFTER INSERT OR DELETE OR UPDATE ON app.functional_strategies FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: industries trg_audit_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_industries AFTER INSERT OR DELETE OR UPDATE ON app.industries FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: initiative_key_result_links trg_audit_initiative_key_result_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_initiative_key_result_links AFTER INSERT OR DELETE OR UPDATE ON app.initiative_key_result_links FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: initiatives trg_audit_initiatives; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_initiatives AFTER INSERT OR DELETE OR UPDATE ON app.initiatives FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: key_results trg_audit_key_results; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_key_results AFTER INSERT OR DELETE OR UPDATE ON app.key_results FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: objectives trg_audit_objectives; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_objectives AFTER INSERT OR DELETE OR UPDATE ON app.objectives FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: okr_cycles trg_audit_okr_cycles; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_okr_cycles AFTER INSERT OR DELETE OR UPDATE ON app.okr_cycles FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: okr_reviews trg_audit_okr_reviews; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_okr_reviews AFTER INSERT OR DELETE OR UPDATE ON app.okr_reviews FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: okr_updates trg_audit_okr_updates; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_okr_updates AFTER INSERT OR DELETE OR UPDATE ON app.okr_updates FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: operating_models trg_audit_operating_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_operating_models AFTER INSERT OR DELETE OR UPDATE ON app.operating_models FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: organization_unit_business_models trg_audit_org_unit_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_org_unit_business_models AFTER INSERT OR DELETE OR UPDATE ON app.organization_unit_business_models FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: organization_unit_industries trg_audit_org_unit_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_org_unit_industries AFTER INSERT OR DELETE OR UPDATE ON app.organization_unit_industries FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: organization_unit trg_audit_organization_unit; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_organization_unit AFTER INSERT OR DELETE OR UPDATE ON app.organization_unit FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: planning_cycles trg_audit_planning_cycles; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_planning_cycles AFTER INSERT OR DELETE OR UPDATE ON app.planning_cycles FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: responsible_assignments trg_audit_responsible_assignments; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_responsible_assignments AFTER INSERT OR DELETE OR UPDATE ON app.responsible_assignments FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: responsible_hierarchy trg_audit_responsible_hierarchy; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_responsible_hierarchy AFTER INSERT OR DELETE OR UPDATE ON app.responsible_hierarchy FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: responsibles trg_audit_responsibles; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_responsibles AFTER INSERT OR DELETE OR UPDATE ON app.responsibles FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: review_feedback trg_audit_review_feedback; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_review_feedback AFTER INSERT OR DELETE OR UPDATE ON app.review_feedback FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: review_snapshots trg_audit_review_snapshots; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_review_snapshots AFTER INSERT OR DELETE OR UPDATE ON app.review_snapshots FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: strategic_goals trg_audit_strategic_goals; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_strategic_goals AFTER INSERT OR DELETE OR UPDATE ON app.strategic_goals FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: strategic_metrics trg_audit_strategic_metrics; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_strategic_metrics AFTER INSERT OR DELETE OR UPDATE ON app.strategic_metrics FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: strategy_review_feedback_entries trg_audit_strategy_review_feedback; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_strategy_review_feedback AFTER INSERT OR DELETE OR UPDATE ON app.strategy_review_feedback_entries FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: tenant_branding trg_audit_tenant_branding; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_audit_tenant_branding AFTER INSERT OR DELETE OR UPDATE ON app.tenant_branding FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();


--
-- Name: business_models trg_business_models_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_business_models_updated_at BEFORE UPDATE ON app.business_models FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: challenge_direction_links trg_challenge_direction_links_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_challenge_direction_links_updated_at BEFORE UPDATE ON app.challenge_direction_links FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: cycle_instance_portfolio_evaluation trg_cycle_instance_portfolio_eval_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_cycle_instance_portfolio_eval_updated_at BEFORE UPDATE ON app.cycle_instance_portfolio_evaluation FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: strategic_directions trg_enforce_direction_activation_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_enforce_direction_activation_links BEFORE INSERT OR UPDATE ON app.strategic_directions FOR EACH ROW EXECUTE FUNCTION app.enforce_direction_activation_links();


--
-- Name: functional_strategies trg_functional_strategies_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_functional_strategies_updated_at BEFORE UPDATE ON app.functional_strategies FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: industries trg_industries_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_industries_updated_at BEFORE UPDATE ON app.industries FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: initiatives trg_initiatives_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_initiatives_updated_at BEFORE UPDATE ON app.initiatives FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: key_results trg_key_results_require_context; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_key_results_require_context BEFORE INSERT ON app.key_results FOR EACH ROW EXECUTE FUNCTION app.ensure_key_result_context();


--
-- Name: key_results trg_key_results_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_key_results_updated_at BEFORE UPDATE ON app.key_results FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: llm_model_health_status trg_llm_model_health_status_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_llm_model_health_status_updated_at BEFORE UPDATE ON app.llm_model_health_status FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: llm_usage_events trg_llm_usage_events_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_llm_usage_events_updated_at BEFORE UPDATE ON app.llm_usage_events FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: member_invitations trg_member_invitations_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_member_invitations_updated_at BEFORE UPDATE ON app.member_invitations FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: objectives trg_objectives_require_context; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_objectives_require_context BEFORE INSERT ON app.objectives FOR EACH ROW EXECUTE FUNCTION app.ensure_objective_context();


--
-- Name: objectives trg_objectives_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_objectives_updated_at BEFORE UPDATE ON app.objectives FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: okr_cycles trg_okr_cycles_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_okr_cycles_updated_at BEFORE UPDATE ON app.okr_cycles FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: okr_reviews trg_okr_reviews_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_okr_reviews_updated_at BEFORE UPDATE ON app.okr_reviews FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: operating_models trg_operating_models_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_operating_models_updated_at BEFORE UPDATE ON app.operating_models FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: organization_memberships trg_org_memberships_validate_responsible; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_org_memberships_validate_responsible BEFORE INSERT OR UPDATE ON app.organization_memberships FOR EACH ROW EXECUTE FUNCTION app.validate_membership_responsible_org();


--
-- Name: organization_unit_business_models trg_org_unit_business_models_validate_org; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_org_unit_business_models_validate_org BEFORE INSERT OR UPDATE ON app.organization_unit_business_models FOR EACH ROW EXECUTE FUNCTION app.validate_org_unit_dimension_link_cross_org();


--
-- Name: organization_unit_industries trg_org_unit_industries_validate_org; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_org_unit_industries_validate_org BEFORE INSERT OR UPDATE ON app.organization_unit_industries FOR EACH ROW EXECUTE FUNCTION app.validate_org_unit_dimension_link_cross_org();


--
-- Name: organization_memberships trg_organization_memberships_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_organization_memberships_updated_at BEFORE UPDATE ON app.organization_memberships FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: organization_unit trg_organization_unit_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_organization_unit_updated_at BEFORE UPDATE ON app.organization_unit FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: organization_unit trg_organization_unit_validate_cycle; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_organization_unit_validate_cycle BEFORE INSERT OR UPDATE ON app.organization_unit FOR EACH ROW EXECUTE FUNCTION app.validate_organization_unit_cycle();


--
-- Name: organization_unit trg_organization_unit_validate_hierarchy; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_organization_unit_validate_hierarchy BEFORE INSERT OR UPDATE ON app.organization_unit FOR EACH ROW EXECUTE FUNCTION app.validate_organization_unit_hierarchy();


--
-- Name: organizations trg_organizations_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON app.organizations FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: planning_cycles trg_planning_cycles_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_planning_cycles_updated_at BEFORE UPDATE ON app.planning_cycles FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: responsible_assignments trg_responsible_assignments_validate_org; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_responsible_assignments_validate_org BEFORE INSERT OR UPDATE ON app.responsible_assignments FOR EACH ROW EXECUTE FUNCTION app.validate_responsible_cross_org();


--
-- Name: responsible_hierarchy trg_responsible_hierarchy_validate_org; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_responsible_hierarchy_validate_org BEFORE INSERT OR UPDATE ON app.responsible_hierarchy FOR EACH ROW EXECUTE FUNCTION app.validate_responsible_cross_org();


--
-- Name: responsibles trg_responsibles_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_responsibles_updated_at BEFORE UPDATE ON app.responsibles FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: strategic_challenges trg_strategic_challenges_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_strategic_challenges_updated_at BEFORE UPDATE ON app.strategic_challenges FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: strategic_directions trg_strategic_directions_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_strategic_directions_updated_at BEFORE UPDATE ON app.strategic_directions FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: strategic_goals trg_strategic_goals_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_strategic_goals_updated_at BEFORE UPDATE ON app.strategic_goals FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: strategic_metrics trg_strategic_metrics_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_strategic_metrics_updated_at BEFORE UPDATE ON app.strategic_metrics FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: strategy_review_feedback_entries trg_strategy_review_feedback_sync; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_strategy_review_feedback_sync BEFORE INSERT OR UPDATE OF review_id ON app.strategy_review_feedback_entries FOR EACH ROW EXECUTE FUNCTION app.tg_strategy_review_feedback_sync();


--
-- Name: strategy_review_feedback_entries trg_strategy_review_feedback_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_strategy_review_feedback_updated_at BEFORE UPDATE ON app.strategy_review_feedback_entries FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: analysis_cluster_members trg_sync_cycles_analysis_cluster_members; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_analysis_cluster_members BEFORE INSERT OR UPDATE ON app.analysis_cluster_members FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: analysis_clusters trg_sync_cycles_analysis_clusters; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_analysis_clusters BEFORE INSERT OR UPDATE ON app.analysis_clusters FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: analysis_entries trg_sync_cycles_analysis_entries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_analysis_entries BEFORE INSERT OR UPDATE ON app.analysis_entries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: analysis_gap_findings trg_sync_cycles_analysis_gap_findings; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_analysis_gap_findings BEFORE INSERT OR UPDATE ON app.analysis_gap_findings FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: analysis_item_link trg_sync_cycles_analysis_item_link; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_analysis_item_link BEFORE INSERT OR UPDATE ON app.analysis_item_link FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: analysis_item_link_draft trg_sync_cycles_analysis_item_link_draft; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_analysis_item_link_draft BEFORE INSERT OR UPDATE ON app.analysis_item_link_draft FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: annual_target_business_models trg_sync_cycles_annual_target_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_annual_target_business_models BEFORE INSERT OR UPDATE ON app.annual_target_business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: annual_target_industries trg_sync_cycles_annual_target_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_annual_target_industries BEFORE INSERT OR UPDATE ON app.annual_target_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: annual_target_operating_models trg_sync_cycles_annual_target_operating_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_annual_target_operating_models BEFORE INSERT OR UPDATE ON app.annual_target_operating_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: annual_targets trg_sync_cycles_annual_targets; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_annual_targets BEFORE INSERT OR UPDATE ON app.annual_targets FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: business_model_industries trg_sync_cycles_business_model_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_business_model_industries BEFORE INSERT OR UPDATE ON app.business_model_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: business_models trg_sync_cycles_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_business_models BEFORE INSERT OR UPDATE ON app.business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: challenge_direction_links trg_sync_cycles_challenge_direction_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_challenge_direction_links BEFORE INSERT OR UPDATE ON app.challenge_direction_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: cluster_objective_relations trg_sync_cycles_cluster_objective_relations; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_cluster_objective_relations BEFORE INSERT OR UPDATE ON app.cluster_objective_relations FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: dashboard_column_config trg_sync_cycles_dashboard_column_config; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_dashboard_column_config BEFORE INSERT OR UPDATE ON app.dashboard_column_config FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: dashboard_comments trg_sync_cycles_dashboard_comments; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_dashboard_comments BEFORE INSERT OR UPDATE ON app.dashboard_comments FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: dashboard_row_config trg_sync_cycles_dashboard_row_config; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_dashboard_row_config BEFORE INSERT OR UPDATE ON app.dashboard_row_config FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: direction_metric_links trg_sync_cycles_direction_metric_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_direction_metric_links BEFORE INSERT OR UPDATE ON app.direction_metric_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: functional_strategies trg_sync_cycles_functional_strategies; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_functional_strategies BEFORE INSERT OR UPDATE ON app.functional_strategies FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: industries trg_sync_cycles_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_industries BEFORE INSERT OR UPDATE ON app.industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: initiative_business_models trg_sync_cycles_initiative_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_initiative_business_models BEFORE INSERT OR UPDATE ON app.initiative_business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: initiative_industries trg_sync_cycles_initiative_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_initiative_industries BEFORE INSERT OR UPDATE ON app.initiative_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: initiative_key_result_links trg_sync_cycles_initiative_key_result_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_initiative_key_result_links BEFORE INSERT OR UPDATE ON app.initiative_key_result_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: initiative_operating_models trg_sync_cycles_initiative_operating_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_initiative_operating_models BEFORE INSERT OR UPDATE ON app.initiative_operating_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: initiative_target_links trg_sync_cycles_initiative_target_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_initiative_target_links BEFORE INSERT OR UPDATE ON app.initiative_target_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: initiatives trg_sync_cycles_initiatives; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_initiatives BEFORE INSERT OR UPDATE ON app.initiatives FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: key_result_business_models trg_sync_cycles_key_result_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_key_result_business_models BEFORE INSERT OR UPDATE ON app.key_result_business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: key_result_industries trg_sync_cycles_key_result_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_key_result_industries BEFORE INSERT OR UPDATE ON app.key_result_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: key_result_operating_models trg_sync_cycles_key_result_operating_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_key_result_operating_models BEFORE INSERT OR UPDATE ON app.key_result_operating_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: key_result_target_links trg_sync_cycles_key_result_target_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_key_result_target_links BEFORE INSERT OR UPDATE ON app.key_result_target_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: objective_business_models trg_sync_cycles_objective_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_objective_business_models BEFORE INSERT OR UPDATE ON app.objective_business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: objective_direction_links trg_sync_cycles_objective_direction_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_objective_direction_links BEFORE INSERT OR UPDATE ON app.objective_direction_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: objective_industries trg_sync_cycles_objective_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_objective_industries BEFORE INSERT OR UPDATE ON app.objective_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: objective_operating_models trg_sync_cycles_objective_operating_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_objective_operating_models BEFORE INSERT OR UPDATE ON app.objective_operating_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: objective_target_links trg_sync_cycles_objective_target_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_objective_target_links BEFORE INSERT OR UPDATE ON app.objective_target_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: objectives trg_sync_cycles_objectives; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_objectives BEFORE INSERT OR UPDATE ON app.objectives FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: okr_cycles trg_sync_cycles_okr_cycles; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_okr_cycles BEFORE INSERT OR UPDATE ON app.okr_cycles FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: okr_reviews trg_sync_cycles_okr_reviews; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_okr_reviews BEFORE INSERT OR UPDATE ON app.okr_reviews FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: okr_updates trg_sync_cycles_okr_updates; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_okr_updates BEFORE INSERT OR UPDATE ON app.okr_updates FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: operating_model_business_models trg_sync_cycles_operating_model_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_operating_model_business_models BEFORE INSERT OR UPDATE ON app.operating_model_business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: operating_model_industries trg_sync_cycles_operating_model_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_operating_model_industries BEFORE INSERT OR UPDATE ON app.operating_model_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: operating_models trg_sync_cycles_operating_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_operating_models BEFORE INSERT OR UPDATE ON app.operating_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: organization_unit_business_models trg_sync_cycles_organization_unit_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_organization_unit_business_models BEFORE INSERT OR UPDATE ON app.organization_unit_business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: organization_unit_industries trg_sync_cycles_organization_unit_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_organization_unit_industries BEFORE INSERT OR UPDATE ON app.organization_unit_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: responsibility_assignments trg_sync_cycles_responsibility_assignments; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_responsibility_assignments BEFORE INSERT OR UPDATE ON app.responsibility_assignments FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_challenge_business_models trg_sync_cycles_strategic_challenge_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_challenge_business_models BEFORE INSERT OR UPDATE ON app.strategic_challenge_business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_challenge_industries trg_sync_cycles_strategic_challenge_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_challenge_industries BEFORE INSERT OR UPDATE ON app.strategic_challenge_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_challenges trg_sync_cycles_strategic_challenges; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_challenges BEFORE INSERT OR UPDATE ON app.strategic_challenges FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_direction_business_models trg_sync_cycles_strategic_direction_business_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_direction_business_models BEFORE INSERT OR UPDATE ON app.strategic_direction_business_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_direction_cluster_links trg_sync_cycles_strategic_direction_cluster_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_direction_cluster_links BEFORE INSERT OR UPDATE ON app.strategic_direction_cluster_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_direction_gap_links trg_sync_cycles_strategic_direction_gap_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_direction_gap_links BEFORE INSERT OR UPDATE ON app.strategic_direction_gap_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_direction_industries trg_sync_cycles_strategic_direction_industries; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_direction_industries BEFORE INSERT OR UPDATE ON app.strategic_direction_industries FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_direction_objective_links trg_sync_cycles_strategic_direction_objective_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_direction_objective_links BEFORE INSERT OR UPDATE ON app.strategic_direction_objective_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_direction_operating_models trg_sync_cycles_strategic_direction_operating_models; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_direction_operating_models BEFORE INSERT OR UPDATE ON app.strategic_direction_operating_models FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_directions trg_sync_cycles_strategic_directions; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_directions BEFORE INSERT OR UPDATE ON app.strategic_directions FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_goals trg_sync_cycles_strategic_goals; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_goals BEFORE INSERT OR UPDATE ON app.strategic_goals FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategic_metrics trg_sync_cycles_strategic_metrics; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategic_metrics BEFORE INSERT OR UPDATE ON app.strategic_metrics FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategy_correlation_status_overrides trg_sync_cycles_strategy_correlation_status_overrides; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategy_correlation_status_overrides BEFORE INSERT OR UPDATE ON app.strategy_correlation_status_overrides FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: strategy_programs trg_sync_cycles_strategy_programs; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_strategy_programs BEFORE INSERT OR UPDATE ON app.strategy_programs FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: target_metric_links trg_sync_cycles_target_metric_links; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sync_cycles_target_metric_links BEFORE INSERT OR UPDATE ON app.target_metric_links FOR EACH ROW EXECUTE FUNCTION app.sync_legacy_cycle_columns();


--
-- Name: tenant_branding trg_tenant_branding_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_tenant_branding_updated_at BEFORE UPDATE ON app.tenant_branding FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: cycle_instances trg_touch_cycle_instances_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_touch_cycle_instances_updated_at BEFORE UPDATE ON app.cycle_instances FOR EACH ROW EXECUTE FUNCTION app.tg_touch_updated_at();


--
-- Name: cycle_scheme_levels trg_touch_cycle_scheme_levels_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_touch_cycle_scheme_levels_updated_at BEFORE UPDATE ON app.cycle_scheme_levels FOR EACH ROW EXECUTE FUNCTION app.tg_touch_updated_at();


--
-- Name: cycle_schemes trg_touch_cycle_schemes_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_touch_cycle_schemes_updated_at BEFORE UPDATE ON app.cycle_schemes FOR EACH ROW EXECUTE FUNCTION app.tg_touch_updated_at();


--
-- Name: cycle_scheme_levels trg_validate_cycle_scheme_levels; Type: TRIGGER; Schema: app; Owner: -
--

CREATE CONSTRAINT TRIGGER trg_validate_cycle_scheme_levels AFTER INSERT OR DELETE OR UPDATE ON app.cycle_scheme_levels DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.tg_validate_cycle_scheme_levels();


--
-- Name: strategy_programs trg_z_guard_program_activation; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_z_guard_program_activation BEFORE INSERT OR UPDATE ON app.strategy_programs FOR EACH ROW EXECUTE FUNCTION app.enforce_program_activation_has_active_initiative();


--
-- Name: member_roles trg_member_roles_same_org; Type: TRIGGER; Schema: rbac; Owner: -
--

CREATE TRIGGER trg_member_roles_same_org BEFORE INSERT OR UPDATE ON rbac.member_roles FOR EACH ROW EXECUTE FUNCTION rbac.ensure_member_role_same_org();


--
-- Name: roles trg_roles_updated_at; Type: TRIGGER; Schema: rbac; Owner: -
--

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON rbac.roles FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: analysis_background_jobs analysis_background_jobs_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_background_jobs
    ADD CONSTRAINT analysis_background_jobs_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_background_jobs analysis_background_jobs_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_background_jobs
    ADD CONSTRAINT analysis_background_jobs_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: analysis_background_jobs analysis_background_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_background_jobs
    ADD CONSTRAINT analysis_background_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: analysis_challenge_candidates analysis_challenge_candidates_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_challenge_candidates
    ADD CONSTRAINT analysis_challenge_candidates_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_challenge_candidates analysis_challenge_candidates_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_challenge_candidates
    ADD CONSTRAINT analysis_challenge_candidates_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: analysis_challenge_candidates analysis_challenge_candidates_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_challenge_candidates
    ADD CONSTRAINT analysis_challenge_candidates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: analysis_cluster_members analysis_cluster_members_cluster_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_cluster_members
    ADD CONSTRAINT analysis_cluster_members_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES app.analysis_clusters(id) ON DELETE CASCADE;


--
-- Name: analysis_cluster_members analysis_cluster_members_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_cluster_members
    ADD CONSTRAINT analysis_cluster_members_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: analysis_cluster_members analysis_cluster_members_entry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_cluster_members
    ADD CONSTRAINT analysis_cluster_members_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES app.analysis_entries(id) ON DELETE CASCADE;


--
-- Name: analysis_cluster_members analysis_cluster_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_cluster_members
    ADD CONSTRAINT analysis_cluster_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: analysis_clusters analysis_clusters_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_clusters
    ADD CONSTRAINT analysis_clusters_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_clusters analysis_clusters_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_clusters
    ADD CONSTRAINT analysis_clusters_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: analysis_clusters analysis_clusters_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_clusters
    ADD CONSTRAINT analysis_clusters_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: analysis_entries analysis_entries_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_entries
    ADD CONSTRAINT analysis_entries_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_entries analysis_entries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_entries
    ADD CONSTRAINT analysis_entries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: analysis_entries analysis_entries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_entries
    ADD CONSTRAINT analysis_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: analysis_gap_findings analysis_gap_findings_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_gap_findings
    ADD CONSTRAINT analysis_gap_findings_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_gap_findings analysis_gap_findings_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_gap_findings
    ADD CONSTRAINT analysis_gap_findings_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: analysis_gap_findings analysis_gap_findings_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_gap_findings
    ADD CONSTRAINT analysis_gap_findings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: analysis_gap_findings analysis_gap_findings_related_cluster_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_gap_findings
    ADD CONSTRAINT analysis_gap_findings_related_cluster_id_fkey FOREIGN KEY (related_cluster_id) REFERENCES app.analysis_clusters(id) ON DELETE SET NULL;


--
-- Name: analysis_item_link analysis_item_link_activated_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_activated_by_membership_id_fkey FOREIGN KEY (activated_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_item_link analysis_item_link_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_item_link analysis_item_link_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: analysis_item_link_draft analysis_item_link_draft_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link_draft
    ADD CONSTRAINT analysis_item_link_draft_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_item_link_draft analysis_item_link_draft_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link_draft
    ADD CONSTRAINT analysis_item_link_draft_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: analysis_item_link_draft analysis_item_link_draft_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link_draft
    ADD CONSTRAINT analysis_item_link_draft_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: analysis_item_link_draft analysis_item_link_draft_reviewed_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link_draft
    ADD CONSTRAINT analysis_item_link_draft_reviewed_by_membership_id_fkey FOREIGN KEY (reviewed_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: analysis_item_link_draft analysis_item_link_draft_source_analysis_item_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link_draft
    ADD CONSTRAINT analysis_item_link_draft_source_analysis_item_id_fkey FOREIGN KEY (source_analysis_item_id) REFERENCES app.analysis_entries(id) ON DELETE CASCADE;


--
-- Name: analysis_item_link_draft analysis_item_link_draft_target_analysis_item_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link_draft
    ADD CONSTRAINT analysis_item_link_draft_target_analysis_item_id_fkey FOREIGN KEY (target_analysis_item_id) REFERENCES app.analysis_entries(id) ON DELETE CASCADE;


--
-- Name: analysis_item_link analysis_item_link_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: analysis_item_link analysis_item_link_source_analysis_item_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_source_analysis_item_id_fkey FOREIGN KEY (source_analysis_item_id) REFERENCES app.analysis_entries(id) ON DELETE CASCADE;


--
-- Name: analysis_item_link analysis_item_link_source_draft_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_source_draft_id_fkey FOREIGN KEY (source_draft_id) REFERENCES app.analysis_item_link_draft(id) ON DELETE SET NULL;


--
-- Name: analysis_item_link analysis_item_link_target_analysis_item_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.analysis_item_link
    ADD CONSTRAINT analysis_item_link_target_analysis_item_id_fkey FOREIGN KEY (target_analysis_item_id) REFERENCES app.analysis_entries(id) ON DELETE CASCADE;


--
-- Name: annual_target_business_models annual_target_business_models_annual_target_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_business_models
    ADD CONSTRAINT annual_target_business_models_annual_target_id_fkey FOREIGN KEY (annual_target_id) REFERENCES app.annual_targets(id) ON DELETE CASCADE;


--
-- Name: annual_target_business_models annual_target_business_models_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_business_models
    ADD CONSTRAINT annual_target_business_models_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: annual_target_business_models annual_target_business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_business_models
    ADD CONSTRAINT annual_target_business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: annual_target_business_models annual_target_business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_business_models
    ADD CONSTRAINT annual_target_business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: annual_target_industries annual_target_industries_annual_target_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_industries
    ADD CONSTRAINT annual_target_industries_annual_target_id_fkey FOREIGN KEY (annual_target_id) REFERENCES app.annual_targets(id) ON DELETE CASCADE;


--
-- Name: annual_target_industries annual_target_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_industries
    ADD CONSTRAINT annual_target_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: annual_target_industries annual_target_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_industries
    ADD CONSTRAINT annual_target_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: annual_target_industries annual_target_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_industries
    ADD CONSTRAINT annual_target_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: annual_target_operating_models annual_target_operating_models_annual_target_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_operating_models
    ADD CONSTRAINT annual_target_operating_models_annual_target_id_fkey FOREIGN KEY (annual_target_id) REFERENCES app.annual_targets(id) ON DELETE CASCADE;


--
-- Name: annual_target_operating_models annual_target_operating_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_operating_models
    ADD CONSTRAINT annual_target_operating_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: annual_target_operating_models annual_target_operating_models_operating_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_operating_models
    ADD CONSTRAINT annual_target_operating_models_operating_model_id_fkey FOREIGN KEY (operating_model_id) REFERENCES app.operating_models(id) ON DELETE CASCADE;


--
-- Name: annual_target_operating_models annual_target_operating_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_target_operating_models
    ADD CONSTRAINT annual_target_operating_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: annual_targets annual_targets_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_targets
    ADD CONSTRAINT annual_targets_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: annual_targets annual_targets_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_targets
    ADD CONSTRAINT annual_targets_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: annual_targets annual_targets_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_targets
    ADD CONSTRAINT annual_targets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: annual_targets annual_targets_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.annual_targets
    ADD CONSTRAINT annual_targets_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: business_model_industries business_model_industries_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_model_industries
    ADD CONSTRAINT business_model_industries_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: business_model_industries business_model_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_model_industries
    ADD CONSTRAINT business_model_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: business_model_industries business_model_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_model_industries
    ADD CONSTRAINT business_model_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: business_model_industries business_model_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_model_industries
    ADD CONSTRAINT business_model_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: business_models business_models_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_models
    ADD CONSTRAINT business_models_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: business_models business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_models
    ADD CONSTRAINT business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: business_models business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.business_models
    ADD CONSTRAINT business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: challenge_direction_links challenge_direction_links_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.challenge_direction_links
    ADD CONSTRAINT challenge_direction_links_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: challenge_direction_links challenge_direction_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.challenge_direction_links
    ADD CONSTRAINT challenge_direction_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: challenge_direction_links challenge_direction_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.challenge_direction_links
    ADD CONSTRAINT challenge_direction_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: challenge_direction_links challenge_direction_links_strategic_challenge_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.challenge_direction_links
    ADD CONSTRAINT challenge_direction_links_strategic_challenge_id_fkey FOREIGN KEY (strategic_challenge_id) REFERENCES app.strategic_challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_direction_links challenge_direction_links_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.challenge_direction_links
    ADD CONSTRAINT challenge_direction_links_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: cluster_objective_relations cluster_objective_relations_cluster_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cluster_objective_relations
    ADD CONSTRAINT cluster_objective_relations_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES app.analysis_clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_objective_relations cluster_objective_relations_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cluster_objective_relations
    ADD CONSTRAINT cluster_objective_relations_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: cluster_objective_relations cluster_objective_relations_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cluster_objective_relations
    ADD CONSTRAINT cluster_objective_relations_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: cluster_objective_relations cluster_objective_relations_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cluster_objective_relations
    ADD CONSTRAINT cluster_objective_relations_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: cluster_objective_relations cluster_objective_relations_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cluster_objective_relations
    ADD CONSTRAINT cluster_objective_relations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: cluster_objective_relations cluster_objective_relations_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cluster_objective_relations
    ADD CONSTRAINT cluster_objective_relations_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutover_snapshots
    ADD CONSTRAINT cycle_cutover_snapshots_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_cutover_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutover_snapshots
    ADD CONSTRAINT cycle_cutover_snapshots_cutover_id_fkey FOREIGN KEY (cutover_id) REFERENCES app.cycle_cutovers(id) ON DELETE CASCADE;


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_from_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutover_snapshots
    ADD CONSTRAINT cycle_cutover_snapshots_from_cycle_instance_id_fkey FOREIGN KEY (from_cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutover_snapshots
    ADD CONSTRAINT cycle_cutover_snapshots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_review_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutover_snapshots
    ADD CONSTRAINT cycle_cutover_snapshots_review_id_fkey FOREIGN KEY (review_id) REFERENCES app.okr_reviews(id) ON DELETE SET NULL;


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_to_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutover_snapshots
    ADD CONSTRAINT cycle_cutover_snapshots_to_cycle_instance_id_fkey FOREIGN KEY (to_cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: cycle_cutovers cycle_cutovers_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutovers
    ADD CONSTRAINT cycle_cutovers_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: cycle_cutovers cycle_cutovers_from_cycle_scheme_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutovers
    ADD CONSTRAINT cycle_cutovers_from_cycle_scheme_id_fkey FOREIGN KEY (from_cycle_scheme_id) REFERENCES app.cycle_schemes(id) ON DELETE CASCADE;


--
-- Name: cycle_cutovers cycle_cutovers_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutovers
    ADD CONSTRAINT cycle_cutovers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: cycle_cutovers cycle_cutovers_to_cycle_scheme_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_cutovers
    ADD CONSTRAINT cycle_cutovers_to_cycle_scheme_id_fkey FOREIGN KEY (to_cycle_scheme_id) REFERENCES app.cycle_schemes(id) ON DELETE CASCADE;


--
-- Name: cycle_instance_lock cycle_instance_lock_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instance_lock
    ADD CONSTRAINT cycle_instance_lock_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: cycle_instance_lock cycle_instance_lock_locked_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instance_lock
    ADD CONSTRAINT cycle_instance_lock_locked_by_membership_id_fkey FOREIGN KEY (locked_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: cycle_instance_portfolio_evaluation cycle_instance_portfolio_evaluation_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instance_portfolio_evaluation
    ADD CONSTRAINT cycle_instance_portfolio_evaluation_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: cycle_instance_portfolio_evaluation cycle_instance_portfolio_evaluation_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instance_portfolio_evaluation
    ADD CONSTRAINT cycle_instance_portfolio_evaluation_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: cycle_instances cycle_instances_cycle_scheme_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instances
    ADD CONSTRAINT cycle_instances_cycle_scheme_id_fkey FOREIGN KEY (cycle_scheme_id) REFERENCES app.cycle_schemes(id) ON DELETE CASCADE;


--
-- Name: cycle_instances cycle_instances_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instances
    ADD CONSTRAINT cycle_instances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: cycle_instances cycle_instances_parent_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_instances
    ADD CONSTRAINT cycle_instances_parent_instance_id_fkey FOREIGN KEY (parent_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: cycle_scheme_levels cycle_scheme_levels_cycle_scheme_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_scheme_levels
    ADD CONSTRAINT cycle_scheme_levels_cycle_scheme_id_fkey FOREIGN KEY (cycle_scheme_id) REFERENCES app.cycle_schemes(id) ON DELETE CASCADE;


--
-- Name: cycle_schemes cycle_schemes_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_schemes
    ADD CONSTRAINT cycle_schemes_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: cycle_schemes cycle_schemes_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.cycle_schemes
    ADD CONSTRAINT cycle_schemes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: dashboard_column_config dashboard_column_config_challenge_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_column_config
    ADD CONSTRAINT dashboard_column_config_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES app.strategic_challenges(id) ON DELETE CASCADE;


--
-- Name: dashboard_column_config dashboard_column_config_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_column_config
    ADD CONSTRAINT dashboard_column_config_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: dashboard_column_config dashboard_column_config_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_column_config
    ADD CONSTRAINT dashboard_column_config_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: dashboard_comments dashboard_comments_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_comments
    ADD CONSTRAINT dashboard_comments_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: dashboard_comments dashboard_comments_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_comments
    ADD CONSTRAINT dashboard_comments_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: dashboard_comments dashboard_comments_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_comments
    ADD CONSTRAINT dashboard_comments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: dashboard_row_config dashboard_row_config_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_row_config
    ADD CONSTRAINT dashboard_row_config_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: dashboard_row_config dashboard_row_config_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_row_config
    ADD CONSTRAINT dashboard_row_config_direction_id_fkey FOREIGN KEY (direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: dashboard_row_config dashboard_row_config_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.dashboard_row_config
    ADD CONSTRAINT dashboard_row_config_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: direction_metric_links direction_metric_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.direction_metric_links
    ADD CONSTRAINT direction_metric_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: direction_metric_links direction_metric_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.direction_metric_links
    ADD CONSTRAINT direction_metric_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: direction_metric_links direction_metric_links_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.direction_metric_links
    ADD CONSTRAINT direction_metric_links_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: direction_metric_links direction_metric_links_strategic_metric_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.direction_metric_links
    ADD CONSTRAINT direction_metric_links_strategic_metric_id_fkey FOREIGN KEY (strategic_metric_id) REFERENCES app.strategic_metrics(id) ON DELETE CASCADE;


--
-- Name: entity_links entity_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.entity_links
    ADD CONSTRAINT entity_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: functional_strategies functional_strategies_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.functional_strategies
    ADD CONSTRAINT functional_strategies_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: functional_strategies functional_strategies_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.functional_strategies
    ADD CONSTRAINT functional_strategies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: functional_strategies functional_strategies_owner_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.functional_strategies
    ADD CONSTRAINT functional_strategies_owner_membership_id_fkey FOREIGN KEY (owner_membership_id) REFERENCES app.organization_memberships(id);


--
-- Name: industries industries_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.industries
    ADD CONSTRAINT industries_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: industries industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.industries
    ADD CONSTRAINT industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: industries industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.industries
    ADD CONSTRAINT industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: initiative_business_models initiative_business_models_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_business_models
    ADD CONSTRAINT initiative_business_models_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: initiative_business_models initiative_business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_business_models
    ADD CONSTRAINT initiative_business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: initiative_business_models initiative_business_models_initiative_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_business_models
    ADD CONSTRAINT initiative_business_models_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES app.initiatives(id) ON DELETE CASCADE;


--
-- Name: initiative_business_models initiative_business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_business_models
    ADD CONSTRAINT initiative_business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: initiative_industries initiative_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_industries
    ADD CONSTRAINT initiative_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: initiative_industries initiative_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_industries
    ADD CONSTRAINT initiative_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: initiative_industries initiative_industries_initiative_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_industries
    ADD CONSTRAINT initiative_industries_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES app.initiatives(id) ON DELETE CASCADE;


--
-- Name: initiative_industries initiative_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_industries
    ADD CONSTRAINT initiative_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: initiative_key_result_links initiative_key_result_links_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_key_result_links
    ADD CONSTRAINT initiative_key_result_links_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: initiative_key_result_links initiative_key_result_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_key_result_links
    ADD CONSTRAINT initiative_key_result_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: initiative_key_result_links initiative_key_result_links_initiative_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_key_result_links
    ADD CONSTRAINT initiative_key_result_links_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES app.initiatives(id) ON DELETE CASCADE;


--
-- Name: initiative_key_result_links initiative_key_result_links_key_result_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_key_result_links
    ADD CONSTRAINT initiative_key_result_links_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES app.key_results(id) ON DELETE CASCADE;


--
-- Name: initiative_key_result_links initiative_key_result_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_key_result_links
    ADD CONSTRAINT initiative_key_result_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: initiative_key_result_links initiative_key_result_links_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_key_result_links
    ADD CONSTRAINT initiative_key_result_links_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: initiative_operating_models initiative_operating_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_operating_models
    ADD CONSTRAINT initiative_operating_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: initiative_operating_models initiative_operating_models_initiative_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_operating_models
    ADD CONSTRAINT initiative_operating_models_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES app.initiatives(id) ON DELETE CASCADE;


--
-- Name: initiative_operating_models initiative_operating_models_operating_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_operating_models
    ADD CONSTRAINT initiative_operating_models_operating_model_id_fkey FOREIGN KEY (operating_model_id) REFERENCES app.operating_models(id) ON DELETE CASCADE;


--
-- Name: initiative_operating_models initiative_operating_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_operating_models
    ADD CONSTRAINT initiative_operating_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: initiative_target_links initiative_target_links_annual_target_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_target_links
    ADD CONSTRAINT initiative_target_links_annual_target_id_fkey FOREIGN KEY (annual_target_id) REFERENCES app.annual_targets(id) ON DELETE CASCADE;


--
-- Name: initiative_target_links initiative_target_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_target_links
    ADD CONSTRAINT initiative_target_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: initiative_target_links initiative_target_links_initiative_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_target_links
    ADD CONSTRAINT initiative_target_links_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES app.initiatives(id) ON DELETE CASCADE;


--
-- Name: initiative_target_links initiative_target_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiative_target_links
    ADD CONSTRAINT initiative_target_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: initiatives initiatives_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiatives
    ADD CONSTRAINT initiatives_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: initiatives initiatives_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiatives
    ADD CONSTRAINT initiatives_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: initiatives initiatives_execution_health_override_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiatives
    ADD CONSTRAINT initiatives_execution_health_override_by_membership_id_fkey FOREIGN KEY (execution_health_override_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: initiatives initiatives_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiatives
    ADD CONSTRAINT initiatives_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: initiatives initiatives_owner_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiatives
    ADD CONSTRAINT initiatives_owner_membership_id_fkey FOREIGN KEY (owner_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: initiatives initiatives_program_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.initiatives
    ADD CONSTRAINT initiatives_program_id_fkey FOREIGN KEY (program_id) REFERENCES app.strategy_programs(id) ON DELETE SET NULL;


--
-- Name: key_result_business_models key_result_business_models_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_business_models
    ADD CONSTRAINT key_result_business_models_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: key_result_business_models key_result_business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_business_models
    ADD CONSTRAINT key_result_business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: key_result_business_models key_result_business_models_key_result_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_business_models
    ADD CONSTRAINT key_result_business_models_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES app.key_results(id) ON DELETE CASCADE;


--
-- Name: key_result_business_models key_result_business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_business_models
    ADD CONSTRAINT key_result_business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: key_result_industries key_result_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_industries
    ADD CONSTRAINT key_result_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: key_result_industries key_result_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_industries
    ADD CONSTRAINT key_result_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: key_result_industries key_result_industries_key_result_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_industries
    ADD CONSTRAINT key_result_industries_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES app.key_results(id) ON DELETE CASCADE;


--
-- Name: key_result_industries key_result_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_industries
    ADD CONSTRAINT key_result_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: key_result_operating_models key_result_operating_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_operating_models
    ADD CONSTRAINT key_result_operating_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: key_result_operating_models key_result_operating_models_key_result_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_operating_models
    ADD CONSTRAINT key_result_operating_models_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES app.key_results(id) ON DELETE CASCADE;


--
-- Name: key_result_operating_models key_result_operating_models_operating_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_operating_models
    ADD CONSTRAINT key_result_operating_models_operating_model_id_fkey FOREIGN KEY (operating_model_id) REFERENCES app.operating_models(id) ON DELETE CASCADE;


--
-- Name: key_result_operating_models key_result_operating_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_operating_models
    ADD CONSTRAINT key_result_operating_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: key_result_target_links key_result_target_links_annual_target_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_target_links
    ADD CONSTRAINT key_result_target_links_annual_target_id_fkey FOREIGN KEY (annual_target_id) REFERENCES app.annual_targets(id) ON DELETE CASCADE;


--
-- Name: key_result_target_links key_result_target_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_target_links
    ADD CONSTRAINT key_result_target_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: key_result_target_links key_result_target_links_key_result_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_target_links
    ADD CONSTRAINT key_result_target_links_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES app.key_results(id) ON DELETE CASCADE;


--
-- Name: key_result_target_links key_result_target_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_result_target_links
    ADD CONSTRAINT key_result_target_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: key_results key_results_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_results
    ADD CONSTRAINT key_results_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: key_results key_results_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_results
    ADD CONSTRAINT key_results_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: key_results key_results_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_results
    ADD CONSTRAINT key_results_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: key_results key_results_owner_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.key_results
    ADD CONSTRAINT key_results_owner_membership_id_fkey FOREIGN KEY (owner_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: llm_model_health_status llm_model_health_status_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.llm_model_health_status
    ADD CONSTRAINT llm_model_health_status_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: llm_usage_events llm_usage_events_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.llm_usage_events
    ADD CONSTRAINT llm_usage_events_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE SET NULL;


--
-- Name: llm_usage_events llm_usage_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.llm_usage_events
    ADD CONSTRAINT llm_usage_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: member_invitations member_invitations_accepted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.member_invitations
    ADD CONSTRAINT member_invitations_accepted_by_user_id_fkey FOREIGN KEY (accepted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: member_invitations member_invitations_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.member_invitations
    ADD CONSTRAINT member_invitations_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: member_invitations member_invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.member_invitations
    ADD CONSTRAINT member_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: objective_business_models objective_business_models_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_business_models
    ADD CONSTRAINT objective_business_models_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: objective_business_models objective_business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_business_models
    ADD CONSTRAINT objective_business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: objective_business_models objective_business_models_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_business_models
    ADD CONSTRAINT objective_business_models_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: objective_business_models objective_business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_business_models
    ADD CONSTRAINT objective_business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: objective_direction_links objective_direction_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_direction_links
    ADD CONSTRAINT objective_direction_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: objective_direction_links objective_direction_links_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_direction_links
    ADD CONSTRAINT objective_direction_links_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: objective_direction_links objective_direction_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_direction_links
    ADD CONSTRAINT objective_direction_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: objective_direction_links objective_direction_links_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_direction_links
    ADD CONSTRAINT objective_direction_links_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: objective_industries objective_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_industries
    ADD CONSTRAINT objective_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: objective_industries objective_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_industries
    ADD CONSTRAINT objective_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: objective_industries objective_industries_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_industries
    ADD CONSTRAINT objective_industries_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: objective_industries objective_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_industries
    ADD CONSTRAINT objective_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: objective_operating_models objective_operating_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_operating_models
    ADD CONSTRAINT objective_operating_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: objective_operating_models objective_operating_models_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_operating_models
    ADD CONSTRAINT objective_operating_models_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: objective_operating_models objective_operating_models_operating_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_operating_models
    ADD CONSTRAINT objective_operating_models_operating_model_id_fkey FOREIGN KEY (operating_model_id) REFERENCES app.operating_models(id) ON DELETE CASCADE;


--
-- Name: objective_operating_models objective_operating_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_operating_models
    ADD CONSTRAINT objective_operating_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: objective_target_links objective_target_links_annual_target_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_target_links
    ADD CONSTRAINT objective_target_links_annual_target_id_fkey FOREIGN KEY (annual_target_id) REFERENCES app.annual_targets(id) ON DELETE CASCADE;


--
-- Name: objective_target_links objective_target_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_target_links
    ADD CONSTRAINT objective_target_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: objective_target_links objective_target_links_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_target_links
    ADD CONSTRAINT objective_target_links_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: objective_target_links objective_target_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objective_target_links
    ADD CONSTRAINT objective_target_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: objectives objectives_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objectives
    ADD CONSTRAINT objectives_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: objectives objectives_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objectives
    ADD CONSTRAINT objectives_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: objectives objectives_objective_health_override_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objectives
    ADD CONSTRAINT objectives_objective_health_override_by_membership_id_fkey FOREIGN KEY (objective_health_override_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: objectives objectives_okr_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objectives
    ADD CONSTRAINT objectives_okr_cycle_id_fkey FOREIGN KEY (okr_cycle_id) REFERENCES app.okr_cycles(id) ON DELETE SET NULL;


--
-- Name: objectives objectives_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objectives
    ADD CONSTRAINT objectives_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: objectives objectives_owner_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.objectives
    ADD CONSTRAINT objectives_owner_membership_id_fkey FOREIGN KEY (owner_membership_id) REFERENCES app.organization_memberships(id);


--
-- Name: okr_cycles okr_cycles_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_cycles
    ADD CONSTRAINT okr_cycles_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: okr_cycles okr_cycles_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_cycles
    ADD CONSTRAINT okr_cycles_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: okr_cycles okr_cycles_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_cycles
    ADD CONSTRAINT okr_cycles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: okr_reviews okr_reviews_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_reviews
    ADD CONSTRAINT okr_reviews_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: okr_reviews okr_reviews_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_reviews
    ADD CONSTRAINT okr_reviews_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: okr_reviews okr_reviews_okr_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_reviews
    ADD CONSTRAINT okr_reviews_okr_cycle_id_fkey FOREIGN KEY (okr_cycle_id) REFERENCES app.okr_cycles(id) ON DELETE SET NULL;


--
-- Name: okr_reviews okr_reviews_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_reviews
    ADD CONSTRAINT okr_reviews_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: okr_reviews okr_reviews_override_forced_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_reviews
    ADD CONSTRAINT okr_reviews_override_forced_by_fkey FOREIGN KEY (override_forced_by) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: okr_reviews okr_reviews_released_to_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_reviews
    ADD CONSTRAINT okr_reviews_released_to_cycle_instance_id_fkey FOREIGN KEY (released_to_cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE SET NULL;


--
-- Name: okr_updates okr_updates_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_updates
    ADD CONSTRAINT okr_updates_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: okr_updates okr_updates_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_updates
    ADD CONSTRAINT okr_updates_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: okr_updates okr_updates_key_result_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_updates
    ADD CONSTRAINT okr_updates_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES app.key_results(id) ON DELETE CASCADE;


--
-- Name: okr_updates okr_updates_okr_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_updates
    ADD CONSTRAINT okr_updates_okr_cycle_id_fkey FOREIGN KEY (okr_cycle_id) REFERENCES app.okr_cycles(id) ON DELETE SET NULL;


--
-- Name: okr_updates okr_updates_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.okr_updates
    ADD CONSTRAINT okr_updates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: operating_model_business_models operating_model_business_models_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_business_models
    ADD CONSTRAINT operating_model_business_models_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: operating_model_business_models operating_model_business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_business_models
    ADD CONSTRAINT operating_model_business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: operating_model_business_models operating_model_business_models_operating_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_business_models
    ADD CONSTRAINT operating_model_business_models_operating_model_id_fkey FOREIGN KEY (operating_model_id) REFERENCES app.operating_models(id) ON DELETE CASCADE;


--
-- Name: operating_model_business_models operating_model_business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_business_models
    ADD CONSTRAINT operating_model_business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: operating_model_industries operating_model_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_industries
    ADD CONSTRAINT operating_model_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: operating_model_industries operating_model_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_industries
    ADD CONSTRAINT operating_model_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: operating_model_industries operating_model_industries_operating_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_industries
    ADD CONSTRAINT operating_model_industries_operating_model_id_fkey FOREIGN KEY (operating_model_id) REFERENCES app.operating_models(id) ON DELETE CASCADE;


--
-- Name: operating_model_industries operating_model_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_model_industries
    ADD CONSTRAINT operating_model_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: operating_models operating_models_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_models
    ADD CONSTRAINT operating_models_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: operating_models operating_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_models
    ADD CONSTRAINT operating_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: operating_models operating_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.operating_models
    ADD CONSTRAINT operating_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships organization_memberships_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_memberships
    ADD CONSTRAINT organization_memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships organization_memberships_responsible_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_memberships
    ADD CONSTRAINT organization_memberships_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES app.responsibles(id) ON DELETE SET NULL;


--
-- Name: organization_memberships organization_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_memberships
    ADD CONSTRAINT organization_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organization_unit_business_models organization_unit_business_models_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_business_models
    ADD CONSTRAINT organization_unit_business_models_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: organization_unit_business_models organization_unit_business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_business_models
    ADD CONSTRAINT organization_unit_business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: organization_unit_business_models organization_unit_business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_business_models
    ADD CONSTRAINT organization_unit_business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_unit_business_models organization_unit_business_models_organization_unit_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_business_models
    ADD CONSTRAINT organization_unit_business_models_organization_unit_id_fkey FOREIGN KEY (organization_unit_id) REFERENCES app.organization_unit(id) ON DELETE CASCADE;


--
-- Name: organization_unit_industries organization_unit_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_industries
    ADD CONSTRAINT organization_unit_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: organization_unit_industries organization_unit_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_industries
    ADD CONSTRAINT organization_unit_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: organization_unit_industries organization_unit_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_industries
    ADD CONSTRAINT organization_unit_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_unit_industries organization_unit_industries_organization_unit_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit_industries
    ADD CONSTRAINT organization_unit_industries_organization_unit_id_fkey FOREIGN KEY (organization_unit_id) REFERENCES app.organization_unit(id) ON DELETE CASCADE;


--
-- Name: organization_unit organization_unit_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit
    ADD CONSTRAINT organization_unit_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_unit organization_unit_organization_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit
    ADD CONSTRAINT organization_unit_organization_unit_type_id_fkey FOREIGN KEY (organization_unit_type_id) REFERENCES app.organization_unit_type(id);


--
-- Name: organization_unit organization_unit_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.organization_unit
    ADD CONSTRAINT organization_unit_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.organization_unit(id) ON DELETE CASCADE;


--
-- Name: planning_cycles planning_cycles_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.planning_cycles
    ADD CONSTRAINT planning_cycles_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id);


--
-- Name: planning_cycles planning_cycles_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.planning_cycles
    ADD CONSTRAINT planning_cycles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: responsibility_assignments responsibility_assignments_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibility_assignments
    ADD CONSTRAINT responsibility_assignments_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: responsibility_assignments responsibility_assignments_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibility_assignments
    ADD CONSTRAINT responsibility_assignments_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES app.organization_memberships(id) ON DELETE CASCADE;


--
-- Name: responsibility_assignments responsibility_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibility_assignments
    ADD CONSTRAINT responsibility_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: responsible_assignments responsible_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_assignments
    ADD CONSTRAINT responsible_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: responsible_assignments responsible_assignments_organization_unit_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_assignments
    ADD CONSTRAINT responsible_assignments_organization_unit_id_fkey FOREIGN KEY (organization_unit_id) REFERENCES app.organization_unit(id) ON DELETE CASCADE;


--
-- Name: responsible_assignments responsible_assignments_responsible_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_assignments
    ADD CONSTRAINT responsible_assignments_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES app.responsibles(id) ON DELETE CASCADE;


--
-- Name: responsible_hierarchy responsible_hierarchy_manager_responsible_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_hierarchy
    ADD CONSTRAINT responsible_hierarchy_manager_responsible_id_fkey FOREIGN KEY (manager_responsible_id) REFERENCES app.responsibles(id) ON DELETE CASCADE;


--
-- Name: responsible_hierarchy responsible_hierarchy_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_hierarchy
    ADD CONSTRAINT responsible_hierarchy_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: responsible_hierarchy responsible_hierarchy_report_responsible_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsible_hierarchy
    ADD CONSTRAINT responsible_hierarchy_report_responsible_id_fkey FOREIGN KEY (report_responsible_id) REFERENCES app.responsibles(id) ON DELETE CASCADE;


--
-- Name: responsibles responsibles_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibles
    ADD CONSTRAINT responsibles_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: responsibles responsibles_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.responsibles
    ADD CONSTRAINT responsibles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: review_feedback review_feedback_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.review_feedback
    ADD CONSTRAINT review_feedback_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: review_feedback review_feedback_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.review_feedback
    ADD CONSTRAINT review_feedback_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: review_feedback review_feedback_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.review_feedback
    ADD CONSTRAINT review_feedback_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: review_snapshots review_snapshots_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.review_snapshots
    ADD CONSTRAINT review_snapshots_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: review_snapshots review_snapshots_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.review_snapshots
    ADD CONSTRAINT review_snapshots_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: review_snapshots review_snapshots_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.review_snapshots
    ADD CONSTRAINT review_snapshots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_business_models strategic_challenge_business_models_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_business_models
    ADD CONSTRAINT strategic_challenge_business_models_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_business_models strategic_challenge_business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_business_models
    ADD CONSTRAINT strategic_challenge_business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_business_models strategic_challenge_business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_business_models
    ADD CONSTRAINT strategic_challenge_business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_business_models strategic_challenge_business_models_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_business_models
    ADD CONSTRAINT strategic_challenge_business_models_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_business_models strategic_challenge_business_models_strategic_challenge_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_business_models
    ADD CONSTRAINT strategic_challenge_business_models_strategic_challenge_id_fkey FOREIGN KEY (strategic_challenge_id) REFERENCES app.strategic_challenges(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_industries strategic_challenge_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_industries
    ADD CONSTRAINT strategic_challenge_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_industries strategic_challenge_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_industries
    ADD CONSTRAINT strategic_challenge_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_industries strategic_challenge_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_industries
    ADD CONSTRAINT strategic_challenge_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_industries strategic_challenge_industries_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_industries
    ADD CONSTRAINT strategic_challenge_industries_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: strategic_challenge_industries strategic_challenge_industries_strategic_challenge_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenge_industries
    ADD CONSTRAINT strategic_challenge_industries_strategic_challenge_id_fkey FOREIGN KEY (strategic_challenge_id) REFERENCES app.strategic_challenges(id) ON DELETE CASCADE;


--
-- Name: strategic_challenges strategic_challenges_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenges
    ADD CONSTRAINT strategic_challenges_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategic_challenges strategic_challenges_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenges
    ADD CONSTRAINT strategic_challenges_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_challenges strategic_challenges_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenges
    ADD CONSTRAINT strategic_challenges_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_challenges strategic_challenges_source_analysis_entry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenges
    ADD CONSTRAINT strategic_challenges_source_analysis_entry_id_fkey FOREIGN KEY (source_analysis_entry_id) REFERENCES app.analysis_entries(id) ON DELETE SET NULL;


--
-- Name: strategic_challenges strategic_challenges_source_cluster_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_challenges
    ADD CONSTRAINT strategic_challenges_source_cluster_id_fkey FOREIGN KEY (source_cluster_id) REFERENCES app.analysis_clusters(id) ON DELETE SET NULL;


--
-- Name: strategic_context_cache strategic_context_cache_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_context_cache
    ADD CONSTRAINT strategic_context_cache_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_business_models strategic_direction_business_models_business_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_business_models
    ADD CONSTRAINT strategic_direction_business_models_business_model_id_fkey FOREIGN KEY (business_model_id) REFERENCES app.business_models(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_business_models strategic_direction_business_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_business_models
    ADD CONSTRAINT strategic_direction_business_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_business_models strategic_direction_business_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_business_models
    ADD CONSTRAINT strategic_direction_business_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_business_models strategic_direction_business_models_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_business_models
    ADD CONSTRAINT strategic_direction_business_models_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_cluster_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_cluster_links
    ADD CONSTRAINT strategic_direction_cluster_links_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES app.analysis_clusters(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_cluster_links
    ADD CONSTRAINT strategic_direction_cluster_links_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_cluster_links
    ADD CONSTRAINT strategic_direction_cluster_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_cluster_links
    ADD CONSTRAINT strategic_direction_cluster_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_cluster_links
    ADD CONSTRAINT strategic_direction_cluster_links_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_cluster_links
    ADD CONSTRAINT strategic_direction_cluster_links_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_cluster_objective_relation_i_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_gap_links
    ADD CONSTRAINT strategic_direction_gap_links_cluster_objective_relation_i_fkey FOREIGN KEY (cluster_objective_relation_id) REFERENCES app.cluster_objective_relations(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_gap_links
    ADD CONSTRAINT strategic_direction_gap_links_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_gap_links
    ADD CONSTRAINT strategic_direction_gap_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_gap_links
    ADD CONSTRAINT strategic_direction_gap_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_gap_links
    ADD CONSTRAINT strategic_direction_gap_links_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_gap_links
    ADD CONSTRAINT strategic_direction_gap_links_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_industries strategic_direction_industries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_industries
    ADD CONSTRAINT strategic_direction_industries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_industries strategic_direction_industries_industry_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_industries
    ADD CONSTRAINT strategic_direction_industries_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES app.industries(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_industries strategic_direction_industries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_industries
    ADD CONSTRAINT strategic_direction_industries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_industries strategic_direction_industries_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_industries
    ADD CONSTRAINT strategic_direction_industries_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_objective_links strategic_direction_objective_lin_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_objective_links
    ADD CONSTRAINT strategic_direction_objective_lin_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategic_direction_objective_links strategic_direction_objective_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_objective_links
    ADD CONSTRAINT strategic_direction_objective_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_objective_links strategic_direction_objective_links_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_objective_links
    ADD CONSTRAINT strategic_direction_objective_links_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_objective_links strategic_direction_objective_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_objective_links
    ADD CONSTRAINT strategic_direction_objective_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_objective_links strategic_direction_objective_links_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_objective_links
    ADD CONSTRAINT strategic_direction_objective_links_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_objective_links strategic_direction_objective_links_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_objective_links
    ADD CONSTRAINT strategic_direction_objective_links_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_operating_models strategic_direction_operating_model_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_operating_models
    ADD CONSTRAINT strategic_direction_operating_model_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_operating_models strategic_direction_operating_models_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_operating_models
    ADD CONSTRAINT strategic_direction_operating_models_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_operating_models strategic_direction_operating_models_operating_model_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_operating_models
    ADD CONSTRAINT strategic_direction_operating_models_operating_model_id_fkey FOREIGN KEY (operating_model_id) REFERENCES app.operating_models(id) ON DELETE CASCADE;


--
-- Name: strategic_direction_operating_models strategic_direction_operating_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_direction_operating_models
    ADD CONSTRAINT strategic_direction_operating_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_directions strategic_directions_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_directions
    ADD CONSTRAINT strategic_directions_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategic_directions strategic_directions_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_directions
    ADD CONSTRAINT strategic_directions_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_directions strategic_directions_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_directions
    ADD CONSTRAINT strategic_directions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_directions strategic_directions_owner_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_directions
    ADD CONSTRAINT strategic_directions_owner_membership_id_fkey FOREIGN KEY (owner_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategic_goals strategic_goals_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_goals
    ADD CONSTRAINT strategic_goals_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_goals strategic_goals_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_goals
    ADD CONSTRAINT strategic_goals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_goals strategic_goals_owner_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_goals
    ADD CONSTRAINT strategic_goals_owner_membership_id_fkey FOREIGN KEY (owner_membership_id) REFERENCES app.organization_memberships(id);


--
-- Name: strategic_metrics strategic_metrics_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_metrics
    ADD CONSTRAINT strategic_metrics_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategic_metrics strategic_metrics_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_metrics
    ADD CONSTRAINT strategic_metrics_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategic_metrics strategic_metrics_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_metrics
    ADD CONSTRAINT strategic_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategic_metrics strategic_metrics_owner_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategic_metrics
    ADD CONSTRAINT strategic_metrics_owner_membership_id_fkey FOREIGN KEY (owner_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overr_updated_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_correlation_status_overrides
    ADD CONSTRAINT strategy_correlation_status_overr_updated_by_membership_id_fkey FOREIGN KEY (updated_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrid_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_correlation_status_overrides
    ADD CONSTRAINT strategy_correlation_status_overrid_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE CASCADE;


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrides_challenge_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_correlation_status_overrides
    ADD CONSTRAINT strategy_correlation_status_overrides_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES app.strategic_challenges(id) ON DELETE CASCADE;


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrides_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_correlation_status_overrides
    ADD CONSTRAINT strategy_correlation_status_overrides_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrides_objective_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_correlation_status_overrides
    ADD CONSTRAINT strategy_correlation_status_overrides_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES app.objectives(id) ON DELETE CASCADE;


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrides_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_correlation_status_overrides
    ADD CONSTRAINT strategy_correlation_status_overrides_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrides_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_correlation_status_overrides
    ADD CONSTRAINT strategy_correlation_status_overrides_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: strategy_programs strategy_programs_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_programs
    ADD CONSTRAINT strategy_programs_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategy_programs strategy_programs_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_programs
    ADD CONSTRAINT strategy_programs_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategy_programs strategy_programs_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_programs
    ADD CONSTRAINT strategy_programs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategy_programs strategy_programs_owner_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_programs
    ADD CONSTRAINT strategy_programs_owner_membership_id_fkey FOREIGN KEY (owner_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: strategy_programs strategy_programs_planning_cycle_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_programs
    ADD CONSTRAINT strategy_programs_planning_cycle_id_fkey FOREIGN KEY (planning_cycle_id) REFERENCES app.planning_cycles(id) ON DELETE CASCADE;


--
-- Name: strategy_programs strategy_programs_strategic_challenge_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_programs
    ADD CONSTRAINT strategy_programs_strategic_challenge_id_fkey FOREIGN KEY (strategic_challenge_id) REFERENCES app.strategic_challenges(id) ON DELETE SET NULL;


--
-- Name: strategy_programs strategy_programs_strategic_direction_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_programs
    ADD CONSTRAINT strategy_programs_strategic_direction_id_fkey FOREIGN KEY (strategic_direction_id) REFERENCES app.strategic_directions(id) ON DELETE SET NULL;


--
-- Name: strategy_review_feedback_entries strategy_review_feedback_entries_actor_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_review_feedback_entries
    ADD CONSTRAINT strategy_review_feedback_entries_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES app.organization_memberships(id) ON DELETE CASCADE;


--
-- Name: strategy_review_feedback_entries strategy_review_feedback_entries_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_review_feedback_entries
    ADD CONSTRAINT strategy_review_feedback_entries_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: strategy_review_feedback_entries strategy_review_feedback_entries_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_review_feedback_entries
    ADD CONSTRAINT strategy_review_feedback_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: strategy_review_feedback_entries strategy_review_feedback_entries_review_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.strategy_review_feedback_entries
    ADD CONSTRAINT strategy_review_feedback_entries_review_id_fkey FOREIGN KEY (review_id) REFERENCES app.okr_reviews(id) ON DELETE CASCADE;


--
-- Name: target_metric_links target_metric_links_annual_target_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.target_metric_links
    ADD CONSTRAINT target_metric_links_annual_target_id_fkey FOREIGN KEY (annual_target_id) REFERENCES app.annual_targets(id) ON DELETE CASCADE;


--
-- Name: target_metric_links target_metric_links_cycle_instance_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.target_metric_links
    ADD CONSTRAINT target_metric_links_cycle_instance_id_fkey FOREIGN KEY (cycle_instance_id) REFERENCES app.cycle_instances(id) ON DELETE CASCADE;


--
-- Name: target_metric_links target_metric_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.target_metric_links
    ADD CONSTRAINT target_metric_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: target_metric_links target_metric_links_strategic_metric_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.target_metric_links
    ADD CONSTRAINT target_metric_links_strategic_metric_id_fkey FOREIGN KEY (strategic_metric_id) REFERENCES app.strategic_metrics(id) ON DELETE CASCADE;


--
-- Name: tenant_branding tenant_branding_created_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_branding
    ADD CONSTRAINT tenant_branding_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: tenant_branding tenant_branding_organization_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_branding
    ADD CONSTRAINT tenant_branding_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: tenant_branding tenant_branding_updated_by_membership_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tenant_branding
    ADD CONSTRAINT tenant_branding_updated_by_membership_id_fkey FOREIGN KEY (updated_by_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: revision_events revision_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.revision_events
    ADD CONSTRAINT revision_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: revision_events revision_events_revision_id_fkey; Type: FK CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.revision_events
    ADD CONSTRAINT revision_events_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES audit.revisions(id) ON DELETE CASCADE;


--
-- Name: revisions revisions_actor_membership_id_fkey; Type: FK CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.revisions
    ADD CONSTRAINT revisions_actor_membership_id_fkey FOREIGN KEY (actor_membership_id) REFERENCES app.organization_memberships(id) ON DELETE SET NULL;


--
-- Name: revisions revisions_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.revisions
    ADD CONSTRAINT revisions_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: revisions revisions_organization_id_fkey; Type: FK CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.revisions
    ADD CONSTRAINT revisions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: member_roles member_roles_membership_id_fkey; Type: FK CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.member_roles
    ADD CONSTRAINT member_roles_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES app.organization_memberships(id) ON DELETE CASCADE;


--
-- Name: member_roles member_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.member_roles
    ADD CONSTRAINT member_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES rbac.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES rbac.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES rbac.roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: rbac; Owner: -
--

ALTER TABLE ONLY rbac.roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: analysis_background_jobs; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.analysis_background_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_background_jobs analysis_background_jobs_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_background_jobs_modify ON app.analysis_background_jobs USING (app.has_permission(organization_id, 'nav.strategy-cycle.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.strategy-cycle.write'::text));


--
-- Name: analysis_background_jobs analysis_background_jobs_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_background_jobs_select ON app.analysis_background_jobs FOR SELECT USING (app.has_permission(organization_id, 'nav.strategy-cycle.read'::text));


--
-- Name: analysis_challenge_candidates; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.analysis_challenge_candidates ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_challenge_candidates analysis_challenge_candidates_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_challenge_candidates_modify ON app.analysis_challenge_candidates USING (app.has_permission(organization_id, 'nav.strategy-cycle.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.strategy-cycle.write'::text));


--
-- Name: analysis_challenge_candidates analysis_challenge_candidates_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_challenge_candidates_select ON app.analysis_challenge_candidates FOR SELECT USING (app.has_permission(organization_id, 'nav.strategy-cycle.read'::text));


--
-- Name: analysis_cluster_members; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.analysis_cluster_members ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_cluster_members analysis_cluster_members_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_cluster_members_modify ON app.analysis_cluster_members USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: analysis_cluster_members analysis_cluster_members_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_cluster_members_select ON app.analysis_cluster_members FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: analysis_clusters; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.analysis_clusters ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_clusters analysis_clusters_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_clusters_modify ON app.analysis_clusters USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: analysis_clusters analysis_clusters_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_clusters_select ON app.analysis_clusters FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: analysis_entries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.analysis_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_entries analysis_entries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_entries_modify ON app.analysis_entries USING ((app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text)));


--
-- Name: analysis_entries analysis_entries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_entries_select ON app.analysis_entries FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-matrix.read'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.read'::text)));


--
-- Name: analysis_gap_findings; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.analysis_gap_findings ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_gap_findings analysis_gap_findings_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_gap_findings_modify ON app.analysis_gap_findings USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: analysis_gap_findings analysis_gap_findings_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_gap_findings_select ON app.analysis_gap_findings FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: analysis_item_link; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.analysis_item_link ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_item_link_draft; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.analysis_item_link_draft ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_item_link_draft analysis_item_link_draft_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_item_link_draft_modify ON app.analysis_item_link_draft USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: analysis_item_link_draft analysis_item_link_draft_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_item_link_draft_select ON app.analysis_item_link_draft FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: analysis_item_link analysis_item_link_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_item_link_modify ON app.analysis_item_link USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: analysis_item_link analysis_item_link_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY analysis_item_link_select ON app.analysis_item_link FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: annual_target_business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.annual_target_business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: annual_target_business_models annual_target_business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY annual_target_business_models_modify ON app.annual_target_business_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: annual_target_business_models annual_target_business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY annual_target_business_models_select ON app.annual_target_business_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: annual_target_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.annual_target_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: annual_target_industries annual_target_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY annual_target_industries_modify ON app.annual_target_industries USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: annual_target_industries annual_target_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY annual_target_industries_select ON app.annual_target_industries FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: annual_target_operating_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.annual_target_operating_models ENABLE ROW LEVEL SECURITY;

--
-- Name: annual_target_operating_models annual_target_operating_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY annual_target_operating_models_modify ON app.annual_target_operating_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: annual_target_operating_models annual_target_operating_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY annual_target_operating_models_select ON app.annual_target_operating_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: annual_targets; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.annual_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: annual_targets annual_targets_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY annual_targets_modify ON app.annual_targets USING (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text));


--
-- Name: annual_targets annual_targets_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY annual_targets_select ON app.annual_targets FOR SELECT USING (app.has_permission(organization_id, 'nav.strategy-matrix.read'::text));


--
-- Name: business_model_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.business_model_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: business_model_industries business_model_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY business_model_industries_modify ON app.business_model_industries USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: business_model_industries business_model_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY business_model_industries_select ON app.business_model_industries FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: business_models business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY business_models_modify ON app.business_models USING (app.has_permission(organization_id, 'dimension.write'::text)) WITH CHECK (app.has_permission(organization_id, 'dimension.write'::text));


--
-- Name: business_models business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY business_models_select ON app.business_models FOR SELECT USING (app.has_permission(organization_id, 'dimension.read'::text));


--
-- Name: challenge_direction_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.challenge_direction_links ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_direction_links challenge_direction_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY challenge_direction_links_modify ON app.challenge_direction_links USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: challenge_direction_links challenge_direction_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY challenge_direction_links_select ON app.challenge_direction_links FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text) OR app.has_permission(organization_id, 'review.read'::text)));


--
-- Name: cluster_objective_relations; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.cluster_objective_relations ENABLE ROW LEVEL SECURITY;

--
-- Name: cluster_objective_relations cluster_objective_relations_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cluster_objective_relations_modify ON app.cluster_objective_relations USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: cluster_objective_relations cluster_objective_relations_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cluster_objective_relations_select ON app.cluster_objective_relations FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: cycle_cutover_snapshots; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.cycle_cutover_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_cutover_snapshots_modify ON app.cycle_cutover_snapshots USING (app.has_permission(organization_id, 'cycle_scheme.write'::text)) WITH CHECK (app.has_permission(organization_id, 'cycle_scheme.write'::text));


--
-- Name: cycle_cutover_snapshots cycle_cutover_snapshots_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_cutover_snapshots_select ON app.cycle_cutover_snapshots FOR SELECT USING (app.has_permission(organization_id, 'cycle_scheme.read'::text));


--
-- Name: cycle_cutovers; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.cycle_cutovers ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_cutovers cycle_cutovers_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_cutovers_modify ON app.cycle_cutovers USING (app.has_permission(organization_id, 'cycle_scheme.write'::text)) WITH CHECK (app.has_permission(organization_id, 'cycle_scheme.write'::text));


--
-- Name: cycle_cutovers cycle_cutovers_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_cutovers_select ON app.cycle_cutovers FOR SELECT USING (app.has_permission(organization_id, 'cycle_scheme.read'::text));


--
-- Name: cycle_instance_lock; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.cycle_instance_lock ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_instance_lock cycle_instance_lock_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_instance_lock_modify ON app.cycle_instance_lock USING ((EXISTS ( SELECT 1
   FROM app.cycle_instances i
  WHERE ((i.id = cycle_instance_lock.cycle_instance_id) AND app.has_permission(i.organization_id, 'cycle_scheme.write'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM app.cycle_instances i
  WHERE ((i.id = cycle_instance_lock.cycle_instance_id) AND app.has_permission(i.organization_id, 'cycle_scheme.write'::text)))));


--
-- Name: cycle_instance_lock cycle_instance_lock_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_instance_lock_select ON app.cycle_instance_lock FOR SELECT USING ((EXISTS ( SELECT 1
   FROM app.cycle_instances i
  WHERE ((i.id = cycle_instance_lock.cycle_instance_id) AND app.has_permission(i.organization_id, 'cycle_scheme.read'::text)))));


--
-- Name: cycle_instance_portfolio_evaluation cycle_instance_portfolio_eval_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_instance_portfolio_eval_modify ON app.cycle_instance_portfolio_evaluation USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: cycle_instance_portfolio_evaluation cycle_instance_portfolio_eval_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_instance_portfolio_eval_select ON app.cycle_instance_portfolio_evaluation FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: cycle_instance_portfolio_evaluation; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.cycle_instance_portfolio_evaluation ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_instances; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.cycle_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_instances cycle_instances_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_instances_modify ON app.cycle_instances USING (app.has_permission(organization_id, 'cycle_scheme.write'::text)) WITH CHECK (app.has_permission(organization_id, 'cycle_scheme.write'::text));


--
-- Name: cycle_instances cycle_instances_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_instances_select ON app.cycle_instances FOR SELECT USING (app.has_permission(organization_id, 'cycle_scheme.read'::text));


--
-- Name: cycle_scheme_levels; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.cycle_scheme_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_scheme_levels cycle_scheme_levels_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_scheme_levels_modify ON app.cycle_scheme_levels USING ((EXISTS ( SELECT 1
   FROM app.cycle_schemes s
  WHERE ((s.id = cycle_scheme_levels.cycle_scheme_id) AND app.has_permission(s.organization_id, 'cycle_scheme.write'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM app.cycle_schemes s
  WHERE ((s.id = cycle_scheme_levels.cycle_scheme_id) AND app.has_permission(s.organization_id, 'cycle_scheme.write'::text)))));


--
-- Name: cycle_scheme_levels cycle_scheme_levels_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_scheme_levels_select ON app.cycle_scheme_levels FOR SELECT USING ((EXISTS ( SELECT 1
   FROM app.cycle_schemes s
  WHERE ((s.id = cycle_scheme_levels.cycle_scheme_id) AND app.has_permission(s.organization_id, 'cycle_scheme.read'::text)))));


--
-- Name: cycle_schemes; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.cycle_schemes ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_schemes cycle_schemes_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_schemes_modify ON app.cycle_schemes USING (app.has_permission(organization_id, 'cycle_scheme.write'::text)) WITH CHECK (app.has_permission(organization_id, 'cycle_scheme.write'::text));


--
-- Name: cycle_schemes cycle_schemes_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY cycle_schemes_select ON app.cycle_schemes FOR SELECT USING (app.has_permission(organization_id, 'cycle_scheme.read'::text));


--
-- Name: dashboard_column_config; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.dashboard_column_config ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_column_config dashboard_column_config_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY dashboard_column_config_modify ON app.dashboard_column_config USING (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text));


--
-- Name: dashboard_column_config dashboard_column_config_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY dashboard_column_config_select ON app.dashboard_column_config FOR SELECT USING (app.has_permission(organization_id, 'nav.strategy-matrix.read'::text));


--
-- Name: dashboard_comments; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.dashboard_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_comments dashboard_comments_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY dashboard_comments_modify ON app.dashboard_comments USING (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text));


--
-- Name: dashboard_comments dashboard_comments_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY dashboard_comments_select ON app.dashboard_comments FOR SELECT USING (app.has_permission(organization_id, 'nav.strategy-matrix.read'::text));


--
-- Name: dashboard_row_config; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.dashboard_row_config ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_row_config dashboard_row_config_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY dashboard_row_config_modify ON app.dashboard_row_config USING (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text));


--
-- Name: dashboard_row_config dashboard_row_config_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY dashboard_row_config_select ON app.dashboard_row_config FOR SELECT USING (app.has_permission(organization_id, 'nav.strategy-matrix.read'::text));


--
-- Name: direction_metric_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.direction_metric_links ENABLE ROW LEVEL SECURITY;

--
-- Name: direction_metric_links direction_metric_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY direction_metric_links_modify ON app.direction_metric_links USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: direction_metric_links direction_metric_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY direction_metric_links_select ON app.direction_metric_links FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: entity_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.entity_links ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_links entity_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY entity_links_modify ON app.entity_links USING (app.has_permission(organization_id, 'link.write'::text)) WITH CHECK (app.has_permission(organization_id, 'link.write'::text));


--
-- Name: entity_links entity_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY entity_links_select ON app.entity_links FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: functional_strategies; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.functional_strategies ENABLE ROW LEVEL SECURITY;

--
-- Name: functional_strategies functional_strategies_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY functional_strategies_modify ON app.functional_strategies USING (app.has_permission(organization_id, 'strategy.write'::text)) WITH CHECK (app.has_permission(organization_id, 'strategy.write'::text));


--
-- Name: functional_strategies functional_strategies_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY functional_strategies_select ON app.functional_strategies FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.industries ENABLE ROW LEVEL SECURITY;

--
-- Name: industries industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY industries_modify ON app.industries USING (app.has_permission(organization_id, 'dimension.write'::text)) WITH CHECK (app.has_permission(organization_id, 'dimension.write'::text));


--
-- Name: industries industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY industries_select ON app.industries FOR SELECT USING (app.has_permission(organization_id, 'dimension.read'::text));


--
-- Name: initiative_business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.initiative_business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: initiative_business_models initiative_business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_business_models_modify ON app.initiative_business_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: initiative_business_models initiative_business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_business_models_select ON app.initiative_business_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: initiative_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.initiative_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: initiative_industries initiative_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_industries_modify ON app.initiative_industries USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: initiative_industries initiative_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_industries_select ON app.initiative_industries FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: initiative_key_result_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.initiative_key_result_links ENABLE ROW LEVEL SECURITY;

--
-- Name: initiative_key_result_links initiative_key_result_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_key_result_links_modify ON app.initiative_key_result_links USING ((app.has_permission(organization_id, 'traceability.write'::text) OR app.has_permission(organization_id, 'okr.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'traceability.write'::text) OR app.has_permission(organization_id, 'okr.write'::text)));


--
-- Name: initiative_key_result_links initiative_key_result_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_key_result_links_select ON app.initiative_key_result_links FOR SELECT USING ((app.has_permission(organization_id, 'traceability.read'::text) OR app.has_permission(organization_id, 'okr.read'::text)));


--
-- Name: initiative_operating_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.initiative_operating_models ENABLE ROW LEVEL SECURITY;

--
-- Name: initiative_operating_models initiative_operating_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_operating_models_modify ON app.initiative_operating_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: initiative_operating_models initiative_operating_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_operating_models_select ON app.initiative_operating_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: initiative_target_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.initiative_target_links ENABLE ROW LEVEL SECURITY;

--
-- Name: initiative_target_links initiative_target_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_target_links_modify ON app.initiative_target_links USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: initiative_target_links initiative_target_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiative_target_links_select ON app.initiative_target_links FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: initiatives; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.initiatives ENABLE ROW LEVEL SECURITY;

--
-- Name: initiatives initiatives_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiatives_modify ON app.initiatives USING (app.has_permission(organization_id, 'initiative.write'::text)) WITH CHECK (app.has_permission(organization_id, 'initiative.write'::text));


--
-- Name: initiatives initiatives_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY initiatives_select ON app.initiatives FOR SELECT USING ((app.has_permission(organization_id, 'initiative.read'::text) OR app.has_permission(organization_id, 'review.read'::text)));


--
-- Name: key_result_business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.key_result_business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: key_result_business_models key_result_business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_result_business_models_modify ON app.key_result_business_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: key_result_business_models key_result_business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_result_business_models_select ON app.key_result_business_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: key_result_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.key_result_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: key_result_industries key_result_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_result_industries_modify ON app.key_result_industries USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: key_result_industries key_result_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_result_industries_select ON app.key_result_industries FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: key_result_operating_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.key_result_operating_models ENABLE ROW LEVEL SECURITY;

--
-- Name: key_result_operating_models key_result_operating_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_result_operating_models_modify ON app.key_result_operating_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: key_result_operating_models key_result_operating_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_result_operating_models_select ON app.key_result_operating_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: key_result_target_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.key_result_target_links ENABLE ROW LEVEL SECURITY;

--
-- Name: key_result_target_links key_result_target_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_result_target_links_modify ON app.key_result_target_links USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: key_result_target_links key_result_target_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_result_target_links_select ON app.key_result_target_links FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: key_results; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.key_results ENABLE ROW LEVEL SECURITY;

--
-- Name: key_results key_results_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_results_modify ON app.key_results USING (app.has_permission(organization_id, 'okr.write'::text)) WITH CHECK (app.has_permission(organization_id, 'okr.write'::text));


--
-- Name: key_results key_results_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY key_results_select ON app.key_results FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: llm_model_health_status; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.llm_model_health_status ENABLE ROW LEVEL SECURITY;

--
-- Name: llm_model_health_status llm_model_health_status_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY llm_model_health_status_modify ON app.llm_model_health_status USING (app.has_permission(organization_id, 'nav.llm-usage.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.llm-usage.write'::text));


--
-- Name: llm_model_health_status llm_model_health_status_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY llm_model_health_status_select ON app.llm_model_health_status FOR SELECT USING (app.has_permission(organization_id, 'nav.llm-usage.read'::text));


--
-- Name: llm_usage_events; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.llm_usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: llm_usage_events llm_usage_events_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY llm_usage_events_modify ON app.llm_usage_events USING (app.has_permission(organization_id, 'nav.llm-usage.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.llm-usage.write'::text));


--
-- Name: llm_usage_events llm_usage_events_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY llm_usage_events_select ON app.llm_usage_events FOR SELECT USING (app.has_permission(organization_id, 'nav.llm-usage.read'::text));


--
-- Name: member_invitations; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.member_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: member_invitations member_invitations_admin_manage; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY member_invitations_admin_manage ON app.member_invitations USING (app.has_permission(organization_id, 'membership.manage'::text)) WITH CHECK (app.has_permission(organization_id, 'membership.manage'::text));


--
-- Name: member_invitations member_invitations_invitee_accept; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY member_invitations_invitee_accept ON app.member_invitations FOR UPDATE USING (((lower(invited_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (status = 'pending'::text))) WITH CHECK (((lower(invited_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (status = ANY (ARRAY['pending'::text, 'accepted'::text]))));


--
-- Name: member_invitations member_invitations_invitee_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY member_invitations_invitee_select ON app.member_invitations FOR SELECT USING ((lower(invited_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: organization_memberships memberships_delete; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY memberships_delete ON app.organization_memberships FOR DELETE USING (app.has_permission(organization_id, 'membership.manage'::text));


--
-- Name: organization_memberships memberships_insert; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY memberships_insert ON app.organization_memberships FOR INSERT WITH CHECK (app.has_permission(organization_id, 'membership.manage'::text));


--
-- Name: organization_memberships memberships_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY memberships_select ON app.organization_memberships FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: organization_memberships memberships_update; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY memberships_update ON app.organization_memberships FOR UPDATE USING (app.has_permission(organization_id, 'membership.manage'::text)) WITH CHECK (app.has_permission(organization_id, 'membership.manage'::text));


--
-- Name: objective_business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.objective_business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: objective_business_models objective_business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_business_models_modify ON app.objective_business_models USING ((app.has_permission(organization_id, 'traceability.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'traceability.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: objective_business_models objective_business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_business_models_select ON app.objective_business_models FOR SELECT USING ((app.has_permission(organization_id, 'traceability.read'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: objective_direction_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.objective_direction_links ENABLE ROW LEVEL SECURITY;

--
-- Name: objective_direction_links objective_direction_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_direction_links_modify ON app.objective_direction_links USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: objective_direction_links objective_direction_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_direction_links_select ON app.objective_direction_links FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: objective_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.objective_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: objective_industries objective_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_industries_modify ON app.objective_industries USING ((app.has_permission(organization_id, 'traceability.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'traceability.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: objective_industries objective_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_industries_select ON app.objective_industries FOR SELECT USING ((app.has_permission(organization_id, 'traceability.read'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: objective_operating_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.objective_operating_models ENABLE ROW LEVEL SECURITY;

--
-- Name: objective_operating_models objective_operating_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_operating_models_modify ON app.objective_operating_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: objective_operating_models objective_operating_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_operating_models_select ON app.objective_operating_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: objective_target_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.objective_target_links ENABLE ROW LEVEL SECURITY;

--
-- Name: objective_target_links objective_target_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_target_links_modify ON app.objective_target_links USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: objective_target_links objective_target_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objective_target_links_select ON app.objective_target_links FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: objectives; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.objectives ENABLE ROW LEVEL SECURITY;

--
-- Name: objectives objectives_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objectives_modify ON app.objectives USING ((app.has_permission(organization_id, 'okr.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'okr.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: objectives objectives_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY objectives_select ON app.objectives FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: okr_cycles; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.okr_cycles ENABLE ROW LEVEL SECURITY;

--
-- Name: okr_cycles okr_cycles_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY okr_cycles_modify ON app.okr_cycles USING (app.has_permission(organization_id, 'okr.write'::text)) WITH CHECK (app.has_permission(organization_id, 'okr.write'::text));


--
-- Name: okr_cycles okr_cycles_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY okr_cycles_select ON app.okr_cycles FOR SELECT USING (app.has_permission(organization_id, 'okr.read'::text));


--
-- Name: okr_reviews; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.okr_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: okr_reviews okr_reviews_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY okr_reviews_modify ON app.okr_reviews USING (app.has_permission(organization_id, 'review.write'::text)) WITH CHECK (app.has_permission(organization_id, 'review.write'::text));


--
-- Name: okr_reviews okr_reviews_modify_okr_write; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY okr_reviews_modify_okr_write ON app.okr_reviews USING (app.has_permission(organization_id, 'okr.write'::text)) WITH CHECK (app.has_permission(organization_id, 'okr.write'::text));


--
-- Name: okr_reviews okr_reviews_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY okr_reviews_select ON app.okr_reviews FOR SELECT USING (app.has_permission(organization_id, 'review.read'::text));


--
-- Name: okr_reviews okr_reviews_select_okr_read; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY okr_reviews_select_okr_read ON app.okr_reviews FOR SELECT USING (app.has_permission(organization_id, 'okr.read'::text));


--
-- Name: okr_updates; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.okr_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: okr_updates okr_updates_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY okr_updates_modify ON app.okr_updates USING (app.has_permission(organization_id, 'okr.write'::text)) WITH CHECK (app.has_permission(organization_id, 'okr.write'::text));


--
-- Name: okr_updates okr_updates_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY okr_updates_select ON app.okr_updates FOR SELECT USING (app.has_permission(organization_id, 'okr.read'::text));


--
-- Name: operating_model_business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.operating_model_business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: operating_model_business_models operating_model_business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY operating_model_business_models_modify ON app.operating_model_business_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: operating_model_business_models operating_model_business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY operating_model_business_models_select ON app.operating_model_business_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: operating_model_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.operating_model_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: operating_model_industries operating_model_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY operating_model_industries_modify ON app.operating_model_industries USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: operating_model_industries operating_model_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY operating_model_industries_select ON app.operating_model_industries FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: operating_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.operating_models ENABLE ROW LEVEL SECURITY;

--
-- Name: operating_models operating_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY operating_models_modify ON app.operating_models USING (app.has_permission(organization_id, 'dimension.write'::text)) WITH CHECK (app.has_permission(organization_id, 'dimension.write'::text));


--
-- Name: operating_models operating_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY operating_models_select ON app.operating_models FOR SELECT USING (app.has_permission(organization_id, 'dimension.read'::text));


--
-- Name: organization_memberships; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.organization_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_unit; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.organization_unit ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_unit_business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.organization_unit_business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_unit_business_models organization_unit_business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organization_unit_business_models_modify ON app.organization_unit_business_models USING (app.has_permission(organization_id, 'dimension.write'::text)) WITH CHECK (app.has_permission(organization_id, 'dimension.write'::text));


--
-- Name: organization_unit_business_models organization_unit_business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organization_unit_business_models_select ON app.organization_unit_business_models FOR SELECT USING (app.has_permission(organization_id, 'dimension.read'::text));


--
-- Name: organization_unit_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.organization_unit_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_unit_industries organization_unit_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organization_unit_industries_modify ON app.organization_unit_industries USING (app.has_permission(organization_id, 'dimension.write'::text)) WITH CHECK (app.has_permission(organization_id, 'dimension.write'::text));


--
-- Name: organization_unit_industries organization_unit_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organization_unit_industries_select ON app.organization_unit_industries FOR SELECT USING (app.has_permission(organization_id, 'dimension.read'::text));


--
-- Name: organization_unit organization_unit_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organization_unit_modify ON app.organization_unit USING (app.has_permission(organization_id, 'org_unit.manage'::text)) WITH CHECK (app.has_permission(organization_id, 'org_unit.manage'::text));


--
-- Name: organization_unit organization_unit_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organization_unit_select ON app.organization_unit FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: organizations; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_insert; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organizations_insert ON app.organizations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: organizations organizations_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organizations_select ON app.organizations FOR SELECT USING (app.is_member_of_org(id));


--
-- Name: organizations organizations_update; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY organizations_update ON app.organizations FOR UPDATE USING (app.has_permission(id, 'org.manage'::text)) WITH CHECK (app.has_permission(id, 'org.manage'::text));


--
-- Name: planning_cycles; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.planning_cycles ENABLE ROW LEVEL SECURITY;

--
-- Name: planning_cycles planning_cycles_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY planning_cycles_modify ON app.planning_cycles USING (app.has_permission(organization_id, 'cycle.write'::text)) WITH CHECK (app.has_permission(organization_id, 'cycle.write'::text));


--
-- Name: planning_cycles planning_cycles_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY planning_cycles_select ON app.planning_cycles FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: responsibility_assignments; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.responsibility_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: responsibility_assignments responsibility_assignments_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY responsibility_assignments_modify ON app.responsibility_assignments USING (app.has_permission(organization_id, 'admin.manage_roles'::text)) WITH CHECK (app.has_permission(organization_id, 'admin.manage_roles'::text));


--
-- Name: responsibility_assignments responsibility_assignments_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY responsibility_assignments_select ON app.responsibility_assignments FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: responsible_assignments; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.responsible_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: responsible_assignments responsible_assignments_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY responsible_assignments_modify ON app.responsible_assignments USING (app.has_permission(organization_id, 'responsible.manage'::text)) WITH CHECK (app.has_permission(organization_id, 'responsible.manage'::text));


--
-- Name: responsible_assignments responsible_assignments_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY responsible_assignments_select ON app.responsible_assignments FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: responsible_hierarchy; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.responsible_hierarchy ENABLE ROW LEVEL SECURITY;

--
-- Name: responsible_hierarchy responsible_hierarchy_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY responsible_hierarchy_modify ON app.responsible_hierarchy USING (app.has_permission(organization_id, 'responsible.manage'::text)) WITH CHECK (app.has_permission(organization_id, 'responsible.manage'::text));


--
-- Name: responsible_hierarchy responsible_hierarchy_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY responsible_hierarchy_select ON app.responsible_hierarchy FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: responsibles; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.responsibles ENABLE ROW LEVEL SECURITY;

--
-- Name: responsibles responsibles_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY responsibles_modify ON app.responsibles USING (app.has_permission(organization_id, 'responsible.manage'::text)) WITH CHECK (app.has_permission(organization_id, 'responsible.manage'::text));


--
-- Name: responsibles responsibles_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY responsibles_select ON app.responsibles FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: review_feedback; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.review_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: review_feedback review_feedback_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY review_feedback_modify ON app.review_feedback USING (app.has_permission(organization_id, 'review.write'::text)) WITH CHECK (app.has_permission(organization_id, 'review.write'::text));


--
-- Name: review_feedback review_feedback_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY review_feedback_select ON app.review_feedback FOR SELECT USING (app.has_permission(organization_id, 'review.read'::text));


--
-- Name: review_snapshots; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.review_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: review_snapshots review_snapshots_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY review_snapshots_modify ON app.review_snapshots USING (app.has_permission(organization_id, 'review.write'::text)) WITH CHECK (app.has_permission(organization_id, 'review.write'::text));


--
-- Name: review_snapshots review_snapshots_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY review_snapshots_select ON app.review_snapshots FOR SELECT USING (app.has_permission(organization_id, 'review.read'::text));


--
-- Name: strategic_challenge_business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_challenge_business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_challenge_business_models strategic_challenge_business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_challenge_business_models_modify ON app.strategic_challenge_business_models USING ((app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text)));


--
-- Name: strategic_challenge_business_models strategic_challenge_business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_challenge_business_models_select ON app.strategic_challenge_business_models FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-matrix.read'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.read'::text)));


--
-- Name: strategic_challenge_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_challenge_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_challenge_industries strategic_challenge_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_challenge_industries_modify ON app.strategic_challenge_industries USING ((app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text)));


--
-- Name: strategic_challenge_industries strategic_challenge_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_challenge_industries_select ON app.strategic_challenge_industries FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-matrix.read'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.read'::text)));


--
-- Name: strategic_challenges; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_challenges strategic_challenges_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_challenges_modify ON app.strategic_challenges USING ((app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.write'::text)));


--
-- Name: strategic_challenges strategic_challenges_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_challenges_select ON app.strategic_challenges FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-matrix.read'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.read'::text)));


--
-- Name: strategic_context_cache; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_context_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_context_cache strategic_context_cache_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_context_cache_modify ON app.strategic_context_cache USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: strategic_context_cache strategic_context_cache_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_context_cache_select ON app.strategic_context_cache FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: strategic_direction_business_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_direction_business_models ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_direction_business_models strategic_direction_business_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_business_models_modify ON app.strategic_direction_business_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: strategic_direction_business_models strategic_direction_business_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_business_models_select ON app.strategic_direction_business_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: strategic_direction_cluster_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_direction_cluster_links ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_cluster_links_modify ON app.strategic_direction_cluster_links USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: strategic_direction_cluster_links strategic_direction_cluster_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_cluster_links_select ON app.strategic_direction_cluster_links FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: strategic_direction_gap_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_direction_gap_links ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_gap_links_modify ON app.strategic_direction_gap_links USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: strategic_direction_gap_links strategic_direction_gap_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_gap_links_select ON app.strategic_direction_gap_links FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: strategic_direction_industries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_direction_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_direction_industries strategic_direction_industries_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_industries_modify ON app.strategic_direction_industries USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: strategic_direction_industries strategic_direction_industries_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_industries_select ON app.strategic_direction_industries FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: strategic_direction_objective_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_direction_objective_links ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_direction_objective_links strategic_direction_objective_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_objective_links_modify ON app.strategic_direction_objective_links USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'okr.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text) OR app.has_permission(organization_id, 'okr.write'::text)));


--
-- Name: strategic_direction_objective_links strategic_direction_objective_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_objective_links_select ON app.strategic_direction_objective_links FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text) OR app.has_permission(organization_id, 'review.read'::text) OR app.has_permission(organization_id, 'okr.read'::text)));


--
-- Name: strategic_direction_operating_models; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_direction_operating_models ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_direction_operating_models strategic_direction_operating_models_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_operating_models_modify ON app.strategic_direction_operating_models USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: strategic_direction_operating_models strategic_direction_operating_models_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_direction_operating_models_select ON app.strategic_direction_operating_models FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: strategic_directions; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_directions ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_directions strategic_directions_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_directions_modify ON app.strategic_directions USING (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)) WITH CHECK (app.has_permission(organization_id, 'nav.strategy-matrix.write'::text));


--
-- Name: strategic_directions strategic_directions_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_directions_select ON app.strategic_directions FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-matrix.read'::text) OR app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'review.read'::text)));


--
-- Name: strategic_goals; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_goals strategic_goals_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_goals_modify ON app.strategic_goals USING (app.has_permission(organization_id, 'goal.write'::text)) WITH CHECK (app.has_permission(organization_id, 'goal.write'::text));


--
-- Name: strategic_goals strategic_goals_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_goals_select ON app.strategic_goals FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: strategic_metrics; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategic_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_metrics strategic_metrics_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_metrics_modify ON app.strategic_metrics USING (app.has_permission(organization_id, 'metric.write'::text)) WITH CHECK (app.has_permission(organization_id, 'metric.write'::text));


--
-- Name: strategic_metrics strategic_metrics_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategic_metrics_select ON app.strategic_metrics FOR SELECT USING (app.has_permission(organization_id, 'metric.read'::text));


--
-- Name: strategy_correlation_status_overrides; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategy_correlation_status_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrides_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategy_correlation_status_overrides_modify ON app.strategy_correlation_status_overrides USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: strategy_correlation_status_overrides strategy_correlation_status_overrides_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategy_correlation_status_overrides_select ON app.strategy_correlation_status_overrides FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text)));


--
-- Name: strategy_programs; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategy_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: strategy_programs strategy_programs_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategy_programs_modify ON app.strategy_programs USING ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text))) WITH CHECK ((app.has_permission(organization_id, 'nav.strategy-cycle.write'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.write'::text)));


--
-- Name: strategy_programs strategy_programs_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategy_programs_select ON app.strategy_programs FOR SELECT USING ((app.has_permission(organization_id, 'nav.strategy-cycle.read'::text) OR app.has_permission(organization_id, 'nav.strategy-matrix.read'::text) OR app.has_permission(organization_id, 'review.read'::text)));


--
-- Name: strategy_review_feedback_entries strategy_review_feedback_delete; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategy_review_feedback_delete ON app.strategy_review_feedback_entries FOR DELETE USING (app.has_permission(organization_id, 'strategy_review.moderate'::text));


--
-- Name: strategy_review_feedback_entries; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.strategy_review_feedback_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: strategy_review_feedback_entries strategy_review_feedback_insert; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategy_review_feedback_insert ON app.strategy_review_feedback_entries FOR INSERT WITH CHECK ((app.has_permission(organization_id, 'strategy_review.feedback'::text) AND (actor_id IN ( SELECT m.id
   FROM app.organization_memberships m
  WHERE ((m.organization_id = strategy_review_feedback_entries.organization_id) AND (m.user_id = auth.uid()) AND (m.status = 'active'::text))))));


--
-- Name: strategy_review_feedback_entries strategy_review_feedback_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategy_review_feedback_select ON app.strategy_review_feedback_entries FOR SELECT USING (app.has_permission(organization_id, 'review.read'::text));


--
-- Name: strategy_review_feedback_entries strategy_review_feedback_update; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY strategy_review_feedback_update ON app.strategy_review_feedback_entries FOR UPDATE USING ((app.has_permission(organization_id, 'strategy_review.feedback'::text) AND (actor_id IN ( SELECT m.id
   FROM app.organization_memberships m
  WHERE ((m.organization_id = strategy_review_feedback_entries.organization_id) AND (m.user_id = auth.uid()) AND (m.status = 'active'::text))))));


--
-- Name: target_metric_links; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.target_metric_links ENABLE ROW LEVEL SECURITY;

--
-- Name: target_metric_links target_metric_links_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY target_metric_links_modify ON app.target_metric_links USING (app.has_permission(organization_id, 'traceability.write'::text)) WITH CHECK (app.has_permission(organization_id, 'traceability.write'::text));


--
-- Name: target_metric_links target_metric_links_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY target_metric_links_select ON app.target_metric_links FOR SELECT USING (app.has_permission(organization_id, 'traceability.read'::text));


--
-- Name: tenant_branding; Type: ROW SECURITY; Schema: app; Owner: -
--

ALTER TABLE app.tenant_branding ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_branding tenant_branding_modify; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY tenant_branding_modify ON app.tenant_branding USING (app.has_permission(organization_id, 'admin.manage_branding'::text)) WITH CHECK (app.has_permission(organization_id, 'admin.manage_branding'::text));


--
-- Name: tenant_branding tenant_branding_select; Type: POLICY; Schema: app; Owner: -
--

CREATE POLICY tenant_branding_select ON app.tenant_branding FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: revision_events; Type: ROW SECURITY; Schema: audit; Owner: -
--

ALTER TABLE audit.revision_events ENABLE ROW LEVEL SECURITY;

--
-- Name: revision_events revision_events_insert; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY revision_events_insert ON audit.revision_events FOR INSERT WITH CHECK (true);


--
-- Name: revision_events revision_events_select; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY revision_events_select ON audit.revision_events FOR SELECT USING (((organization_id IS NOT NULL) AND app.is_member_of_org(organization_id) AND app.has_permission(organization_id, 'audit.read'::text)));


--
-- Name: revisions; Type: ROW SECURITY; Schema: audit; Owner: -
--

ALTER TABLE audit.revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: revisions revisions_insert; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY revisions_insert ON audit.revisions FOR INSERT WITH CHECK (true);


--
-- Name: revisions revisions_select; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY revisions_select ON audit.revisions FOR SELECT USING (((organization_id IS NOT NULL) AND app.is_member_of_org(organization_id) AND app.has_permission(organization_id, 'audit.read'::text)));


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: member_roles; Type: ROW SECURITY; Schema: rbac; Owner: -
--

ALTER TABLE rbac.member_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: member_roles member_roles_delete; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY member_roles_delete ON rbac.member_roles FOR DELETE USING ((EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.id = member_roles.membership_id) AND app.has_permission(m.organization_id, 'admin.manage_roles'::text)))));


--
-- Name: member_roles member_roles_insert; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY member_roles_insert ON rbac.member_roles FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.id = member_roles.membership_id) AND app.has_permission(m.organization_id, 'admin.manage_roles'::text)))));


--
-- Name: member_roles member_roles_select; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY member_roles_select ON rbac.member_roles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.id = member_roles.membership_id) AND app.is_member_of_org(m.organization_id)))));


--
-- Name: permissions; Type: ROW SECURITY; Schema: rbac; Owner: -
--

ALTER TABLE rbac.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions_select; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY permissions_select ON rbac.permissions FOR SELECT TO authenticated USING (true);


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: rbac; Owner: -
--

ALTER TABLE rbac.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_permissions_delete; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY role_permissions_delete ON rbac.role_permissions FOR DELETE USING ((EXISTS ( SELECT 1
   FROM rbac.roles r
  WHERE ((r.id = role_permissions.role_id) AND app.has_permission(r.organization_id, 'admin.manage_roles'::text)))));


--
-- Name: role_permissions role_permissions_insert; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY role_permissions_insert ON rbac.role_permissions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM rbac.roles r
  WHERE ((r.id = role_permissions.role_id) AND app.has_permission(r.organization_id, 'admin.manage_roles'::text)))));


--
-- Name: role_permissions role_permissions_select; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY role_permissions_select ON rbac.role_permissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM rbac.roles r
  WHERE ((r.id = role_permissions.role_id) AND app.is_member_of_org(r.organization_id)))));


--
-- Name: roles; Type: ROW SECURITY; Schema: rbac; Owner: -
--

ALTER TABLE rbac.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_delete; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY roles_delete ON rbac.roles FOR DELETE USING (app.has_permission(organization_id, 'admin.manage_roles'::text));


--
-- Name: roles roles_insert; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY roles_insert ON rbac.roles FOR INSERT WITH CHECK (app.has_permission(organization_id, 'admin.manage_roles'::text));


--
-- Name: roles roles_select; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY roles_select ON rbac.roles FOR SELECT USING (app.is_member_of_org(organization_id));


--
-- Name: roles roles_update; Type: POLICY; Schema: rbac; Owner: -
--

CREATE POLICY roles_update ON rbac.roles FOR UPDATE USING (app.has_permission(organization_id, 'admin.manage_roles'::text)) WITH CHECK (app.has_permission(organization_id, 'admin.manage_roles'::text));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: objects tenant_ai_logs_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY tenant_ai_logs_delete ON storage.objects FOR DELETE USING (((bucket_id = 'tenant-ai-logs'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text))))));


--
-- Name: objects tenant_ai_logs_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY tenant_ai_logs_insert ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'tenant-ai-logs'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text))))));


--
-- Name: objects tenant_ai_logs_select; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY tenant_ai_logs_select ON storage.objects FOR SELECT USING (((bucket_id = 'tenant-ai-logs'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text))))));


--
-- Name: objects tenant_ai_logs_update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY tenant_ai_logs_update ON storage.objects FOR UPDATE USING (((bucket_id = 'tenant-ai-logs'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text)))))) WITH CHECK (((bucket_id = 'tenant-ai-logs'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text))))));


--
-- Name: objects tenant_branding_logo_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY tenant_branding_logo_delete ON storage.objects FOR DELETE USING (((bucket_id = 'tenant-branding'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text))))));


--
-- Name: objects tenant_branding_logo_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY tenant_branding_logo_insert ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'tenant-branding'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text))))));


--
-- Name: objects tenant_branding_logo_select; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY tenant_branding_logo_select ON storage.objects FOR SELECT USING (((bucket_id = 'tenant-branding'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text))))));


--
-- Name: objects tenant_branding_logo_update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY tenant_branding_logo_update ON storage.objects FOR UPDATE USING (((bucket_id = 'tenant-branding'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text)))))) WITH CHECK (((bucket_id = 'tenant-branding'::text) AND (split_part(name, '/'::text, 1) = 'organizations'::text) AND (EXISTS ( SELECT 1
   FROM app.organization_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.status = 'active'::text) AND (split_part(objects.name, '/'::text, 2) = (m.organization_id)::text))))));


--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('0001'),
    ('0002'),
    ('0003'),
    ('0004'),
    ('0005'),
    ('0006'),
    ('0007'),
    ('0008'),
    ('0009'),
    ('001'),
    ('0010'),
    ('0011'),
    ('0012'),
    ('0013'),
    ('0014'),
    ('0015'),
    ('0016'),
    ('0017'),
    ('0018'),
    ('0019'),
    ('002'),
    ('0020'),
    ('0021'),
    ('0022'),
    ('0023'),
    ('0024'),
    ('0025'),
    ('0026'),
    ('0027'),
    ('0028'),
    ('0029'),
    ('003'),
    ('0030'),
    ('0031'),
    ('0032'),
    ('0033'),
    ('0034'),
    ('0035'),
    ('0036'),
    ('0037'),
    ('0038'),
    ('0039'),
    ('004'),
    ('0040'),
    ('0041'),
    ('0042'),
    ('0043'),
    ('0044'),
    ('0045'),
    ('0046'),
    ('0047'),
    ('0048'),
    ('0049'),
    ('005'),
    ('0050'),
    ('0051'),
    ('0052'),
    ('0053'),
    ('0054'),
    ('0055'),
    ('0056'),
    ('0057'),
    ('0058'),
    ('0059'),
    ('006'),
    ('0060'),
    ('0061'),
    ('0062'),
    ('0063'),
    ('0064'),
    ('0065'),
    ('0066'),
    ('0067'),
    ('0068'),
    ('0069'),
    ('007'),
    ('0070'),
    ('0071'),
    ('0072'),
    ('0073'),
    ('0074'),
    ('0075'),
    ('0076'),
    ('0077'),
    ('0078'),
    ('0079'),
    ('008'),
    ('0080'),
    ('0081'),
    ('0082'),
    ('0083'),
    ('009'),
    ('010');
