-- 010_seed_cabtec_built2print.sql
-- Seed "Built-2-Print" business model for tenant cabtecgroup.
-- migrate:up
do $$
declare
  v_org_id uuid;
  v_cycle_id uuid;
  v_membership_id uuid;
begin
  select id into v_org_id
  from app.organizations
  where slug = 'cabtecgroup'
  limit 1;

  if v_org_id is null then
    raise notice 'cabtecgroup not found, skipping Built-2-Print seed.';
    return;
  end if;

  select id into v_cycle_id
  from app.planning_cycles
  where organization_id = v_org_id
  order by start_date desc nulls last, created_at desc
  limit 1;

  if v_cycle_id is null then
    raise notice 'No planning cycle for cabtecgroup, skipping Built-2-Print seed.';
    return;
  end if;

  select id into v_membership_id
  from app.organization_memberships
  where organization_id = v_org_id
    and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

  with seed_industries(name, description, market_characteristics, growth_rate, strategic_importance, status) as (
    values
      (
        'Maschinen- und Anlagenbau',
        'Seriennahe bis mittelkomplexe Kabelkonfektion fuer industrielle Maschinen.',
        'Hoher Variantenanteil, kurze Reaktionszeiten, robuste Qualitaets- und Doku-Anforderungen.',
        0.045::numeric(6,3),
        'high',
        'active'
      ),
      (
        'Intralogistik und Automation',
        'Kabelbaeume und Baugruppen fuer Foerdertechnik, Sortiersysteme und Lagerautomation.',
        'Projektgeschaeft mit Ramp-up/Down-Zyklen und hoher Terminverbindlichkeit.',
        0.052::numeric(6,3),
        'high',
        'active'
      ),
      (
        'Land- und Nutzfahrzeugtechnik',
        'Konfektionierte Leitungsloesungen fuer vibrierende und raue Einsatzumgebungen.',
        'Preis- und Lieferzuverlaessigkeit sind kaufentscheidend; technische Robustheit ist Pflicht.',
        0.031::numeric(6,3),
        'medium',
        'active'
      )
  )
  insert into app.industries (
    organization_id,
    planning_cycle_id,
    name,
    description,
    market_characteristics,
    growth_rate,
    strategic_importance,
    status,
    created_by_membership_id
  )
  select
    v_org_id,
    v_cycle_id,
    s.name,
    s.description,
    s.market_characteristics,
    s.growth_rate,
    s.strategic_importance,
    s.status,
    v_membership_id
  from seed_industries s
  on conflict (planning_cycle_id, name)
  do update set
    description = excluded.description,
    market_characteristics = excluded.market_characteristics,
    growth_rate = excluded.growth_rate,
    strategic_importance = excluded.strategic_importance,
    status = excluded.status;

  insert into app.business_models (
    organization_id,
    planning_cycle_id,
    name,
    description,
    status,
    version_no,
    value_proposition,
    channels,
    customer_relationships,
    revenue_streams,
    key_resources,
    key_activities,
    key_partners,
    cost_structure,
    created_by_membership_id
  )
  values (
    v_org_id,
    v_cycle_id,
    'Built-2-Print',
    'Fertigungsfokussiertes Geschaeftsmodell fuer kundenspezifische Kabelkonfektion auf Basis freigegebener Zeichnungen, Spezifikationen und Stuecklisten.',
    'active',
    1,
    jsonb_build_array(
      jsonb_build_object('text', 'Kurze Industrialisierungszeit vom Kundenpaket bis zur Serienfreigabe'),
      jsonb_build_object('text', 'Hohe Liefertreue bei variantenreichen Kabelbaugruppen'),
      jsonb_build_object('text', 'Nachvollziehbare Qualitaets- und Prozessdokumentation je Los')
    ),
    jsonb_build_array(
      jsonb_build_object('text', 'Direktvertrieb an OEMs und Tier-1-Kunden'),
      jsonb_build_object('text', 'Technische Abstimmung via EDI/E-Mail und Kundenportale'),
      jsonb_build_object('text', 'Rahmenabrufe und rollierende Forecast-Planung')
    ),
    jsonb_build_array(
      jsonb_build_object('text', 'Fester Key-Account mit technischem Ansprechpartner'),
      jsonb_build_object('text', 'APQP/PPAP-nahe Einfuehrung bei qualitaetskritischen Projekten'),
      jsonb_build_object('text', 'Regelkommunikation zu Qualitaet, Kosten und Liefertreue')
    ),
    jsonb_build_array(
      jsonb_build_object('text', 'Stueckpreis pro konfektionierter Einheit'),
      jsonb_build_object('text', 'Werkzeug-/Anlaufkosten fuer Erstbemusterung'),
      jsonb_build_object('text', 'Zusatzentgelte fuer Eilauftraege und Sonderpruefungen')
    ),
    jsonb_build_array(
      jsonb_build_object('text', 'Crimp-, Schneid- und Testtechnik mit qualifizierten Prozessen'),
      jsonb_build_object('text', 'Erfahrenes Team in Arbeitsvorbereitung und Fertigungsengineering'),
      jsonb_build_object('text', 'Lieferantennetzwerk fuer Leitungen, Kontakte, Stecker und Schutzsysteme')
    ),
    jsonb_build_array(
      jsonb_build_object('text', 'Pruefung und Industrialisierung von Kundenunterlagen'),
      jsonb_build_object('text', 'Nullserien, Erstbemusterung und kontrollierter Serienanlauf'),
      jsonb_build_object('text', 'Serienfertigung inkl. 100%-Pruefung nach definiertem Pruefplan')
    ),
    jsonb_build_array(
      jsonb_build_object('text', 'Materiallieferanten fuer Steckverbinder, Leitungen und Kontakte'),
      jsonb_build_object('text', 'Werkzeug- und Betriebsmittelpartner'),
      jsonb_build_object('text', 'Pruef- und Zertifizierungsdienstleister')
    ),
    jsonb_build_array(
      jsonb_build_object('text', 'Materialeinsatz (Kupfer, Stecksysteme, Isolationsmaterial)'),
      jsonb_build_object('text', 'Direkte Fertigungskosten inkl. Ruesten und Qualitaetssicherung'),
      jsonb_build_object('text', 'Fixkosten fuer Engineering, Betriebsmittel und Compliance')
    ),
    v_membership_id
  )
  on conflict (planning_cycle_id, name, version_no)
  do update set
    description = excluded.description,
    status = excluded.status,
    value_proposition = excluded.value_proposition,
    channels = excluded.channels,
    customer_relationships = excluded.customer_relationships,
    revenue_streams = excluded.revenue_streams,
    key_resources = excluded.key_resources,
    key_activities = excluded.key_activities,
    key_partners = excluded.key_partners,
    cost_structure = excluded.cost_structure;

  with target_bm as (
    select id
    from app.business_models
    where organization_id = v_org_id
      and planning_cycle_id = v_cycle_id
      and name = 'Built-2-Print'
      and version_no = 1
    limit 1
  ),
  link_targets as (
    select i.id as industry_id
    from app.industries i
    where i.organization_id = v_org_id
      and i.planning_cycle_id = v_cycle_id
      and i.name in (
        'Maschinen- und Anlagenbau',
        'Intralogistik und Automation',
        'Land- und Nutzfahrzeugtechnik'
      )
  )
  insert into app.business_model_industries (
    organization_id,
    planning_cycle_id,
    business_model_id,
    industry_id
  )
  select
    v_org_id,
    v_cycle_id,
    bm.id,
    lt.industry_id
  from target_bm bm
  join link_targets lt on true
  on conflict (planning_cycle_id, business_model_id, industry_id)
  do nothing;
end
$$;

-- migrate:down
-- Non-destructive: keep seeded data.
select 1;
