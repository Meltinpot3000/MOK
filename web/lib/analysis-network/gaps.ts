import type { AnalysisEntryRecord } from "@/lib/analysis-network/types";

export type GapFinding = {
  dimension: string;
  gapType: "coverage" | "connectivity" | "traceability" | "evidence";
  severity: number;
  recommendation: string;
  metadata?: Record<string, unknown>;
};

export type ConnectivityInput = {
  source_analysis_item_id: string;
  target_analysis_item_id: string;
};

const PESTEL_KEYS = [
  "political",
  "economic",
  "social",
  "technological",
  "ecological",
  "legal",
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeGapFindings(
  entries: AnalysisEntryRecord[],
  links: ConnectivityInput[],
  challengeSourceEntryIds: string[]
): GapFinding[] {
  const findings: GapFinding[] = [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  for (const key of PESTEL_KEYS) {
    const hits = entries.filter(
      (entry) => entry.analysis_type === "environment" && entry.sub_type === key
    );
    if (hits.length === 0) {
      findings.push({
        dimension: `pestel:${key}`,
        gapType: "coverage",
        severity: 4,
        recommendation: `Keine Findings im Bereich ${key}. Bitte gezielt Umfeld-Scans ergaenzen.`,
      });
    }
  }

  const degree = new Map<string, number>();
  for (const entry of entries) degree.set(entry.id, 0);
  for (const link of links) {
    degree.set(link.source_analysis_item_id, (degree.get(link.source_analysis_item_id) ?? 0) + 1);
    degree.set(link.target_analysis_item_id, (degree.get(link.target_analysis_item_id) ?? 0) + 1);
  }

  for (const entry of entries) {
    const d = degree.get(entry.id) ?? 0;
    if ((entry.impact_level ?? 3) >= 4 && d === 0) {
      findings.push({
        dimension: `entry:${entry.id}`,
        gapType: "connectivity",
        severity: 4,
        recommendation: `High-Impact Finding "${entry.title}" ist isoliert. Verbindungen oder Gegenhypothesen ergaenzen.`,
      });
    }
    if ((entry.impact_level ?? 3) >= 4 && ((entry.description ?? "").trim().length < 40)) {
      findings.push({
        dimension: `entry:${entry.id}`,
        gapType: "evidence",
        severity: 3,
        recommendation: `High-Impact Finding "${entry.title}" hat zu wenig Evidenztext.`,
      });
    }
  }

  const challengeSourceSet = new Set(challengeSourceEntryIds);
  const untracedHighImpact = entries.filter(
    (entry) => (entry.impact_level ?? 3) >= 4 && !challengeSourceSet.has(entry.id)
  );
  if (untracedHighImpact.length > 0) {
    findings.push({
      dimension: "challenge-bridge",
      gapType: "traceability",
      severity: clamp(Math.round(untracedHighImpact.length / 2) + 2, 2, 5),
      recommendation: `${untracedHighImpact.length} High-Impact Findings sind noch keiner Strategic Challenge zugeordnet.`,
      metadata: { untracedEntryIds: untracedHighImpact.map((entry) => entry.id) },
    });
  }

  const duplicates = links.filter(
    (link) =>
      !byId.has(link.source_analysis_item_id) ||
      !byId.has(link.target_analysis_item_id) ||
      link.source_analysis_item_id === link.target_analysis_item_id
  );
  if (duplicates.length > 0) {
    findings.push({
      dimension: "network-integrity",
      gapType: "connectivity",
      severity: 2,
      recommendation: "Inkonsistente Verbindungen im Netzwerk erkannt. Bitte Link-Entwuerfe pruefen.",
      metadata: { invalidLinks: duplicates.length },
    });
  }

  return findings;
}
