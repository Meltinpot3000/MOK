-- 0011_phase0_cycle_clone.sql
-- Phase 0 foundation: create planning cycles and full-snapshot clone.
-- migrate:up
alter table app.planning_cycles
  add column if not exists source_cycle_id uuid references app.planning_cycles(id) on delete set null,
  add column if not exists clone_type text check (clone_type in ('full_snapshot')),
  add column if not exists cloned_at timestamptz,
  add column if not exists cloned_by_membership_id uuid references app.organization_memberships(id) on delete set null;

create or replace function app.clone_planning_cycle_full_snapshot(
  p_organization_id uuid,
  p_source_cycle_id uuid,
  p_new_code text,
  p_new_name text,
  p_start_date date,
  p_end_date date,
  p_actor_membership_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app, rbac, audit
as $$
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

grant execute on function app.clone_planning_cycle_full_snapshot(uuid, uuid, text, text, date, date, uuid)
  to authenticated;

-- migrate:down
revoke execute on function app.clone_planning_cycle_full_snapshot(uuid, uuid, text, text, date, date, uuid)
  from authenticated;
drop function if exists app.clone_planning_cycle_full_snapshot(uuid, uuid, text, text, date, date, uuid);
alter table app.planning_cycles
  drop column if exists source_cycle_id,
  drop column if exists clone_type,
  drop column if exists cloned_at,
  drop column if exists cloned_by_membership_id;
