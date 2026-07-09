-- 0161_fix_promote_remap_order_and_okr_link_columns.sql
-- Zwei Bugfixes für promote_strategy_object_revision:
--  1) Legacy-Shim MUSS vor dem FK-Remap laufen. Sonst zeigt der Remap FK-Links auf die
--     neue Revision-ID, bevor die neue Legacy-Zeile (id = neue Revision-ID) existiert
--     -> Fehler 23503 (FK violation) -> "Revision konnte nicht freigegeben werden."
--  2) app.okr_objective_strategy_objectives hat weder organization_id noch cycle_instance_id.
--     Der Remap darf dort nur nach strategy_objective_id filtern -> sonst 42703 (column does not exist).
-- migrate:up

create or replace function app.remap_strategy_object_links_on_promotion(
  p_organization_id uuid,
  p_cycle_instance_id uuid,
  p_object_type text,
  p_old_revision_id uuid,
  p_new_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = app, public
as $fn$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
  v_map jsonb;
begin
  if p_object_type = 'strategic_challenge' then
    update app.challenge_direction_links
    set strategic_challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('challenge_direction_links.challenge', v_n);

    update app.strategy_programs
    set strategic_challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.challenge', v_n);

    update app.strategy_correlation_status_overrides
    set challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.challenge', v_n);
  elsif p_object_type = 'strategic_direction' then
    update app.challenge_direction_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('challenge_direction_links.direction', v_n);

    update app.strategic_direction_objective_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategic_direction_objective_links', v_n);

    update app.objective_direction_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_direction_links.direction', v_n);

    update app.annual_targets
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('annual_targets', v_n);

    update app.strategy_programs
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.direction', v_n);

    update app.okr_objectives
    set leading_strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and leading_strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('okr_objectives.leading_direction', v_n);

    update app.strategy_correlation_status_overrides
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.direction', v_n);
  elsif p_object_type = 'strategic_objective' then
    update app.strategic_direction_objective_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategic_direction_objective_links.objective', v_n);

    update app.objective_direction_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_direction_links.objective', v_n);

    -- app.okr_objective_strategy_objectives hat KEIN organization_id/cycle_instance_id.
    update app.okr_objective_strategy_objectives
    set strategy_objective_id = p_new_revision_id
    where strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('okr_objective_strategy_objectives', v_n);

    update app.objective_target_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_target_links', v_n);

    v_map := jsonb_build_object(p_old_revision_id::text, p_new_revision_id);
    update app.strategy_programs p
    set supported_objective_ids = app._remap_uuid_array_from_map(p.supported_objective_ids, v_map)
    where p.organization_id = p_organization_id
      and p.cycle_instance_id = p_cycle_instance_id
      and p_old_revision_id = any (p.supported_objective_ids);
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.supported_objective_ids', v_n);

    update app.strategy_correlation_status_overrides
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.objective', v_n);
  end if;

  return v_counts;
end;
$fn$;

create or replace function app.promote_strategy_object_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_actor uuid;
  v_new record;
  v_old_current_id uuid;
  v_old_hash text;
  v_hash_changed boolean;
  v_legacy_table text;
begin
  select
    r.id,
    r.object_identity_id,
    r.organization_id,
    r.cycle_instance_id,
    r.revision_state,
    r.title,
    r.description,
    r.definition_payload,
    r.definition_hash,
    r.legacy_status,
    i.object_type
  into v_new
  from app.strategy_object_revisions r
  join app.strategy_object_identities i on i.id = r.object_identity_id
  where r.id = p_revision_id;

  if v_new.id is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  v_actor := app._strategy_object_assert_write_access(v_new.organization_id);

  if v_new.revision_state not in ('draft', 'pending_approval') then
    raise exception 'strategy-object-revision-not-promotable';
  end if;

  select r.id, r.definition_hash
    into v_old_current_id, v_old_hash
  from app.strategy_object_revisions r
  where r.object_identity_id = v_new.object_identity_id
    and r.cycle_instance_id = v_new.cycle_instance_id
    and r.revision_state = 'current'
  for update;

  if v_old_current_id is null then
    raise exception 'strategy-object-current-revision-missing';
  end if;

  v_hash_changed := v_old_hash is distinct from v_new.definition_hash;

  update app.strategy_object_revisions
  set revision_state = 'superseded'
  where id = v_old_current_id;

  update app.strategy_object_revisions
  set revision_state = 'current'
  where id = p_revision_id;

  -- WICHTIG: Legacy-Zeile (id = neue Revision-ID) zuerst anlegen, danach die FK-Links remappen.
  perform app._sync_legacy_strategy_object_on_promotion(
    v_new.object_type,
    v_old_current_id,
    p_revision_id,
    v_new.title,
    v_new.description,
    v_new.definition_payload,
    v_new.legacy_status,
    v_hash_changed
  );

  perform app.remap_strategy_object_links_on_promotion(
    v_new.organization_id,
    v_new.cycle_instance_id,
    v_new.object_type,
    v_old_current_id,
    p_revision_id
  );

  v_legacy_table := case v_new.object_type
    when 'strategic_challenge' then 'strategic_challenges'
    when 'strategic_direction' then 'strategic_directions'
    else 'strategy_objectives'
  end;

  insert into app.strategy_object_migration_map (
    organization_id,
    legacy_table,
    legacy_id,
    object_identity_id,
    revision_id,
    legacy_id_preserved
  )
  values (
    v_new.organization_id,
    v_legacy_table,
    p_revision_id,
    v_new.object_identity_id,
    p_revision_id,
    false
  )
  on conflict (legacy_table, legacy_id) do nothing;

  return p_revision_id;
end;
$fn$;

-- migrate:down

create or replace function app.remap_strategy_object_links_on_promotion(
  p_organization_id uuid,
  p_cycle_instance_id uuid,
  p_object_type text,
  p_old_revision_id uuid,
  p_new_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = app, public
as $fn$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
  v_map jsonb;
begin
  if p_object_type = 'strategic_challenge' then
    update app.challenge_direction_links
    set strategic_challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('challenge_direction_links.challenge', v_n);

    update app.strategy_programs
    set strategic_challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.challenge', v_n);

    update app.strategy_correlation_status_overrides
    set challenge_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and challenge_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.challenge', v_n);
  elsif p_object_type = 'strategic_direction' then
    update app.challenge_direction_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('challenge_direction_links.direction', v_n);

    update app.strategic_direction_objective_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategic_direction_objective_links', v_n);

    update app.objective_direction_links
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_direction_links.direction', v_n);

    update app.annual_targets
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('annual_targets', v_n);

    update app.strategy_programs
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.direction', v_n);

    update app.okr_objectives
    set leading_strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and leading_strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('okr_objectives.leading_direction', v_n);

    update app.strategy_correlation_status_overrides
    set strategic_direction_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategic_direction_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.direction', v_n);
  elsif p_object_type = 'strategic_objective' then
    update app.strategic_direction_objective_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategic_direction_objective_links.objective', v_n);

    update app.objective_direction_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_direction_links.objective', v_n);

    update app.okr_objective_strategy_objectives
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('okr_objective_strategy_objectives', v_n);

    update app.objective_target_links
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('objective_target_links', v_n);

    v_map := jsonb_build_object(p_old_revision_id::text, p_new_revision_id);
    update app.strategy_programs p
    set supported_objective_ids = app._remap_uuid_array_from_map(p.supported_objective_ids, v_map)
    where p.organization_id = p_organization_id
      and p.cycle_instance_id = p_cycle_instance_id
      and p_old_revision_id = any (p.supported_objective_ids);
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_programs.supported_objective_ids', v_n);

    update app.strategy_correlation_status_overrides
    set strategy_objective_id = p_new_revision_id
    where organization_id = p_organization_id
      and cycle_instance_id = p_cycle_instance_id
      and strategy_objective_id = p_old_revision_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('strategy_correlation_status_overrides.objective', v_n);
  end if;

  return v_counts;
end;
$fn$;

create or replace function app.promote_strategy_object_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = app, public, rbac
as $fn$
declare
  v_actor uuid;
  v_new record;
  v_old_current_id uuid;
  v_old_hash text;
  v_hash_changed boolean;
  v_legacy_table text;
begin
  select
    r.id,
    r.object_identity_id,
    r.organization_id,
    r.cycle_instance_id,
    r.revision_state,
    r.title,
    r.description,
    r.definition_payload,
    r.definition_hash,
    r.legacy_status,
    i.object_type
  into v_new
  from app.strategy_object_revisions r
  join app.strategy_object_identities i on i.id = r.object_identity_id
  where r.id = p_revision_id;

  if v_new.id is null then
    raise exception 'strategy-object-revision-not-found';
  end if;

  v_actor := app._strategy_object_assert_write_access(v_new.organization_id);

  if v_new.revision_state not in ('draft', 'pending_approval') then
    raise exception 'strategy-object-revision-not-promotable';
  end if;

  select r.id, r.definition_hash
    into v_old_current_id, v_old_hash
  from app.strategy_object_revisions r
  where r.object_identity_id = v_new.object_identity_id
    and r.cycle_instance_id = v_new.cycle_instance_id
    and r.revision_state = 'current'
  for update;

  if v_old_current_id is null then
    raise exception 'strategy-object-current-revision-missing';
  end if;

  v_hash_changed := v_old_hash is distinct from v_new.definition_hash;

  update app.strategy_object_revisions
  set revision_state = 'superseded'
  where id = v_old_current_id;

  update app.strategy_object_revisions
  set revision_state = 'current'
  where id = p_revision_id;

  perform app.remap_strategy_object_links_on_promotion(
    v_new.organization_id,
    v_new.cycle_instance_id,
    v_new.object_type,
    v_old_current_id,
    p_revision_id
  );

  perform app._sync_legacy_strategy_object_on_promotion(
    v_new.object_type,
    v_old_current_id,
    p_revision_id,
    v_new.title,
    v_new.description,
    v_new.definition_payload,
    v_new.legacy_status,
    v_hash_changed
  );

  v_legacy_table := case v_new.object_type
    when 'strategic_challenge' then 'strategic_challenges'
    when 'strategic_direction' then 'strategic_directions'
    else 'strategy_objectives'
  end;

  insert into app.strategy_object_migration_map (
    organization_id,
    legacy_table,
    legacy_id,
    object_identity_id,
    revision_id,
    legacy_id_preserved
  )
  values (
    v_new.organization_id,
    v_legacy_table,
    p_revision_id,
    v_new.object_identity_id,
    p_revision_id,
    false
  )
  on conflict (legacy_table, legacy_id) do nothing;

  return p_revision_id;
end;
$fn$;
