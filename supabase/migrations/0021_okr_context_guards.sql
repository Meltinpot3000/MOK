-- 0021_okr_context_guards.sql
-- Backend guards to prevent isolated objective/key_result creation.
-- migrate:up

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

drop trigger if exists trg_objectives_require_context on app.objectives;
create trigger trg_objectives_require_context
before insert on app.objectives
for each row execute function app.ensure_objective_context();

create or replace function app.ensure_key_result_context()
returns trigger
language plpgsql
as $$
declare
  v_cycle_id uuid;
  v_org_id uuid;
  v_has_objective_links boolean;
begin
  select o.cycle_id, o.organization_id
  into v_cycle_id, v_org_id
  from app.objectives o
  where o.id = new.objective_id;

  if v_cycle_id is null or v_org_id is null then
    raise exception 'Cannot create key result: objective context not found.';
  end if;

  if v_org_id <> new.organization_id then
    raise exception 'Cannot create key result: objective organization mismatch.';
  end if;

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

  if not v_has_objective_links then
    raise exception 'Cannot create key result: objective is not linked to annual target or strategic direction.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_key_results_require_context on app.key_results;
create trigger trg_key_results_require_context
before insert on app.key_results
for each row execute function app.ensure_key_result_context();

-- migrate:down
drop trigger if exists trg_key_results_require_context on app.key_results;
drop trigger if exists trg_objectives_require_context on app.objectives;
drop function if exists app.ensure_key_result_context();
drop function if exists app.ensure_objective_context();
