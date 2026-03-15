-- 008_seed_cabtec_analysis_entries.sql
-- Seed analysis entries for tenant cabtecgroup across all analysis fields.
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
    raise notice 'cabtecgroup not found, skipping seed.';
    return;
  end if;

  select id into v_cycle_id
  from app.planning_cycles
  where organization_id = v_org_id
  order by start_date desc nulls last, created_at desc
  limit 1;

  if v_cycle_id is null then
    raise notice 'No planning cycle for cabtecgroup, skipping seed.';
    return;
  end if;

  select id into v_membership_id
  from app.organization_memberships
  where organization_id = v_org_id
    and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

  with seed_rows(analysis_type, sub_type, title, description, impact_level, uncertainty_level) as (
    values
      -- environment incl. optional PESTEL refinement
      ('environment','political','EU-Nachhaltigkeitsregulierung erhoeht Nachweisaufwand',
        'Neue Vorgaben zu Lieferketten und Produktdokumentation erhoehen den Compliance-Aufwand in Engineering und Fertigung.', 4, 3),
      ('environment','economic','Anhaltender Kostendruck bei OEMs',
        'Kunden fordern mehr Entwicklungsleistung bei sinkenden Budgets; Preis- und Margendruck nimmt zu.', 5, 3),
      ('environment','social','Fachkraeftemangel in Entwicklungsteams',
        'Der Wettbewerb um qualifizierte Engineering-Profile verlangsamt Projekte und verteuert Kapazitaeten.', 4, 4),
      ('environment','technological','KI-gestuetzte Entwicklung wird Branchenstandard',
        'Toolchains mit KI beschleunigen Konzept- und Variantenentwicklung deutlich; ohne Adaption droht Wettbewerbsnachteil.', 4, 3),
      ('environment','ecological','Dekarbonisierung beeinflusst Material- und Designentscheidungen',
        'Kunden priorisieren CO2-Reduktion und Zirkularitaet in Entwicklungsprojekten.', 4, 3),
      ('environment','legal','Produkthaftungsrisiken bei Embedded-Software steigen',
        'Mit wachsender Softwaretiefe steigen Anforderungen an Testabdeckung, Traceability und Haftungsdokumentation.', 5, 4),
      -- company
      ('company','effizienz','Durchlaufzeiten in Angebots- und Projektuebergabe zu hoch',
        'Medienbrueche zwischen Vertrieb, Engineering und PM verursachen Wartezeiten und Nacharbeiten.', 4, 2),
      ('company','faehigkeiten','Hohe Engineering-Kompetenz in komplexen Nischen',
        'CabTec loest anspruchsvolle Entwicklungsaufgaben schneller als viele Wettbewerber und ist beim Kunden frueh eingebunden.', 4, 2),
      ('company','prozesse','Unklare Priorisierung im Portfolio',
        'Zu viele parallele Initiativen ohne klare strategische Priorisierung binden kritische Ressourcen.', 4, 3),
      -- competitor
      ('competitor','positionierung','Asiatische Anbieter greifen mit aggressiven Preisen an',
        'Preisfuehrerschaft kombiniert mit kuerzeren Time-to-Quote erhoeht den Wettbewerbsdruck in standardnahen Leistungen.', 4, 3),
      ('competitor','innovation','Wettbewerber investieren in digitale Serviceplattformen',
        'Digitale Kundenportale und datenbasierte Services verbessern Bindung und After-Sales-Umsaetze der Konkurrenz.', 4, 4),
      -- swot
      ('swot','weakness','Abhaengigkeit von Schluesselkunden in einzelnen Segmenten',
        'Ein hoher Umsatzanteil bei wenigen Accounts erhoeht Volatilitaet und Verhandlungsdruck.', 4, 3),
      ('swot','threat','Beschleunigte Technologiewechsel koennen bestehende Kompetenzen entwerten',
        'Wenn Plattformen und Standards schneller drehen, verliert bestehendes Loesungswissen an Differenzierung.', 5, 4),
      -- workshop
      ('workshop','hypothesis','Cross-funktionale Teams koennen Time-to-Market messbar senken',
        'Pilotansatz: fruehe Kopplung von Vertrieb, Engineering und Operations mit verbindlichen Sprintzielen.', 4, 3),
      ('workshop','decision','Fokussegmente fuer 2026 priorisieren',
        'Segmentpriorisierung auf Basis von Margenpotenzial, Differenzierung und Umsetzbarkeit im Operating Model.', 4, 2),
      -- other
      ('other','risk','Wissensinseln in Spezialthemen',
        'Kritisches Know-how ist auf wenige Personen konzentriert; Ausfallrisiko und Skalierungsgrenzen steigen.', 4, 3),
      ('other','opportunity','Aufbau eines modularen Serviceportfolios',
        'Standardisierte Servicebausteine erhoehen Wiederverwendbarkeit, Geschwindigkeit und Margenqualitaet.', 4, 2)
  )
  insert into app.analysis_entries (
    organization_id,
    planning_cycle_id,
    analysis_type,
    sub_type,
    title,
    description,
    impact_level,
    uncertainty_level,
    created_by_membership_id
  )
  select
    v_org_id,
    v_cycle_id,
    s.analysis_type,
    nullif(s.sub_type, ''),
    s.title,
    s.description,
    s.impact_level,
    s.uncertainty_level,
    v_membership_id
  from seed_rows s
  where not exists (
    select 1
    from app.analysis_entries ae
    where ae.organization_id = v_org_id
      and ae.planning_cycle_id = v_cycle_id
      and lower(ae.analysis_type) = lower(s.analysis_type)
      and lower(ae.title) = lower(s.title)
  );
end
$$;

-- migrate:down
-- Non-destructive: keep seeded analysis data.
select 1;
