/** Text before the first `## okr-objective:` block (e.g. Teilnehmer-Zeile). */
export function splitOkrReviewSummaryPreamble(summary: string | null | undefined): string {
  if (!summary?.trim()) return "";
  const idx = summary.search(/^## okr-objective:/im);
  if (idx === -1) return summary.trim();
  return summary.slice(0, idx).trim();
}

/** Per-OKR-Objective notes stored as markdown sections under `summary`. */
export function parseOkrReviewObjectiveSections(summary: string | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  if (!summary?.trim()) return m;
  const lines = summary.split(/\r?\n/);
  let currentId: string | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (currentId) m.set(currentId, buf.join("\n").trim());
    buf.length = 0;
  };
  for (const line of lines) {
    const match = /^## okr-objective:([0-9a-f-]{36})\s*$/i.exec(line);
    if (match) {
      flush();
      currentId = match[1];
    } else if (currentId) {
      buf.push(line);
    }
  }
  flush();
  return m;
}

export function buildOkrReviewSummary(params: {
  preamble: string;
  perObjective: Array<{ id: string; notes: string }>;
}): string {
  const parts: string[] = [];
  const pre = params.preamble.trim();
  if (pre) parts.push(pre);
  for (const o of params.perObjective) {
    const body = o.notes.trim();
    if (!body) continue;
    parts.push(`## okr-objective:${o.id}\n${body}`);
  }
  return parts.join("\n\n");
}
