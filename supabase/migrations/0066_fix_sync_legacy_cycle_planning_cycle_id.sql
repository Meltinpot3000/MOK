-- 0066_fix_sync_legacy_cycle_planning_cycle_id.sql
-- Fix: planning_cycle_id must reference planning_cycles(id), not cycle_instances(id).
-- When legacy_planning_cycle_id is null, set planning_cycle_id to null (column is nullable).
-- migrate:up

create or replace function app.sync_legacy_cycle_columns()
returns trigger
language plpgsql
as $$
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

-- migrate:down
-- Restore original coalesce(legacy_planning_cycle_id, id) for planning_cycle_id (may cause FK errors for new cycle_instances)
create or replace function app.sync_legacy_cycle_columns()
returns trigger
language plpgsql
as $$
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

  if payload ? 'planning_cycle_id' and v_cycle_instance_id is not null then
    select coalesce(legacy_planning_cycle_id, id) into v_legacy_cycle_id
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
