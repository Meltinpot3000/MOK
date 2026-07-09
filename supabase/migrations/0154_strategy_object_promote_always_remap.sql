-- 0154_strategy_object_promote_always_remap.sql
-- Promotion wechselt immer die revision.id — Remap/Legacy-Shim daher immer, nicht nur bei Hash-Änderung.
-- migrate:up

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

-- migrate:down

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
  v_remap_counts jsonb;
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

  if v_hash_changed then
    v_remap_counts := app.remap_strategy_object_links_on_promotion(
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
  end if;

  return p_revision_id;
end;
$fn$;
