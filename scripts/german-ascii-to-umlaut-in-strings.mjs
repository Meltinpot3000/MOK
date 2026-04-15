/**
 * Nur String-Literale + JSX-Text: ASCII-Umschrift → Umlaute (keine Identifier).
 * Lädt typescript aus web/node_modules.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require(path.join(__dirname, "../web/node_modules/typescript"));

const ROOT = process.argv[2] ?? path.join(process.cwd(), "web");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);

/** Längste zuerst — zusammengesetzte Begriffe */
const PAIRS = [
  ["Rueckwaertskompatibilitaet", "Rückwärtskompatibilität"],
  ["Entscheidungsgrundsaetze", "Entscheidungsgrundsätze"],
  ["Differenzierungskraefte", "Differenzierungskräfte"],
  ["Schluesselaktivitaeten", "Schlüsselaktivitäten"],
  ["Schluesselressourcen", "Schlüsselressourcen"],
  ["Schluesselpartner", "Schlüsselpartner"],
  ["Gesundheitspruefungen", "Gesundheitsprüfungen"],
  ["Unternehmensgroesse", "Unternehmensgröße"],
  ["unternehmensgroesse", "unternehmensgröße"],
  ["kern_wertschoepfung", "kern_wertschöpfung"],
  ["Wertschoepfungslogik", "Wertschöpfungslogik"],
  ["Wertschoepfung", "Wertschöpfung"],
  ["Geschaeftsmodellen", "Geschäftsmodellen"],
  ["Geschaeftsmodelle", "Geschäftsmodelle"],
  ["Geschaeftsmodell", "Geschäftsmodell"],
  ["Geschaeftseinheit", "Geschäftseinheit"],
  ["Geschaeftsleitung", "Geschäftsleitung"],
  ["Qualitaetsbewertung", "Qualitätsbewertung"],
  ["Qualitaetsregel", "Qualitätsregel"],
  ["Qualitaetswert", "Qualitätswert"],
  ["Prioritaetszone", "Prioritätszone"],
  ["Fuehrungsprinzipien", "Führungsprinzipien"],
  ["Fuehrungsrollen", "Führungsrollen"],
  ["Fuehrungsnahe", "Führungsnahe"],
  ["Abdeckungsstaerke", "Abdeckungsstärke"],
  ["Benutzerzugaenge", "Benutzerzugänge"],
  ["Verlaesslichkeit", "Verlässlichkeit"],
  ["zuverlaessigem", "zuverlässigem"],
  ["Veroeffentlicht", "Veröffentlicht"],
  ["Folgeabschaetzung", "Folgeabschätzung"],
  ["Sekundaerfarbe", "Sekundärfarbe"],
  ["Querschnittsthemen", "Querschnittsthemen"],
  ["Einnahmequellen", "Einnahmequellen"],
  ["Strategiebuero", "Strategiebüro"],
  ["Zugriffssteuerung", "Zugriffssteuerung"],
  ["Steuerungsansicht", "Steuerungsansicht"],
  ["Mindestvertrauen", "Mindestvertrauen"],
  ["Listeneintraege", "Listeneinträge"],
  ["Verknuepfungen", "Verknüpfungen"],
  ["Verknuepfung", "Verknüpfung"],
  ["verknuepft", "verknüpft"],
  ["verknuepfte", "verknüpfte"],
  ["verknuepften", "verknüpften"],
  ["verknuepfen", "verknüpfen"],
  ["Verknuepfen", "Verknüpfen"],
  ["Verknuepfe", "Verknüpfe"],
  ["Verfuegbare", "Verfügbare"],
  ["verfuegbar", "verfügbar"],
  ["Lueckenanalyse", "Lückenanalyse"],
  ["Zusammenhaenge", "Zusammenhänge"],
  ["Umsatzgroesse", "Umsatzgröße"],
  ["ausgeschoepft", "ausgeschöpft"],
  ["ausgewaehlten", "ausgewählten"],
  ["auswaehlen", "auswählen"],
  ["Auswaehlen", "Auswählen"],
  ["ausgefuellt", "ausgefüllt"],
  ["ausfuellen", "ausfüllen"],
  ["ausfuellbaren", "ausfüllbaren"],
  ["ausgefuehrt", "ausgeführt"],
  ["ausfuehren", "ausführen"],
  ["zusaetzlichen", "zusätzlichen"],
  ["zusaetzlich", "zusätzlich"],
  ["zusaetzliche", "zusätzliche"],
  ["zuruecksetzen", "zurücksetzen"],
  ["Zuruecksetzen", "Zurücksetzen"],
  ["Ruecksetzlink", "Rücksetzlink"],
  ["Rueckstand", "Rückstand"],
  ["Rueckgaengig", "Rückgängig"],
  ["Loesungslogik", "Lösungslogik"],
  ["Feinsteuerung", "Feinsteuerung"],
  ["Gebuendeltes", "Gebündeltes"],
  ["widerspruechliche", "widersprüchliche"],
  ["Menuepunkt", "Menüpunkt"],
  ["Menue", "Menü"],
  ["unterstuetzende", "unterstützende"],
  ["unterstuetzt", "unterstützt"],
  ["Unterstuetzung", "Unterstützung"],
  ["Unterstuetzer", "Unterstützer"],
  ["unterstuetz", "unterstütz"],
  ["Unterstuetz", "Unterstütz"],
  ["vollstaendige", "vollständige"],
  ["unvollstaendig", "unvollständig"],
  ["ergaenzen", "ergänzen"],
  ["Ergaenzen", "Ergänzen"],
  ["haengend", "hängend"],
  ["Haengende", "Hängende"],
  ["aelter", "älter"],
  ["laeuft", "läuft"],
  ["Laeufe", "Läufe"],
  ["duerfen", "dürfen"],
  ["duenner", "dünner"],
  ["gruener", "grüner"],
  ["Gruen", "Grün"],
  ["gruen", "grün"],
  ["Faehigkeiten", "Fähigkeiten"],
  ["Sphaeren", "Sphären"],
  ["Ueberblick", "Überblick"],
  ["Ueberschneidungen", "Überschneidungen"],
  ["uebernommen", "übernommen"],
  ["uebernehmen", "übernehmen"],
  ["Stossrichtungen", "Stoßrichtungen"],
  ["Stossrichtung", "Stoßrichtung"],
  ["Stoss", "Stoß"],
  ["auffaellig", "auffällig"],
  ["auffaellige", "auffällige"],
  ["Vorgaenger", "Vorgänger"],
  ["vorgaenger", "vorgänger"],
  ["zulaessig", "zulässig"],
  ["zulaessige", "zulässige"],
  ["Zulaessig", "Zulässig"],
  ["Massnahmen", "Maßnahmen"],
  ["Massnahme", "Maßnahme"],
  ["Grundsaetze", "Grundsätze"],
  ["Bruecken", "Brücken"],
  ["Fuehrung", "Führung"],
  ["fuehren", "führen"],
  ["fuehrenden", "führenden"],
  ["fuehrt", "führt"],
  ["Fuehre", "Führe"],
  ["Fuenf", "Fünf"],
  ["fuenf", "fünf"],
  ["fuegt", "fügt"],
  ["Sekundaer", "Sekundär"],
  ["sekundaer", "sekundär"],
  ["Stossrichtungsfortschritt", "Stoßrichtungsfortschritt"],
  ["persoenlichen", "persönlichen"],
  ["persoenliche", "persönliche"],
  ["persoenlicher", "persönlicher"],
  ["Regulaer", "Regulär"],
  ["regulaer", "regulär"],
  ["aendern", "ändern"],
  ["Aendern", "Ändern"],
  ["Prioritaet", "Priorität"],
  ["prioritaet", "priorität"],
  ["fuer", "für"],
  ["Fuer", "Für"],
  ["gewaehlten", "gewählten"],
  ["gewaehlte", "gewählte"],
  ["gewaehlter", "gewählter"],
  ["Ueberfaellige", "Überfällige"],
  ["ueberfaellig", "überfällig"],
  ["Vollstaendige", "Vollständige"],
  ["Eintraege", "Einträge"],
  ["Aktualitaet", "Aktualität"],
  ["koennen", "können"],
  ["Koennen", "Können"],
  ["moeglich", "möglich"],
  ["Moeglich", "Möglich"],
  ["Moeglichkeit", "Möglichkeit"],
  ["gueltig", "gültig"],
  ["gueltige", "gültige"],
  ["gueltiger", "gültiger"],
  ["Ungueltig", "Ungültig"],
  ["pruefen", "prüfen"],
  ["Pruefung", "Prüfung"],
  ["Begruendung", "Begründung"],
  ["geloescht", "gelöscht"],
  ["Entwuerfe", "Entwürfe"],
  ["Entwuerf", "Entwurf"],
  ["zugehoerige", "zugehörige"],
  ["gehoert", "gehört"],
  ["Begruende", "Begründe"],
  ["auswaehl", "auswähl"],
  ["ausgewaehlt", "ausgewählt"],
  ["unvollstaendig", "unvollständig"],
  ["naechste", "nächste"],
  ["Naehe", "Nähe"],
];

PAIRS.sort((a, b) => b[0].length - a[0].length);

const PROTECT_WORDS = new Set([
  "queue",
  "continue",
  "value",
  "values",
  "true",
  "false",
  "unique",
  "blue",
  "issue",
  "issues",
  "does",
  "goes",
  "revenue",
  "influence",
  "coefficient",
  "enqueue",
  "dequeue",
  "request",
  "response",
  "queries",
  "query",
  "request_changes",
]);

function protectEnglish(s) {
  const ph = [];
  let i = 0;
  const mark = (w) => {
    const k = `\uE000${i++}\uE000`;
    ph.push({ k, w });
    return k;
  };
  let t = s.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (tok) =>
    PROTECT_WORDS.has(tok) ? mark(tok) : tok,
  );
  return { t, ph };
}

function unprotect(s, ph) {
  let t = s;
  for (const { k, w } of ph) t = t.split(k).join(w);
  return t;
}

function applyPairs(s) {
  let t = s;
  for (const [from, to] of PAIRS) {
    if (t.includes(from)) t = t.split(from).join(to);
  }
  return t;
}

function transformText(s) {
  const { t: p, ph } = protectEnglish(s);
  let t = applyPairs(p);
  t = unprotect(t, ph);
  return t;
}

function emitStringLiteral(text, preferSingleQuote) {
  const lit = ts.factory.createStringLiteral(text, preferSingleQuote);
  const printer = ts.createPrinter({ removeComments: true });
  const sf = ts.createSourceFile("x.ts", "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  return printer.printNode(ts.EmitHint.Unspecified, lit, sf).trim();
}

function transformSourceFile(content, fileName) {
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  /** @type {Array<{start:number,end:number,text:string}>} */
  const edits = [];

  function patchString(inner, quoteChar) {
    const next = transformText(inner);
    if (next === inner) return null;
    if (quoteChar === '"') return emitStringLiteral(next, false);
    if (quoteChar === "'") return emitStringLiteral(next, true);
    return emitStringLiteral(next, false);
  }

  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const raw = node.getText(sf);
      const q = raw[0];
      const inner = node.text;
      const emitted = patchString(inner, q);
      if (emitted) {
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: emitted });
      }
    } else if (ts.isJsxText(node)) {
      const next = transformText(node.text);
      if (next !== node.text) {
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: next });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (edits.length === 0) return content;
  edits.sort((a, b) => b.start - a.start);
  let out = content;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

function walkFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walkFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function main() {
  const files = walkFiles(ROOT);
  let n = 0;
  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    const after = transformSourceFile(before, file);
    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      n++;
      console.log(file);
    }
  }
  console.error(`Fertig: ${n} Dateien.`);
}

main();
