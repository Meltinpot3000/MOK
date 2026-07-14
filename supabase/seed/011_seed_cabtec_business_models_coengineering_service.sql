-- 011_seed_cabtec_business_models_coengineering_service.sql
-- Seed additional cabtecgroup business models on the same L1 cycle as Built-2-Print.
-- migrate:up
do $$
declare
  v_org_id uuid;
  v_cycle_instance_id uuid;
  v_membership_id uuid;
begin
  select id into v_org_id
  from app.organizations
  where slug = 'cabtecgroup'
  limit 1;

  if v_org_id is null then
    raise notice 'cabtecgroup not found, skipping additional business model seed.';
    return;
  end if;

  select bm.cycle_instance_id into v_cycle_instance_id
  from app.business_models bm
  where bm.organization_id = v_org_id
    and bm.name = 'Built-2-Print'
  limit 1;

  if v_cycle_instance_id is null then
    select id into v_cycle_instance_id
    from app.cycle_instances
    where organization_id = v_org_id
      and level_no = 1
    order by starts_on desc nulls last, created_at desc
    limit 1;
  end if;

  if v_cycle_instance_id is null then
    raise notice 'No L1 cycle for cabtecgroup, skipping additional business model seed.';
    return;
  end if;

  select id into v_membership_id
  from app.organization_memberships
  where organization_id = v_org_id
    and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

  insert into app.business_models (
    organization_id,
    cycle_instance_id,
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
  select
    v_org_id,
    v_cycle_instance_id,
    seed.name,
    seed.description,
    'active',
    1,
    seed.value_proposition,
    seed.channels,
    seed.customer_relationships,
    seed.revenue_streams,
    seed.key_resources,
    seed.key_activities,
    seed.key_partners,
    seed.cost_structure,
    v_membership_id
  from (
    values
      (
        'Co-Engineering & Solutions',
        'Gemeinsame Entwicklung kundenspezifischer Kabel- und Baugruppenloesungen von der Idee bis zur serienreifen Spezifikation.',
        jsonb_build_array(
          jsonb_build_object('text', 'Fruehe Mitgestaltung von Produkt- und Prozessdesign mit dem Kunden'),
          jsonb_build_object('text', 'Reduzierte Time-to-Market durch integriertes Engineering'),
          jsonb_build_object('text', 'Technische Loesungen statt reiner Fertigungsauftrag')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Co-Design-Workshops und gemeinsame Spezifikationssprints'),
          jsonb_build_object('text', 'Technischer Direktvertrieb und Key-Account-Betreuung'),
          jsonb_build_object('text', 'Digitale Kollaboration in Kundenportale und PLM-Schnittstellen')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Langfristige Entwicklungspartnerschaften mit OEM-Engineering'),
          jsonb_build_object('text', 'Gemeinsame Roadmaps und Design-Freeze-Prozesse'),
          jsonb_build_object('text', 'Transparente Eskalation bei Design- und Fertigungsrisiken')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Engineering- und Projekthonorare'),
          jsonb_build_object('text', 'Serienpreise nach Freigabe der Loesung'),
          jsonb_build_object('text', 'Milestone-basierte Entwicklungsbudgets')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Fertigungs- und Prozessengineering mit Kundenkenntnis'),
          jsonb_build_object('text', 'Simulation, Prototyping und Testinfrastruktur'),
          jsonb_build_object('text', 'Cross-funktionale Projektteams Vertrieb-Engineering-Operations')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Anforderungsanalyse und Loesungskonzeption'),
          jsonb_build_object('text', 'Design-for-Manufacturing und Industrialisierung'),
          jsonb_build_object('text', 'Uebergabe in Serienfertigung inkl. Dokumentation')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Kunden-Engineering und Systemintegratoren'),
          jsonb_build_object('text', 'Werkstoff- und Komponentenlieferanten'),
          jsonb_build_object('text', 'Pruef- und Zertifizierungspartner')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Engineering- und Projektpersonalkosten'),
          jsonb_build_object('text', 'Prototypen- und Testmaterial'),
          jsonb_build_object('text', 'Gemeinsame Tooling- und Anlaufkosten')
        )
      ),
      (
        'Lifecycle & Service',
        'Begleitung des Produktlebenszyklus mit Service, Ersatzteilversorgung, Aenderungsmanagement und technischem Support.',
        jsonb_build_array(
          jsonb_build_object('text', 'Verlaesslicher Support ueber die gesamte Produktlebensdauer'),
          jsonb_build_object('text', 'Schnelle Reaktion bei Engineering Changes und Serienproblemen'),
          jsonb_build_object('text', 'Planbare Service- und Ersatzteilkosten fuer den Kunden')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Service-Hotline und technischer Support'),
          jsonb_build_object('text', 'Rahmenvertraege fuer Lifecycle-Betreuung'),
          jsonb_build_object('text', 'Digitale Service- und Change-Requests ueber Kundenportale')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Proaktive Kommunikation zu Obsoleszenz und Alternativen'),
          jsonb_build_object('text', 'SLA-basierte Reaktionszeiten im Serienbetrieb'),
          jsonb_build_object('text', 'Regelmaessige Review-Termine zu Qualitaet und Lieferperformance')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Service- und Supportpauschalen'),
          jsonb_build_object('text', 'Ersatzteil- und Nachfertigungsauftraege'),
          jsonb_build_object('text', 'Change- und Requalifikationsentgelte')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Service- und Qualitaetsteam mit Produkthistorie'),
          jsonb_build_object('text', 'Archiv fuer Freigaben, Pruefplaene und Seriendaten'),
          jsonb_build_object('text', 'Flexible Nachfertigungskapazitaet')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Change-Management und Requalifikation'),
          jsonb_build_object('text', 'Root-Cause-Analyse und Korrekturmassnahmen'),
          jsonb_build_object('text', 'Ersatzteil- und Spot-Order-Fertigung')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Komponentenlieferanten mit Langlebigkeitsgarantien'),
          jsonb_build_object('text', 'Logistikpartner fuer Ersatzteilversand'),
          jsonb_build_object('text', 'Externe Pruef- und Reklamationsdienstleister')
        ),
        jsonb_build_array(
          jsonb_build_object('text', 'Service- und Supportpersonal'),
          jsonb_build_object('text', 'Lagerhaltung kritischer Ersatzteile'),
          jsonb_build_object('text', 'Kosten fuer Change- und Requalifikationsprozesse')
        )
      )
  ) as seed(
    name,
    description,
    value_proposition,
    channels,
    customer_relationships,
    revenue_streams,
    key_resources,
    key_activities,
    key_partners,
    cost_structure
  )
  where not exists (
    select 1
    from app.business_models existing
    where existing.organization_id = v_org_id
      and existing.cycle_instance_id = v_cycle_instance_id
      and existing.name = seed.name
      and existing.version_no = 1
  );
end
$$;

-- migrate:down
-- Non-destructive: keep seeded data.
select 1;
