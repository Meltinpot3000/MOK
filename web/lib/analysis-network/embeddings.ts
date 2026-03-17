import type { AnalysisEntryRecord } from "@/lib/analysis-network/types";

const EMBEDDING_MODEL = process.env.ANALYSIS_LLM_MODEL_GEMINI_EMBEDDING ?? "text-embedding-004";
const EMBEDDING_VERSION = "gemini-embedding-v1";
const REQUEST_TIMEOUT_MS = Number(process.env.ANALYSIS_LLM_TIMEOUT_MS ?? 20000);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function buildEntryEmbeddingText(entry: Pick<
  AnalysisEntryRecord,
  "title" | "analysis_type" | "sub_type" | "description"
>): string {
  return [
    `title: ${entry.title}`,
    `analysis_type: ${entry.analysis_type}`,
    `sub_type: ${entry.sub_type ?? ""}`,
    `description: ${entry.description ?? ""}`,
  ]
    .join("\n")
    .slice(0, 6000);
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(clamp(value, -1, 1).toFixed(7))).join(",")}]`;
}

export function parseVectorLiteral(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    const values = raw.filter((value) => Number.isFinite(value)).map((value) => Number(value));
    return values.length > 0 ? values : null;
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text.startsWith("[") || !text.endsWith("]")) return null;
  const body = text.slice(1, -1).trim();
  if (!body) return null;
  const values = body
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? values : null;
}

export function cosineSimilarity(a: number[] | null | undefined, b: number[] | null | undefined): number | null {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return null;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA <= 0 || normB <= 0) return null;
  return clamp(dot / (Math.sqrt(normA) * Math.sqrt(normB)), -1, 1);
}

export async function computeEntryEmbedding(entry: Pick<
  AnalysisEntryRecord,
  "title" | "analysis_type" | "sub_type" | "description"
>): Promise<{
  embedding: number[] | null;
  model: string;
  version: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { embedding: null, model: EMBEDDING_MODEL, version: EMBEDDING_VERSION };
  }
  const text = buildEntryEmbeddingText(entry);
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(EMBEDDING_MODEL)}:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
      }),
    }
  ).catch(() => null);
  if (!response?.ok) {
    return { embedding: null, model: EMBEDDING_MODEL, version: EMBEDDING_VERSION };
  }
  const json = (await response.json().catch(() => null)) as
    | { embedding?: { values?: number[] } }
    | null;
  const values = Array.isArray(json?.embedding?.values)
    ? json?.embedding?.values.filter((value) => Number.isFinite(value))
    : [];
  return {
    embedding: values.length > 0 ? values : null,
    model: EMBEDDING_MODEL,
    version: EMBEDDING_VERSION,
  };
}
