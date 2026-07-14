-- 0170_strategy_review_l2_scope.sql
-- Strategy Review hängt am Reviewzyklus (L2): Pre-Read lädt Strategieobjekte über Zyklusbaum (L1+L2+L3).

-- migrate:up

create or replace function app.cycle_instance_related_ids(p_cycle_instance_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = app, pg_temp
as $$
  with recursive
  ancestors as (
    select id, parent_instance_id
    from app.cycle_instances
    where id = p_cycle_instance_id
    union all
    select ci.id, ci.parent_instance_id
    from app.cycle_instances ci
    join ancestors a on ci.id = a.parent_instance_id
  ),
  descendants as (
    select id, parent_instance_id
    from app.cycle_instances
    where id = p_cycle_instance_id
    union all
    select ci.id, ci.parent_instance_id
    from app.cycle_instances ci
    join descendants d on ci.parent_instance_id = d.id
  )
  select coalesce(array_agg(distinct x.id), array[p_cycle_instance_id]::uuid[])
  from (
    select id from ancestors
    union
    select id from descendants
  ) x;
$$;

comment on function app.cycle_instance_related_ids(uuid) is
  'L1/L2/L3-Baum um eine cycle_instance: Vorfahren und Nachkommen inklusive Self.';

create or replace function app.prepare_strategy_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to app, public
as $$
declare
  v_org uuid;
  v_ci uuid;
  v_cycle_ids uuid[];
  v_challenge_ids uuid[];
  v_focus_ids uuid[];
  v_obj_ids uuid[];
  v_payload jsonb;
begin
  select organization_id, cycle_instance_id
  into v_org, v_ci
  from app.okr_reviews
  where id = p_review_id
    and review_mode = 'strategy_review';

  if v_ci is null then
    raise exception 'prepare_strategy_review: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'prepare_strategy_review: forbidden';
  end if;

  v_cycle_ids := app.cycle_instance_related_ids(v_ci);

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_challenge_ids
  from app.strategic_challenges
  where organization_id = v_org
    and cycle_instance_id = any (v_cycle_ids);

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_focus_ids
  from app.strategic_directions
  where organization_id = v_org
    and cycle_instance_id = any (v_cycle_ids);

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_obj_ids
  from app.strategy_objectives
  where organization_id = v_org
    and cycle_instance_id = any (v_cycle_ids);

  v_payload := jsonb_build_object(
    'generated_at', to_jsonb(now()),
    'scope', jsonb_build_object(
      'challenge_ids', coalesce(to_jsonb(v_challenge_ids), '[]'::jsonb),
      'focus_area_ids', coalesce(to_jsonb(v_focus_ids), '[]'::jsonb),
      'objective_ids', coalesce(to_jsonb(v_obj_ids), '[]'::jsonb),
      'cycle_instance_ids', coalesce(to_jsonb(v_cycle_ids), '[]'::jsonb)
    ),
    'challenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'description', c.description,
          'priority', c.priority,
          'visibility', c.visibility
        )
        order by c.title
      )
      from app.strategic_challenges c
      where c.organization_id = v_org
        and c.cycle_instance_id = any (v_cycle_ids)
    ), '[]'::jsonb),
    'focus_areas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'title', d.title,
          'description', d.description,
          'status', d.status,
          'priority', d.priority
        )
        order by d.title
      )
      from app.strategic_directions d
      where d.organization_id = v_org
        and d.cycle_instance_id = any (v_cycle_ids)
    ), '[]'::jsonb),
    'objectives', coalesce((
      select jsonb_agg(x.obj order by x.sort_title)
      from (
        select
          s.title as sort_title,
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'description', s.description,
            'status', s.status,
            'progress_percent', s.progress_percent,
            'key_results', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', kr.id,
                  'title', kr.title,
                  'metric_type', kr.metric_type,
                  'target_value', kr.target_value,
                  'current_value', kr.current_value
                )
                order by kr.title
              )
              from app.key_results kr
              join app.okr_objective_strategy_objectives j on j.okr_objective_id = kr.okr_objective_id
              where j.strategy_objective_id = s.id
            ), '[]'::jsonb)
          ) as obj
        from app.strategy_objectives s
        where s.organization_id = v_org
          and s.cycle_instance_id = any (v_cycle_ids)
      ) x
    ), '[]'::jsonb)
  );

  update app.okr_reviews
  set
    pre_read_payload = v_payload,
    procedure_status = 'pre_read_open'
  where id = p_review_id
    and procedure_status = 'announcement_sent';

  if not found then
    raise exception 'prepare_strategy_review: expected procedure_status announcement_sent';
  end if;
end;
$$;

grant execute on function app.cycle_instance_related_ids(uuid) to authenticated;
grant execute on function app.cycle_instance_related_ids(uuid) to service_role;

-- migrate:down

drop function if exists app.cycle_instance_related_ids(uuid);
-- prepare_strategy_review bleibt in der zuletzt bekannten Form (0114) — Down ohne vollständigen Restore.
