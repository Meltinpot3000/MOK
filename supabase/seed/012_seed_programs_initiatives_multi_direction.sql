-- 012_seed_programs_initiatives_multi_direction.sql
-- 5 Stoßrichtungen (deterministische IDs), je 1 Programm, jeweils 2 Initiativen.
-- Idempotent via ON CONFLICT (id).
-- Reihenfolge: Stoßrichtungen zuerst draft → Challenge-Link → active (Trigger
-- enforce_direction_activation_links). Programme zuerst draft → Initiativen →
-- active (Trigger enforce_program_activation_has_active_initiative).
-- Zykluswahl entspricht getActivePlanningCycle (web/lib/phase0/queries +
-- web/lib/planning/queries): aktives Schema, dann „aktuell“ / „kommend“ /
-- „vergangen“ wie im Frontend — nicht nur status=active der Instance.
-- Voraussetzung: Organisation slug 'cabtecgroup' (wie andere Seeds).
--
-- Anwendung z. B.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed/012_seed_programs_initiatives_multi_direction.sql
--
-- migrate:up (optional; kann auch manuell ausgeführt werden)

do $$
declare
  v_org_id uuid;
  v_ci uuid;
  v_pc uuid;
  v_admin uuid;

  d1 constant uuid := '30000000-0000-4000-8000-000000000001'::uuid;
  d2 constant uuid := '30000000-0000-4000-8000-000000000002'::uuid;
  d3 constant uuid := '30000000-0000-4000-8000-000000000003'::uuid;
  d4 constant uuid := '30000000-0000-4000-8000-000000000004'::uuid;
  d5 constant uuid := '30000000-0000-4000-8000-000000000005'::uuid;

  p1 constant uuid := '10000000-0000-4000-8000-000000000001'::uuid;
  p2 constant uuid := '10000000-0000-4000-8000-000000000002'::uuid;
  p3 constant uuid := '10000000-0000-4000-8000-000000000003'::uuid;
  p4 constant uuid := '10000000-0000-4000-8000-000000000004'::uuid;
  p5 constant uuid := '10000000-0000-4000-8000-000000000005'::uuid;

  c_seed constant uuid := '31000000-0000-4000-8000-000000000001'::uuid;

  l1 constant uuid := '32000000-0000-4000-8000-000000000001'::uuid;
  l2 constant uuid := '32000000-0000-4000-8000-000000000002'::uuid;
  l3 constant uuid := '32000000-0000-4000-8000-000000000003'::uuid;
  l4 constant uuid := '32000000-0000-4000-8000-000000000004'::uuid;
  l5 constant uuid := '32000000-0000-4000-8000-000000000005'::uuid;

  v_has_active_scheme boolean;
  v_today date;
begin
  select id into v_org_id from app.organizations where slug = 'cabtecgroup' limit 1;
  if v_org_id is null then
    raise notice '012_seed: cabtecgroup nicht gefunden — Seed uebersprungen.';
    return;
  end if;

  select id into v_admin
  from app.organization_memberships
  where organization_id = v_org_id and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

  if v_admin is null then
    raise notice '012_seed: keine aktive Mitgliedschaft — Seed uebersprungen.';
    return;
  end if;

  v_today := (timezone('utc', now()))::date;

  select exists (
    select 1
    from app.cycle_instances ci
    inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id
      and sch.is_active
  )
  into v_has_active_scheme;

  v_ci := null;
  v_pc := null;

  select ci.id, ci.legacy_planning_cycle_id
  into v_ci, v_pc
  from app.cycle_instances ci
  inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
  where ci.organization_id = v_org_id
    and (
      not v_has_active_scheme
      or sch.is_active
    )
    and ci.starts_on <= v_today
    and v_today < ci.ends_on
  order by ci.level_no desc, ci.starts_on desc
  limit 1;

  if v_ci is null then
    select ci.id, ci.legacy_planning_cycle_id
    into v_ci, v_pc
    from app.cycle_instances ci
    inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id
      and (not v_has_active_scheme or sch.is_active)
      and ci.starts_on > v_today
    order by ci.starts_on asc, ci.level_no desc
    limit 1;
  end if;

  if v_ci is null then
    select ci.id, ci.legacy_planning_cycle_id
    into v_ci, v_pc
    from app.cycle_instances ci
    inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id
      and (not v_has_active_scheme or sch.is_active)
      and ci.ends_on <= v_today
    order by ci.ends_on desc, ci.level_no desc
    limit 1;
  end if;

  if v_ci is null then
    select ci.id, ci.legacy_planning_cycle_id
    into v_ci, v_pc
    from app.cycle_instances ci
    inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id
      and (not v_has_active_scheme or sch.is_active)
    order by ci.starts_on desc
    limit 1;
  end if;

  if v_ci is null then
    raise notice '012_seed: keine cycle_instance — Seed uebersprungen.';
    return;
  end if;

  raise notice '012_seed: cycle_instance_id=% (wie OKR-Planung aktiv)', v_ci;

  if v_pc is null then
    select id into v_pc
    from app.planning_cycles
    where organization_id = v_org_id
          order by start_date desc nulls last
    limit 1;
  end if;

  insert into app.strategic_challenges (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    title,
    description,
    created_by_membership_id,
    created_by_source
  )
  values (
    c_seed,
    v_org_id,
    v_pc,
    v_ci,
    '[Seed] Demo-Herausforderung (Matrix-Anker)',
    'Seed: eine Herausforderung fuer Challenge–Direction-Links aller Demo-Richtungen.',
    v_admin,
    'user'
  )
  on conflict (id) do update
  set
    title = excluded.title,
    description = excluded.description,
    planning_cycle_id = excluded.planning_cycle_id,
    cycle_instance_id = excluded.cycle_instance_id,
    updated_at = now();

  insert into app.strategic_directions (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    title,
    description,
    status,
    created_by_membership_id,
    created_by_source,
    priority
  )
  values
    (
      d1,
      v_org_id,
      v_pc,
      v_ci,
      '[Seed] Wachstum & Marktanteil',
      'Demo: Differenzierung und nachhaltiges Wachstum im Kerngeschaeft.',
      'draft',
      v_admin,
      'user',
      3.25
    ),
    (
      d2,
      v_org_id,
      v_pc,
      v_ci,
      '[Seed] Operative Exzellenz',
      'Demo: Kosten, Qualitaet und Durchlaufzeiten verbessern.',
      'draft',
      v_admin,
      'user',
      3.15
    ),
    (
      d3,
      v_org_id,
      v_pc,
      v_ci,
      '[Seed] Kundenerlebnis & Loyalitaet',
      'Demo: Onboarding, Support und Retention staerken.',
      'draft',
      v_admin,
      'user',
      3.10
    ),
    (
      d4,
      v_org_id,
      v_pc,
      v_ci,
      '[Seed] Innovation & Produkte',
      'Demo: Neue Angebote und Plattformfaehigkeit.',
      'draft',
      v_admin,
      'user',
      3.05
    ),
    (
      d5,
      v_org_id,
      v_pc,
      v_ci,
      '[Seed] Nachhaltigkeit & Governance',
      'Demo: Regulatorik, ESG und Risikosteuerung.',
      'draft',
      v_admin,
      'user',
      3.00
    )
  on conflict (id) do update
  set
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    planning_cycle_id = excluded.planning_cycle_id,
    cycle_instance_id = excluded.cycle_instance_id,
    updated_at = now();

  insert into app.challenge_direction_links (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    strategic_direction_id,
    strategic_challenge_id,
    created_by_membership_id
  )
  values
    (l1, v_org_id, v_pc, v_ci, d1, c_seed, v_admin),
    (l2, v_org_id, v_pc, v_ci, d2, c_seed, v_admin),
    (l3, v_org_id, v_pc, v_ci, d3, c_seed, v_admin),
    (l4, v_org_id, v_pc, v_ci, d4, c_seed, v_admin),
    (l5, v_org_id, v_pc, v_ci, d5, c_seed, v_admin)
  on conflict (id) do update
  set
    organization_id = excluded.organization_id,
    planning_cycle_id = excluded.planning_cycle_id,
    cycle_instance_id = excluded.cycle_instance_id,
    strategic_direction_id = excluded.strategic_direction_id,
    strategic_challenge_id = excluded.strategic_challenge_id,
    updated_at = now();

  update app.strategic_directions
  set status = 'active', updated_at = now()
  where organization_id = v_org_id
    and id in (d1, d2, d3, d4, d5);

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
  values
    (
      p1,
      v_org_id,
      v_pc,
      v_ci,
      d1,
      '[Seed] Programm Revenue Acceleration',
      'Wachstumsprogramm: Pipeline, Pricing und Channel.',
      'draft',
      'manual',
      v_admin
    ),
    (
      p2,
      v_org_id,
      v_pc,
      v_ci,
      d2,
      '[Seed] Programm Lean Operations',
      'Effizienzprogramm: Standardisierung und Automatisierung.',
      'draft',
      'manual',
      v_admin
    ),
    (
      p3,
      v_org_id,
      v_pc,
      v_ci,
      d3,
      '[Seed] Programm Customer Journey',
      'CX-Programm: Onboarding, Erfolg und Support.',
      'draft',
      'manual',
      v_admin
    ),
    (
      p4,
      v_org_id,
      v_pc,
      v_ci,
      d4,
      '[Seed] Programm Product Velocity',
      'Innovationsprogramm: Time-to-Market und Feedback-Schleifen.',
      'draft',
      'manual',
      v_admin
    ),
    (
      p5,
      v_org_id,
      v_pc,
      v_ci,
      d5,
      '[Seed] Programm Trust & Compliance',
      'Governance-Programm: Policies, Audits und Transparenz.',
      'draft',
      'manual',
      v_admin
    )
  on conflict (id) do update
  set
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
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
      '20000000-0000-4000-8000-000000000001'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p1,
      '[Seed] Initiative Lead-Gen Kampagne Q2',
      'Content- und Paid-Kanaele fuer qualifizierte Leads.',
      'active',
      3,
      v_admin,
      v_admin,
      'user',
      3,
      15,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-000000000002'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p1,
      '[Seed] Initiative Partnerpipeline ausbauen',
      'Strukturierte Kooperationen mit Systemintegratoren.',
      'planned',
      3,
      v_admin,
      v_admin,
      'user',
      3,
      0,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-000000000003'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p2,
      '[Seed] Initiative Prozessautomatisierung Backoffice',
      'RPA und Workflow-Optimierung in Verwaltungsprozessen.',
      'active',
      3,
      v_admin,
      v_admin,
      'user',
      5,
      35,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-000000000004'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p2,
      '[Seed] Initiative Lieferanten-SLA harmonisieren',
      'Einheitliche KPIs und Eskalationspfade mit Lieferanten.',
      'planned',
      2,
      v_admin,
      v_admin,
      'user',
      3,
      0,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-000000000005'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p3,
      '[Seed] Initiative Onboarding Redesign',
      'Neues Erstkontakt-Erlebnis und Selbstbedienung im Portal.',
      'active',
      3,
      v_admin,
      v_admin,
      'user',
      8,
      45,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-000000000006'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p3,
      '[Seed] Initiative Voice-of-Customer Loop',
      'Quartalsweise Auswertung von NPS und Support-Themen.',
      'active',
      2,
      v_admin,
      v_admin,
      'user',
      3,
      20,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-000000000007'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p4,
      '[Seed] Initiative Beta-Feature-Flagging',
      'Kontrollierte Rollouts und Messung der Adoption.',
      'active',
      3,
      v_admin,
      v_admin,
      'user',
      3,
      25,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-000000000008'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p4,
      '[Seed] Initiative API-Produktisierung',
      'Stabile Schnittstellen und Developer-Dokumentation.',
      'planned',
      3,
      v_admin,
      v_admin,
      'user',
      3,
      0,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-000000000009'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p5,
      '[Seed] Initiative Policy-Portal & Schulungen',
      'Zentrale Policies und Pflichtschulungen fuer alle Rollen.',
      'active',
      3,
      v_admin,
      v_admin,
      'user',
      5,
      40,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      '20000000-0000-4000-8000-00000000000a'::uuid,
      v_org_id,
      v_pc,
      v_ci,
      p5,
      '[Seed] Initiative Datenklassifizierung rollen',
      'Einheitliche Labels und Zugriffsregeln fuer sensible Daten.',
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
  where organization_id = v_org_id
    and id in (p1, p2, p3, p4, p5);

  raise notice '012_seed: 5 Stoßrichtungen, 5 Programme, 10 Initiativen fuer org % upserted.', v_org_id;
end $$;
