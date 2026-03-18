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
  attempted: boolean;
  embedding: number[] | null;
  model: string;
  version: string;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      attempted: false,
      embedding: null,
      model: EMBEDDING_MODEL,
      version: EMBEDDING_VERSION,
      httpStatus: null,
      errorCode: "MISSING_API_KEY",
      errorMessage: "GEMINI_API_KEY ist nicht gesetzt.",
    };
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
    let errorCode = "EMBEDDING_HTTP_ERROR";
    let errorMessage = "Embedding Request fehlgeschlagen.";
    if (!response) {
      errorCode = "NETWORK_OR_TIMEOUT";
      errorMessage = "Netzwerkfehler oder Timeout bei Embedding-Request.";
    } else {
      const body = (await response.json().catch(() => null)) as
        | { error?: { status?: unknown; message?: unknown; code?: unknown } }
        | null;
      const status = body?.error?.status;
      const code = body?.error?.code;
      const message = body?.error?.message;
      errorCode =
        typeof status === "string"
          ? status
          : typeof code === "number"
            ? String(code)
            : typeof code === "string"
              ? code
              : `HTTP_${response.status}`;
      errorMessage =
        typeof message === "string" && message.trim().length > 0
          ? message.slice(0, 500)
          : `Embedding Endpoint antwortete mit HTTP ${response.status}.`;
    }
    return {
      attempted: true,
      embedding: null,
      model: EMBEDDING_MODEL,
      version: EMBEDDING_VERSION,
      httpStatus: response?.status ?? null,
      errorCode,
      errorMessage,
    };
  }
  const json = (await response.json().catch(() => null)) as
    | { embedding?: { values?: number[] } }
    | null;
  const values = Array.isArray(json?.embedding?.values)
    ? json?.embedding?.values.filter((value) => Number.isFinite(value))
    : [];
  return {
    attempted: true,
    embedding: values.length > 0 ? values : null,
    model: EMBEDDING_MODEL,
    version: EMBEDDING_VERSION,
    httpStatus: response.status,
    errorCode: values.length > 0 ? null : "EMPTY_EMBEDDING",
    errorMessage: values.length > 0 ? null : "Embedding-Service lieferte keinen Vektor.",
  };
}
