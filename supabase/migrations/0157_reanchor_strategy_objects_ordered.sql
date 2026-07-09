-- 0157_reanchor_strategy_objects_ordered.sql
-- Re-Anchor in sicherer Reihenfolge: zuerst Verknuepfungstabellen, dann Hauptobjekte.
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

create or replace function app.reanchor_table_cycle_instance_to_level(
  p_schema text,
  p_table text,
  p_target_level int,
  p_min_source_level int
)
returns integer
language plpgsql
as $$
declare
  v_sql text;
  v_count integer;
begin
  v_sql := format(
    'update %I.%I t
     set cycle_instance_id = app.cycle_instance_ancestor_at_level(t.cycle_instance_id, $1)
     from app.cycle_instances ci
     where ci.id = t.cycle_instance_id
       and ci.level_no >= $2
       and app.cycle_instance_ancestor_at_level(t.cycle_instance_id, $1) is not null
       and t.cycle_instance_id is distinct from app.cycle_instance_ancestor_at_level(t.cycle_instance_id, $1)',
    p_schema,
    p_table
  );
  execute v_sql using p_target_level, p_min_source_level;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
declare
  t text;
  l1_link_tables text[] := array[
    'challenge_direction_links',
    'strategic_direction_objective_links',
    'objective_direction_links',
    'strategic_challenge_industries',
    'strategic_challenge_business_models',
    'strategic_challenge_analysis_entries',
    'strategic_direction_industries',
    'strategic_direction_business_models',
    'strategic_direction_operating_models',
    'objective_industries',
    'objective_business_models',
    'cluster_objective_relations',
    'strategy_correlation_status_overrides',
    'analysis_item_link_draft',
    'analysis_item_link',
    'analysis_cluster_members'
  ];
  l1_entity_tables text[] := array[
    'analysis_entries',
    'analysis_clusters',
    'analysis_gap_findings',
    'strategic_challenges',
    'strategic_directions',
    'strategy_objectives',
    'strategy_object_revisions',
    'strategy_object_review_assessments',
    'industries',
    'business_models',
    'operating_models',
    'analysis_manual_node_positions',
    'analysis_challenge_candidates',
    'analysis_background_jobs'
  ];
  l2_link_tables text[] := array[
    'initiative_target_links',
    'initiative_key_result_links',
    'annual_target_okr_objective_links',
    'annual_target_okr_objective_exceptions'
  ];
  l2_entity_tables text[] := array[
    'strategy_programs',
    'annual_targets',
    'initiatives',
    'cycle_instance_portfolio_evaluation'
  ];
begin
  foreach t in array l1_link_tables loop
    if to_regclass(format('app.%I', t)) is not null then
      perform app.reanchor_table_cycle_instance_to_level('app', t, 1, 2);
    end if;
  end loop;

  foreach t in array l1_entity_tables loop
    if to_regclass(format('app.%I', t)) is not null then
      perform app.reanchor_table_cycle_instance_to_level('app', t, 1, 2);
    end if;
  end loop;

  foreach t in array l2_link_tables loop
    if to_regclass(format('app.%I', t)) is not null then
      perform app.reanchor_table_cycle_instance_to_level('app', t, 2, 3);
    end if;
  end loop;

  foreach t in array l2_entity_tables loop
    if to_regclass(format('app.%I', t)) is not null then
      perform app.reanchor_table_cycle_instance_to_level('app', t, 2, 3);
    end if;
  end loop;
end;
$$;

drop function if exists app.reanchor_table_cycle_instance_to_level(text, text, int, int);

-- migrate:down

-- Kein Daten-Rollback.
