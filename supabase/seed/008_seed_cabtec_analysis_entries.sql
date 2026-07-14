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
        'Die CabTec Group muss fuer OEM-Kunden Lieferketten- und Produkt-CO2-Nachweise in AV und Serienbegleitung liefern. Fehlende Standardprozesse verzoegern Freigaben und erhoehen Audit-Risiken in Maschinenbau und Nutzfahrzeug.', 4, 3),
      ('environment','economic','Anhaltender Kostendruck bei OEMs',
        'OEM-Einkauf fordert Preisreduktionen bei gleichbleibender Komplexitaet. Standardnahe Konfektion wird zum Commodity; CabTec verliert Verhandlungsspielraum, wenn Differenzierung nicht ueber Co-Engineering und OTIF belegt wird.', 5, 3),
      ('environment','social','Fachkraeftemangel in Entwicklungsteams',
        'Offene Rollen in Arbeitsvorbereitung und Serienanlauf verlaengern Durchlaufzeiten. Ueberstunden in Spitzen und Abhaengigkeit von Einzelpersonen gefaehrden Qualitaet und Liefertermine in Intralogistik-Projekten.', 4, 4),
      ('environment','technological','KI-gestuetzte Entwicklung wird Branchenstandard',
        'Wettbewerber nutzen KI fuer Varianten- und Fehleranalysen in der AV. Ohne eigene Toolchain faellt CabTec bei Time-to-Quote und Erstfreigabe gegenueber digitalisierten Konkurrenten zurueck.', 4, 3),
      ('environment','ecological','Dekarbonisierung beeinflusst Material- und Designentscheidungen',
        'Kunden verlangen recyclingfaehige Isolationsmaterialien und optimierte Verlegewege. CabTec muss Materialalternativen frueh in Co-Engineering-Sessions bewerten, ohne UL- und Temperaturanforderungen zu verletzen.', 4, 3),
      ('environment','legal','Produkthaftungsrisiken bei Embedded-Software steigen',
        'Mit wachsender Softwaretiefe in Kabelbaeumen und Steuerungen steigen Anforderungen an Testabdeckung, Traceability und Haftungsdokumentation. Luecken gefaehrden Serienfreigaben bei Premium-OEMs.', 5, 4),
      -- company
      ('company','effizienz','Durchlaufzeiten in Angebots- und Projektuebergabe zu hoch',
        'Medienbrueche zwischen Vertrieb, AV und Produktionsplanung verursachen Nacharbeiten. Kunden erleben lange Wartezeiten von Anfrage bis bestaetigter AV-Freigabe — ein Wettbewerbsnachteil gegenueber schnelleren Anbietern.', 4, 2),
      ('company','faehigkeiten','Hohe Engineering-Kompetenz in komplexen Nischen',
        'CabTec loest anspruchsvolle Konfektionsaufgaben in raue Umgebungen und enge Bauraeme schneller als viele Wettbewerber. Fruehe Einbindung beim Kunden ist eine echte Staerke, die skaliert werden muss.', 4, 2),
      ('company','prozesse','Unklare Priorisierung im Portfolio',
        'Zu viele parallele Kundenprojekte ohne strategische Gewichtung binden AV-Kapazitaet. Kritische Rahmenvertraege konkurrieren mit Einmalauftraegen — Prioritaeten sind nicht fuer alle Teams transparent.', 4, 3),
      -- competitor
      ('competitor','positionierung','Asiatische Anbieter greifen mit aggressiven Preisen an',
        'Preisfuehrerschaft und kurze Time-to-Quote bei Standardleitungen erhoehen den Druck auf CabTecs Margen. Differenzierung muss ueber Qualitaet, Co-Engineering und Lieferzuverlaessigkeit statt Preis allein gelingen.', 4, 3),
      ('competitor','innovation','Wettbewerber investieren in digitale Serviceplattformen',
        'Konkurrenten bieten Kundenportal mit Auftragsstatus, AV-Versionen und Reklamationshistorie. CabTec fehlt eine integrierte Sicht von Angebot bis Auslieferung fuer Key Accounts.', 4, 4),
      -- swot
      ('swot','weakness','Abhaengigkeit von Schluesselkunden in einzelnen Segmenten',
        'Ein hoher Umsatzanteil bei wenigen OEMs erhoeht Verhandlungsdruck und Planungsvolatilitaet. Ausfaelle oder Budgetstreichungen einzelner Kunden wirken sich unmittelbar auf Auslastung aus.', 4, 3),
      ('swot','threat','Beschleunigte Technologiewechsel koennen bestehende Kompetenzen entwerten',
        'Neue Bussysteme und Steckerplattformen koennen bestehendes Baugruppen-Know-how obsolet machen. CabTec muss Kompetenzaufbau und Standardisierung aktiv steuern.', 5, 4),
      -- workshop
      ('workshop','hypothesis','Cross-funktionale Teams koennen Time-to-Market messbar senken',
        'Pilot mit gemeinsamen Sprintzielen aus Vertrieb, AV und Shopfloor zeigt Potenzial: fruehere Klaerung offener Punkte und weniger Rueckfragen in der Serienanlaufphase.', 4, 3),
      ('workshop','decision','Fokussegmente fuer 2026 priorisieren',
        'Workshop-Ergebnis: Intralogistik und Nutzfahrzeug mit hohem Co-Engineering-Anteil priorisieren; Standardkonfektion nur mit klarer Margenschwelle.', 4, 2),
      -- other
      ('other','risk','Wissensinseln in Spezialthemen',
        'UL-Pruefungen, Hochvolt-Isolation und kundenspezifische Crimp-Technologien liegen auf wenigen Experten. Ausfall oder Fluktuation fuehrt zu Freigabeverzoegerungen.', 4, 3),
      ('other','opportunity','Aufbau eines modularen Serviceportfolios',
        'Standardisierte Servicebausteine (Express-AV, Serienbegleitung, After-Sales-Kits) koennten Wiederverwendung und Margen verbessern — setzt klare Paketdefinition und Preislogik voraus.', 4, 2)
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

  -- Bestehende Eintraege: Beschreibungen auf aktuellen Stand bringen
  update app.analysis_entries ae
  set description = s.description, updated_at = now()
  from seed_rows s
  where ae.organization_id = v_org_id
    and ae.planning_cycle_id = v_cycle_id
    and lower(ae.analysis_type) = lower(s.analysis_type)
    and lower(ae.title) = lower(s.title);
end
$$;

-- migrate:down
-- Non-destructive: keep seeded analysis data.
select 1;
