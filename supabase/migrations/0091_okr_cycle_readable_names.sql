-- migrate:up
-- OKR-Zeitraum-Anzeige: kurzes Muster „OKR-Zyklus DD.MM.YYYY – DD.MM.YYYY“ statt
-- „Schema / Ebene 3 …“ (urspruenglich von cycle_instances.name uebernommen).

create or replace function app.regenerate_cycle_instances(
  p_cycle_scheme_id uuid,
  p_horizon_months integer default null,
  p_actor_membership_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_scheme app.cycle_schemes%rowtype;
  v_horizon integer;
  v_top_months integer;
  v_level2_months integer;
  v_level3_months integer;
  v_top_count integer;
  v_top_idx integer;
  v_level2_count integer;
  v_level2_idx integer;
  v_level3_count integer;
  v_level3_idx integer;
  v_l1_start date;
  v_l1_end date;
  v_l2_start date;
  v_l2_end date;
  v_l3_start date;
  v_l3_end date;
  v_parent_l1 uuid;
  v_parent_l2 uuid;
  v_created integer := 0;
begin
  select * into v_scheme
  from app.cycle_schemes
  where id = p_cycle_scheme_id;

  if v_scheme.id is null then
    raise exception 'cycle scheme not found: %', p_cycle_scheme_id;
  end if;

  perform app.validate_cycle_scheme_levels(p_cycle_scheme_id);

  select duration_months into v_top_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 1;

  select duration_months into v_level2_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 2;

  select duration_months into v_level3_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 3;

  v_horizon := coalesce(p_horizon_months, greatest(v_top_months, 12));
  v_top_count := greatest(1, ceil(v_horizon::numeric / v_top_months::numeric)::integer);

  delete from app.cycle_instances
  where cycle_scheme_id = p_cycle_scheme_id
    and legacy_planning_cycle_id is null;

  for v_top_idx in 0..(v_top_count - 1) loop
    v_l1_start := (v_scheme.starts_on + make_interval(months => v_top_idx * v_top_months))::date;
    v_l1_end := (v_l1_start + make_interval(months => v_top_months))::date;

    insert into app.cycle_instances (
      organization_id, cycle_scheme_id, level_no, parent_instance_id,
      starts_on, ends_on, status, code, name, sequence_no
    )
    values (
      v_scheme.organization_id,
      p_cycle_scheme_id,
      1,
      null,
      v_l1_start,
      v_l1_end,
      'planned',
      format('%s-L1-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0')),
      format('%s / Ebene 1 #%s', v_scheme.name, v_top_idx + 1),
      v_top_idx + 1
    )
    returning id into v_parent_l1;

    v_created := v_created + 1;

    if v_level2_months is not null then
      v_level2_count := v_top_months / v_level2_months;
      for v_level2_idx in 0..(v_level2_count - 1) loop
        v_l2_start := (v_l1_start + make_interval(months => v_level2_idx * v_level2_months))::date;
        v_l2_end := (v_l2_start + make_interval(months => v_level2_months))::date;

        insert into app.cycle_instances (
          organization_id, cycle_scheme_id, level_no, parent_instance_id,
          starts_on, ends_on, status, code, name, sequence_no
        )
        values (
          v_scheme.organization_id,
          p_cycle_scheme_id,
          2,
          v_parent_l1,
          v_l2_start,
          v_l2_end,
          'planned',
          format('%s-L2-%s-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0'), lpad((v_level2_idx + 1)::text, 3, '0')),
          format('%s / Ebene 2 #%s.%s', v_scheme.name, v_top_idx + 1, v_level2_idx + 1),
          (v_top_idx * v_level2_count) + v_level2_idx + 1
        )
        returning id into v_parent_l2;

        v_created := v_created + 1;

        if v_level3_months is not null then
          v_level3_count := v_level2_months / v_level3_months;
          for v_level3_idx in 0..(v_level3_count - 1) loop
            v_l3_start := (v_l2_start + make_interval(months => v_level3_idx * v_level3_months))::date;
            v_l3_end := (v_l3_start + make_interval(months => v_level3_months))::date;

            insert into app.cycle_instances (
              organization_id, cycle_scheme_id, level_no, parent_instance_id,
              starts_on, ends_on, status, code, name, sequence_no
            )
            values (
              v_scheme.organization_id,
              p_cycle_scheme_id,
              3,
              v_parent_l2,
              v_l3_start,
              v_l3_end,
              'planned',
              format('%s-L3-%s-%s-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0'), lpad((v_level2_idx + 1)::text, 3, '0'), lpad((v_level3_idx + 1)::text, 3, '0')),
              format('%s / Ebene 3 #%s.%s.%s', v_scheme.name, v_top_idx + 1, v_level2_idx + 1, v_level3_idx + 1),
              ((v_top_idx * v_level2_count * v_level3_count) + (v_level2_idx * v_level3_count) + v_level3_idx + 1)
            );

            v_created := v_created + 1;
          end loop;
        end if;
      end loop;
    end if;
  end loop;

  insert into app.okr_cycles (
    organization_id,
    cycle_instance_id,
    name,
    code,
    start_date,
    end_date,
    status,
    planning_cycle_id
  )
  select
    ci.organization_id,
    ci.id,
    ('OKR-Zyklus ' || to_char(ci.starts_on, 'DD.MM.YYYY') || ' – ' || to_char(ci.ends_on, 'DD.MM.YYYY')),
    ci.code,
    ci.starts_on,
    ci.ends_on,
    'draft'::text,
    ci.legacy_planning_cycle_id
  from app.cycle_instances ci
  where ci.cycle_scheme_id = p_cycle_scheme_id
    and ci.legacy_planning_cycle_id is null
    and not exists (
      select 1
      from app.cycle_instances child
      where child.parent_instance_id = ci.id
        and child.cycle_scheme_id = ci.cycle_scheme_id
        and child.legacy_planning_cycle_id is null
    )
    and not exists (
      select 1 from app.okr_cycles oc where oc.cycle_instance_id = ci.id
    );

  return v_created;
end;
$$;

update app.okr_cycles
set name = 'OKR-Zyklus ' || to_char(start_date, 'DD.MM.YYYY') || ' – ' || to_char(end_date, 'DD.MM.YYYY');

-- migrate:down
select 1;
