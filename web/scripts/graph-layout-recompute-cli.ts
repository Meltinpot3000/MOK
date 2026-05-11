/**
 * Einmal: alle Analyse-Knoten eines Zyklus neu layouten (Groq + Gemini + Supplement)
 * und Groq-only-Diagnose ausgeben.
 *
 *   cd web
 *   npx --yes tsx@4 scripts/graph-layout-recompute-cli.ts
 *
 * Lädt automatisch Repo-Root `.env.local` und `web/.env.local` (DATABASE_URL, GROQ_API_KEY, …).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { diagnoseGraphLayoutGroqPipeline, proposeGraphLayoutWithLlm } from "../lib/analysis-network/providers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const repoRoot = join(webRoot, "..");

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(join(repoRoot, ".env.local"));
loadEnvFile(join(webRoot, ".env.local"));

const require = createRequire(import.meta.url);
const { Client } = require(join(webRoot, "node_modules/pg")) as {
  Client: new (c: { connectionString: string; ssl: { rejectUnauthorized: boolean } }) => {
    connect: () => Promise<void>;
    query: (sql: string, p?: unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
};

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  throw new Error("DATABASE_URL fehlt (nach Laden von .env.local)");
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, Number(value.toFixed(4))));
}

function readRuleGraphLayoutPoint(entry: {
  id: string;
  analysis_type: string;
  impact_level: number | null;
  uncertainty_level: number | null;
  quality_score: number | null;
}) {
  const impact = Math.max(1, Math.min(5, entry.impact_level ?? 3));
  const uncertainty = Math.max(1, Math.min(5, entry.uncertainty_level ?? 3));
  const quality = Math.max(0, Math.min(100, entry.quality_score ?? 50));
  const externalBias =
    entry.analysis_type === "environment" || entry.analysis_type === "competitor"
      ? -0.7
      : entry.analysis_type === "company" || entry.analysis_type === "swot"
        ? 0.7
        : 0;
  const yPriority = ((impact - 1) / 4) * 0.9 - ((uncertainty - 1) / 4) * 0.4;
  const zDepth = (quality / 100) * 0.8 - 0.4;
  return {
    id: entry.id,
    x: clampUnit(externalBias),
    y: clampUnit(yPriority),
    z: clampUnit(zDepth),
    confidence: 0.35,
    reason: "Regelbasiertes Fallback-Layout",
  };
}

function readTriScoresFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const tri = (metadata as Record<string, unknown>).triScores;
  if (!tri || typeof tri !== "object") return null;
  const row = tri as Record<string, unknown>;
  const proximityScore = Number(row.proximityScore ?? 0);
  const supportScore = Number(row.supportScore ?? 0);
  const repulsionScore = Number(row.repulsionScore ?? 0);
  if (!Number.isFinite(proximityScore) || !Number.isFinite(supportScore) || !Number.isFinite(repulsionScore)) {
    return null;
  }
  return {
    proximityScore: Math.max(0, Math.min(1, Number(proximityScore.toFixed(4)))),
    supportScore: Math.max(0, Math.min(1, Number(supportScore.toFixed(4)))),
    repulsionScore: Math.max(0, Math.min(1, Number(repulsionScore.toFixed(4)))),
  };
}

const ORG = process.env.GRAPH_RECOMPUTE_ORG_ID ?? "15fd7d63-dad1-44c4-9ee5-b3bc34f54e43";
const CYCLE = process.env.GRAPH_RECOMPUTE_CYCLE_ID ?? "fdeb6ab9-5027-48fd-9d16-ab8358d82a9b";

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const cs = loadDatabaseUrl();
  const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: entryRows } = await client.query(
    `select id, title, analysis_type, sub_type, description, impact_level, uncertainty_level, quality_score
     from app.analysis_entries
     where organization_id = $1::uuid and cycle_instance_id = $2::uuid
     order by title`,
    [ORG, CYCLE]
  );

  const [{ rows: approved }, { rows: drafts }] = await Promise.all([
    client.query(
      `select source_analysis_item_id, target_analysis_item_id, link_type, confidence, strength, metadata
       from app.analysis_item_link
       where organization_id = $1::uuid and cycle_instance_id = $2::uuid`,
      [ORG, CYCLE]
    ),
    client.query(
      `select source_analysis_item_id, target_analysis_item_id, link_type, confidence, strength, metadata, status
       from app.analysis_item_link_draft
       where organization_id = $1::uuid and cycle_instance_id = $2::uuid and status = 'draft'`,
      [ORG, CYCLE]
    ),
  ]);

  type AnalysisEntryRow = {
    id: string;
    title: string;
    analysis_type: string;
    sub_type: string | null;
    description: string | null;
    impact_level: number | null;
    uncertainty_level: number | null;
    quality_score: number | null;
  };
  const entries = entryRows as AnalysisEntryRow[];
  const entryIdSet = new Set(entries.map((e) => e.id));
  const mergedEdges = ([...approved, ...drafts] as Record<string, unknown>[])
    .map((edge) => ({
      source: String(edge.source_analysis_item_id),
      target: String(edge.target_analysis_item_id),
      linkType: String(edge.link_type ?? ""),
      confidence: Number(edge.confidence ?? 0),
      strength: Number(edge.strength ?? 3),
      triScores: readTriScoresFromMetadata(edge.metadata),
    }))
    .filter((edge) => entryIdSet.has(edge.source) && entryIdSet.has(edge.target));

  const nodes = entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    analysisType: entry.analysis_type,
    subType: entry.sub_type,
    impact: entry.impact_level ?? 3,
    uncertainty: entry.uncertainty_level ?? 3,
    description: entry.description,
    qualityScore: Number(entry.quality_score ?? 50),
  }));

  const input = {
    nodes,
    edges: mergedEdges,
    strategyReferenceText: null as string | null,
    maxOutputTokens: Number(process.env.ANALYSIS_LLM_MAX_OUTPUT_GRAPH_LAYOUT ?? 8192),
  };

  console.log("\n=== 1) Groq-only Diagnose (gleiche Batches wie Pipeline, ohne Gemini) ===\n");
  const groqReport = await diagnoseGraphLayoutGroqPipeline(input);
  console.log("Modell:", groqReport.model);
  console.log("Zusammenfassung:", groqReport.summaryDe);
  console.log("Schritte:", groqReport.steps.length, "| gemerged (Groq-only):", groqReport.mergedNodeIds.length);
  console.log("Ohne Position (IDs):", groqReport.missingNodeIds.length);
  for (const step of groqReport.steps) {
    console.log(
      `\n— ${step.phase}${step.supplementRound ? ` Runde ${step.supplementRound}` : ""} | erwartet ${step.expectedNodeIds.length} IDs | Text ${step.groqTextLength} Zeichen`
    );
    console.log("  Parser:", step.parse.reasonCode, "|", step.parse.summaryDe);
  }

  const titleById = new Map(entries.map((e) => [e.id, e.title]));
  console.log("\nFehlend nach Groq-only (Titel):");
  for (const id of groqReport.missingNodeIds) {
    console.log(" -", titleById.get(id) ?? id);
  }

  console.log("\n=== 2) Volle Pipeline (Groq → Gemini-Fallback → Supplement) + DB-Update ===\n");
  const llm = await proposeGraphLayoutWithLlm(input);
  if (llm.graphLayoutDiagnostics) {
    console.log("Diagnose (Merge):", llm.graphLayoutDiagnostics.ruleFallbackExplanationDe);
    if (llm.graphLayoutDiagnostics.lastGroqParseRejected) {
      console.log("Letzter Groq-Parser:", llm.graphLayoutDiagnostics.lastGroqParseRejected.summaryDe);
    }
  }

  if (!llm.result) {
    console.error("Kein LLM-Ergebnis (merged leer).");
    await client.end();
    process.exit(1);
  }

  const llmIds = new Set(llm.result.nodes.map((n) => n.id));
  const calculatedAt = new Date().toISOString();
  let llmCount = 0;
  let ruleCount = 0;

  for (const entry of entries) {
    const isLlm = llmIds.has(entry.id);
    const n = isLlm && llm.result ? llm.result.nodes.find((x) => x.id === entry.id) : null;
    const point = n
      ? {
          id: entry.id,
          x: n.x,
          y: n.y,
          z: n.z,
          confidence: n.confidence,
          reason: n.reason ?? "",
        }
      : readRuleGraphLayoutPoint(entry);
    if (isLlm && n) llmCount += 1;
    else ruleCount += 1;

    const ruleExplain =
      !isLlm && llm.graphLayoutDiagnostics?.ruleFallbackExplanationDe
        ? llm.graphLayoutDiagnostics.ruleFallbackExplanationDe
        : null;

    await client.query(
      `update app.analysis_entries set
        graph_layout_x = $1,
        graph_layout_y = $2,
        graph_layout_z = $3,
        graph_layout_confidence = $4,
        graph_layout_reason = $5,
        graph_layout_source = $6,
        graph_layout_fallback_reason = $7,
        graph_layout_provider = $8,
        graph_layout_model = $9,
        graph_layout_prompt_version = $10,
        graph_layout_calculated_at = $11::timestamptz
      where id = $12::uuid and organization_id = $13::uuid and cycle_instance_id = $14::uuid`,
      [
        point.x,
        point.y,
        point.z,
        point.confidence,
        isLlm ? point.reason || null : ruleExplain ?? (point.reason || null),
        isLlm ? "llm" : "rule",
        isLlm || !llm.result ? null : "llm_no_result",
        isLlm ? llm.result.provider : null,
        isLlm ? llm.result.model : null,
        isLlm ? llm.result.promptVersion : null,
        calculatedAt,
        entry.id,
        ORG,
        CYCLE,
      ]
    );
  }

  console.log("\nErgebnis:");
  console.log("  LLM (gespeichert):", llmCount);
  console.log("  Rule-Fallback:", ruleCount);
  console.log("  fertig:", calculatedAt);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
