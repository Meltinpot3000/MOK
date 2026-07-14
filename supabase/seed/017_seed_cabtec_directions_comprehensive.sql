-- 017_seed_cabtec_directions_comprehensive.sql
-- Vertiefte CabTec-Beschreibungen fuer ALLE Stossrichtungen (alle Zyklen),
-- inkl. Legacy-[Seed]-Demo-Titel und Revision-Sync. Idempotent.
-- migrate:up

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from app.organizations where slug = 'cabtecgroup' limit 1;
  if v_org_id is null then
    raise notice '017_seed: cabtecgroup nicht gefunden — uebersprungen.';
    return;
  end if;

  -- ── Legacy-[Seed]-Titel bereinigen und mit CabTec-Inhalten fuellen ─────────
  update app.strategic_directions sd
  set
    title = m.new_title,
    description = m.new_desc,
    updated_at = now()
  from (values
    (
      '[Seed] Nachhaltigkeit & Governance',
      'Nachhaltigkeit, ESG und Governance entlang der Lieferkette',
      'Stossrichtung: CabTec industrialisiert ESG-Nachweise, Produkthaftung und Lieferketten-Compliance fuer OEMs in Maschinenbau und Nutzfahrzeug. Problem: fehlende CO2-Basis, unklare Verantwortlichkeiten und Audit-Luecken bei Material- und Exportdokumentation. Ziel bis 2028: Scope-2-Transparenz fuer Kernprodukte, First-Pass Export 92 % und keine kritischen Audit-Findings in Traceability.'
    ),
    (
      '[Seed] Operative Exzellenz',
      'Operative Exzellenz in Konfektion und AV',
      'Stossrichtung: CabTec sichert Wettbewerbsfaehigkeit durch OTIF, FTQ und kurze Durchlaufzeiten in AV, Produktion und 100-Pruefung. Problem: Nacharbeit, Rueckstau an Pruefplaetzen und Ruestverluste belasten DB. Ziel bis 2028: OTIF 96 %, FTQ im Serienanlauf +15 %, Durchlaufzeit AV bis Freigabe -20 % und Nacharbeitkosten -25 %.'
    ),
    (
      '[Seed] Kundenerlebnis & Loyalitaet',
      'Kundenerlebnis und Transparenz entlang des Auftrags',
      'Stossrichtung: OEMs erwarten von Angebot bis Auslieferung planbare Termine, proaktive Kommunikation und schnelle Reklamationsloesung. CabTec baut digitale Statussicht und Ticket-Workflows fuer Key Accounts. Ziel bis 2028: Reklamations-Durchlaufzeit -30 %, OTIF in Top-Konten 96 % und messbar hoehere Kundenzufriedenheit.'
    ),
    (
      '[Seed] Digitale Transformation',
      'Digitale AV- und Serienanlauf-Beschleunigung',
      'Stossrichtung: Medienbrueche zwischen ERP, AV, MES und Pruefdaten verzoegern Time-to-Quote und Serienfreigaben. CabTec verbindet Shopfloor-Rueckmeldung, digitale Freigaben und KI-Piloten in der Pruefauswertung. Ziel bis 2028: Time-to-Quote -25 %, digitale Statusabdeckung Key Accounts 100 % und weniger manuelle Datenuebernahmen.'
    ),
    (
      '[Seed] Wachstum & Marktanteil',
      'Differenziertes Wachstum im OEM-Co-Engineering',
      'Stossrichtung: CabTec waechst in Intralogistik und Nutzfahrzeug ueber fruehe Co-Engineering-Einbindung statt Preisfuehrerschaft im Commodity-Konfektionsgeschaeft. Ziel bis 2028: Co-Engineering-Umsatzanteil +10 Prozentpunkte, Win-Rate in Fokus-OEMs messbar erhoehen und kein strategisches Neugeschaeft unter DB-Schwelle.'
    ),
    (
      '[Seed] Revenue Acceleration',
      'Differenziertes Wachstum im OEM-Co-Engineering',
      'Stossrichtung: Technische Key-Account-Fuehrung und DB-gesteuerte Pipeline beschleunigen rentables Wachstum. CabTec fokussiert Engineering-Leads mit Co-Engineering-Mehrwert statt Volumen um jeden Preis. Ziel bis 2028: gewichtete Pipeline DB +40 % und Win-Rate qualifizierte Ausschreibungen +5 Prozentpunkte.'
    ),
    (
      '[Seed] Lean Operations',
      'Operative Exzellenz in Konfektion und AV',
      'Stossrichtung: Lean-Prinzipien in AV-Arbeitsfolgen, Shopfloor und Rueckmeldung senken Durchlaufzeit und Ausschuss ohne OTIF zu gefaehrden. Ziel bis 2028: OEE in Kernlinien +8 %, Ruestverluste -15 % und Durchlaufzeit AV bis Freigabe -20 %.'
    ),
    (
      '[Seed] Customer Journey',
      'Kundenerlebnis und Transparenz entlang des Auftrags',
      'Stossrichtung: End-to-End-Transparenz von Anfrage ueber AV-Freigabe bis Auslieferung staerkt Vertrauen bei OEM-Einkauf und Entwicklung. CabTec standardisiert Kommunikations- und Eskalationspfade. Ziel bis 2028: Rueckfragen-Durchlauf -35 % und Reklamationsquote Top-Accounts -25 %.'
    ),
    (
      '[Seed] Product Velocity',
      'Digitale AV- und Serienanlauf-Beschleunigung',
      'Stossrichtung: Schnellere Industrialisierung von Kundenvarianten durch AV-Bausteine, parallele Freigaben und digitale Pruefplanung. Ziel bis 2028: Median Time-to-Series in Co-Engineering-Projekten -20 % und Baukasten-Anteil Neugeschaeft +15 Prozentpunkte.'
    ),
    (
      '[Seed] Trust & Compliance',
      'Compliance-faehige und nachhaltige Lieferkette',
      'Stossrichtung: Traceability von Material bis Pruefprotokoll, UL-/IATF-nahe Prozesse und Export-Compliance sind Marktzugangsvoraussetzung. CabTec verankert Governance in Lieferantenwahl und Dokumentation. Ziel bis 2028: Audit-Findings kritisch = 0 und Lieferketten-CO2-Basis fuer Kern-OEMs.'
    )
  ) as m(old_title, new_title, new_desc)
  where sd.organization_id = v_org_id
    and sd.title = m.old_title;

  -- ── Alle bekannten Stossrichtungs-Titel (org-weit, alle Zyklen) ───────────
  update app.strategic_directions sd
  set description = m.new_desc, updated_at = now()
  from (values
    ('Differenziertes Wachstum im OEM-Co-Engineering',
      'Antwort auf Margendruck und Commoditisierung: CabTec waechst in Intralogistik und Nutzfahrzeug ueber fruehe Co-Engineering-Einbindung (Spezifikationssprints, DfM-Reviews) statt Preisfuehrerschaft. Problem: Systemintegratoren gewinnen Engineering-Anteile. Ziel bis 2028: Co-Engineering-Umsatzanteil +10 Prozentpunkte, Win-Rate in Fokus-OEMs messbar und Hybridmodell Engineering plus Konfektion als Differenzierung.'),
    ('Konfektionsexzellenz und OTIF-Fuehrerschaft',
      'Operative Exzellenz in AV, Produktion und QS sichert CabTecs Rolle als verlaesslicher Built-2-Print-Partner fuer DACH-OEMs. Problem: Nacharbeit in der 100-Pruefung, Rueckstau an Pruefplaetzen und Ruestverluste. Ziel bis 2028: OTIF 96 %, FTQ im Serienanlauf +15 %, Durchlaufzeit AV bis Freigabe -20 % und Nacharbeitkosten -25 % bei stabilen Kundenaudits.'),
    ('Kundenerlebnis und Transparenz entlang des Auftrags',
      'OEMs in Maschinenbau und Intralogistik erwarten von Angebot bis Auslieferung planbare Termine und proaktive Kommunikation. Fehlende Statussicht schwaecht Vertrauen und erhoeht Rueckfragen. CabTec baut Kundenportal, Ticket-Workflows und SLA fuer Key Accounts. Ziel bis 2028: Reklamations-Durchlaufzeit -30 %, digitale Statusabdeckung 100 % und Kundenzufriedenheit Top-Accounts messbar verbessern.'),
    ('Digitale AV- und Serienanlauf-Beschleunigung',
      'Digitalisierung beschleunigt Time-to-Quote und Time-to-Series: standardisierte AV-Module, Pruefdatenanbindung, Shopfloor-Rueckmeldung und weniger Medienbrueche zwischen ERP, AV und MES. Problem: manuelle Datenuebernahmen und fehlende Echtzeit-Sicht. Ziel bis 2028: Time-to-Quote -25 %, Pilot KI-Pruefauswertung validiert und digitale Freigabe-Workflows in Kernprozessen.'),
    ('Compliance-faehige und nachhaltige Lieferkette',
      'Regulatorik, Produkthaftung und Kunden-ESG-Anforderungen machen Traceability und CO2-Nachweise zur Marktzugangsvoraussetzung. CabTec verankert Compliance in Materialwahl, Export und Dokumentation entlang der Konfektionskette. Ziel bis 2028: First-Pass Export 92 %, Lieferketten-CO2-Basis fuer Kern-OEMs und keine kritischen Audit-Findings.'),
    ('Operative Exzellenz in Konfektion und AV',
      'Stossrichtung fuer durchgaengige Prozessqualitaet in Arbeitsvorbereitung, Crimp-Technik, Shopfloor und 100-Pruefung. CabTec reduziert Nacharbeit und Rueckstau ohne OTIF zu opfern. Ziel bis 2028: OTIF 96 %, FTQ +15 % im Serienanlauf, OEE Kernlinien +8 % und dokumentierte Standard-Arbeitsfolgen flaechendeckend.'),
    ('Nachhaltigkeit, ESG und Governance entlang der Lieferkette',
      'CabTec positioniert ESG und Governance als strategischen Differenzierer gegenueber Billigkonfektionaeren. Scope-2-Transparenz, recyclingfaehige Verpackung und audit-sichere Lieferantenbewertung werden industrialisiert. Ziel bis 2028: Energieindex -10 %, recyclingfaehige Verpackung 62 % Gewicht und ESG-Nachweise fuer Top-OEMs ohne Ueberfaelligkeit.'),
    ('C3_01 – Complementary Businesses',
      'Ergaenzende Geschaeftsfelder neben Kernkonfektion — Lifecycle-Service, Express-AV und After-Sales — erhoehen Kundenbindung und Deckungsbeitrag. CabTec priorisiert Angebote mit klarem OEM-Fit in Maschinenbau und Intralogistik. Problem: Services nicht paketiert. Ziel bis 2028: zwei skalierbare Zusatzgeschaefte mit positivem DB und Service-Umsatzanteil 15 %.'),
    ('C5_02 – Automotive Applications',
      'Automotive-Nischen erfordern IATF-nahe Prozesse und lange Qualifizierungen — Chance fuer CabTec bei komplexen Baugruppen mit Co-Engineering-Mehrwert. CabTec waehlt selektiv Projekte ohne DB-Verwaesserung. Ziel bis 2028: zwei neue Automotive-Referenzen mit positivem DB und audit-sichere Prozessanbindung.'),
    ('C6_01 - Market Expansion Americas',
      'Geografische Expansion: CabTec erschliesst amerikanische und weitere Exportmaerkte mit lokaler Lieferfaehigkeit, Export-Compliance (UL, Zoll, Incoterms) und Co-Engineering-Naehe zu OEMs. Problem: reine DACH-Produktion deckt Nearshoring-Nachfrage nicht. Ziel bis 2028: Pilotkunden mit OTIF vergleichbar zum Kernwerk, validierte Partnerschaft und First-Pass-Export 92 %.'),
    ('Complementary services',
      'Services wie Express-AV, Change-Management und Lifecycle-Begleitung differenzieren CabTec gegenueber reinen Lohnfertigern. Problem: Angebote nicht standardisiert und im Vertrieb unterverkauft. Ziel bis 2028: drei Servicepakete mit SLA, Preislogik, messbarem Umsatzanteil 15 % und DB-Beitrag je Paket transparent.'),
    ('Expanded value proposition',
      'Wertversprechen ueber Stueckpreis: Technikkompetenz, Termintreue, Traceability und Co-Engineering als Gesamtpaket. CabTec kommuniziert Built-2-Print plus Engineering in Vertrieb und Key Accounts. Ziel bis 2028: hoehere Conversion in Engineering-Lead-Projekten und klarere Abgrenzung zu Commodity-Anbietern in Angeboten.'),
    ('I_C1_01 - OPEX',
      'OPEX-Disziplin sichert Profitabilitaet bei volatilem OEM-Volumen in der Serienkonfektion. Fokus: Ruestverluste, Ausschuss, Energie pro Einheit und Ausschuss in der 100-Pruefung senken — ohne OTIF zu gefaehrden. Ziel bis 2028: OPEX-Index -8 %, Energie pro konfektionierter Einheit -10 % bei stabiler FTQ.'),
    ('I_C10_01 - Build up expertise',
      'Kompetenzaufbau in UL, Hochvolt, Crimp-Technik und kundenspezifischen Freigabeprozessen ist Voraussetzung fuer komplexe Baugruppen. CabTec investiert in Schulung, Mentoring und dokumentierte AV-Bausteine. Ziel bis 2028: Skills-Abdeckung kritische Prozesse > 90 % und Wissensdokumentation Kernprozesse +50 %.'),
    ('I_C11_01 - Lifecycle',
      'Lifecycle-Management verankert Change-, Obsoleszenz- und Ersatzteilprozesse im Lifecycle-Service-Modell fuer OEM-Produkte mit langer Lebensdauer. Problem: spaete Changes erzeugen Reklamationen. Ziel bis 2028: Change-Durchlaufzeit -35 %, Service-Umsatzanteil 15 % und Kundenbindung ueber Produktlebensdauer messbar.'),
    ('I_C12_01 - Engineering skills',
      'Co-Engineering-Dienstleistungen erfordern vertiefte Skills in Spezifikation, Simulation, DfM und Industrialisierung. CabTec baut Engineering-Rechner und Baukasten-AV aus. Ziel bis 2028: Baukasten-Anteil Neugeschaeft +15 Prozentpunkte und Time-to-Series in Co-Engineering -20 %.'),
    ('I_C16_01 - Business Continuity',
      'Business Continuity schuetzt Produktion, MES und AV-Systeme gegen Ausfaelle, Cyber-Risiken und Lieferantenengpaesse. CabTec dokumentiert Notfallplaene und testet Recovery. Ziel bis 2028: RTO-Tests 4x/Jahr bestanden, ungeplante Stillstandsminuten -40 % und Class-A-Material mit validiertem Zweitwerk.'),
    ('I_C17_01 - Reduce production costs',
      'Produktionskosten senken durch Value Engineering, OEE-Steigerung und Standard-Arbeitsfolgen — ohne Qualitaetsregression bei 100-Pruefung und UL-Anforderungen. Ziel bis 2028: Fertigungskostenindex -7 %, Materialkostenindex Neu-Teile -6 % und FTQ stabil.'),
    ('I_C19_01 - Digitalisation',
      'Digitalisierung verbindet Vertrieb, AV, Shopfloor und Kundenstatus in Echtzeit. CabTec reduziert manuelle Datenbrueche zwischen ERP, AV und MES. Ziel bis 2028: digitale Statusabdeckung Key Accounts 100 %, Time-to-Quote -25 % und weniger Medienbrueche in Freigabeprozessen.'),
    ('I_C20_01 – Adapt management system',
      'Management-System (ISO 9001, Kundenanforderungen, IATF wo relevant) spiegelt Strategie und Prozesse der CabTec Group. Ziel bis 2028: Prozesslandkarte aktuell, Audit-Findings ohne Ueberfaelligkeit und Strategie-KPIs (OTIF, DB, Co-Engineering-Anteil) im Management-Review verankert.'),
    ('I_C22_01 - Adapt CD_CI',
      'Corporate Design und Identity positionieren CabTec als Co-Engineering-Partner statt anonymen Lohnfertiger. Einheitliche Kundenkommunikation zu Capabilities Built-2-Print und Lifecycle. Ziel bis 2028: Markenfit in Key-Account-Befragungen verbessern und konsistente Templates in Vertrieb und Angeboten.'),
    ('I_C4_01 - Management and staff development',
      'Fuehrung und Personalentwicklung sichern Fachkraefte in AV, QS und Produktion sowie Entscheidungsgeschwindigkeit in Kundenprojekten. Ziel bis 2028: Vakanzzeit kritische Rollen < 60 Tage, Time-to-Productivity +25 % und cross-funktionale Reviews in Top-20-Projekten Standard.'),
    ('I_C8_01 - Adapt sales organisation',
      'Vertriebsorganisation mit technischer Key-Account-Fuehrung, DB-steuerter Pipeline und Forecast-Qualitaet. CabTec verkauft Co-Engineering statt nur Standardleitungen. Ziel bis 2028: Forecast-Genauigkeit verbessern, gewichtete Pipeline DB +40 % und Win-Rate Engineering-Leads +5 Prozentpunkte.'),
    ('I_C9_01 - corporate_leadership culture',
      'Fuehrungskultur mit Verantwortung, Feedback und cross-funktionaler Zusammenarbeit zwischen Vertrieb, AV und Shopfloor. Ziel bis 2028: schnellere Eskalationsloesung in Kundenprojekten, niedrigere Fluktuation Kernteams und Engagement-Index in kritischen Rollen messbar staerken.'),
    ('Leading from a financial perspective',
      'Finanzielle Steuerung verknuepft Strategie mit DB pro Auftrag, Working Capital und Investitionen in Co-Engineering-Faehigkeiten. CabTec vermeidet Volumen um jeden Preis. Ziel bis 2028: Plan-Ist-DB pro Segment transparent, NWC -9 Tage ohne OTIF-Verlust und keine strategischen Verlustauftraege.'),
    ('reduce material costs & optimize supply chain',
      'Lieferkette und Materialkosten sind zentraler Hebel bei Kupfer-, Stecker- und Leitungspreisen. CabTec sichert Class-A-Material mit Zweitwerk und senkt Kosten durch Value Engineering — nur mit QS-Sign-off. Ziel bis 2028: Liefertreue 98 %, Materialkostenindex -6 % und Altbestand kritische Teile -30 %.')
  ) as m(title, new_desc)
  where sd.organization_id = v_org_id
    and sd.title = m.title;

  -- Restliche schwache Beschreibungen (Demo, Titel-Duplikat, zu kurz)
  update app.strategic_directions sd
  set
    description =
      'CabTec verfolgt diese Stossrichtung im Hybridmodell aus Kabelkonfektion, Co-Engineering und Lifecycle-Service '
      || 'fuer OEMs in Maschinenbau, Intralogistik und Nutzfahrzeug. Konkrete Initiativen verbinden AV, Produktion, '
      || 'Qualitaet und Vertrieb — messbar an OTIF, FTQ, Time-to-Quote und Deckungsbeitrag bis 2028.',
    updated_at = now()
  where sd.organization_id = v_org_id
    and (
      sd.description is null
      or btrim(sd.description) = ''
      or sd.description = sd.title
      or sd.description ilike 'Demo:%'
      or length(btrim(sd.description)) < 120
    );

  -- ── Revisions (UI-Quelle) — Legacy-Titel und -Texte uebernehmen ────────────
  update app.strategy_object_revisions r
  set title = sd.title, description = sd.description, updated_at = now()
  from app.strategic_directions sd
  where r.id = sd.id
    and r.organization_id = v_org_id
    and sd.organization_id = v_org_id
    and r.revision_state = 'current'
    and (r.title is distinct from sd.title or r.description is distinct from sd.description);

  -- Verwaiste [Seed]-Revisionen ohne passende Legacy-Zeile (gleicher Titel)
  update app.strategy_object_revisions r
  set
    title = m.new_title,
    description = m.new_desc,
    updated_at = now()
  from (values
    (
      '[Seed] Nachhaltigkeit & Governance',
      'Nachhaltigkeit, ESG und Governance entlang der Lieferkette',
      'Stossrichtung: CabTec industrialisiert ESG-Nachweise, Produkthaftung und Lieferketten-Compliance fuer OEMs in Maschinenbau und Nutzfahrzeug. Problem: fehlende CO2-Basis, unklare Verantwortlichkeiten und Audit-Luecken bei Material- und Exportdokumentation. Ziel bis 2028: Scope-2-Transparenz fuer Kernprodukte, First-Pass Export 92 % und keine kritischen Audit-Findings in Traceability.'
    ),
    (
      '[Seed] Operative Exzellenz',
      'Operative Exzellenz in Konfektion und AV',
      'Stossrichtung: CabTec sichert Wettbewerbsfaehigkeit durch OTIF, FTQ und kurze Durchlaufzeiten in AV, Produktion und 100-Pruefung. Problem: Nacharbeit, Rueckstau an Pruefplaetzen und Ruestverluste belasten DB. Ziel bis 2028: OTIF 96 %, FTQ im Serienanlauf +15 %, Durchlaufzeit AV bis Freigabe -20 % und Nacharbeitkosten -25 %.'
    ),
    (
      '[Seed] Kundenerlebnis & Loyalitaet',
      'Kundenerlebnis und Transparenz entlang des Auftrags',
      'Stossrichtung: OEMs erwarten von Angebot bis Auslieferung planbare Termine, proaktive Kommunikation und schnelle Reklamationsloesung. CabTec baut digitale Statussicht und Ticket-Workflows fuer Key Accounts. Ziel bis 2028: Reklamations-Durchlaufzeit -30 %, OTIF in Top-Konten 96 % und messbar hoehere Kundenzufriedenheit.'
    ),
    (
      'C6_01 - Market Expansion Americas',
      'C6_01 - Market Expansion Americas',
      'Geografische Expansion: CabTec erschliesst amerikanische und weitere Exportmaerkte mit lokaler Lieferfaehigkeit, Export-Compliance (UL, Zoll, Incoterms) und Co-Engineering-Naehe zu OEMs. Problem: reine DACH-Produktion deckt Nearshoring-Nachfrage nicht. Ziel bis 2028: Pilotkunden mit OTIF vergleichbar zum Kernwerk, validierte Partnerschaft und First-Pass-Export 92 %.'
    )
  ) as m(old_title, new_title, new_desc),
  app.strategy_object_identities i
  where r.object_identity_id = i.id
    and r.organization_id = v_org_id
    and r.revision_state = 'current'
    and r.title = m.old_title
    and i.object_type = 'strategic_direction'
    and not exists (
      select 1 from app.strategic_directions sd
      where sd.id = r.id and sd.organization_id = v_org_id
    );

  raise notice '017_seed: CabTec Stossrichtungen org-weit aktualisiert und Revisions synchronisiert.';
end $$;

-- migrate:down
select 1;
