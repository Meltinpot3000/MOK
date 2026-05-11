import type {
  CompositeContract,
  CountContract,
  DistributionContract,
  LookupContract,
  RankingContract,
  StructuredAnswerContract,
} from "./answer-contracts";

function renderCoverageNote(contract: StructuredAnswerContract): string {
  const missing = contract.missingOps ?? [];
  if (!missing.length) return "";
  return `Teilabdeckung: Nicht alle angefragten Teilziele konnten ausgefuehrt werden. Fehlend: ${missing.join(", ")}.`;
}

function renderRanking(contract: RankingContract): string {
  if (contract.retrievalStatus === "failed") {
    return "Kernaussage: Der Datenabruf fuer das Ranking ist fehlgeschlagen. Es wird kein belastbares numerisches Ergebnis ausgegeben.";
  }
  if (contract.totalItems === 0 || contract.top.length === 0) {
    return "Kernaussage: Es liegen im betrachteten Scope keine Daten fuer ein Ranking vor.";
  }
  const first = contract.top[0];
  const firstEvidence = first.evidenceIds.join(", ");
  return [
    `Kernaussage: ${first.label} hat im betrachteten Scope mit ${first.count} Eintraegen den Rang 1.`,
    `Begruendung: Das Ranking basiert auf ${contract.totalItems} Eintraegen.`,
    `Verwendete Objekte: ${firstEvidence || "keine"}`,
    renderCoverageNote(contract),
  ].join("\n");
}

function renderCount(contract: CountContract): string {
  if (contract.retrievalStatus === "failed" || contract.value == null) {
    return "Kernaussage: Der Datenabruf fuer die Zaehlung ist fehlgeschlagen. Es wird kein numerisches Ergebnis ausgegeben.";
  }
  return [
    `Kernaussage: Im betrachteten Scope wurden ${contract.value} Eintraege ermittelt.`,
    `Verwendete Objekte: ${contract.evidenceIds.join(", ") || "keine"}`,
    renderCoverageNote(contract),
  ].join("\n");
}

function renderDistribution(contract: DistributionContract): string {
  if (contract.retrievalStatus === "failed" || contract.total == null) {
    return "Kernaussage: Der Datenabruf fuer die Verteilung ist fehlgeschlagen. Es wird kein belastbares numerisches Ergebnis ausgegeben.";
  }
  if (contract.total === 0) {
    return "Kernaussage: Im betrachteten Scope liegen keine Daten fuer eine Verteilung vor.";
  }
  const top = contract.buckets[0];
  return [
    `Kernaussage: Die groesste Gruppe ist '${top?.label ?? "unbekannt"}' mit ${top?.count ?? 0} von ${contract.total} Eintraegen.`,
    "Verteilung:",
    ...contract.buckets.map((bucket) => `- ${bucket.label}: ${bucket.count} (${Math.round(bucket.share * 100)}%)`),
    renderCoverageNote(contract),
  ].join("\n");
}

function renderLookup(contract: LookupContract): string {
  if (contract.retrievalStatus === "failed" || contract.totalItems == null) {
    return "Kernaussage: Der Datenabruf fuer die Suche ist fehlgeschlagen. Es werden keine fachlichen Trefferzahlen ausgegeben.";
  }
  const td = contract.taskDiagnostics;
  if (
    contract.domain === "task" &&
    contract.totalItems === 0 &&
    td &&
    td.rawTotalBeforeStatusFilter > 0
  ) {
    return [
      `Kernaussage: Es gibt ${td.rawTotalBeforeStatusFilter} Task(s) zu Ihren Memberships, aber keiner entspricht dem gewaehlten Statusfilter (${td.statusFilter}).`,
      `Gepruefte Memberships: ${td.checkedMembershipIds.join(", ") || "—"}.`,
      renderCoverageNote(contract),
    ].join("\n");
  }
  if (contract.totalItems === 0) {
    return "Kernaussage: Es wurden keine passenden Eintraege gefunden.";
  }
  return [
    `Kernaussage: Es wurden ${contract.totalItems} passende Eintraege gefunden.`,
    ...contract.items.map((item) => `- ${item.label} (id=${item.id})`),
    renderCoverageNote(contract),
  ].join("\n");
}

function renderComposite(contract: CompositeContract): string {
  const lines = [
    "Kernaussage: Zusammengesetzte Analyse wurde ausgefuehrt.",
    ...contract.insights.map((x) => `- ${x}`),
  ];
  if (contract.anomalies.length > 0) {
    lines.push(`Anomalien (${contract.anomalies.length}):`);
    lines.push(...contract.anomalies.slice(0, 5).map((a) => `- [${a.ruleId}] ${a.label}`));
  }
  if (contract.uncoveredItems.length > 0) {
    lines.push(`Nicht abgedeckte Elemente: ${contract.uncoveredItems.length}.`);
  }
  const coverage = renderCoverageNote(contract);
  if (coverage) lines.push(coverage);
  return lines.join("\n");
}

export function renderDeterministicNarration(contract: StructuredAnswerContract): string {
  switch (contract.queryClass) {
    case "ranking":
      return renderRanking(contract);
    case "count":
      return renderCount(contract);
    case "distribution":
      return renderDistribution(contract);
    case "lookup":
      return renderLookup(contract);
    case "composite":
      return renderComposite(contract);
  }
}

