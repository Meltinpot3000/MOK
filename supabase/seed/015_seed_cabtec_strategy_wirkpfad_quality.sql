-- 015_seed_cabtec_strategy_wirkpfad_quality.sql
-- Vernünftige Beschreibungen und Wirkpfad-Verknüpfungen (Analyse → Herausforderung → Stoßrichtung → Ziel)
-- für cabtecgroup. Idempotent. Nach 008/012/012_okr ausführen.
-- migrate:up

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

  c1 constant uuid := '31000000-0000-4000-8000-000000000001'::uuid;
  c2 constant uuid := '31000000-0000-4000-8000-000000000002'::uuid;
  c3 constant uuid := '31000000-0000-4000-8000-000000000003'::uuid;
  c4 constant uuid := '31000000-0000-4000-8000-000000000004'::uuid;
  c5 constant uuid := '31000000-0000-4000-8000-000000000005'::uuid;

  v_has_active_scheme boolean;
  v_today date;
begin
  select id into v_org_id from app.organizations where slug = 'cabtecgroup' limit 1;
  if v_org_id is null then
    raise notice '015_seed: cabtecgroup nicht gefunden — uebersprungen.';
    return;
  end if;

  select id into v_admin
  from app.organization_memberships
  where organization_id = v_org_id and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

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

  -- Aktiver L1-Strategiezyklus (wie resolveStrategyPlanningCycle / level_no = 1)
  select ci.id, ci.legacy_planning_cycle_id
  into v_ci, v_pc
  from app.cycle_instances ci
  inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
  where ci.organization_id = v_org_id
    and (not v_has_active_scheme or sch.is_active)
    and ci.level_no = 1
    and ci.starts_on <= v_today
    and v_today < ci.ends_on
  order by ci.starts_on desc
  limit 1;

  if v_ci is null then
    select ci.id, ci.legacy_planning_cycle_id
    into v_ci, v_pc
    from app.cycle_instances ci
    inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id
      and (not v_has_active_scheme or sch.is_active)
      and ci.level_no = 1
      and ci.starts_on > v_today
    order by ci.starts_on asc
    limit 1;
  end if;

  if v_ci is null then
    select ci.id, ci.legacy_planning_cycle_id
    into v_ci, v_pc
    from app.cycle_instances ci
    inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id
      and (not v_has_active_scheme or sch.is_active)
      and ci.level_no = 1
      and ci.ends_on <= v_today
    order by ci.ends_on desc
    limit 1;
  end if;

  if v_ci is null then
    select ci.id, ci.legacy_planning_cycle_id
    into v_ci, v_pc
    from app.cycle_instances ci
    inner join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id
      and (not v_has_active_scheme or sch.is_active)
      and ci.level_no = 1
    order by ci.starts_on desc
    limit 1;
  end if;

  if v_ci is null then
    raise notice '015_seed: keine cycle_instance — uebersprungen.';
    return;
  end if;

  if v_pc is null then
    select id into v_pc
    from app.planning_cycles
    where organization_id = v_org_id
    order by start_date desc nulls last
    limit 1;
  end if;

  raise notice '015_seed: cycle_instance_id=%', v_ci;

  -- ── Analyse-Einträge: Beschreibungen vertiefen ─────────────────────────
  update app.analysis_entries ae
  set description = v.new_description, updated_at = now()
  from (
    values
      ('EU-Nachhaltigkeitsregulierung erhoeht Nachweisaufwand',
        'Die CabTec Group muss fuer OEM-Kunden Lieferketten- und Produkt-CO2-Nachweise in AV und Serienbegleitung liefern. Fehlende Standardprozesse verzoegern Freigaben und erhoehen Audit-Risiken in Maschinenbau und Nutzfahrzeug.'),
      ('Anhaltender Kostendruck bei OEMs',
        'OEM-Einkauf fordert Preisreduktionen bei gleichbleibender Komplexitaet. Standardnahe Konfektion wird zum Commodity; CabTec verliert Verhandlungsspielraum, wenn Differenzierung nicht ueber Co-Engineering und OTIF belegt wird.'),
      ('Fachkraeftemangel in Entwicklungsteams',
        'Offene Rollen in Arbeitsvorbereitung und Serienanlauf verlaengern Durchlaufzeiten. Ueberstunden in Spitzen und Abhaengigkeit von Einzelpersonen gefaehrden Qualitaet und Liefertermine in Intralogistik-Projekten.'),
      ('KI-gestuetzte Entwicklung wird Branchenstandard',
        'Wettbewerber nutzen KI fuer Varianten- und Fehleranalysen in der AV. Ohne eigene Toolchain faellt CabTec bei Time-to-Quote und Erstfreigabe gegenueber digitalisierten Konkurrenten zurueck.'),
      ('Dekarbonisierung beeinflusst Material- und Designentschiedungen',
        'Kunden verlangen recyclingfaehige Isolationsmaterialien und optimierte Verlegewege. CabTec muss Materialalternativen frueh in Co-Engineering-Sessions bewerten, ohne UL- und Temperaturanforderungen zu verletzen.'),
      ('Produkthaftungsrisiken bei Embedded-Software steigen',
        'Mit wachsender Softwaretiefe in Kabelbaeumen und Steuerungen steigen Anforderungen an Testabdeckung, Traceability und Haftungsdokumentation. Luecken gefaehrden Serienfreigaben bei Premium-OEMs.'),
      ('Durchlaufzeiten in Angebots- und Projektuebergabe zu hoch',
        'Medienbrueche zwischen Vertrieb, AV und Produktionsplanung verursachen Nacharbeiten. Kunden erleben lange Wartezeiten von Anfrage bis bestaetigter AV-Freigabe — ein Wettbewerbsnachteil gegenueber schnelleren Anbietern.'),
      ('Hohe Engineering-Kompetenz in komplexen Nischen',
        'CabTec loest anspruchsvolle Konfektionsaufgaben in raue Umgebungen und enge Bauraeme schneller als viele Wettbewerber. Fruehe Einbindung beim Kunden ist eine echte Staerke, die skaliert werden muss.'),
      ('Unklare Priorisierung im Portfolio',
        'Zu viele parallele Kundenprojekte ohne strategische Gewichtung binden AV-Kapazitaet. Kritische Rahmenvertraege konkurrieren mit Einmalauftraegen — Prioritaeten sind nicht fuer alle Teams transparent.'),
      ('Asiatische Anbieter greifen mit aggressiven Preisen an',
        'Preisfuehrerschaft und kurze Time-to-Quote bei Standardleitungen erhoehen den Druck auf CabTecs Margen. Differenzierung muss ueber Qualitaet, Co-Engineering und Lieferzuverlaessigkeit statt Preis allein gelingen.'),
      ('Wettbewerber investieren in digitale Serviceplattformen',
        'Konkurrenten bieten Kundenportal mit Auftragsstatus, AV-Versionen und Reklamationshistorie. CabTec fehlt eine integrierte Sicht von Angebot bis Auslieferung fuer Key Accounts.'),
      ('Abhaengigkeit von Schluesselkunden in einzelnen Segmenten',
        'Ein hoher Umsatzanteil bei wenigen OEMs erhoeht Verhandlungsdruck und Planungsvolatilitaet. Ausfaelle oder Budgetstreichungen einzelner Kunden wirken sich unmittelbar auf Auslastung aus.'),
      ('Beschleunigte Technologiewechsel koennen bestehende Kompetenzen entwerten',
        'Neue Bussysteme und Steckerplattformen koennen bestehendes Baugruppen-Know-how obsolet machen. CabTec muss Kompetenzaufbau und Standardisierung aktiv steuern.'),
      ('Cross-funktionale Teams koennen Time-to-Market messbar senken',
        'Pilot mit gemeinsamen Sprintzielen aus Vertrieb, AV und Shopfloor zeigt Potenzial: fruehere Klaerung offener Punkte und weniger Rueckfragen in der Serienanlaufphase.'),
      ('Fokussegmente fuer 2026 priorisieren',
        'Workshop-Ergebnis: Intralogistik und Nutzfahrzeug mit hohem Co-Engineering-Anteil priorisieren; Standardkonfektion nur mit klarer Margenschwelle.'),
      ('Wissensinseln in Spezialthemen',
        'UL-Pruefungen, Hochvolt-Isolation und kundenspezifische Crimp-Technologien liegen auf wenigen Experten. Ausfall oder Fluktuation fuehrt zu Freigabeverzoegerungen.'),
      ('Aufbau eines modularen Serviceportfolios',
        'Standardisierte Servicebausteine (Express-AV, Serienbegleitung, After-Sales-Kits) koennten Wiederverwendung und Margen verbessern — setzt klare Paketdefinition und Preislogik voraus.')
  ) as v(title, new_description)
  where ae.organization_id = v_org_id
    and ae.cycle_instance_id = v_ci
    and ae.title = v.title;

  -- Fallback: Eintraege nur mit planning_cycle_id (aeltere Seeds)
  update app.analysis_entries ae
  set description = v.new_description, updated_at = now(), cycle_instance_id = coalesce(ae.cycle_instance_id, v_ci)
  from (
    values
      ('EU-Nachhaltigkeitsregulierung erhoeht Nachweisaufwand',
        'Die CabTec Group muss fuer OEM-Kunden Lieferketten- und Produkt-CO2-Nachweise in AV und Serienbegleitung liefern. Fehlende Standardprozesse verzoegern Freigaben und erhoehen Audit-Risiken in Maschinenbau und Nutzfahrzeug.'),
      ('Dekarbonisierung beeinflusst Material- und Designentscheidungen',
        'Kunden verlangen recyclingfaehige Isolationsmaterialien und optimierte Verlegewege. CabTec muss Materialalternativen frueh in Co-Engineering-Sessions bewerten, ohne UL- und Temperaturanforderungen zu verletzen.')
  ) as v(title, new_description)
  where ae.organization_id = v_org_id
    and ae.planning_cycle_id = v_pc
    and ae.title = v.title
    and coalesce(length(ae.description), 0) < 80;

  update app.analysis_entries ae
  set
    description =
      'CabTec leitet aus dieser Analyse konkrete Implikationen fuer Konfektion, Co-Engineering und Lieferkette ab. '
      || 'Relevanz fuer OTIF, Qualitaet und Margen im OEM-Geschaeft bis 2028.',
    updated_at = now()
  where ae.organization_id = v_org_id
    and ae.cycle_instance_id = v_ci
    and coalesce(length(trim(ae.description)), 0) < 80;

  -- ── Herausforderungen (5, fachlich zu Stoßrichtungen) ───────────────────
  insert into app.strategic_challenges (
    id, organization_id, planning_cycle_id, cycle_instance_id,
    title, description, created_by_membership_id, created_by_source
  )
  values
    (c1, v_org_id, v_pc, v_ci,
      'Margendruck und Commoditisierung im Standardgeschaeft',
      'OEM-Einkauf reduziert Preise bei konfektionsnahen Standardleitungen. CabTec muss zeigen, warum Co-Engineering, OTIF und Qualitaetsnachweise Mehrwert liefern — sonst verliert das Unternehmen Volumen an Billiganbieter.',
      v_admin, 'user'),
    (c2, v_org_id, v_pc, v_ci,
      'Fachkraefte- und Wissensengpaesse in AV und Serienanlauf',
      'Offene Stellen und Wissensinseln in UL, Hochvolt und Crimp-Technik verlangsamen Freigaben. Projekte stocken, Nacharbeit steigt; ohne gezieltes Recruiting und Wissenstransfer drohen Lieferverzoegerungen.',
      v_admin, 'user'),
    (c3, v_org_id, v_pc, v_ci,
      'Regulatorik, Traceability und Export-Compliance',
      'EU-Nachhaltigkeits- und Haftungsanforderungen erhoehen Dokumentationspflicht entlang der Lieferkette. Fehlende durchgaengige Traceability von Material bis Pruefprotokoll gefaehrdet Serienfreigaben und Exportauftraege.',
      v_admin, 'user'),
    (c4, v_org_id, v_pc, v_ci,
      'Lange Durchlaufzeiten von Anfrage bis AV-Freigabe',
      'Medienbrueche zwischen Vertrieb, AV und Planung verursachen Wartezeiten und Nacharbeit. Kunden vergleichen Time-to-Quote mit Wettbewerbern; interne Priorisierung ist unklar.',
      v_admin, 'user'),
    (c5, v_org_id, v_pc, v_ci,
      'Umsatzkonzentration und Planungsvolatilitaet bei Key Accounts',
      'Hoher Anteil des Umsatzes bei wenigen OEMs erhoeht Verhandlungsdruck. Budgetaenderungen einzelner Kunden fuehren zu Auslastungsschwankungen in der Konfektion.',
      v_admin, 'user')
  on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      cycle_instance_id = excluded.cycle_instance_id,
      planning_cycle_id = excluded.planning_cycle_id,
      updated_at = now();

  -- ── Stoßrichtungen: Titel und Beschreibungen ───────────────────────────
  update app.strategic_directions sd
  set
    title = v.new_title,
    description = v.new_description,
    updated_at = now()
  from (
    values
      (d1, 'Differenziertes Wachstum im OEM-Co-Engineering',
        'CabTec baut Marktanteile in Intralogistik und Nutzfahrzeug durch fruehe Co-Engineering-Einbindung und nachweisbare Lieferzuverlaessigkeit aus — nicht durch Preisfuehrerschaft im Standardgeschaeft.'),
      (d2, 'Konfektionsexzellenz und OTIF-Fuehrerschaft',
        'Operative Exzellenz in AV, Produktion und Qualitaetssicherung: kuerzere Durchlaufzeiten, hohe FTQ im Serienanlauf und OTIF-Werte, die Key Accounts als verlaesslichen Partner bestaetigen.'),
      (d3, 'Kundenerlebnis und Transparenz entlang des Auftrags',
        'Von Angebot bis Auslieferung erleben Kunden planbare Termine, proaktive Kommunikation und schnelle Reklamationsbearbeitung — unterstuetzt durch digitale Statussichtbarkeit.'),
      (d4, 'Digitale AV- und Serienanlauf-Beschleunigung',
        'Standardisierte AV-Module, KI-gestuetzte Pruefungen und Shopfloor-Rueckmeldung verkürzen Time-to-Quote und Time-to-Series ohne Qualitaetsverlust.'),
      (d5, 'Compliance-faehige und nachhaltige Lieferkette',
        'ESG-Nachweise, Produkthaftung und Exportprozesse sind industrialisiert; Material- und Lieferantenentscheidungen sind auditierbar und risikoarm.')
  ) as v(id, new_title, new_description)
  where sd.id = v.id and sd.organization_id = v_org_id;

  -- ── Challenge ↔ Direction (1:1 statt Matrix-Anker) ────────────────────
  insert into app.challenge_direction_links (
    id, organization_id, planning_cycle_id, cycle_instance_id,
    strategic_direction_id, strategic_challenge_id, created_by_membership_id
  )
  values
    ('32000000-0000-4000-8000-000000000001'::uuid, v_org_id, v_pc, v_ci, d1, c1, v_admin),
    ('32000000-0000-4000-8000-000000000002'::uuid, v_org_id, v_pc, v_ci, d2, c4, v_admin),
    ('32000000-0000-4000-8000-000000000003'::uuid, v_org_id, v_pc, v_ci, d3, c5, v_admin),
    ('32000000-0000-4000-8000-000000000004'::uuid, v_org_id, v_pc, v_ci, d4, c2, v_admin),
    ('32000000-0000-4000-8000-000000000005'::uuid, v_org_id, v_pc, v_ci, d5, c3, v_admin)
  on conflict (id) do update
  set strategic_direction_id = excluded.strategic_direction_id,
      strategic_challenge_id = excluded.strategic_challenge_id,
      updated_at = now();

  -- ── Analyse → Herausforderung (inhaltlich passend) ───────────────────────
  insert into app.strategic_challenge_analysis_entries (
    organization_id, cycle_instance_id, strategic_challenge_id, analysis_entry_id
  )
  select v_org_id, v_ci, link.challenge_id, ae.id
  from (
    values
      (c1, 'Anhaltender Kostendruck bei OEMs'),
      (c1, 'Asiatische Anbieter greifen mit aggressiven Preisen an'),
      (c2, 'Fachkraeftemangel in Entwicklungsteams'),
      (c2, 'Wissensinseln in Spezialthemen'),
      (c2, 'KI-gestuetzte Entwicklung wird Branchenstandard'),
      (c3, 'EU-Nachhaltigkeitsregulierung erhoeht Nachweisaufwand'),
      (c3, 'Produkthaftungsrisiken bei Embedded-Software steigen'),
      (c4, 'Durchlaufzeiten in Angebots- und Projektuebergabe zu hoch'),
      (c4, 'Unklare Priorisierung im Portfolio'),
      (c5, 'Abhaengigkeit von Schluesselkunden in einzelnen Segmenten')
  ) as link(challenge_id, analysis_title)
  join app.analysis_entries ae
    on ae.organization_id = v_org_id
   and ae.planning_cycle_id = v_pc
   and ae.title = link.analysis_title
  on conflict (cycle_instance_id, strategic_challenge_id, analysis_entry_id)
  do nothing;

  -- Primary analysis source auf erste passende Analyse setzen
  update app.strategic_challenges ch
  set source_analysis_entry_id = sub.analysis_entry_id, updated_at = now()
  from (
    select distinct on (scae.strategic_challenge_id)
      scae.strategic_challenge_id,
      scae.analysis_entry_id
    from app.strategic_challenge_analysis_entries scae
    where scae.organization_id = v_org_id
      and scae.cycle_instance_id = v_ci
    order by scae.strategic_challenge_id, scae.created_at asc
  ) sub
  where ch.id = sub.strategic_challenge_id
    and ch.organization_id = v_org_id;

  -- ── Strategische Ziele: Beschreibungen ───────────────────────────────────
  update app.strategy_objectives so
  set description = v.new_desc, updated_at = now()
  from (
    values
      ('Kundenzufriedenheit und Lieferzuverlaessigkeit zur Markenstaerke ausbauen',
        'OTIF und Reklamationsquote in Top-OEM-Konten verbessern; CabTec soll als verlaesslicher Co-Engineering-Partner wahrgenommen werden, nicht nur als Konfektionslieferant.'),
      ('Operative Exzellenz in der Konfektion als Wettbewerbsvorteil verankern',
        'Durchlaufzeit AV bis Serienfreigabe und FTQ im Anlauf messbar senken; Standard-Arbeitsfolgen und Erstpacket-Qualitaet flaechendeckend etablieren.'),
      ('Qualitaetskultur: Fehler vor der Linie verhindern, nicht nur entdecken',
        'Poka-Yoke und FTQ-Ziele im Serienanlauf; Nacharbeitkosten unter Budget halten durch fruehe Fehlervermeidung in AV und Erstmuster.'),
      ('Supply Resilience fuer kritische Kontakt- und Leitungsteile sicherstellen',
        'Class-A-Materialien mit Zweitwerk und validierter Liefertreue absichern; Engpaesse duerfen OTIF-Ziele nicht gefaehrden.'),
      ('Digitalisierung: Transparenz von Auftrag bis Auslieferung',
        'Shopfloor-Terminals und Ticket-Workflows fuer Abweichungen; Echtzeit-Sicht auf offene Punkte fuer Kunden und interne Steuerung.'),
      ('Engineering-Rechner: Wiederverwendbare Module statt Einzelloesungen',
        'Baukasten-Anteil im Neugeschaeft erhoehen; Wiederverwendungsscores in AV-Dokumenten als Steuerungsgroesse etablieren.'),
      ('Nachhaltigkeit entlang Scope 2 und Verpackung messbar verbessern',
        'Energie pro produzierter Einheit und recyclingfaehige Verpackung senken; Kundennachweise fuer ESG-Reporting liefern.'),
      ('People: Fachkraeftegewinnung und schnelleres Onboarding',
        'Time-to-Productivity in Produktion und QS verbessern; kritische Rollen in AV und Prueftechnik schneller besetzen.'),
      ('Regulatorik und Export: Zoll- und Pruefprozesse industrialisieren',
        'Exportdokumente und Zollprozesse mit First-Pass-Qualitaet; Klärzeiten bei Abweichungen minimieren.'),
      ('IT/Cyber: Resilienz der Produktionssysteme',
        'MES- und AV-Systeme mit nachgewiesener Recovery-Faehigkeit; kritische Security-Findings zeitnah schliessen.'),
      ('Vertrieb: Rentables Wachstum im Rahmen- und Projektgeschaeft',
        'Pipeline-Qualitaet nach Deckungsbeitrag und Win-Rate in Fokussegmenten steigern — nicht Volumen um jeden Preis.'),
      ('Finance: Working Capital ohne Lieferzuverlaessigkeit zu schmaelern',
        'Lager- und Forderungsoptimierung mit OTIF-Schutz; Altbestaende aktiv abbauen.'),
      ('Test und Messtechnik: Kapazitaet fuer 100-Pruefung skalieren',
        'Pruefplatz-Auslastung und Rueckstau vor Freigabe-Tests reduzieren; Engpaesse in Hochvol-Pruefung beseitigen.'),
      ('Partnerschaften: strategische Werkzeug- und Betriebsmittelpartner stabilisieren',
        'Werkzeugverfuegbarkeit und Lebenszyklusplanung verbessern; ungeplante Stillstaende reduzieren.'),
      ('Kunde & Produkt: UL-Zertifizierung im Kernportfolio voranbringen',
        'UL-relevante Produktfamilien zertifizieren und audit-sicher pflegen; Findings ohne Ueberfaelligkeit.'),
      ('Sicherheit am Arbeitsplatz: Vorschlagsmanagement und Near-Miss',
        'Meldekultur staerken; schwere Beinahe-Unfaelle mit zeitnahem CAPA-Abschluss.'),
      ('Datenbasis: Stammdatenqualitaet in AV und ERP gegen Zielbild',
        'Stammdatenqualitaetsindex erhoehen; abweichende AV-Saetze ohne Ticket reduzieren.'),
      ('Value Engineering: Materialkosten ohne Qualitaetsregression senken',
        'Materialkostenindex bei Neu-Teilen senken; Substitutionen nur mit QS-Sign-off.'),
      ('Programm- und Portfoliomanagement: strategische Initiativen steuern',
        'Top-Initiativen im gruenen Zustand halten; kritische Meilensteine termingerecht.'),
      ('Innovation: Rapid Prototyping fuer Kundenpiloten beschleunigen',
        'Pilotdauer von Erstmuster bis validierter Serie verkuerzen; Lessons Learned dokumentieren.')
  ) as v(title_suffix, new_desc)
  where so.organization_id = v_org_id
    and so.cycle_instance_id = v_ci
    and so.title like '[OKR-Multi-Seed] ' || v.title_suffix;

  raise notice '015_seed: CabTec Wirkpfad-Qualitaet aktualisiert (org %). Fuer Objekt-Texte: 016_seed.', v_org_id;
end $$;

-- migrate:down
select 1;
