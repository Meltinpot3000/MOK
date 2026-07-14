-- 0177_strategy_review_replace_directions_objectives.sql
-- Ersetzen: neues Objekt in Zielzyklus anlegen (Stoßrichtung/Ziel), analog Challenges.

-- migrate:up

create or replace function app.strategy_review_apply_replacements(
  p_review_id uuid,
  p_to_cycle_instance_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_dec jsonb;
  v_planning_to uuid;
  v_elem jsonb;
  v_old uuid;
  v_decision text;
  v_title text;
  v_desc text;
  v_new uuid;
  v_rec record;
begin
  select organization_id, decision_payload
  into v_org, v_dec
  from app.okr_reviews
  where id = p_review_id;

  if v_org is null or v_dec is null then
    return;
  end if;

  select legacy_planning_cycle_id
  into v_planning_to
  from app.cycle_instances
  where id = p_to_cycle_instance_id
    and organization_id = v_org;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'focus_areas', '[]'::jsonb))
  loop
    v_old := nullif(v_elem ->> 'id', '')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_old is null or v_decision <> 'replace' then
      continue;
    end if;
    v_title := coalesce(nullif(trim(v_elem #>> '{replacement,title}'), ''), 'Stoßrichtung');
    v_desc := v_elem #>> '{replacement,description}';
    select * into v_rec from app.strategic_directions where id = v_old and organization_id = v_org;
    insert into app.strategic_directions (
      organization_id, planning_cycle_id, title, description, owner_membership_id,
      priority, status, grouping, created_by_membership_id, cycle_instance_id,
      relevance_level, risk_level, strategic_value_score, capability_fit_score,
      feasibility_score, created_by_source, strategy_carry_metadata
    )
    values (
      v_org,
      v_planning_to,
      v_title,
      v_desc,
      v_rec.owner_membership_id,
      coalesce((v_elem #>> '{replacement,priority}')::int, coalesce(v_rec.priority, 3)),
      'active',
      coalesce(v_elem #>> '{replacement,grouping}', v_rec.grouping),
      v_rec.created_by_membership_id,
      p_to_cycle_instance_id,
      coalesce(v_rec.relevance_level, 3),
      coalesce((v_elem #>> '{replacement,risk_score}')::int, coalesce(v_rec.risk_level, 3)),
      coalesce((v_elem #>> '{replacement,strategic_value_score}')::int, coalesce(v_rec.strategic_value_score, 3)),
      coalesce((v_elem #>> '{replacement,capability_fit_score}')::int, coalesce(v_rec.capability_fit_score, 3)),
      coalesce((v_elem #>> '{replacement,feasibility_score}')::int, coalesce(v_rec.feasibility_score, 3)),
      'user',
      jsonb_build_object('strategy_review_replace_of', v_old::text)
    )
    returning id into v_new;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'objectives', '[]'::jsonb))
  loop
    v_old := nullif(v_elem ->> 'id', '')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_old is null or v_decision <> 'replace' then
      continue;
    end if;
    v_title := coalesce(nullif(trim(v_elem #>> '{replacement,title}'), ''), 'Ziel');
    v_desc := v_elem #>> '{replacement,description}';
    select * into v_rec from app.strategy_objectives where id = v_old and organization_id = v_org;
    insert into app.strategy_objectives (
      organization_id, cycle_id, title, description, status, owner_membership_id,
      cycle_instance_id, time_horizon, importance_score, created_by_source,
      strategy_carry_metadata
    )
    values (
      v_org,
      v_planning_to,
      v_title,
      v_desc,
      'active',
      v_rec.owner_membership_id,
      p_to_cycle_instance_id,
      coalesce(v_elem #>> '{replacement,time_horizon}', v_rec.time_horizon),
      coalesce((v_elem #>> '{replacement,importance_score}')::int, coalesce(v_rec.importance_score, 3)),
      'user',
      jsonb_build_object('strategy_review_replace_of', v_old::text)
    )
    returning id into v_new;
  end loop;
end;
$$;

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

  perform app.strategy_review_apply_replacements(p_review_id, v_to);
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

grant execute on function app.strategy_review_apply_replacements(uuid, uuid) to authenticated;

-- migrate:down

drop function if exists app.strategy_review_apply_replacements(uuid, uuid);
