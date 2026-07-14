-- 016_seed_cabtec_strategy_object_descriptions.sql
-- CabTec-spezifische, analysefaehige Beschreibungen fuer alle Herausforderungen,
-- Stossrichtungen und strategische Ziele auf dem aktiven L1-Zyklus.
-- Basis: Unternehmensprofil (Hybrid-Kabelkonfektion/Co-Engineering, DACH-OEMs,
-- Segmente Maschinenbau/Intralogistik/Nutzfahrzeug, Built-2-Print & Lifecycle-Service).
-- migrate:up

do $$
declare
  v_org_id uuid;
  v_ci uuid;
  v_has_active_scheme boolean;
  v_today date;
begin
  select id into v_org_id from app.organizations where slug = 'cabtecgroup' limit 1;
  if v_org_id is null then return; end if;

  v_today := (timezone('utc', now()))::date;
  select exists (
    select 1 from app.cycle_instances ci
    join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id and sch.is_active
  ) into v_has_active_scheme;

  select ci.id into v_ci
  from app.cycle_instances ci
  join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
  where ci.organization_id = v_org_id
    and (not v_has_active_scheme or sch.is_active)
    and ci.level_no = 1
    and ci.starts_on <= v_today and v_today < ci.ends_on
  order by ci.starts_on desc limit 1;

  if v_ci is null then
    select ci.id into v_ci
    from app.cycle_instances ci
    join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id and (not v_has_active_scheme or sch.is_active)
      and ci.level_no = 1 and ci.starts_on > v_today
    order by ci.starts_on asc limit 1;
  end if;

  if v_ci is null then
    select ci.id into v_ci
    from app.cycle_instances ci
    join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
    where ci.organization_id = v_org_id and (not v_has_active_scheme or sch.is_active)
      and ci.level_no = 1 and ci.ends_on <= v_today
    order by ci.ends_on desc limit 1;
  end if;

  if v_ci is null then return; end if;

  -- ── Herausforderungen ─────────────────────────────────────────────────────
  update app.strategic_challenges ch
  set description = v.new_desc, updated_at = now()
  from (values
    ('1 Ensuring competitiveness through operational excellence',
      'Problem: CabTecs Wettbewerbsfaehigkeit in der Serienkonfektion haengt an OTIF, FTQ und Durchlaufzeit — Kunden in Maschinenbau und Intralogistik vergleichen uns mit Billiganbietern. Ziel bis 2028: OTIF auf 96 % und Nacharbeitquote um 30 % senken durch standardisierte AV-Arbeitsfolgen, Shopfloor-Rueckmeldung und Poka-Yoke in der 100-Pruefung.'),
    ('3 Securing profitability and avoiding high risks',
      'Risiko: Sinkende Stueckpreise bei OEM-Rahmenvertraegen und volatile Rohstoffkosten fuer Kupfer und Stecksysteme druecken den Deckungsbeitrag im Built-2-Print-Geschaeft. CabTec muss Margen pro Auftrag transparent steuern und Haftungsrisiken bei Sonderfreigaben reduzieren — Ziel: DB III stabil halten und kritische Einzelrisiken (UL, Export) bis 2028 auf Ampel gruen.'),
    ('4 Equipping the company with suitable personnel on a global level',
      'Fachkraeftemangel in AV, Crimp-Technik und Hochvolt-Pruefung verzoegert Freigaben fuer Nutzfahrzeug- und Intralogistik-Projekte. CabTec braucht gezieltes Recruiting, Wissenstransfer aus UL-/Crimp-Experten und schnelleres Onboarding — messbar: kritische Rollen < 60 Tage offen und Time-to-Productivity bis 2028 um 25 % verbessern.'),
    ('5 Developing applications with potential in order to retain or gain market share',
      'Ohne fruehe Co-Engineering-Einbindung verliert CabTec Anteile an Systemintegratoren in Wachstumssegmenten. Wir muessen Anwendungen in Intralogistik und Nutzfahrzeug mit gemeinsamen Spezifikationssprints und DfM-Reviews entwickeln — Ziel bis 2028: Anteil Co-Engineering-Umsatz von 28 % auf 38 % und Win-Rate in Zielsegmenten messbar erhoehen.'),
    ('6 Tapping potential in new geographical markets',
      'DACH-OEMs verlagern Teile der Beschaffung; CabTec will nahe Kunden in Europa produzieren und lokale Lieferketten aufbauen. Problem: fehlende Skalierung von Qualitaets- und Exportprozessen. Ziel: erste validierte Kundenprojekte in Zielregionen mit gleicher OTIF-Performance wie Kernwerk bis 2028.'),
    ('7a Establishing services as an additional benefit for customers and CabTec',
      'Reines Stueckpreisgeschaeft commoditisiert; CabTec kann mit Lifecycle & Service (Change-Management, Ersatzteil, Express-AV) Kundenbindung und Marge erhoehen. Ziel bis 2028: Service-Umsatzanteil messbar auf 15 % und SLA-Einhaltung bei Reklamationen > 90 %.'),
    ('7b Establishing added value as an additional benefit',
      'Zusaetzlicher Nutzen entsteht, wenn CabTec neben Konfektion Daten, Traceability und Technikberatung liefert. Problem: Services sind nicht paketiert und im Vertrieb nicht verkauft. Ziel: drei standardisierte Servicebausteine mit klarem KPI-Set und DB-Beitrag bis 2028 im Markt.'),
    ('8 Rebuilding a powerful sales organization',
      'Vertrieb verkauft noch zu oft Standardleitungen statt Co-Engineering-Pipeline; Forecast und Deckungsbeitrag sind in Key Accounts nicht durchgaengig. CabTec braucht technische Key-Account-Fuehrung und Pipeline-Qualitaet — Ziel bis 2028: gewichtete Pipeline DB in Fokussegmenten +40 % und Forecast-Genauigkeit verbessern.'),
    ('9 Implementing a modern corporate and management culture',
      'Fuehrung und Zusammenarbeit muessen projektbasierte Entscheidungen zwischen Vertrieb, AV und Shopfloor beschleunigen. Problem: Silos und unklare Verantwortung verzoegern Freigaben. Ziel bis 2028: cross-funktionale Reviews in Top-20-Kundenprojekten und Mitarbeiterbindung in kritischen Rollen messbar staerken.'),
    ('10 Rebuilding the knowledge position & knowhow',
      'Wissensinseln in UL, Hochvolt und kundenspezifischen Crimp-Prozessen gefaehrden Serienfreigaben. CabTec muss Expertenwissen dokumentieren, Schulungsketten aufbauen und Wiederverwendung in AV-Bausteinen erhoehen — Ziel: dokumentierte Prozessfaelle +50 % und Ausfallrisiko Einzelpersonen bis 2028 reduzieren.'),
    ('11 Ensure life cycle management',
      'OEM-Kunden erwarten Obsoleszenz-Management und Engineering Changes ueber die gesamte Produktlebensdauer — fehlende Lifecycle-Prozesse fuehren zu Reklamationen. CabTec industrialisiert Change- und Requalifikationsworkflows im Lifecycle-Service-Modell; Ziel bis 2028: Change-Durchlaufzeit -35 % und Kundenzufriedenheit Lifecycle KPI gruen.'),
    ('12 Ensure processes and skills in engineering',
      'AV und Fertigungsengineering muessen Varianten schneller industrialisieren; Medienbrueche zwischen Kundenzeichnung, Crimp-Bibliothek und Pruefplan kosten Tage. Ziel: Time-to-Quote und Time-to-Series in Co-Engineering-Projekten bis 2028 je -20 % durch standardisierte Module und Skills-Matrix.'),
    ('16 Ensuring business continuity',
      'Ausfall von MES, AV-Systemen oder kritischen Pruefplaetzen stoppt die Konfektionslinie — Cyber- und Lieferantenrisiken steigen. CabTec braucht nachgewiesene Recovery, Zweitquellen fuer Class-A-Material und Krisenplaene; Ziel bis 2028: RTO-Uebungen bestanden und ungeplante Stillstandsminuten -40 %.'),
    ('17 Continuous cost reduction (procurement, processes)',
      'Materialkosten fuer Leitungen und Stecker sowie Ruestzeiten belasten DB im Wettbewerb mit Asien. Value Engineering und Lieferantenentwicklung muessen Qualitaet (FTQ) wahren — Ziel bis 2028: Materialkostenindex Neu-Teile -6 % und Ruestverluste -15 % messbar.'),
    ('19 Keeping pace with advancing digitalization',
      'Wettbewerber digitalisieren Angebots-, AV- und Shopfloor-Prozesse; CabTec hat Medienbrueche zwischen ERP, AV und Pruefdaten. Ziel bis 2028: durchgaengige Statussicht fuer Kunden, KI-gestuetzte Pruefauswertung im Pilot und weniger manuelle Datenuebernahmen.'),
    ('20 Adapt management system to strategy',
      'ISO- und Kundenaudits verlangen, dass Management-System Prozesse der Strategie (Co-Engineering, OTIF, ESG) abbildet. Problem: veraltete Verfahrensanweisungen und KPI-Kaskade. Ziel bis 2028: Prozesslandkarte aktuell, Audit-Findings kritisch = 0 und Strategie-KPIs im Review verankert.'),
    ('22 Polishing up CabTec''s outdated image (CI/CD)',
      'Markt wahrnimmt CabTec teils als reinen Lohnfertiger statt Co-Engineering-Partner — das erschwert Zugang zu Neuprojekten. Ziel bis 2028: konsistentes Corporate Design, digitale Praesenz und Kundenkommunikation zu Capabilities (Built-2-Print, Lifecycle) — messbar: Markenfit in Key-Account-Befragungen verbessern.'),
    ('Asiatische Wettbewerbsdruck',
      'Asiatische Konkurrenten unterbieten Preise bei Standardkonfektion und liefern schnelle Muster — CabTec verliert Volumen, wenn Differenzierung nicht ueber Qualitaet, Co-Engineering und OTIF belegt wird. Ziel bis 2028: kein strategisches Neugeschaeft unter DB-Schwelle und Differenzierungsquote in Angeboten erhoehen.'),
    ('Margendruck und Commoditisierung im Standardgeschaeft',
      'OEM-Einkauf reduziert Preise bei konfektionsnahen Standardleitungen; ohne Nachweis von OTIF, Traceability und Co-Engineering-Mehrwert wird CabTec zum austauschbaren Lieferanten. Ziel bis 2028: DB-sichere Abgrenzung Standard vs. Engineering und Volumen nur mit Mindest-DB.'),
    ('Fachkraefte- und Wissensengpaesse in AV und Serienanlauf',
      'Offene Stellen und Wissensinseln in UL, Hochvolt und Crimp-Technik verlangsamen Freigaben in Maschinenbau-Projekten. Ueberstunden und Einzelabhaengigkeiten erhoehen Qualitaetsrisiko — Ziel bis 2028: kritische Rollen besetzt, Schulungspfad AV/QS und Wiederverwendung AV-Module messbar erhoehen.'),
    ('Regulatorik, Traceability und Export-Compliance',
      'EU-Nachhaltigkeits- und Haftungsregeln verlangen lueckenlose Dokumentation von Material bis Pruefprotokoll — Luecken stoppen Serienfreigaben und Export. CabTec industrialisiert ESG-Nachweise und Export-First-Pass — Ziel bis 2028: Audit-Findings kritisch = 0 und Traceability in Kernprozessen.'),
    ('Lange Durchlaufzeiten von Anfrage bis AV-Freigabe',
      'Medienbrueche zwischen Vertrieb, AV und Planung verursachen Wartezeiten; OEMs vergleichen Time-to-Quote mit schnelleren Wettbewerbern. Ziel bis 2028: Median Time-to-Quote -25 % durch Priorisierung, Standard-Arbeitsfolgen und digitale Rueckfragen-Workflows.'),
    ('Umsatzkonzentration und Planungsvolatilitaet bei Key Accounts',
      'Hoher Umsatzanteil bei wenigen OEMs erhoeht Verhandlungsdruck; Budgetaenderungen erzeugen Auslastungsschwankungen in der Konfektion. CabTec braucht diversifizierte Pipeline und Szenario-Planung — Ziel bis 2028: Top-3-Kundenanteil senken und Planungsgenauigkeit Quartalsauslastung verbessern.')
  ) as v(title, new_desc)
  where ch.organization_id = v_org_id and ch.cycle_instance_id = v_ci and ch.title = v.title;

  -- ── Stossrichtungen ───────────────────────────────────────────────────────
  update app.strategic_directions sd
  set description = v.new_desc, updated_at = now()
  from (values
    ('Differenziertes Wachstum im OEM-Co-Engineering',
      'Antwort auf Margendruck: CabTec waechst in Intralogistik und Nutzfahrzeug ueber fruehe Co-Engineering-Einbindung (Spezifikationssprints, DfM) statt Preisfuehrerschaft. Ziel bis 2028: Co-Engineering-Umsatzanteil +10 Prozentpunkte und Win-Rate in Fokus-OEMs messbar erhoehen — Kern des Hybrid-Modells Engineering plus Konfektion.'),
    ('Konfektionsexzellenz und OTIF-Fuehrerschaft',
      'Operative Exzellenz in AV, Produktion und QS sichert CabTecs Rolle als verlaesslicher Built-2-Print-Partner. Problem: Nacharbeit und Rueckstaue in der Pruefung. Ziel bis 2028: OTIF 96 %, FTQ im Serienanlauf +15 % und Durchlaufzeit AV bis Freigabe -20 %.'),
    ('Kundenerlebnis und Transparenz entlang des Auftrags',
      'OEMs erwarten von Angebot bis Auslieferung planbare Termine und proaktive Kommunikation — fehlende Statussicht schwächt Vertrauen. CabTec baut Kundenportal und Ticket-Workflows; Ziel bis 2028: Reklamations-Durchlaufzeit -30 % und Kundenzufriedenheit Top-Accounts messbar verbessern.'),
    ('Digitale AV- und Serienanlauf-Beschleunigung',
      'Digitalisierung beschleunigt Time-to-Quote und Time-to-Series: standardisierte AV-Module, Pruefdatenanbindung und Shopfloor-Rueckmeldung. Ziel bis 2028: Medienbrueche zwischen ERP, AV und MES reduzieren und Pilot KI-Pruefauswertung in Serienanlauf validieren.'),
    ('Compliance-faehige und nachhaltige Lieferkette',
      'Regulatorik und Kunden-ESG-Anforderungen machen Traceability und CO2-Nachweise zur Marktzugangsvoraussetzung. CabTec verankert Compliance in Materialwahl, Export und Dokumentation — Ziel bis 2028: First-Pass Export 92 % und Lieferketten-CO2-Basis fuer Kern-OEMs.'),
    ('C3_01 – Complementary Businesses',
      'Ergaenzende Geschaeftsfelder neben Kernkonfektion — z. B. Servicepakete und After-Sales — erhoehen Kundenbindung. CabTec priorisiert Angebote mit klarem DB und OEM-Fit in Maschinenbau; Ziel bis 2028: zwei skalierbare Zusatzgeschaefte mit positivem Deckungsbeitrag validieren.'),
    ('C5_02 – Automotive Applications',
      'Automotive-Anwendungen erfordern IATF-nahe Prozesse und lange Qualifizierungen — Chance fuer CabTec bei Nischen-Baugruppen. Ziel: selektive Automotive-Projekte nur mit Co-Engineering-Mehrwert und ohne DB-Verwaesserung bis 2028.'),
    ('C6_01 - Market Expansion Americas',
      'Geografische Expansion setzt lokale Lieferfaehigkeit und Export-Compliance voraus. CabTec prueft Partnerschaften und Nearshore-Konzepte fuer amerikanische OEM-Nachfrage — Ziel bis 2028: Pilotkunden mit OTIF vergleichbar zum Kernwerk.'),
    ('Complementary services',
      'Services (Express-AV, Lifecycle-Begleitung) differenzieren gegenueber Billigkonfektionaeren. Problem: Angebote nicht industrialisiert. Ziel bis 2028: drei Servicepakete mit SLA, Preislogik und messbarem Umsatzanteil.'),
    ('Expanded value proposition',
      'Wertversprechen ueber Stueckpreis hinaus: Technik, Termintreue, Traceability. CabTec kommuniziert Built-2-Print plus Co-Engineering in Vertrieb und Key Accounts — Ziel bis 2028: hoehere Conversion in Engineering-Lead-Projekten.'),
    ('I_C1_01 - OPEX',
      'OPEX-Disziplin sichert Profitabilitaet bei volatilem OEM-Volumen. Fokus: Ruestverluste, Ausschuss und Energie pro Einheit in der Konfektion senken ohne OTIF zu gefaehrden — Ziel bis 2028: OPEX-Index -8 % bei stabiler Qualitaet.'),
    ('I_C10_01 - Build up expertise',
      'Kompetenzaufbau in UL, Hochvolt und Crimp-Technik ist Voraussetzung fuer komplexe Baugruppen. CabTec investiert in Schulung, Mentoring und AV-Bausteine — Ziel bis 2028: Skills-Abdeckung kritische Prozesse > 90 %.'),
    ('I_C11_01 - Lifecycle',
      'Lifecycle-Management als Stossrichtung verankert Change-, Obsoleszenz- und Ersatzteilprozesse im Lifecycle-Service-Modell. Ziel bis 2028: durchschnittliche Change-Durchlaufzeit -35 % und Kundenbindung ueber Produktlebensdauer messbar.'),
    ('I_C12_01 - Engineering skills',
      'Co-Engineering-Dienstleistungen erfordern vertiefte Skills in Spezifikation, Simulation und Industrialisierung. CabTec baut Engineering-Rechner und DfM-Kompetenz aus — Ziel bis 2028: Baukasten-Anteil Neugeschaeft +15 Prozentpunkte.'),
    ('I_C16_01 - Business Continuity',
      'Business Continuity schuetzt Produktion und IT gegen Ausfaelle und Cyber-Risiken. Ziel bis 2028: dokumentierte Notfallplaene, RTO-Tests und redundante Versorgung Class-A-Material.'),
    ('I_C17_01 - Reduce production costs',
      'Produktionskosten senken durch Value Engineering, OEE und Standard-Arbeitsfolgen — ohne Qualitaetsregression bei 100-Pruefung. Ziel bis 2028: Fertigungskostenindex -7 % und FTQ stabil.'),
    ('I_C19_01 - Digitalisation',
      'Digitalisierung verbindet Vertrieb, AV, Shopfloor und Kundenstatus. CabTec reduziert manuelle Datenbrueche — Ziel bis 2028: Echtzeit-Sicht offene Punkte und digitale Freigabe Workflows in Kernprozessen.'),
    ('I_C20_01 – Adapt management system',
      'Management-System (ISO, Kundenanforderungen) spiegelt Strategie und Prozesse der CabTec Group. Ziel bis 2028: Prozess- und KPI-Kaskade aktuell, Audit-Findings ohne Ueberfaelligkeit.'),
    ('I_C22_01 - Adapt CD_CI',
      'Corporate Design und Identity unterstuetzen Positionierung als Co-Engineering-Partner. Ziel bis 2028: einheitliche Kundenkommunikation und Markenwahrnehmung in Zielsegmenten verbessern.'),
    ('I_C4_01 - Management and staff development',
      'Fuehrung und Personalentwicklung sichern Fachkraefte und Entscheidungsgeschwindigkeit. CabTec foerdert technische und fuehrungsbezogene Lernpfade — Ziel bis 2028: Vakanzzeit kritische Rollen < 60 Tage.'),
    ('I_C8_01 - Adapt sales organisation',
      'Vertriebsorganisation mit technischer Key-Account-Fuehrung und DB-steuerter Pipeline. Ziel bis 2028: Forecast-Genauigkeit und Win-Rate in Co-Engineering-Leads messbar erhoehen.'),
    ('I_C9_01 - corporate_leadership culture',
      'Fuehrungskultur mit Verantwortung, Feedback und cross-funktionaler Zusammenarbeit. Ziel bis 2028: schnellere Eskalationsloesung in Kundenprojekten und niedrigere Fluktuation Kernteams.'),
    ('Leading from a financial perspective',
      'Finanzielle Steuerung verknuepft Strategie mit DB, Working Capital und Investitionen in Co-Engineering. Ziel bis 2028: Plan-Ist-DB pro Segment transparent und NWC ohne OTIF-Verlust optimieren.'),
    ('reduce material costs & optimize supply chain',
      'Lieferkette und Materialkosten sind zentraler Hebel bei Kupfer- und Steckerpreisen. CabTec sichert Class-A-Material mit Zweitwerk und senkt Kosten durch VE — Ziel bis 2028: Liefertreue 98 % und Materialkostenindex -6 %.')
  ) as v(title, new_desc)
  where sd.organization_id = v_org_id and sd.cycle_instance_id = v_ci and sd.title = v.title;

  -- ── Strategische Ziele ────────────────────────────────────────────────────
  update app.strategy_objectives so
  set
    description = v.new_desc,
    ai_clarity_score = greatest(coalesce(so.ai_clarity_score, 0), 4),
    updated_at = now()
  from (values
    ('Avoid/minimize business interruptions and cyber risks',
      'Ziel: Geschaeftsunterbrechungen und Cyber-Risiken fuer Produktion, MES und AV-Systeme der CabTec Group minimieren. Massnahmen: Backup/Recovery, Segmentierung, Lieferanten-BCM — KPI bis 2028: RTO-Tests bestanden, kritische Security-Findings < 30 Tage offen, ungeplante Stillstandsminuten -40 %.'),
    ('Contemporary corporate and management culture is established',
      'Ziel: zeitgemaesse Fuehrungs- und Arbeitskultur mit kurzen Entscheidungswegen zwischen Vertrieb, AV und Shopfloor. CabTec misst Mitarbeiterfeedback und Projekt-Eskalationsdauer — KPI bis 2028: Engagement-Index +10 % und cross-funktionale Review in Top-Projekten Standard.'),
    ('Contemporary corporate design / corporate identity both internally and externally',
      'Ziel: einheitliches Erscheinungsbild intern und extern, das Co-Engineering und Built-2-Print kommuniziert. Problem: veraltete Wahrnehmung als Lohnfertiger. KPI bis 2028: Markenfit in Kundenbefragung und konsistente Templates in Vertrieb/Angeboten.'),
    ('Develop co-engineering skills to offer solutions',
      'Ziel: Co-Engineering-Kompetenz ausbauen — Spezifikation, DfM, Prototyping — um Loesungen statt nur Konfektion zu verkaufen. KPI bis 2028: Baukasten-Anteil +15 Prozentpunkte und mindestens 12 validierte Co-Engineering-Referenzprojekte in Intralogistik/Nutzfahrzeug.'),
    ('Development and expansion of the new Contruction & Security market segment.',
      'Ziel: neues Segment Construction & Security mit passenden Leitungsloesungen und Zertifizierungen erschliessen. CabTec prueft Markt, UL-Anforderungen und DB — KPI bis 2028: zwei Pilot-OEMs und positive DB in erstem Rahmenvertrag.'),
    ('Ensuring suitable specialists and managers',
      'Ziel: ausreichend qualifizierte Fach- und Fuehrungskraefte in AV, QS und Produktion. Problem: offene kritische Rollen. KPI bis 2028: Vakanzzeit < 60 Tage, Time-to-Productivity +25 %, Wissensdokumentation Kernprozesse +50 %.'),
    ('Gain market share. Opens doors with new/existing customers.',
      'Ziel: Marktanteil durch technische Differenzierung und OTIF bei bestehenden und neuen OEMs erhoehen. CabTec fokussiert Intralogistik und Nutzfahrzeug — KPI bis 2028: Win-Rate qualifizierte Ausschreibungen +5 Prozentpunkte und Umsatzwachstum DB-sicher.'),
    ('Gaining market share in familiar fields of application in automotive engineering',
      'Ziel: Marktanteil in vertrauten Automotive-Nischen (nicht Volumen um jeden Preis). Nur Projekte mit Co-Engineering-Mehrwert und IATF-tauglichen Prozessen — KPI bis 2028: zwei neue Automotive-Referenzen mit positivem DB.'),
    ('Increase customer benefits and make processes more efficient, supported by a comprehensive IT landscape/platform.',
      'Ziel: Kundennutzen durch effizientere Prozesse und integrierte IT von Angebot bis Auslieferung. CabTec verknuepft ERP, AV und Shopfloor-Daten — KPI bis 2028: Time-to-Quote -25 % und digitale Statussicht fuer Key Accounts.'),
    ('Lifecycle management is an integral part of the organization',
      'Ziel: Lifecycle-Management (Change, Obsoleszenz, Ersatzteil) fest in Organisation und Angebot verankern. KPI bis 2028: Change-Durchlaufzeit -35 % und Service-Umsatzanteil 15 %.'),
    ('Rebuilding knowledge to strengthen strategic positions for success.',
      'Ziel: Wissensbasis fuer UL, Hochvolt, Crimp und Kundenstandards systematisch aufbauen. Problem: Wissensinseln. KPI bis 2028: dokumentierte AV-Bausteine +50 % und Ausfallrisiko Einzelexperten messbar reduziert.'),
    ('Redesign and further development of the management system',
      'Ziel: Management-System an Strategie (Co-Engineering, OTIF, ESG) anpassen und weiterentwickeln. KPI bis 2028: Audit-Findings kritisch = 0, Prozesslandkarte aktuell, Strategie-KPIs im Management-Review.'),
    ('Strengthen competitiveness and increase profitability',
      'Ziel: Wettbewerbsfaehigkeit und Profitabilitaet gleichermassen staerken — DB pro Auftrag, OTIF und Differenzierung. KPI bis 2028: DB III stabil, OTIF 96 %, keine strategischen Verlustauftraege.'),
    ('Transformation into an agile and self-learning organization',
      'Ziel: agile, lernende Organisation fuer schnellere Kundenprojekte und Lessons Learned aus Serienanlaeufen. KPI bis 2028: Pilotdauer bis validierte Serie -20 % und dokumentierte Lessons Learned in 68 % der Projekte.'),
    ('We serve globally positioned new and existing customers',
      'Ziel: global agierende OEMs in DACH und Europa mit lokaler Lieferfaehigkeit und Co-Engineering bedienen. KPI bis 2028: On-Time-Export 92 % und mindestens ein neues OEM in Zielregion mit Referenz-OTIF.'),
    ('We take care of local&global customer needs.',
      'Ziel: lokale und globale Kundenanforderungen (Termin, Qualitaet, Dokumentation, Sprache) zuverlaessig erfuellen. CabTec standardisiert Key-Account-Prozesse — KPI bis 2028: Reklamationsquote -25 % und Kundenzufriedenheit Top-Accounts messbar.')
  ) as v(title, new_desc)
  where so.organization_id = v_org_id and so.cycle_instance_id = v_ci and so.title = v.title;

  -- OKR-Multi-Seed Ziele (falls vorhanden)
  update app.strategy_objectives so
  set description = v.new_desc, ai_clarity_score = greatest(coalesce(so.ai_clarity_score, 0), 4), updated_at = now()
  from (values
    ('Kundenzufriedenheit und Lieferzuverlaessigkeit zur Markenstaerke ausbauen',
      'OTIF und Reklamationsquote in Top-OEM-Konten verbessern; CabTec soll als verlaesslicher Co-Engineering-Partner wahrgenommen werden. KPI bis 2028: OTIF 96 %, Reklamationsquote -30 %, NPS Top-Accounts messbar.'),
    ('Operative Exzellenz in der Konfektion als Wettbewerbsvorteil verankern',
      'Durchlaufzeit AV bis Serienfreigabe und FTQ im Anlauf senken; Standard-Arbeitsfolgen flaechendeckend. KPI bis 2028: Durchlaufzeit -20 %, FTQ +15 %, Erstpacket-Qualitaet gruen.'),
    ('Qualitaetskultur: Fehler vor der Linie verhindern, nicht nur entdecken',
      'Poka-Yoke und FTQ-Ziele im Serienanlauf; Nacharbeitkosten unter Budget durch fruehe Fehlervermeidung in AV. KPI bis 2028: Nacharbeitkosten -25 %, schwere Fehler im Anlauf -40 %.'),
    ('Supply Resilience fuer kritische Kontakt- und Leitungsteile sicherstellen',
      'Class-A-Materialien mit Zweitwerk und validierter Liefertreue; Engpaesse duerfen OTIF nicht gefaehrden. KPI bis 2028: Liefertreue 98 %, Altbestand kritische Teile -30 %.'),
    ('Digitalisierung: Transparenz von Auftrag bis Auslieferung',
      'Shopfloor-Terminals und Ticket-Workflows; Echtzeit-Sicht fuer Kunden und Steuerung. KPI bis 2028: digitale Statusabdeckung Key Accounts 100 %, Rueckfragen-Durchlauf -35 %.'),
    ('Engineering-Rechner: Wiederverwendbare Module statt Einzelloesungen',
      'Baukasten-Anteil im Neugeschaeft erhoehen; Wiederverwendungsscores in AV messbar. KPI bis 2028: Baukasten-Anteil +15 Prozentpunkte, AV-Neuentwicklungszeit -20 %.'),
    ('Nachhaltigkeit entlang Scope 2 und Verpackung messbar verbessern',
      'Energie pro Einheit und recyclingfaehige Verpackung senken; ESG-Nachweise fuer OEMs. KPI bis 2028: Energieindex -10 %, recyclingfaehige Verpackung 62 % Gewicht.'),
    ('People: Fachkraeftegewinnung und schnelleres Onboarding',
      'Time-to-Productivity in Produktion und QS verbessern; kritische Rollen schneller besetzen. KPI bis 2028: Vakanz < 60 Tage, Onboarding-Index +25 %.'),
    ('Regulatorik und Export: Zoll- und Pruefprozesse industrialisieren',
      'Exportdokumente und Zoll mit First-Pass-Qualitaet; Klärzeiten minimieren. KPI bis 2028: First-Pass Export 92 %, Klaerzeit Abweichungen < 3 Tage.'),
    ('IT/Cyber: Resilienz der Produktionssysteme',
      'MES/AV mit nachgewiesener Recovery; Security-Findings zeitnah schliessen. KPI bis 2028: RTO-Tests 4x/Jahr bestanden, kritische Findings < 30 Tage.'),
    ('Vertrieb: Rentables Wachstum im Rahmen- und Projektgeschaeft',
      'Pipeline nach Deckungsbeitrag und Win-Rate steuern — kein Volumen um jeden Preis. KPI bis 2028: gewichtete Pipeline DB +40 %, Win-Rate +5 Prozentpunkte.'),
    ('Finance: Working Capital ohne Lieferzuverlaessigkeit zu schmaelern',
      'Lager- und Forderungsoptimierung mit OTIF-Schutz. KPI bis 2028: NWC -9 Tage, Altbestand > 180 Tage -40 %.'),
    ('Test und Messtechnik: Kapazitaet fuer 100-Pruefung skalieren',
      'Pruefplatz-Engpaesse beseitigen; Rueckstau vor Freigabe reduzieren. KPI bis 2028: Peak-Auslastung Pruefplaetze 82 %, Rueckstau -65 %.'),
    ('Partnerschaften: strategische Werkzeug- und Betriebsmittelpartner stabilisieren',
      'Werkzeugverfuegbarkeit und Lebenszyklusplanung verbessern. KPI bis 2028: ungeplante Stillstandsminuten Werkzeug -50 %.'),
    ('Kunde & Produkt: UL-Zertifizierung im Kernportfolio voranbringen',
      'UL-Produktfamilien zertifizieren und audit-sicher pflegen. KPI bis 2028: 92 % UL-Familien aktuell, Audit-Findings ueberfaellig = 0.'),
    ('Sicherheit am Arbeitsplatz: Vorschlagsmanagement und Near-Miss',
      'Meldekultur staerken; CAPA bei Near-Miss zeitnah. KPI bis 2028: 45 Vorschlaege/Quartal, schwere Near-Miss ohne CAPA = 0.'),
    ('Datenbasis: Stammdatenqualitaet in AV und ERP gegen Zielbild',
      'Stammdatenqualitaetsindex erhoehen; abweichende AV-Saetze ohne Ticket reduzieren. KPI bis 2028: Index 90 %, Abweichungen -65 %.'),
    ('Value Engineering: Materialkosten ohne Qualitaetsregression senken',
      'Materialkostenindex Neu-Teile senken; Substitution nur mit QS-Sign-off. KPI bis 2028: Index -6 %, FTQ stabil.'),
    ('Programm- und Portfoliomanagement: strategische Initiativen steuern',
      'Top-Initiativen im gruenen Zustand halten; Meilensteine termingerecht. KPI bis 2028: 11 von 12 Top-Initiativen gruen, kritische Meilensteine -50 % ueberfaellig.'),
    ('Innovation: Rapid Prototyping fuer Kundenpiloten beschleunigen',
      'Pilotdauer Erstmuster bis validierte Serie verkuerzen. KPI bis 2028: Median 9,5 Wochen, Lessons Learned 90 %.')
  ) as v(title_suffix, new_desc)
  where so.organization_id = v_org_id and so.cycle_instance_id = v_ci
    and so.title like '[OKR-Multi-Seed] ' || v.title_suffix;

  -- Revisions-Snapshot mit Legacy-Tabellen synchronisieren (UI liest v_current_strategy_objects).
  update app.strategy_object_revisions r
  set title = ch.title, description = ch.description, updated_at = now()
  from app.strategic_challenges ch
  where r.id = ch.id
    and r.organization_id = v_org_id
    and r.cycle_instance_id = v_ci
    and r.revision_state = 'current'
    and (r.title is distinct from ch.title or r.description is distinct from ch.description);

  update app.strategy_object_revisions r
  set title = sd.title, description = sd.description, updated_at = now()
  from app.strategic_directions sd
  where r.id = sd.id
    and r.organization_id = v_org_id
    and r.cycle_instance_id = v_ci
    and r.revision_state = 'current'
    and (r.title is distinct from sd.title or r.description is distinct from sd.description);

  update app.strategy_object_revisions r
  set title = so.title, description = so.description, updated_at = now()
  from app.strategy_objectives so
  where r.id = so.id
    and r.organization_id = v_org_id
    and r.cycle_instance_id = v_ci
    and r.revision_state = 'current'
    and (r.title is distinct from so.title or r.description is distinct from so.description);

  raise notice '016_seed: CabTec Objekt-Beschreibungen aktualisiert (cycle %).', v_ci;
end $$;

-- migrate:down
select 1;
