import type { ReactNode } from "react";
import Link from "next/link";

const pillClass =
  "inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article id={id} className="brand-card scroll-mt-6 p-6">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-zinc-700">{children}</div>
    </article>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
    >
      {children}
    </Link>
  );
}

export default function UserManualPage() {
  return (
    <div className="space-y-6">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dokumentation</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">User Manual</h1>
        <p className="mt-2 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">CITADEL</span> ist die Arbeitsumgebung für strategische
          Planung und operative Steuerung: Herausforderungen, Stoßrichtungen, Jahresziele, Initiativen und OKRs
          werden im Kontext eines <span className="font-medium text-zinc-800">Planungszyklus</span> geführt. Das
          Handbuch beschreibt die Bedeutung der Menübereiche, eine sinnvolle Reihenfolge der Arbeit und typische
          Fragen rund um Berechtigungen.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
          <span className={pillClass}>Zielgruppe: Führung, Strategy Office, Bereichsverantwortliche</span>
          <span className={pillClass}>Sprache der Oberfläche: Deutsch</span>
        </div>
      </article>

      <nav className="brand-card p-6" aria-label="Inhaltsverzeichnis">
        <h2 className="text-sm font-semibold text-zinc-900">Inhalt</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-700">
          <li>
            <a href="#einstieg" className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900">
              Einstieg und Arbeitslogik
            </a>
          </li>
          <li>
            <a href="#begriffe" className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900">
              Zentrale Begriffe
            </a>
          </li>
          <li>
            <a
              href="#module"
              className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
            >
              Module im Überblick (Navigation)
            </a>
          </li>
          <li>
            <a
              href="#workflow"
              className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
            >
              Empfohlener Ablauf im Strategie- und Jahresrhythmus
            </a>
          </li>
          <li>
            <a
              href="#admin-handbuch"
              className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
            >
              Administrator-Handbuch (Verwaltung im Detail)
            </a>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-zinc-600">
              <li>
                <a href="#admin-berechtigungsmodell" className="text-indigo-600 underline underline-offset-2">
                  Berechtigungsmodell
                </a>
              </li>
              <li>
                <a href="#admin-rollenrechte" className="text-indigo-600 underline underline-offset-2">
                  Rollenrechte (Navigation, OKR, Systemregeln)
                </a>
              </li>
              <li>
                <a href="#admin-benutzer" className="text-indigo-600 underline underline-offset-2">
                  Benutzer
                </a>
              </li>
              <li>
                <a href="#admin-markenauftritt" className="text-indigo-600 underline underline-offset-2">
                  Markenauftritt
                </a>
              </li>
              <li>
                <a href="#admin-llm" className="text-indigo-600 underline underline-offset-2">
                  Systemkonfiguration (LLM, Health, Logs, Verbrauch)
                </a>
              </li>
            </ul>
          </li>
          <li>
            <a href="#rechte" className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900">
              Rollen, Lesen und Schreiben
            </a>
          </li>
          <li>
            <a href="#faq" className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900">
              Tipps und häufige Fragen
            </a>
          </li>
        </ol>
      </nav>

      <Section id="einstieg" title="Einstieg und Arbeitslogik">
        <p>
          Die Oberfläche ist in thematische Blöcke gegliedert, die der typischen Abfolge der Strategiearbeit
          folgen. Oben in der Seitenleiste findest du zuerst die strategische Planung (Dashboard und
          verknüpfte Arbeitsbereiche), darunter die Organisation, dann Zyklen und zuletzt die Verwaltung.
        </p>
        <p>
          Fast alle Inhalte beziehen sich auf einen <span className="font-medium text-zinc-900">aktiven bzw. gewählten Zyklus</span>.
          Wenn das Dashboard meldet, dass noch kein Planungszyklus existiert, lege zuerst unter{" "}
          <NavLink href="/planning-cycles">Neuer Planungszyklus</NavLink> einen Zyklus an, bevor du Kennzahlen
          oder Ziele pflegst.
        </p>
        <p>
          Zwielichtige oder inkonsistente Daten entstehen oft dann, wenn Organisation und Verantwortlichkeiten noch
          nicht sauber gepflegt sind. Behandle die Stammdaten daher nicht als «Nebenschauplatz», sondern als
          Fundament für die gesamte Steuerung.
        </p>
      </Section>

      <Section id="begriffe" title="Zentrale Begriffe">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-medium text-zinc-900">Planungszyklus / Strategiezyklus:</span> Zeitlich
            begrenzter Rahmen, in dem Analyse, Ziele und Umsetzung zusammengeführt werden. Im Menü «Zyklen» springst
            du direkt in die Detailansicht des jeweils relevanten Hauptzyklus.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Challenges (Herausforderungen):</span> Wesentliche
            Themenfelder oder Problemdimensionen, die im Strategiezyklus bewertet und priorisiert werden.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Herausforderungs-Profil (Systemvorschlag):</span>{" "}
            Pro Herausforderung leitet CITADEL drei Dimensionen ab — ohne manuelle «Erfüllungs-%»:{" "}
            <em>Adressierung</em> (Verknüpfung zu Stoßrichtungen inkl. Beitragsstufe),{" "}
            <em>Kohärenz</em> (Korrelation zu strategischen Zielen über gemeinsame Stoßrichtungen) und{" "}
            <em>Umsetzung</em> (gewichteter Fortschritt über Jahresziele, Initiativen und verknüpfte OKR-Key-Results).
            Der <em>Erfüllungsgrad</em> ist dieser Umsetzungsprozentsatz (0–100 %), sobald die Herausforderung
            verankert ist; fehlen Anker, nennt das System Schritte zum Pflegen (Jahresziele, PIP, OKR-Tracking).
            Anzeige im Dashboard-Pop-up und Erläuterung im{" "}
            <NavLink href="/strategienetzwerk">Strategienetzwerk</NavLink>.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Strategische Stoßrichtungen:</span> Gewünschte
            Handlungsfelder oder Prioritäten, die aus der Analyse abgeleitet werden und mit Challenges verknüpft
            werden können.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Strategische Ziele / «Ziele» (Strategiezyklus):</span>{" "}
            Langfristige Zielbilder im{" "}
            <NavLink href="/strategy-cycle">Strategiezyklus</NavLink> (Navigationsreiter «Ziele»). In Texten und
            der Oberfläche heißen sie «Ziele» oder «strategische Ziele». Das englische Wort «Objectives» wird hier
            nicht verwendet.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Jahresziele:</span> Konkreisierte Ziele innerhalb des
            Zyklus – die Brücke zwischen Richtung und messbarer Jahresplanung.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Initiativen / Programme:</span> Bündel von Maßnahmen zur
            Erreichung der Ziele; häufig mit Reviews und Verantwortlichkeiten verknüpft.
          </li>
          <li>
            <span className="font-medium text-zinc-900">OKR (Objectives &amp; Key Results):</span> Rahmenwerk im
            OKR-Arbeitsbereich (<NavLink href="/okr/dashboard">OKR-Dashboard</NavLink>
            , Planung, Tracking, Review). Dort bezeichnet «Objectives» (OKR-Objectives) die Zielebene des OKR-Modells
            — bewusst getrennt von den strategischen Zielen im Strategiezyklus.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Reviewzyklus:</span> Formalisierter Prüfrhythmus für
            Fortschritt und Entscheidungen – ergänzend zur laufenden OKR-Pflege.
          </li>
        </ul>
      </Section>

      <article id="module" className="brand-card scroll-mt-6 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Module im Überblick (Navigation)</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Die folgenden Abschnitte entsprechen den Hauptpunkten der Seitenleiste. Jede Zeile beschreibt Zweck,
          typische Nutzer und einen pragmatischen Umgang mit dem Bereich.
        </p>

        <div className="mt-4 space-y-5 border-t border-zinc-100 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/dashboard">Dashboard</NavLink>
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Zentrale Steuerungsansicht zum aktiven Zyklus: Status, Kennzahlenkarten, priorisierte Challenges und
              Stoßrichtungen sowie Hinweise auf „unadressierte“ Challenges. In den Top-5-Pop-ups zu Herausforderungen
              zeigt das System das <strong>Herausforderungs-Profil</strong> (Adressierung, Kohärenz, Umsetzung) inkl.
              Kurzbegründung — abgeleitet aus Verknüpfungen und Fortschrittsdaten, nicht als freie Bewertung. Nutze das
              Dashboard als wöchentliche oder monatliche Management-Übersicht, nicht nur am Quartalsende.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/key-figures">Kennzahlen</NavLink>
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Sammlung und Pflege relevanter Kennzahlen als Grundlage für Bewertungen und Verlaufsdarstellungen.
              Achte auf konsistente Definitionen (z. B. gleiche Zeiträume), damit Vergleiche über Zyklen hinweg
              Interpretationsspielraum behalten, aber nicht beliebig werden.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/strategy-cycle">Strategiezyklus</NavLink>
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Kernarbeitsbereich für die inhaltliche Strategiearbeit: Challenges, strategische Ziele (Reiter «Ziele»),
              Bewertungen, Verknüpfungen mit Stoßrichtungen und weiterführende Sichten (z. B. Strategiematrix unter{" "}
              <NavLink href="/strategy-matrix">/strategy-matrix</NavLink>, sofern freigeschaltet). Hier entsteht die
              Begründung, <em>warum</em> bestimmte Jahresziele und Initiativen Priorität haben.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/reviews">Reviewzyklus</NavLink>
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Strukturierter Überprüfungsprozess für Initiative und Strategiefortschritt. Ideal für feste
              Kalendertermine (Quartals- oder Halbjahresreviews). Dokumentiere Ergebnisse so, dass nachvollziehbar
              ist, welche Entscheidungen auf welchen Daten basieren.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">OKR-Zyklus</h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Der OKR-Bereich bündelt mehrere Ansichten:{" "}
              <NavLink href="/okr/dashboard">Übersicht</NavLink>,{" "}
              <NavLink href="/okr/planning">Planung</NavLink>,{" "}
              <NavLink href="/okr/tracking">Tracking</NavLink>,{" "}
              <NavLink href="/okr/review">Review</NavLink> und bei Bedarf{" "}
              <NavLink href="/reviews/strategy-review">Strategie-Review</NavLink>. Typischer Ablauf: Objectives anlegen
              oder übernehmen, Key Results mit messbaren Zielgrößen versehen, im Tracking den Ist-Stand pflegen und im
              Review Abweichungen und nächste Schritte festhalten.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/strategic-directions">Strategische Stoßrichtungen</NavLink>
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Pflege und Priorisierung der strategischen Handlungsfelder. Halte Formulierungen kurz und
              entscheidungsorientiert; verknüpfe sie sinnvoll mit Challenges aus dem Strategiezyklus, damit das
              Dashboard „Lücken“ erkennbar machen kann.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/annual-targets">Jahresziele</NavLink>
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Operative Jahresplanung im Kontext des gewählten Zyklus. Nutze Jahresziele als verbindliche
              Zielvereinbarungsebene zwischen Strategie und Initiativen/OKRs.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/initiatives">Initiativen / Programme</NavLink>
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Planung und Steuerung von Umsetzungsbündeln. Achte auf klare Verantwortliche (siehe Organisation) und
              auf Abstimmung mit Reviews – sonst entstehen „Orphan“-Initiativen ohne strategischen Anker.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/organization">Organisationsstruktur</NavLink> und Unterseiten
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Hier werden Einheiten, Zuständigkeiten und Kontextdaten gepflegt. Über die Organisationsnavigation
              erreichst du je nach Konfiguration auch{" "}
              <NavLink href="/unternehmensinfo">Unternehmensinfo</NavLink>,{" "}
              <NavLink href="/responsibles">Verantwortliche</NavLink>,{" "}
              <NavLink href="/industries">Branchen</NavLink>,{" "}
              <NavLink href="/business-models">Geschäftsmodelle</NavLink> und{" "}
              <NavLink href="/operating-models">Operating Modelle</NavLink> sowie das{" "}
              <NavLink href="/strategienetzwerk">Strategienetzwerk</NavLink> (Referenzmodell der Verknüpfungen und
              Erläuterung des Herausforderungs-Profils). Je sauberer diese Basis, desto einfacher werden Auswertungen,
              Zielzuordnungen und Akzeptanz im Unternehmen.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              <NavLink href="/planning-cycles">Neuer Planungszyklus</NavLink> und Zyklus-Verwaltung
            </h3>
            <p className="mt-1.5 text-sm text-zinc-700">
              Anlegen und Fortschreiben von Planungszyklen, inkl. Schema- und Instanzlogik über Unterpfade wie{" "}
              <NavLink href="/planning-cycles/schema">Schema</NavLink> und{" "}
              <NavLink href="/planning-cycles/instances">Instanzen</NavLink>. Starte neue Zyklen rechtzeitig vor
              dem Geschäftsjahreswechsel, damit Teams nicht in zwei parallelen Zeitrahmen arbeiten müssen.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Verwaltung</h3>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm text-zinc-700">
              <li>
                <NavLink href="/access-control">Rollenrechte</NavLink> – Wer darf welche Menüpunkte sehen und
                bearbeiten? Änderungen wirken sich unmittelbar auf die Sichtbarkeit der Navigation aus.
              </li>
              <li>
                <NavLink href="/invitations">Benutzer</NavLink> – Einladungen und Zuordnung zu Organisationen bzw.
                Rollen.
              </li>
              <li>
                <NavLink href="/branding">Markenauftritt</NavLink> – Logo und Farben des Mandanten in der
                Anwendung.
              </li>
              <li>
                <NavLink href="/llm-usage">Systemkonfiguration und -information</NavLink> – Technische und
                systemnahe Einstellungen bzw. Informationen für Administratoren.
              </li>
            </ul>
          </div>
        </div>
      </article>

      <Section id="workflow" title="Empfohlener Ablauf im Strategie- und Jahresrhythmus">
        <p>
          Kein Unternehmen arbeitet exakt gleich; folgende Reihenfolge deckt aber die meisten Szenarien ab und
          minimiert Rework.
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <span className="font-medium text-zinc-900">Organisation vorbereiten:</span> Struktur, Verantwortliche
            und Kontext in <NavLink href="/organization">Organisationsstruktur</NavLink> pflegen.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Zyklus anlegen:</span> Über{" "}
            <NavLink href="/planning-cycles">Neuer Planungszyklus</NavLink> den Planungsrahmen setzen; aktiven
            Hauptzyklus im Blick behalten (Sidebar unter „Zyklen“).
          </li>
          <li>
            <span className="font-medium text-zinc-900">Messbasis sichern:</span> Relevante{" "}
            <NavLink href="/key-figures">Kennzahlen</NavLink> definieren und befüllen.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Strategie schärfen:</span> Im{" "}
            <NavLink href="/strategy-cycle">Strategiezyklus</NavLink> Challenges analysieren, bewerten und mit{" "}
            <NavLink href="/strategic-directions">Stoßrichtungen</NavLink> verknüpfen.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Jahresziele setzen:</span>{" "}
            <NavLink href="/annual-targets">Jahresziele</NavLink> ableiten und abstimmen.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Umsetzung planen:</span>{" "}
            <NavLink href="/initiatives">Initiativen / Programme</NavLink> definieren; parallel oder anschließend
            OKRs in <NavLink href="/okr/planning">OKR-Planung</NavLink> anlegen und mit messbaren Key Results
            versehen.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Laufend steuern:</span>{" "}
            <NavLink href="/dashboard">Dashboard</NavLink> und <NavLink href="/okr/tracking">OKR-Tracking</NavLink>{" "}
            nutzen; Abweichungen früh sichtbar machen.
          </li>
          <li>
            <span className="font-medium text-zinc-900">Zyklisch reflektieren:</span>{" "}
            <NavLink href="/reviews">Reviewzyklus</NavLink> und <NavLink href="/okr/review">OKR-Review</NavLink>{" "}
            für Entscheidungen und Anpassungen nutzen – inklusive Dokumentation der Learnings für den nächsten Zyklus.
          </li>
        </ol>
      </Section>

      <article id="admin-handbuch" className="brand-card scroll-mt-6 space-y-8 p-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Verwaltung</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-900">Administrator-Handbuch</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Die folgenden Abschnitte beschreiben <span className="font-medium text-zinc-800">jede</span> Einstellung in
            den Admin-Bereichen der Seitenleiste (<NavLink href="/access-control">Rollenrechte</NavLink>,{" "}
            <NavLink href="/invitations">Benutzer</NavLink>, <NavLink href="/branding">Markenauftritt</NavLink>,{" "}
            <NavLink href="/llm-usage">Systemkonfiguration</NavLink>) samt technischer Permission-Codes, wo relevant,
            und der <span className="font-medium text-zinc-800">unmittelbaren Wirkung</span> in der Anwendung.
          </p>
        </header>

        <section id="admin-berechtigungsmodell" className="scroll-mt-6 space-y-3 border-t border-zinc-100 pt-6">
          <h3 className="text-base font-semibold text-zinc-900">Berechtigungsmodell (Schichten)</h3>
          <p className="text-sm text-zinc-700">
            Admins arbeiten mit mehreren Schichten, die sich überlagern. Eine Änderung wirkt erst dann wie erwartet,
            wenn alle passenden Rechte gesetzt sind.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              <span className="font-medium text-zinc-900">Sidebar / Navigation (nav.*):</span> Pro Rolle und
              Navigationspunkt wird festgelegt, ob ein Modul fehlt (<span className="font-mono text-xs">none</span>),
              nur sichtbar ist (<span className="font-mono text-xs">read</span>) oder bearbeitbar ist (
              <span className="font-mono text-xs">write</span>). <span className="font-medium">Schreiben setzt Lesen</span>{" "}
              automatisch voraus. Ohne Leserecht erscheint der Menüpunkt nicht in der Seitenleisleiste.
            </li>
            <li>
              <span className="font-medium text-zinc-900">Rollen-Administration (admin.manage_roles):</span> Zum{" "}
              <span className="font-medium">Speichern</span> der Navigationsmatrix und der OKR-Objektmatrix auf{" "}
              <NavLink href="/access-control">Rollenrechte</NavLink> ist diese fachliche Berechtigung zusätzlich zu
              <span className="font-medium"> Schreibzugriff</span> auf den Menüpunkt{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">nav.access-control.write</code> nötig. Ohne{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">admin.manage_roles</code> bleiben die Tabellen
              sichtbar, aber eingefroren.
            </li>
            <li>
              <span className="font-medium text-zinc-900">Mandantenverwaltung (org.manage):</span> Bestimmte Felder am
              Organisationssatz – z. B. die Mandantenregeln auf dem Tab „OKR-Systemregeln“ – können nur geändert werden,
              wenn die Mitgliedschaft <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">org.manage</code> hat
              (RLS auf <code className="text-xs">app.organizations</code>), unabhängig vom reinen Sidebar-Schreibrecht.
            </li>
            <li>
              <span className="font-medium text-zinc-900">OKR-Objektrechte (okr.objective.*, okr.key_result.*, okr.review.*):</span>{" "}
              Steuern, <em>welche</em> Objectives und Key Results eine Rolle in Planung, Tracking und Reviews sieht oder
              bearbeitet – unabhängig davon, ob das OKR-Menü nur lesbar ist. Das ist die Feinsteuerung neben der groben
              Navigation.
            </li>
            <li>
              <span className="font-medium text-zinc-900">Zusatzrecht okr.write:</span> Kann Teammitgliedern Schreibmöglichkeiten
              im OKR-Arbeitsbereich geben, auch wenn der Navigationspunkt „OKR Zyklus“ nur mit Leserecht angebunden ist (siehe
              auch allgemeiner Abschnitt <a href="#rechte" className="text-indigo-700 underline underline-offset-2">Rollen</a>
              ).
            </li>
          </ul>
        </section>

        <section id="admin-rollenrechte" className="scroll-mt-6 space-y-4 border-t border-zinc-100 pt-6">
          <h3 className="text-base font-semibold text-zinc-900">
            <NavLink href="/access-control">Rollenrechte</NavLink> – drei Register
          </h3>
          <p className="text-sm text-zinc-700">
            Route: <code className="text-xs">/access-control</code>, weitere Register über{" "}
            <code className="text-xs">?tab=okr</code> und <code className="text-xs">?tab=rules</code>.
          </p>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">Register „Navigation“</h4>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-zinc-900">Matrix Zeilen:</span> Alle Organisationsrollen (
                <code className="text-xs">rbac.roles</code>).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Matrix Spalten:</span> Jedes Sidebar-Modul (u. a. Dashboard,
                Kennzahlen, Strategiezyklus, Reviewzyklus, OKR Zyklus, Organisation, Planungszyklen, Rollenrechte, Benutzer,
                Markenauftritt, Systemkonfiguration).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Stufen pro Zelle:</span>{" "}
                <span className="font-mono text-xs">none</span> (kein Menüpunkt),{" "}
                <span className="font-mono text-xs">read</span> (sichtbar, Formulare meist lesend),{" "}
                <span className="font-mono text-xs">write</span> (bearbeiten, wo die Fachlogik es erlaubt).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Speichern („Rechte speichern“):</span> Persistiert die Codes{" "}
                <code className="text-xs">nav.&lt;modul&gt;.read</code> und{" "}
                <code className="text-xs">nav.&lt;modul&gt;.write</code> in{" "}
                <code className="text-xs">rbac.role_permissions</code>. Wirkt mandantenweit sofort auf alle Benutzer mit
                dieser Rolle.
              </li>
            </ul>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">Register „OKR-Objektrechte“</h4>
            <p>
              Jede Zeile ist ein konkreter Permission-Code (Checkbox pro Rolle). Gespeichert wird ebenfalls über{" "}
              <code className="text-xs">rbac.role_permissions</code>. Der Button <span className="font-medium">Voreinstellungen wiederherstellen</span>{" "}
              setzt für die Standard-Rollen <code className="text-xs">org_admin</code>, <code className="text-xs">executive</code>,{" "}
              <code className="text-xs">department_lead</code> und <code className="text-xs">team_member</code> die im Produkt
              hinterlegten Default-Kombinationen. <span className="font-medium">Custom-Rollen</span> (ohne Preset) behalten ihre
              bisherigen OKR-Objektrechte.
            </p>
            <p className="font-medium text-zinc-900">Objectives – Lesen (okr.objective.read.*)</p>
            <ul className="list-disc space-y-1 pl-5 text-xs sm:text-sm">
              <li>
                <code className="rounded bg-white px-1">okr.objective.read.own</code> – Objectives, deren effektiver Owner
                die Mitgliedschaft ist.
              </li>
              <li>
                <code className="rounded bg-white px-1">okr.objective.read.deputy</code> – zusätzlich Objectives über
                Deputy-Zuordnung.
              </li>
              <li>
                <code className="rounded bg-white px-1">okr.objective.read.department</code> – Objectives im
                Führungsbereich (direkte Linie über <code className="text-xs">reports_to_membership_id</code>).
              </li>
              <li>
                <code className="rounded bg-white px-1">okr.objective.read.all</code> – alle Objectives der Organisation.
              </li>
            </ul>
            <p className="font-medium text-zinc-900">Objectives – Bearbeiten (okr.objective.update.*)</p>
            <ul className="list-disc space-y-1 pl-5 text-xs sm:text-sm">
              <li>
                <code className="rounded bg-white px-1">okr.objective.update.own</code> – bearbeitbare Objectives im Umfang
                „Owner“.
              </li>
              <li>
                <code className="rounded bg-white px-1">okr.objective.update.deputy</code> – zusätzlich über Deputy-Zuordnung.
              </li>
              <li>
                <code className="rounded bg-white px-1">okr.objective.update.department</code> – im Führungsbereich (direkte
                Linie).
              </li>
              <li>
                <code className="rounded bg-white px-1">okr.objective.update.all</code> – organisationweit.
              </li>
            </ul>
            <p className="font-medium text-zinc-900">Key Results – Lesen / Bearbeiten (okr.key_result.read|update.*)</p>
            <p className="text-xs sm:text-sm">
              Dieselben vier Umfänge <code className="rounded bg-white px-1">own</code>, <code className="rounded bg-white px-1">deputy</code>,{" "}
              <code className="rounded bg-white px-1">department</code>, <code className="rounded bg-white px-1">all</code> wie bei Objectives, jeweils separat für KR. Wirkung: Sichtbarkeit
              und Editierbarkeit von KRs in Planung, Tracking und Detailansichten.
            </p>
            <p className="font-medium text-zinc-900">OKR-Review (okr.review.*)</p>
            <ul className="list-disc space-y-1 pl-5 text-xs sm:text-sm">
              <li>
                <code className="rounded bg-white px-1">okr.review.workspace.read</code> – Zugriff auf den Review-Workspace
                (Lesen).
              </li>
              <li>
                <code className="rounded bg-white px-1">okr.review.session.manage</code> – Review-Sessions anlegen und
                verwalten.
              </li>
              <li>
                <code className="rounded bg-white px-1">okr.review.facilitator.assign</code> – Facilitator (OKR Process
                Owner) zuweisen.
              </li>
            </ul>
            <p>
              <span className="font-medium text-zinc-900">Speichern („OKR-Objektrechte speichern“)</span> ersetzt die
              gewählten OKR-Objekt-Checkboxen für alle Rollen – Fehlkonfigurationen können hier gezielt Benutzer aussperren;
              nach größeren Änderungen kurz mit Testnutzer prüfen.
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">Register „Strategie-Review“</h4>
            <p>
              Verfahrens-Capabilities (<code className="text-xs">strategy_review.*</code>), analog zu{" "}
              <code className="text-xs">okr.review.*</code>. Checkboxen pro Rolle, Speichern ersetzt nur diesen Code-Satz.
              Standard-Presets für org_admin, executive, department_lead und team_member.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs sm:text-sm">
              <li>
                <code className="rounded bg-white px-1">strategy_review.read</code> – Reviewverfahren einsehen
              </li>
              <li>
                <code className="rounded bg-white px-1">strategy_review.feedback</code> – Vorab-Feedback geben
              </li>
              <li>
                <code className="rounded bg-white px-1">strategy_review.moderate</code> – Verfahren führen
                (Ankündigung, Prep, Teilnehmer, Entscheidungen)
              </li>
              <li>
                <code className="rounded bg-white px-1">strategy_review.lead_assign</code> – Review-Leitung zuweisen
              </li>
              <li>
                <code className="rounded bg-white px-1">strategy_review.release</code> – Änderungen bestätigen und
                abschließen
              </li>
              <li>
                <code className="rounded bg-white px-1">strategy_review.force_ready</code> – Readiness erzwingen
              </li>
            </ul>
            <p>
              Die <span className="font-medium text-zinc-900">Teilnehmerrolle Lead</span> bleibt fallbezogen: sie steuert im
              konkreten Review u. a. das Meeting starten und Ankündigung im Lead-Fenster. Org-Rechte und Lead-Zuweisung
              greifen zusammen.
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">Register „OKR-Systemregeln“</h4>
            <p className="font-medium text-zinc-900">Fest verdrahtete Regeln (nur Erläuterung, keine Schalter)</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-zinc-900">KR ohne eigenen Owner:</span> Der wirksame KR-Owner folgt dem
                Objective-Owner, wenn am KR keiner gesetzt ist (Koaleszenz in der Zugriffslogik).
              </li>
              <li>
                <span className="font-medium text-zinc-900">KR ohne eigenen Deputy:</span> Der wirksame KR-Deputy wird vom
                Objective-Deputy übernommen, falls am KR leer.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Department-Zugriff:</span> „Führungsbereich“ bedeutet direkte
                Führungslinie (<code className="text-xs">reports_to_membership_id</code>), nicht die ganze Organisation.
              </li>
            </ul>
            <p className="font-medium text-zinc-900">Mandantenregeln (Formular, benötigt org.manage)</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-zinc-900">Checkbox „Key-Result-Owner entspricht immer dem
                  Objective-Owner“</span> (<code className="text-xs">okr_kr_owner_must_match_objective</code> auf{" "}
                <code className="text-xs">app.organizations</code>): Ist sie aktiv, gibt es in der OKR-Planung kein separates
                KR-Owner-Feld; beim Speichern wird immer der Objective-Owner auf das KR übernommen.{" "}
                <span className="font-medium">Wirkung:</span> vereinfacht Verantwortlichkeiten, verkürzt Diskussionen;{" "}
                <span className="font-medium">Nachteil:</span> keine KR-spezifische Delegation auf Personenebene.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Checkbox „OKR-Owner bei geplanter Review-Session
                  benachrichtigen“</span> (<code className="text-xs">okr_review_notify_owners_on_schedule</code>): Wenn aktiv,
                sollen Owner nach dem Planen einer Session informiert werden –{" "}
                <span className="font-medium">tatsächlicher E-Mail-Versand</span> setzt einen angebundenen E-Mail-Provider in
                Supabase voraus (wie im UI-Hinweis beschrieben).
              </li>
              <li>
                <span className="font-medium text-zinc-900">„Jahresziele vor OKRs erzwingen“</span>{" "}
                (<code className="text-xs">require_annual_targets_before_okrs</code> plus{" "}
                <code className="text-xs">annual_target_gate_enforcement_mode</code>): Bei aktiviertem Gate sind OKR-Entwürfe
                weiter möglich, aber Aktivierung/Publish wird je Modus blockiert, bis für den Objective-Owner aktive
                Jahresziele im Zieljahr vorhanden sind. Scope und Ausnahmen werden über{" "}
                <code className="text-xs">annual_target_gate_scope</code> und{" "}
                <code className="text-xs">annual_target_gate_allow_exceptions</code> gesteuert.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Button „Mandantenregeln speichern“:</span> Aktualisiert den
                Organisationssatz; es werden u. a. <code className="text-xs">/organization</code>,{" "}
                <code className="text-xs">/okr/planning</code>, <code className="text-xs">/okr/tracking</code> und{" "}
                <code className="text-xs">/okr-workspace</code> revalidiert, damit geänderte Regeln ohne verzögerten Cache
                greifen.
              </li>
            </ul>
            <p className="text-xs text-zinc-600">
              Ohne <code className="rounded bg-zinc-100 px-1">org.manage</code> siehst du den aktuellen Status der
              Mandantenregeln nur als Text, nicht als editierbare Checkboxen.
            </p>
          </div>
        </section>

        <section id="admin-benutzer" className="scroll-mt-6 space-y-4 border-t border-zinc-100 pt-6">
          <h3 className="text-base font-semibold text-zinc-900">
            <NavLink href="/invitations">Benutzer</NavLink>
          </h3>
          <p className="text-sm text-zinc-700">
            Zentrale Nutzerverwaltung inkl. Einladungen. Lesende Nutzer sehen alle Bereiche; Schreibzugriff hängt von{" "}
            <code className="text-xs">nav.invitations.write</code> ab.
          </p>

          <div className="space-y-3 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">Benutzerliste und Verantwortliche-Zuordnung</h4>
            <p>
              Tabelle aller <code className="text-xs">organization_memberships</code> des Mandanten. Pro Zeile: Anzeigename,
              E-Mail (über Auth-Admin, falls konfiguriert), Status (<code className="text-xs">active</code> /{" "}
              <code className="text-xs">invited</code> / <code className="text-xs">suspended</code>), zugewiesene Rollen und
              ggf. verknüpfte Führungskraft aus der Responsibles-Stammdatenliste.
            </p>
            <p className="font-medium text-zinc-900">Erweiterte Zeile („Einstellungen“) – Felder und Wirkung</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-zinc-900">Anzeigename in der Organisation</span> (optional): Überschreibt
                in dieser Organisation den aus dem Login-Konto bekannten Namen in Listen und Zuordnungen, falls befüllt.
                Kein Einfluss auf Authentifizierung.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Titel / Funktion in der Organisation</span> (optional):
                Freitext zur Rollenbezeichnung; getrennt vom Anzeigenamen. Dient der Klarheit in UI und Reports.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Organisation-Rollen (Checkboxen):</span> Mindestens eine Rolle
                muss aktiv bleiben. Mehrere Rollen pro Mitgliedschaft sind erlaubt; effektive Navigationsrechte ergeben sich
                als Vereinigung (Summe) aller zugewiesenen Rollen. Speichern ersetzt die Zuordnung in{" "}
                <code className="text-xs">rbac.member_roles</code>.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Verknüpfung zur Verantwortlichen-Stammdatenzeile:</span> Die
                technische Brücke <code className="text-xs">organization_memberships.responsible_id</code> wird nicht
                mehr auf dieser Seite bearbeitet; Pflege der Verantwortlichen und der Mitgliedschaftsverknüpfung erfolgt
                über <NavLink href="/responsibles">Verantwortliche</NavLink> (bzw. zugehörige Abläufe).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Speichern:</span> Validiert Rollencodes gegen den Mandanten,
                synchronisiert <code className="text-xs">member_roles</code> und aktualisiert{" "}
                <code className="text-xs">display_name</code> und <code className="text-xs">title</code> der Mitgliedschaft.
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">Neuen Benutzerzugang anlegen</h4>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-zinc-900">E-Mail (Pflicht):</span> Wird normalisiert (Kleinschreibung).
                Legt den Zugang / die Einladung an.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Anzeigename in der Organisation (optional):</span> Landet auf
                der Mitgliedschaft (nicht zwingend im Auth-Profil).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Titel / Funktion (optional):</span> Mitgliedschaftsfeld, siehe
                oben.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Organisation-Rollen (mind. eine Checkbox):</span> Ohne Rolle
                bricht die Anlage mit Fehler ab. Alle gewählten Codes werden in der Einladung gespeichert; nach Annahme
                werden die Mitgliedschaften und Rollen provisioniert.
              </li>
              <li>
                <span className="font-medium text-zinc-900">SUPABASE_SERVICE_ROLE_KEY:</span> Wenn gesetzt, versucht die App
                eine Einladungs-E-Mail über Supabase Auth; bei Fehlkonfiguration (Site-URL, Redirect{" "}
                <code className="text-xs">/invite/oauth**</code>, E-Mail-Provider) erscheinen die Hinweise aus der Oberfläche.
                Ohne Service-Role: Zugang wird trotzdem angelegt, Link muss manuell geteilt werden; „Widerrufen“ kann dann
                keine vollständige Auth-Bereinigung durchführen.
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">Offene Einladungen</h4>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-zinc-900">Erneut senden:</span> Nutzt Supabase-Mail, aktualisiert{" "}
                <code className="text-xs">last_sent_at</code>, stellt bei Erfolg die Mitgliedschaft erneut passend zu den
                Rollen der Einladung sicher.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Widerrufen:</span> Setzt Status auf widerrufen; mit Service-Role
                werden Mandanten-Mitgliedschaft und Rollen zur E-Mail entfernt und der Auth-User ggf. gelöscht, wenn er in
                keiner anderen Organisation mehr vorkommt (siehe Hilfetext auf der Seite).
              </li>
            </ul>
          </div>
        </section>

        <section id="admin-markenauftritt" className="scroll-mt-6 space-y-4 border-t border-zinc-100 pt-6">
          <h3 className="text-base font-semibold text-zinc-900">
            <NavLink href="/branding">Markenauftritt</NavLink>
          </h3>
          <p className="text-sm text-zinc-700">
            Mandantenweite Darstellung in <code className="text-xs">app.tenant_branding</code>. Schreibzugriff über{" "}
            <code className="text-xs">nav.branding.write</code>.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              <span className="font-medium text-zinc-900">Primärfarbe, Sekundärfarbe, Akzentfarbe:</span> Hex-Farben (
              <code className="text-xs">#RRGGBB</code>), verpflichtend. Werden u. a. als CSS-Variablen{" "}
              <code className="text-xs">--brand-primary</code>, <code className="text-xs">--brand-secondary</code>,{" "}
              <code className="text-xs">--brand-accent</code> in der App-Shell gesetzt – damit prägen sie Flächen, Buttons und
              Akzent-Badges.
            </li>
            <li>
              <span className="font-medium text-zinc-900">Mandantenlogo hochladen:</span> Optional; Upload in den Storage-Bucket{" "}
              <code className="text-xs">BRANDING_LOGO_BUCKET</code> (Standard <code className="text-xs">tenant-branding</code>
              ), Objektpfad <code className="text-xs">organizations/&lt;tenant-id&gt;/branding/…</code>. Erfolgreicher Upload
              setzt öffentliche <code className="text-xs">logo_url</code> und Metadaten{" "}
              <code className="text-xs">logo_storage_bucket</code> / <code className="text-xs">logo_storage_path</code> in{" "}
              <code className="text-xs">branding_config</code>.
            </li>
            <li>
              <span className="font-medium text-zinc-900">Logo-Darstellung:</span>{" "}
              <span className="font-medium">Modus</span> <code className="text-xs">contain</code> (gesamtes Logo sichtbar) vs.{" "}
              <code className="text-xs">cover</code> (füllt die Fläche, Anschnitt möglich). <span className="font-medium">Fokus X/Y %</span>{" "}
              verschiebt die Blickrichtung bei <code className="text-xs">cover</code> bzw. die Einbettung in der linken Sidebar
              (Begrenzung 0–100).
            </li>
            <li>
              <span className="font-medium text-zinc-900">Status Entwurf / Veröffentlicht:</span> Persistiert als{" "}
              <code className="text-xs">draft</code> oder <code className="text-xs">published</code>. Für die rein visuelle
              Vorschau im UI ist der Status primär dokumentarisch – die Farben wirken nach Speichern in jedem Fall in der Shell,
              sofern die Daten gelesen werden.
            </li>
            <li>
              <span className="font-medium text-zinc-900">Quality-Score Gewichtung (Strategy Cycle):</span> Vier Felder Impact,
              Certainty, Evidence, Structure (Ganzzahl-Prozente, jeweils ≥ 0). Beim Speichern werden sie{" "}
              <span className="font-medium">auf 100 % normalisiert</span> und als Dezimalanteile unter{" "}
              <code className="text-xs">branding_config.analysis_quality_weights</code> abgelegt.{" "}
              <span className="font-medium">Wirkung:</span> steuert, wie stark die vier Dimensionen den Qualitäts-Score im
              Strategiezyklus gewichten (höheres Gewicht = stärkerer Einfluss auf die Bewertungslogik, die diese Werte
              einliest).
            </li>
            <li>
              <span className="font-medium text-zinc-900">Markenauftritt speichern:</span> Upsert auf{" "}
              <code className="text-xs">tenant_branding</code>; revalidiert <code className="text-xs">/branding</code> und{" "}
              <code className="text-xs">/dashboard</code>, damit die Shell neue Farben/Logos zieht.
            </li>
          </ul>
          <p className="text-xs text-zinc-600">
            Hinweis: LLM-Konfiguration (siehe unten) wird zusätzlich in <code className="text-xs">branding_config.analysis_network</code>{" "}
            gespeichert – Markenauftritt und Systemkonfiguration teilen sich also technisch einen JSON-Bereich in derselben
            Tabellenzeile.
          </p>
        </section>

        <section id="admin-llm" className="scroll-mt-6 space-y-4 border-t border-zinc-100 pt-6">
          <h3 className="text-base font-semibold text-zinc-900">
            <NavLink href="/llm-usage">Systemkonfiguration und -information</NavLink> (LLM)
          </h3>
          <p className="text-sm text-zinc-700">
            Steuert KI-Funktionen, Token-Budgets und Diagnose. Konfiguration wird im Mandanten unter{" "}
            <code className="text-xs">tenant_branding.branding_config.analysis_network</code> persistiert (Upsert aus dem
            Formular <span className="font-medium">Systemkonfiguration speichern</span>).
          </p>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">LLM Freigaben und Token-Budgets</h4>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-zinc-900">LLM global aktivieren:</span> Master-Schalter (
                <code className="text-xs">llm_enabled</code>). Aus = alle nachgelagerten Feature-Checkboxen werden in der
                Praxis wirkungslos (zusätzliche Prüfung in der Policy <code className="text-xs">isLlmFeatureEnabled</code>
                ).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Feature-Checkboxen</span> (jeweils{" "}
                <code className="text-xs">llm_feature_flags.&lt;key&gt;</code>): Schalten einzelne KI-Anwendungsfälle frei oder
                ab. Auswirkung jeweils auf die entsprechenden Strategie-/OKR-Ansichten und Server-Aufrufe.
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                  <li>
                    <span className="font-medium">Qualitätsbewertung</span> (<code className="text-xs">quality_scoring</code>
                    ) – Qualitätsscores im Strategie-/Analysekontext.
                  </li>
                  <li>
                    <span className="font-medium">Graph-Layout</span> (<code className="text-xs">graph_layout</code>) –
                    KI-gestützte Node-Einordnung im Netzwerk.
                  </li>
                  <li>
                    <span className="font-medium">Link-Entwurfsgenerierung</span> (
                    <code className="text-xs">link_draft_generation</code>) – Vorschläge für Verknüpfungen.
                  </li>
                  <li>
                    <span className="font-medium">Cluster-Bewertung</span> (<code className="text-xs">cluster_assessment</code>
                    ).
                  </li>
                  <li>
                    <span className="font-medium">Lücken-Bewertung</span> (<code className="text-xs">gap_assessment</code>).
                  </li>
                  <li>
                    <span className="font-medium">Empfehlungslogik für Herausforderungen</span> (
                    <code className="text-xs">challenge_recommendation</code>).
                  </li>
                  <li>
                    <span className="font-medium">Modell-Gesundheitsprüfungen</span> (
                    <code className="text-xs">model_health_checks</code>) – ob automatische/manuelle Health-Jobs laufen sollen.
                  </li>
                  <li>
                    <span className="font-medium">Objectives-Bewertung</span> (
                    <code className="text-xs">objective_evaluation</code>).
                  </li>
                  <li>
                    <span className="font-medium">OKR Contribution Assessment</span> (
                    <code className="text-xs">okr_contribution_assessment</code>) – Alignment von OKRs zu Initiativen /
                    Strategiezielen.
                  </li>
                  <li>
                    <span className="font-medium">KR-Initiativen-Matching</span> (
                    <code className="text-xs">kr_initiative_matching</code>) – Sentinel-Vorschläge im KR-Detail; gekoppelt an
                    den Confidence-Schwellenwert.
                  </li>
                </ul>
                <p className="mt-2 text-xs text-zinc-600">
                  Im Code existiert zusätzlich der Flag <code className="rounded bg-white px-1">matrix_program_proposal</code>; er
                  wird in der aktuellen Oberfläche <span className="font-medium">nicht</span> als eigenes Feld angeboten und
                  behält seinen gespeicherten Wert bei Konfigurationsupdates.
                </p>
              </li>
              <li>
                <span className="font-medium text-zinc-900">Tägliches Soft-Token-Limit</span> (
                <code className="text-xs">llm_daily_soft_token_limit</code>): Obergrenze pro Tag (0–100 Mio., geklemmt); typisch
                für „weiche“ Drosselung oder Monitoring-Schwellen in der Verbrauchslogik – zu niedrige Werte führen zu
                eingeschränkter LLM-Nutzbarkeit am Tagesende.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Monatliches Hard-Token-Limit</span> (
                <code className="text-xs">llm_monthly_hard_token_limit</code>): Monatliche Obergrenze (0–1 Mrd.); stellt eine
                harte Budgetkappe dar. Bei Erreichen sollten serverseitige Checks Folgeanfragen ablehnen oder Budgetwarnungen
                auslösen (je nach Implementierung der Consumer).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Standardwert maximale Ausgabetokens</span> (
                <code className="text-xs">llm_max_output_tokens_default</code>): Fallback für alle Features ohne spezifischen
                Wert; erlaubt 64–4096 Tokens pro Antwort (runde Ganzzahl nach Klemmung).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Max. Ausgabetokens pro Feature:</span> jeweils 64–4096, überschreibt
                den Default für genau dieses Feature – höhere Werte: ausführlichere Modellantworten, höhere Kosten und
                Latenz; niedrigere Werte: kürzere Texte, Risiko von abgeschnittenen Antworten.
              </li>
              <li>
                <span className="font-medium text-zinc-900">KR-Matching Confidence-Grenze (0–1):</span> (
                <code className="text-xs">kr_initiative_matching_confidence_threshold</code>) – nur Vorschläge oberhalb dieser
                Ähnlichkeit werden prominent; höher = weniger, dafür präzisere Vorschläge; niedriger = mehr Vorschläge, höheres
                Risiko von Fehlzuordnungen.
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">LLM Modell-Health</h4>
            <p>
              Zeilen aus <code className="text-xs">llm_model_health_status</code> pro Feature/Provider/Modell: Status healthy /
              degraded / down, Fallback-Flag, Zeitstempel, Latenz, HTTP-Code, Fehlermeldung. Einträge älter als ca. 26 Stunden
              gelten in der UI als <span className="font-medium">stale</span>.
            </p>
            <p>
              <span className="font-medium text-zinc-900">Jetzt prüfen:</span> Manueller Lauf (
              <code className="text-xs">runLlmModelHealthCheckNow</code>), nur mit <code className="text-xs">nav.llm-usage.write</code>
              . Ergänzend existiert ein Cron über <code className="text-xs">/api/internal/llm-health</code> (wie im UI erwähnt).
            </p>
          </div>

          <div className="space-y-3 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">AI Logdatei-Reader</h4>
            <p>
              Listet JSON-Dateien aus Storage-Bucket <code className="text-xs">AI_LOG_BUCKET</code> (Standard{" "}
              <code className="text-xs">tenant-ai-logs</code>) unter Prefix{" "}
              <code className="text-xs">organizations/&lt;tenant-id&gt;/ai-logs</code>. Auswahl lädt den Rohinhalt, pretty-print
              bei gültigem JSON. Dient der Fehleranalyse (Prompts/Antworten/Metadaten je nach Logformat).
            </p>
          </div>

          <div className="space-y-3 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900">Verbrauch (7 / 30 / 90 Tage)</h4>
            <p>
              Aggregation über <code className="text-xs">llm_usage_events</code>: Anzahl Requests, Prompt-/Completion-/Total-Tokens,
              sowie <code className="text-xs">usage_missing</code>-Zähler für Events ohne vollständige Token-Meldung. Listen „nach
              Feature“ und „nach Provider/Modell“ helfen bei Kostenverteilung und Modellwechsel-Entscheidungen.
            </p>
          </div>
        </section>
      </article>

      <Section id="rechte" title="Rollen, Lesen und Schreiben">
        <p>
          Zugriffe werden über die Datenbank-Rollenrechte gesteuert (technisch als Lese- und Schreibrechte pro
          Navigationspunkt). Wenn du einen Menüeintrag nicht siehst, fehlt dir in der Regel das Leserecht für genau
          diesen Bereich. Wenn du Inhalte sehen, aber nicht bearbeiten kannst, hast du häufig nur Leserecht.
        </p>
        <p>
          Organisationsadministratorinnen und -administratoren pflegen die Rechtematrix unter{" "}
          <NavLink href="/access-control">Rollenrechte</NavLink>. Änderungen sollten bewusst und dokumentiert erfolgen
          – insbesondere vor größeren Workshops oder Reporting-Terminen, damit niemand unerwartet ausgesperrt wird.
        </p>
        <p>
          <span className="font-medium text-zinc-900">Hinweis zum OKR-Schreiben:</span> In einigen Konstellationen
          kann Schreibzugriff im OKR-Arbeitsbereich auch über zusätzliche fachliche Berechtigungen wirken, nicht nur
          über den Sidebar-Schreibmodus. Wenn du unklare Sperren bemerkst, prüfe Rolle, Mitgliedschaft und die
          OKR-spezifischen Rechte gemeinsam mit einer Administratorin.
        </p>
      </Section>

      <Section id="faq" title="Tipps und häufige Fragen">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-medium text-zinc-900">„Im Dashboard fehlt der Zyklus.“</span> Lege zuerst einen
            Planungszyklus an und stelle sicher, dass Daten und Auswahl zum aktuellen Zeitfenster passen.
          </li>
          <li>
            <span className="font-medium text-zinc-900">„Challenges sind nicht mit Stoßrichtungen verknüpft.“</span>{" "}
            Vervollständige die Verknüpfungen im Strategiezyklus bzw. in den Stoßrichtungen – das Dashboard hebt
            ungedeckte Themen bewusst hervor.
          </li>
          <li>
            <span className="font-medium text-zinc-900">„OKRs und Initiativen widersprechen sich.“</span> Nutze
            Reviews, um Überschneidungen zu klären; ein gemeinsames Zielbild pro Quartal reduziert Doppelarbeit.
          </li>
          <li>
            <span className="font-medium text-zinc-900">„Wir haben parallele Wahrheiten in Kennzahlen.“</span>{" "}
            Vereinbare Definitionen und Zeiträume schriftlich im Team und pflege die Kennzahlen konsistent – sonst
            arbeitet jedes Gremium mit anderen Zahlen.
          </li>
        </ul>
        <p className="border-t border-zinc-100 pt-3 text-sm text-zinc-600">
          Dieses Handbuch beschreibt die fachliche Nutzung der Anwendung. Technische Betriebs- oder
          Integrationsfragen (Exporte, Schnittstellen, Mandantenfähigkeit) klärst du mit der Person oder dem Team, das
          CITADEL in deiner Organisation verantwortet.
        </p>
      </Section>
    </div>
  );
}
