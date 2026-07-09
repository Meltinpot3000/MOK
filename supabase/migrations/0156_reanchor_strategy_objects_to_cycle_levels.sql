-- 0156_reanchor_strategy_objects_to_cycle_levels.sql
-- Platzhalter: eigentliche Re-Anchor-Logik in 0157 (Trigger-sichere Reihenfolge).
-- migrate:up

create or replace function app.cycle_instance_ancestor_at_level(p_cycle_instance_id uuid, p_level_no int)
returns uuid
language sql
stable
as $$
  with recursive chain as (
    select id, parent_instance_id, level_no
    from app.cycle_instances
    where id = p_cycle_instance_id
    union all
    select ci.id, ci.parent_instance_id, ci.level_no
    from app.cycle_instances ci
    join chain c on ci.id = c.parent_instance_id
  )
  select id from chain where level_no = p_level_no limit 1;
$$;

-- migrate:down

drop function if exists app.cycle_instance_ancestor_at_level(uuid, int);
