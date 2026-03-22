-- 0074_key_result_context_strategic_direction_v3.sql
-- extend ensure_key_result_context: accept v3 strategic_direction_objective_links as valid
-- objective context (no new business semantics or rollups in trigger).
-- migrate:up

create or replace function app.ensure_key_result_context()
returns trigger
language plpgsql
as $$
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

comment on table app.objectives is
  'Objectives row: strategic design and/or OKR-objectives (okr_cycle_id). Review progress lives on initiatives; OKR outcome metrics on key_results.';
comment on table app.key_results is
  'Key Result outcome metrics (baseline/target/current); not initiative implementation progress.';
comment on table app.initiative_key_result_links is
  'Initiative–Key Result links: implementation drivers for outcomes; canonical for OKR workspace (not linked_okrs JSON).';

-- migrate:down

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
