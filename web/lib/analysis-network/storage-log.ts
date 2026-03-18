const DEFAULT_AI_LOG_BUCKET = "tenant-ai-logs";

type UploadResult = Promise<{ error?: { message?: string | null } | null }>;

type SupabaseStorageClientLike = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Blob,
        options?: { upsert?: boolean; cacheControl?: string; contentType?: string }
      ) => UploadResult;
    };
  };
};

export type AiStorageProviderModel = {
  provider: string;
  model: string;
  promptVersion?: string | null;
};

export type AiStorageTokenStats = {
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

export type AiStorageActionLogInput = {
  supabase: SupabaseStorageClientLike;
  organizationId: string;
  cycleInstanceId?: string | null;
  feature: string;
  action: string;
  triggerType: string;
  status: "success" | "partial" | "failed";
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  runId?: string;
  providerModels?: AiStorageProviderModel[];
  tokens?: AiStorageTokenStats;
  billableCost?: number | null;
  counts?: Record<string, number>;
  items?: unknown[];
  errors?: unknown[];
  metadata?: Record<string, unknown>;
  bucket?: string;
};

export type AiStorageLogWriteResult = {
  ok: boolean;
  bucket: string;
  path: string | null;
  error: string | null;
};

function sanitizeSegment(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

function toIsoSafe(value: string): string {
  return value.replace(/[:.]/g, "-");
}

function redactSensitive(value: unknown, parentKey: string | null, seen: WeakSet<object>): unknown {
  const key = (parentKey ?? "").toLowerCase();
  const sensitiveKeyPattern = /(prompt|authorization|api.?key|secret|token|password|cookie|credential|bearer)/i;
  if (sensitiveKeyPattern.test(key)) {
    return "[redacted]";
  }
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, parentKey, seen));
  }
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(record)) {
    out[childKey] = redactSensitive(childValue, childKey, seen);
  }
  return out;
}

function redactPayload(value: unknown): unknown {
  return redactSensitive(value, null, new WeakSet<object>());
}

function buildStoragePath(input: {
  organizationId: string;
  feature: string;
  action: string;
  finishedAtIso: string;
  runId: string;
}): string {
  const finishedAt = new Date(input.finishedAtIso);
  const year = String(finishedAt.getUTCFullYear());
  const month = String(finishedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(finishedAt.getUTCDate()).padStart(2, "0");
  const feature = sanitizeSegment(input.feature) || "unknown-feature";
  const action = sanitizeSegment(input.action) || "unknown-action";
  const stamp = sanitizeSegment(toIsoSafe(input.finishedAtIso)) || Date.now().toString();
  const run = sanitizeSegment(input.runId) || crypto.randomUUID();
  return `organizations/${input.organizationId}/ai-logs/${year}/${month}/${day}/${feature}/${stamp}-${action}-${run}.json`;
}

export async function writeAiStorageActionLog(input: AiStorageActionLogInput): Promise<AiStorageLogWriteResult> {
  const bucket = (input.bucket ?? process.env.AI_LOG_BUCKET ?? DEFAULT_AI_LOG_BUCKET).trim() || DEFAULT_AI_LOG_BUCKET;
  const startedAt = input.startedAt ?? new Date().toISOString();
  const finishedAt = input.finishedAt ?? new Date().toISOString();
  const runId = input.runId ?? crypto.randomUUID();
  const path = buildStoragePath({
    organizationId: input.organizationId,
    feature: input.feature,
    action: input.action,
    finishedAtIso: finishedAt,
    runId,
  });

  const payload = redactPayload({
    logVersion: 1,
    runId,
    organizationId: input.organizationId,
    cycleInstanceId: input.cycleInstanceId ?? null,
    feature: input.feature,
    action: input.action,
    triggerType: input.triggerType,
    status: input.status,
    startedAt,
    finishedAt,
    durationMs: input.durationMs ?? Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
    providerModels: input.providerModels ?? [],
    tokens: {
      promptTokens: input.tokens?.promptTokens ?? null,
      completionTokens: input.tokens?.completionTokens ?? null,
      totalTokens: input.tokens?.totalTokens ?? null,
    },
    billableCost: input.billableCost ?? null,
    counts: input.counts ?? {},
    items: input.items ?? [],
    errors: input.errors ?? [],
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  });

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  try {
    const { error } = await input.supabase.storage.from(bucket).upload(path, blob, {
      upsert: true,
      cacheControl: "3600",
      contentType: "application/json",
    });
    if (error) {
      return { ok: false, bucket, path: null, error: error.message ?? "storage_upload_failed" };
    }
    return { ok: true, bucket, path, error: null };
  } catch (error) {
    return {
      ok: false,
      bucket,
      path: null,
      error: String(error instanceof Error ? error.message : error),
    };
  }
}
