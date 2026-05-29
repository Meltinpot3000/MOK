-- 014_seed_engineering_skills_okr_initiatives.sql
-- Programm + 3 Initiativen unter Stoßrichtung „Engineering skills“ für OKR-Planung
-- (Objective „Aufbau Product-/Solutions Engineering Gruppe“).
-- Idempotent via ON CONFLICT (id).
--
-- Anwendung:
--   npm run db:seed:engineering-initiatives
-- oder:
--   node scripts/run-sql-seed.mjs supabase/seed/014_seed_engineering_skills_okr_initiatives.sql

do $$
declare
  v_org_id uuid;
  v_ci uuid;
  v_pc uuid;
  v_admin uuid;
  v_dir_id uuid;

  -- Zyklus Ebene 3 #1.1.1 (OKR-Planung dieses Objectives)
  c_cycle_instance constant uuid := 'fdeb6ab9-5027-48fd-9d16-ab8358d82a9b'::uuid;
  -- Stoßrichtung I_C12_01 - Engineering skills
  c_direction constant uuid := 'ab0ca992-99e9-4ccb-a098-824e3d03158d'::uuid;

  c_program constant uuid := '10000000-0000-4000-8000-00000000000c'::uuid;
  c_init_1 constant uuid := '20000000-0000-4000-8000-00000000000c'::uuid;
  c_init_2 constant uuid := '20000000-0000-4000-8000-00000000000d'::uuid;
  c_init_3 constant uuid := '20000000-0000-4000-8000-00000000000e'::uuid;
begin
  select id into v_org_id from app.organizations where slug = 'cabtecgroup' limit 1;
  if v_org_id is null then
    raise notice '014_seed: cabtecgroup nicht gefunden — Seed uebersprungen.';
    return;
  end if;

  select id into v_admin
  from app.organization_memberships
  where organization_id = v_org_id and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

  if v_admin is null then
    raise notice '014_seed: keine aktive Mitgliedschaft — Seed uebersprungen.';
    return;
  end if;

  select ci.id, ci.legacy_planning_cycle_id
  into v_ci, v_pc
  from app.cycle_instances ci
  where ci.organization_id = v_org_id
    and ci.id = c_cycle_instance
  limit 1;

  if v_ci is null then
    select ci.id, ci.legacy_planning_cycle_id
    into v_ci, v_pc
    from app.cycle_instances ci
    where ci.organization_id = v_org_id
      and ci.name ilike '%Ebene 3 #1.1.1%'
    order by ci.starts_on desc
    limit 1;
  end if;

  if v_ci is null then
    raise notice '014_seed: cycle_instance nicht gefunden — Seed uebersprungen.';
    return;
  end if;

  if v_pc is null then
    select id into v_pc
    from app.planning_cycles
    where organization_id = v_org_id
    order by start_date desc nulls last
    limit 1;
  end if;

  select id into v_dir_id
  from app.strategic_directions
  where organization_id = v_org_id
    and cycle_instance_id = v_ci
    and id = c_direction
  limit 1;

  if v_dir_id is null then
    select id into v_dir_id
    from app.strategic_directions
    where organization_id = v_org_id
      and cycle_instance_id = v_ci
      and title ilike '%Engineering skills%'
    limit 1;
  end if;

  if v_dir_id is null then
    raise notice '014_seed: Stoßrichtung Engineering skills nicht im Zyklus — Seed uebersprungen.';
    return;
  end if;

  insert into app.strategy_programs (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    strategic_direction_id,
    title,
    description,
    status,
    program_origin,
    created_by_membership_id
  )
  values (
    c_program,
    v_org_id,
    v_pc,
    v_ci,
    v_dir_id,
    '[Seed] Programm Product & Solutions Engineering',
    'Aufbau und Skalierung der Product-/Solutions-Engineering-Fähigkeit: Recruiting, Prozesse, Tools.',
    'draft',
    'manual',
    v_admin
  )
  on conflict (id) do update
  set
    title = excluded.title,
    description = excluded.description,
    strategic_direction_id = excluded.strategic_direction_id,
    planning_cycle_id = excluded.planning_cycle_id,
    cycle_instance_id = excluded.cycle_instance_id,
    updated_at = now();

  insert into app.initiatives (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    program_id,
    title,
    description,
    status,
    priority,
    owner_membership_id,
    created_by_membership_id,
    created_by_source,
    weight,
    progress_percent,
    linked_okrs,
    deliverables
  )
  values
    (
      c_init_1,
      v_org_id,
      v_pc,
      v_ci,
      c_program,
      '[Seed] Solutions-Engineering Stellenprofil & Recruiting',
      'Definition, Freigabe und Ausschreibung von Rollen für Product-/Solutions-Engineering-Spezialisten.',
      'active',
      3,
      v_admin,
      v_admin,
      'user',
      5,
      20,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      c_init_2,
      v_org_id,
      v_pc,
      v_ci,
      c_program,
      '[Seed] Co-Engineering Prozesse & Team-Onboarding',
      'Prozessdesign und Einarbeitung, damit das neue Engineering-Team einsatzfähig arbeitet.',
      'active',
      3,
      v_admin,
      v_admin,
      'user',
      5,
      15,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      c_init_3,
      v_org_id,
      v_pc,
      v_ci,
      c_program,
      '[Seed] CAD/E-CAD Toolchain für Solutions Engineering',
      'Evaluation und Beschaffung von CAD- und E-CAD-Werkzeugen für den schnellen Team-Start.',
      'planned',
      2,
      v_admin,
      v_admin,
      'user',
      3,
      0,
      '[]'::jsonb,
      '[]'::jsonb
    )
  on conflict (id) do update
  set
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    program_id = excluded.program_id,
    planning_cycle_id = excluded.planning_cycle_id,
    cycle_instance_id = excluded.cycle_instance_id,
    updated_at = now();

  update app.strategy_programs
  set status = 'active', updated_at = now()
  where id = c_program
    and organization_id = v_org_id;

  raise notice
    '014_seed: Programm + 3 Initiativen fuer Stoßrichtung % in cycle_instance % angelegt.',
    v_dir_id,
    v_ci;
end $$;
