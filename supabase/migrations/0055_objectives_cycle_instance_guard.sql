-- 0055_objectives_cycle_instance_guard.sql
-- Relax objective context guard when using cycle_instance_id (v3 strategy framework).
-- migrate:up

create or replace function app.ensure_objective_context()
returns trigger
language plpgsql
as $$
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

-- migrate:down
create or replace function app.ensure_objective_context()
returns trigger
language plpgsql
as $$
declare
  v_has_directions boolean;
  v_has_targets boolean;
begin
  select exists (
    select 1
    from app.strategic_directions d
    where d.organization_id = new.organization_id
      and d.planning_cycle_id = new.cycle_id
  ) into v_has_directions;

  if not v_has_directions then
    raise exception 'Cannot create objective: no strategic directions exist for this planning cycle.';
  end if;

  select exists (
    select 1
    from app.annual_targets t
    where t.organization_id = new.organization_id
      and t.planning_cycle_id = new.cycle_id
  ) into v_has_targets;

  if not v_has_targets then
    raise exception 'Cannot create objective: no annual targets exist for this planning cycle.';
  end if;

  return new;
end;
$$;
