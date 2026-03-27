-- 0099_objective_shifted_status_and_shift_rpc.sql
-- OKR „Sprint“: Objective-Status shifted + atomares Verschieben in den nächsten OKR-Zeitraum
-- (Kopie offener KRs, Initiative-Links umhängen, Check-ins kopieren).
-- migrate:up

-- 1) Lifecycle-Status objectives.status um 'shifted' erweitern
alter table app.objectives drop constraint if exists objectives_status_check;
alter table app.objectives
  add constraint objectives_status_check check (
    status = any (
      array[
        'draft'::text,
        'active'::text,
        'at_risk'::text,
        'completed'::text,
        'archived'::text,
        'shifted'::text
      ]
    )
  );

-- 2) Metrik-Fortschritt 0–100 (gleiche Semantik wie web/lib/review/key-result-progress.ts computeKeyResultProgress)
create or replace function app.kr_metric_progress_pct(
  p_metric_type text,
  p_start numeric,
  p_target numeric,
  p_current numeric
) returns numeric
language sql
immutable
parallel safe
set search_path = app, public
as $$
  select case
    when p_metric_type = 'percent' then
      least(100::numeric, greatest(0::numeric, coalesce(p_current, 0)))
    when p_metric_type = 'boolean' then
      case when coalesce(p_current, 0) >= 1 then 100::numeric else 0::numeric end
    else
      case
        when (coalesce(p_target, 100) - coalesce(p_start, 0)) = 0 then
          case
            when coalesce(p_current, coalesce(p_start, 0)) >= coalesce(p_target, 100) then 100::numeric
            else 0::numeric
          end
        else
          least(
            100::numeric,
            greatest(
              0::numeric,
              (coalesce(p_current, coalesce(p_start, 0)) - coalesce(p_start, 0))
                / nullif((coalesce(p_target, 100) - coalesce(p_start, 0)), 0)
                * 100
            )
          )
      end
  end;
$$;

-- 3) OKR-Zyklus-Scope (Äquivalent zu web/lib/okr/queries.ts getOkrCycleInstanceScopeIds)
create or replace function app.okr_cycle_instance_scope_ids(
  p_organization_id uuid,
  p_active_instance_id uuid
) returns uuid[]
language plpgsql
stable
security definer
set search_path = app, public
as $$
declare
  v_active record;
  v_has_child boolean;
  v_siblings uuid[];
  v_leaves uuid[] := array[]::uuid[];
  v_queue uuid[] := array[]::uuid[];
  v_cur uuid;
  v_children uuid[];
  v_ci int;
  v_qlen int;
begin
  select c.id, c.parent_instance_id, c.level_no
  into v_active
  from app.cycle_instances c
  where c.organization_id = p_organization_id
    and c.id = p_active_instance_id;

  if v_active.id is null then
    return array[p_active_instance_id];
  end if;

  select exists (
    select 1
    from app.cycle_instances ch
    where ch.organization_id = p_organization_id
      and ch.parent_instance_id = v_active.id
  )
  into v_has_child;

  if not v_has_child and v_active.parent_instance_id is not null then
    select coalesce(array_agg(s.id order by s.id), array[]::uuid[])
    into v_siblings
    from app.cycle_instances s
    where s.organization_id = p_organization_id
      and s.parent_instance_id = v_active.parent_instance_id
      and s.level_no = v_active.level_no;

    if v_siblings is null or cardinality(v_siblings) = 0 then
      return array[v_active.id];
    end if;
    return v_siblings;
  end if;

  v_queue := array_append(v_queue, v_active.id);

  <<bfs>>
  while coalesce(array_length(v_queue, 1), 0) > 0 loop
    v_cur := v_queue[1];
    v_qlen := array_length(v_queue, 1);
    if v_qlen > 1 then
      v_queue := v_queue[2:v_qlen];
    else
      v_queue := array[]::uuid[];
    end if;

    select coalesce(array_agg(c.id order by c.id), array[]::uuid[])
    into v_children
    from app.cycle_instances c
    where c.organization_id = p_organization_id
      and c.parent_instance_id = v_cur;

    if v_children is null or cardinality(v_children) = 0 then
      v_leaves := array_append(v_leaves, v_cur);
    else
      for v_ci in 1..array_length(v_children, 1) loop
        v_queue := array_append(v_queue, v_children[v_ci]);
      end loop;
    end if;
  end loop bfs;

  if v_leaves is null or cardinality(v_leaves) = 0 then
    return array[v_active.id];
  end if;
  return v_leaves;
end;
$$;

revoke all on function app.kr_metric_progress_pct(text, numeric, numeric, numeric) from public;
revoke all on function app.okr_cycle_instance_scope_ids(uuid, uuid) from public;
grant execute on function app.kr_metric_progress_pct(text, numeric, numeric, numeric) to authenticated;
grant execute on function app.okr_cycle_instance_scope_ids(uuid, uuid) to authenticated;

-- 4) Atomares Shift
create or replace function app.okr_shift_objective_to_next_cycle(
  p_organization_id uuid,
  p_cycle_instance_id uuid,
  p_objective_id uuid,
  p_from_okr_cycle_id uuid,
  p_to_okr_cycle_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_mid uuid;
  v_obj record;
  v_from_oc record;
  v_to_oc record;
  v_scope uuid[];
  v_dir_id uuid;
  v_new_objective_id uuid;
  v_kr record;
  v_new_kr_id uuid;
  v_to_end date;
begin
  v_mid := app.current_membership_id(p_organization_id);
  if v_mid is null then
    return jsonb_build_object('error', 'Nicht angemeldet oder keine Mitgliedschaft.');
  end if;

  if p_from_okr_cycle_id = p_to_okr_cycle_id then
    return jsonb_build_object('error', 'Quell- und Ziel-OKR-Zyklus dürfen nicht identisch sein.');
  end if;

  select o.*
  into v_obj
  from app.objectives o
  where o.id = p_objective_id
    and o.organization_id = p_organization_id
    and o.cycle_instance_id = p_cycle_instance_id
    and o.okr_cycle_id = p_from_okr_cycle_id;

  if v_obj.id is null then
    return jsonb_build_object('error', 'OKR-Objective nicht gefunden oder falscher Zeitraum.');
  end if;

  if v_obj.status in ('shifted', 'archived') then
    return jsonb_build_object('error', 'Objective kann nicht verschoben werden (Status).');
  end if;

  if not (
    app.has_permission(p_organization_id, 'nav.strategy-cycle.write')
    or app.has_permission(p_organization_id, 'nav.strategy-matrix.write')
    or (
      app.has_permission(p_organization_id, 'okr.write')
      and app.okr_can_modify_objective(
        p_organization_id,
        v_obj.owner_membership_id,
        v_obj.deputy_membership_id
      )
    )
  ) then
    return jsonb_build_object('error', 'Keine Berechtigung zum Verschieben.');
  end if;

  select oc.id, oc.organization_id, oc.cycle_instance_id
  into v_from_oc
  from app.okr_cycles oc
  where oc.id = p_from_okr_cycle_id
    and oc.organization_id = p_organization_id;

  if v_from_oc.id is null then
    return jsonb_build_object('error', 'Ungültiger Quell-OKR-Zyklus.');
  end if;

  select oc.id, oc.organization_id, oc.cycle_instance_id, oc.end_date
  into v_to_oc
  from app.okr_cycles oc
  where oc.id = p_to_okr_cycle_id
    and oc.organization_id = p_organization_id;

  if v_to_oc.id is null then
    return jsonb_build_object('error', 'Ungültiger Ziel-OKR-Zyklus.');
  end if;

  v_scope := app.okr_cycle_instance_scope_ids(p_organization_id, p_cycle_instance_id);

  if not (
    v_from_oc.cycle_instance_id = any (v_scope)
    and v_to_oc.cycle_instance_id = any (v_scope)
  ) then
    return jsonb_build_object('error', 'OKR-Zyklus liegt außerhalb des gültigen Scopes.');
  end if;

  select l.strategic_direction_id
  into v_dir_id
  from app.strategic_direction_objective_links l
  where l.organization_id = p_organization_id
    and l.cycle_instance_id = p_cycle_instance_id
    and l.objective_id = p_objective_id
  order by l.created_at asc nulls last, l.id asc
  limit 1;

  if v_dir_id is null then
    return jsonb_build_object('error', 'Keine führende Stoßrichtung verknüpft — Verschieben abgebrochen.');
  end if;

  v_to_end := v_to_oc.end_date;

  update app.objectives
  set status = 'shifted',
      updated_at = now()
  where id = p_objective_id
    and organization_id = p_organization_id;

  insert into app.objectives (
    organization_id,
    cycle_instance_id,
    cycle_id,
    title,
    description,
    status,
    owner_membership_id,
    deputy_membership_id,
    progress_percent,
    okr_cycle_id,
    confidence_level,
    time_horizon,
    importance_score,
    created_by_membership_id,
    created_by_source
  )
  values (
    p_organization_id,
    p_cycle_instance_id,
    v_obj.cycle_id,
    v_obj.title,
    v_obj.description,
    'draft',
    v_obj.owner_membership_id,
    v_obj.deputy_membership_id,
    v_obj.progress_percent,
    p_to_okr_cycle_id,
    v_obj.confidence_level,
    v_obj.time_horizon,
    v_obj.importance_score,
    v_mid,
    coalesce(v_obj.created_by_source, 'user')
  )
  returning id into v_new_objective_id;

  insert into app.strategic_direction_objective_links (
    organization_id,
    cycle_instance_id,
    strategic_direction_id,
    objective_id,
    created_by_membership_id
  )
  values (
    p_organization_id,
    p_cycle_instance_id,
    v_dir_id,
    v_new_objective_id,
    v_mid
  );

  for v_kr in
    select kr.*
    from app.key_results kr
    where kr.objective_id = p_objective_id
      and kr.organization_id = p_organization_id
      and app.kr_metric_progress_pct(
        kr.metric_type,
        kr.start_value,
        kr.target_value,
        kr.current_value
      ) < 100
    order by kr.created_at asc, kr.id asc
  loop
    insert into app.key_results (
      organization_id,
      objective_id,
      title,
      metric_type,
      start_value,
      target_value,
      current_value,
      status,
      due_date,
      measurement_unit,
      owner_membership_id,
      deputy_membership_id,
      created_by_membership_id,
      created_by_source
    )
    values (
      p_organization_id,
      v_new_objective_id,
      v_kr.title,
      v_kr.metric_type,
      v_kr.start_value,
      v_kr.target_value,
      v_kr.current_value,
      v_kr.status,
      v_to_end,
      v_kr.measurement_unit,
      v_kr.owner_membership_id,
      v_kr.deputy_membership_id,
      coalesce(v_kr.created_by_membership_id, v_mid),
      coalesce(v_kr.created_by_source, 'user')
    )
    returning id into v_new_kr_id;

    update app.initiative_key_result_links l
    set key_result_id = v_new_kr_id
    where l.organization_id = p_organization_id
      and l.cycle_instance_id = p_cycle_instance_id
      and l.key_result_id = v_kr.id;

    insert into app.okr_updates (
      id,
      organization_id,
      planning_cycle_id,
      okr_cycle_id,
      key_result_id,
      progress_value,
      confidence_level,
      comment,
      created_by_membership_id,
      created_at,
      cycle_instance_id
    )
    select
      gen_random_uuid(),
      u.organization_id,
      u.planning_cycle_id,
      p_to_okr_cycle_id,
      v_new_kr_id,
      u.progress_value,
      u.confidence_level,
      u.comment,
      u.created_by_membership_id,
      u.created_at,
      p_cycle_instance_id
    from app.okr_updates u
    where u.key_result_id = v_kr.id
      and u.organization_id = p_organization_id;
  end loop;

  return jsonb_build_object(
    'new_objective_id', v_new_objective_id,
    'new_okr_cycle_id', p_to_okr_cycle_id
  );
end;
$$;

revoke all on function app.okr_shift_objective_to_next_cycle(uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function app.okr_shift_objective_to_next_cycle(uuid, uuid, uuid, uuid, uuid) to authenticated;

comment on function app.okr_shift_objective_to_next_cycle is
  'Markiert Objective als shifted, legt Draft im Ziel-okr_cycle an, kopiert KRs mit Fortschritt < 100%, hängt Initiative-Links um, kopiert okr_updates.';

-- migrate:down

update app.objectives
set status = 'archived',
    updated_at = now()
where status = 'shifted';

revoke execute on function app.okr_shift_objective_to_next_cycle(uuid, uuid, uuid, uuid, uuid) from authenticated;
drop function if exists app.okr_shift_objective_to_next_cycle(uuid, uuid, uuid, uuid, uuid);

revoke execute on function app.okr_cycle_instance_scope_ids(uuid, uuid) from authenticated;
drop function if exists app.okr_cycle_instance_scope_ids(uuid, uuid);

revoke execute on function app.kr_metric_progress_pct(text, numeric, numeric, numeric) from authenticated;
drop function if exists app.kr_metric_progress_pct(text, numeric, numeric, numeric);

alter table app.objectives drop constraint if exists objectives_status_check;
alter table app.objectives
  add constraint objectives_status_check check (
    status = any (
      array[
        'draft'::text,
        'active'::text,
        'at_risk'::text,
        'completed'::text,
        'archived'::text
      ]
    )
  );
