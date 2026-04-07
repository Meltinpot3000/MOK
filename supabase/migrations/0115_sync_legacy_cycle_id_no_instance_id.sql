-- 0115_sync_legacy_cycle_id_no_instance_id.sql
-- cycle_id/planning_cycle_id muessen app.planning_cycles(id) sein, nie app.cycle_instances.id.
-- migrate:up

create or replace function app.sync_legacy_cycle_columns ()
returns trigger
language plpgsql
as $$
declare
  payload jsonb := to_jsonb (new);
  v_cycle_instance_id uuid := nullif (payload ->> 'cycle_instance_id', '')::uuid;
  v_planning_cycle_id uuid := nullif (payload ->> 'planning_cycle_id', '')::uuid;
  v_cycle_id uuid := nullif (payload ->> 'cycle_id', '')::uuid;
  v_legacy_cycle_id uuid;
begin
  if v_cycle_instance_id is null and payload ? 'planning_cycle_id' and v_planning_cycle_id is not null then
    select
      id into v_cycle_instance_id
    from
      app.cycle_instances
    where
      legacy_planning_cycle_id = v_planning_cycle_id
    limit 1;

    if v_cycle_instance_id is null then
      select
        id into v_cycle_instance_id
      from
        app.cycle_instances
      where
        id = v_planning_cycle_id
      limit 1;
    end if;
  end if;

  if v_cycle_instance_id is null and payload ? 'cycle_id' and v_cycle_id is not null then
    select
      id into v_cycle_instance_id
    from
      app.cycle_instances
    where
      legacy_planning_cycle_id = v_cycle_id
    limit 1;

    if v_cycle_instance_id is null then
      select
        id into v_cycle_instance_id
      from
        app.cycle_instances
      where
        id = v_cycle_id
      limit 1;
    end if;
  end if;

  if payload ? 'planning_cycle_id' and v_cycle_instance_id is not null then
    select
      legacy_planning_cycle_id into v_legacy_cycle_id
    from
      app.cycle_instances
    where
      id = v_cycle_instance_id
    limit 1;

    new := jsonb_populate_record(new, jsonb_build_object('planning_cycle_id', v_legacy_cycle_id));
  end if;

  if payload ? 'cycle_id' and v_cycle_instance_id is not null then
    select
      legacy_planning_cycle_id into v_legacy_cycle_id
    from
      app.cycle_instances
    where
      id = v_cycle_instance_id
    limit 1;

    new := jsonb_populate_record(new, jsonb_build_object('cycle_id', v_legacy_cycle_id));
  end if;

  if payload ? 'cycle_instance_id' then
    new := jsonb_populate_record(new, jsonb_build_object('cycle_instance_id', v_cycle_instance_id));
  end if;

  return new;
end;
$$;

comment on function app.sync_legacy_cycle_columns () is
  'Synchronisiert cycle_instance_id legacy und setzt planning_cycle_id/cycle_id nur aus legacy_planning_cycle_id (nie cycle_instances.id).';

-- migrate:down
-- Ruecknahme: 0066 Variante mit coalesce(legacy, id) fuer cycle_id
create or replace function app.sync_legacy_cycle_columns ()
returns trigger
language plpgsql
as $$
declare
  payload jsonb := to_jsonb (new);
  v_cycle_instance_id uuid := nullif (payload ->> 'cycle_instance_id', '')::uuid;
  v_planning_cycle_id uuid := nullif (payload ->> 'planning_cycle_id', '')::uuid;
  v_cycle_id uuid := nullif (payload ->> 'cycle_id', '')::uuid;
  v_legacy_cycle_id uuid;
begin
  if v_cycle_instance_id is null and payload ? 'planning_cycle_id' and v_planning_cycle_id is not null then
    select
      id into v_cycle_instance_id
    from
      app.cycle_instances
    where
      legacy_planning_cycle_id = v_planning_cycle_id
    limit 1;

    if v_cycle_instance_id is null then
      select
        id into v_cycle_instance_id
      from
        app.cycle_instances
      where
        id = v_planning_cycle_id
      limit 1;
    end if;
  end if;

  if v_cycle_instance_id is null and payload ? 'cycle_id' and v_cycle_id is not null then
    select
      id into v_cycle_instance_id
    from
      app.cycle_instances
    where
      legacy_planning_cycle_id = v_cycle_id
    limit 1;

    if v_cycle_instance_id is null then
      select
        id into v_cycle_instance_id
      from
        app.cycle_instances
      where
        id = v_cycle_id
      limit 1;
    end if;
  end if;

  if payload ? 'planning_cycle_id' and v_cycle_instance_id is not null then
    select
      legacy_planning_cycle_id into v_legacy_cycle_id
    from
      app.cycle_instances
    where
      id = v_cycle_instance_id
    limit 1;

    new := jsonb_populate_record(new, jsonb_build_object('planning_cycle_id', v_legacy_cycle_id));
  end if;

  if payload ? 'cycle_id' and v_cycle_instance_id is not null then
    select
      coalesce (legacy_planning_cycle_id, id) into v_legacy_cycle_id
    from
      app.cycle_instances
    where
      id = v_cycle_instance_id
    limit 1;

    new := jsonb_populate_record(new, jsonb_build_object('cycle_id', v_legacy_cycle_id));
  end if;

  if payload ? 'cycle_instance_id' then
    new := jsonb_populate_record(new, jsonb_build_object('cycle_instance_id', v_cycle_instance_id));
  end if;

  return new;
end;
$$;
