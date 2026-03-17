import { redirect } from "next/navigation";
import {
  runLlmModelHealthCheckNow,
  saveLlmSystemConfiguration,
} from "@/app/(ceo)/llm-usage/actions";
import { readAnalysisNetworkLlmPolicy } from "@/lib/analysis-network/policy";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LlmUsagePageProps = {
  searchParams: Promise<{ days?: string; success?: string; error?: string }>;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function LlmUsagePage({ searchParams }: LlmUsagePageProps) {
  const pageAccess = await getSidebarAccessContext("llm-usage");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const nowIso = new Date().toISOString();
  const sinceIso = new Date(Date.parse(nowIso) - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createSupabaseServerClient();
  const healthStaleThresholdMs = 26 * 60 * 60 * 1000;
  const { data: rows } = await supabase
    .schema("app")
    .from("llm_usage_events")
    .select("feature, provider, model, prompt_tokens, completion_tokens, total_tokens, usage_missing, created_at")
    .eq("organization_id", pageAccess.access.organizationId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(2000);
  const { data: healthRows } = await supabase
    .schema("app")
    .from("llm_model_health_status")
    .select(
      "feature, provider, model, status, fallback_active, fallback_mode, checked_at, latency_ms, http_status, error_code, error_message"
    )
    .eq("organization_id", pageAccess.access.organizationId)
    .order("feature", { ascending: true });
  const { data: branding } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", pageAccess.access.organizationId)
    .maybeSingle();

  const events = rows ?? [];
  const modelHealth = healthRows ?? [];
  const llmPolicy = readAnalysisNetworkLlmPolicy(branding?.branding_config ?? null);
  const totalPrompt = events.reduce((sum, row) => sum + toNumber(row.prompt_tokens), 0);
  const totalCompletion = events.reduce((sum, row) => sum + toNumber(row.completion_tokens), 0);
  const totalTokens = events.reduce((sum, row) => sum + toNumber(row.total_tokens), 0);
  const missingUsageCount = events.filter((row) => Boolean(row.usage_missing)).length;

  const byFeature = new Map<string, { count: number; tokens: number }>();
  const byModel = new Map<string, { count: number; tokens: number }>();
  for (const row of events) {
    const featureKey = row.feature ?? "unknown";
    const modelKey = `${row.provider ?? "unknown"} / ${row.model ?? "unknown"}`;
    const tokens = toNumber(row.total_tokens);
    const featureCurrent = byFeature.get(featureKey) ?? { count: 0, tokens: 0 };
    byFeature.set(featureKey, { count: featureCurrent.count + 1, tokens: featureCurrent.tokens + tokens });
    const modelCurrent = byModel.get(modelKey) ?? { count: 0, tokens: 0 };
    byModel.set(modelKey, { count: modelCurrent.count + 1, tokens: modelCurrent.tokens + tokens });
  }

  const featureRows = [...byFeature.entries()].sort((a, b) => b[1].tokens - a[1].tokens);
  const modelRows = [...byModel.entries()].sort((a, b) => b[1].tokens - a[1].tokens);
  const healthSummary = modelHealth.reduce(
    (acc, row) => {
      const ageMs = Math.max(0, Date.parse(nowIso) - Date.parse(row.checked_at ?? nowIso));
      const isStale = ageMs > healthStaleThresholdMs;
      if (isStale) acc.stale += 1;
      if (row.status === "down") acc.down += 1;
      if (row.status === "degraded") acc.degraded += 1;
      if (row.status === "healthy") acc.healthy += 1;
      return acc;
    },
    { healthy: 0, degraded: 0, down: 0, stale: 0 }
  );

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Systemkonfiguration und -information</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Systemkonfiguration und -information</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Zentrale Uebersicht und Konfiguration fuer LLM-Verbrauch, Feature-Freigaben und Modell-Health.
        </p>
        {params.success === "health-checked" ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Modell-Health-Check erfolgreich ausgefuehrt.
          </p>
        ) : null}
        {params.error === "read-only" ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Nur Benutzer mit Schreibrechten koennen den manuellen Health-Check ausfuehren.
          </p>
        ) : null}
        {params.success === "config-saved" ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Systemkonfiguration erfolgreich gespeichert.
          </p>
        ) : null}
      </header>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">LLM Freigaben und Token-Budgets</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Steuerung pro Feature sowie Output-Token-Limits und Budgetgrenzen.
        </p>
        <form action={saveLlmSystemConfiguration} className="mt-4 space-y-4">
          <input type="hidden" name="days" value={String(days)} />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="llm_enabled"
              defaultChecked={llmPolicy.llmEnabled}
              className="h-4 w-4 rounded border-zinc-300"
            />
            LLM global aktivieren
          </label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="llm_feature_quality_scoring"
                defaultChecked={llmPolicy.featureFlags.quality_scoring}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Qualitaetsbewertung
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="llm_feature_link_draft_generation"
                defaultChecked={llmPolicy.featureFlags.link_draft_generation}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Link-Entwurfsgenerierung
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="llm_feature_cluster_assessment"
                defaultChecked={llmPolicy.featureFlags.cluster_assessment}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Cluster-Bewertung
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="llm_feature_gap_assessment"
                defaultChecked={llmPolicy.featureFlags.gap_assessment}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Luecken-Bewertung
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="llm_feature_challenge_recommendation"
                defaultChecked={llmPolicy.featureFlags.challenge_recommendation}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Empfehlungslogik fuer Herausforderungen
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="llm_feature_model_health_checks"
                defaultChecked={llmPolicy.featureFlags.model_health_checks}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Modell-Gesundheitspruefungen
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Taegliches Soft-Token-Limit</span>
              <input
                type="number"
                min={0}
                max={100000000}
                name="llm_daily_soft_token_limit"
                defaultValue={llmPolicy.dailySoftTokenLimit}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Monatliches Hard-Token-Limit</span>
              <input
                type="number"
                min={0}
                max={1000000000}
                name="llm_monthly_hard_token_limit"
                defaultValue={llmPolicy.monthlyHardTokenLimit}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Standardwert maximale Ausgabetokens</span>
              <input
                type="number"
                min={64}
                max={4096}
                name="llm_max_output_tokens_default"
                defaultValue={llmPolicy.defaultMaxOutputTokens}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Qualitaetsbewertung</span>
              <input
                type="number"
                min={64}
                max={4096}
                name="llm_max_output_tokens_quality_scoring"
                defaultValue={llmPolicy.maxOutputTokensByFeature.quality_scoring}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Link-Entwurfsgenerierung</span>
              <input
                type="number"
                min={64}
                max={4096}
                name="llm_max_output_tokens_link_draft_generation"
                defaultValue={llmPolicy.maxOutputTokensByFeature.link_draft_generation}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Cluster-Bewertung</span>
              <input
                type="number"
                min={64}
                max={4096}
                name="llm_max_output_tokens_cluster_assessment"
                defaultValue={llmPolicy.maxOutputTokensByFeature.cluster_assessment}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Luecken-Bewertung</span>
              <input
                type="number"
                min={64}
                max={4096}
                name="llm_max_output_tokens_gap_assessment"
                defaultValue={llmPolicy.maxOutputTokensByFeature.gap_assessment}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Empfehlungslogik fuer Herausforderungen</span>
              <input
                type="number"
                min={64}
                max={4096}
                name="llm_max_output_tokens_challenge_recommendation"
                defaultValue={llmPolicy.maxOutputTokensByFeature.challenge_recommendation}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">Modell-Gesundheitspruefungen</span>
              <input
                type="number"
                min={64}
                max={4096}
                name="llm_max_output_tokens_model_health_checks"
                defaultValue={llmPolicy.maxOutputTokensByFeature.model_health_checks}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={!pageAccess.canWrite}
            className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            Systemkonfiguration speichern
          </button>
        </form>
      </section>

      <section className="brand-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">LLM Modell-Health</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Taeglicher Check ueber `/api/internal/llm-health` (Cron) plus manueller Sofort-Check.
            </p>
          </div>
          <form action={runLlmModelHealthCheckNow}>
            <input type="hidden" name="days" value={String(days)} />
            <button
              type="submit"
              disabled={!pageAccess.canWrite}
              className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              Jetzt pruefen
            </button>
          </form>
        </div>
        {healthSummary.down > 0 || healthSummary.degraded > 0 || healthSummary.stale > 0 ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Alarm: {healthSummary.down} down, {healthSummary.degraded} degraded, {healthSummary.stale} stale.
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="brand-surface p-3">
            <p className="text-xs text-zinc-500">Healthy</p>
            <p className="text-xl font-semibold text-emerald-700">{healthSummary.healthy}</p>
          </div>
          <div className="brand-surface p-3">
            <p className="text-xs text-zinc-500">Degraded</p>
            <p className="text-xl font-semibold text-amber-700">{healthSummary.degraded}</p>
          </div>
          <div className="brand-surface p-3">
            <p className="text-xs text-zinc-500">Down</p>
            <p className="text-xl font-semibold text-rose-700">{healthSummary.down}</p>
          </div>
          <div className="brand-surface p-3">
            <p className="text-xs text-zinc-500">Stale (&gt;26h)</p>
            <p className="text-xl font-semibold text-zinc-900">{healthSummary.stale}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {modelHealth.length === 0 ? (
            <p className="text-sm text-zinc-600">Noch keine Health-Checks vorhanden.</p>
          ) : (
            modelHealth.map((row) => {
              const ageMs = Math.max(0, Date.parse(nowIso) - Date.parse(row.checked_at ?? nowIso));
              const isStale = ageMs > healthStaleThresholdMs;
              const status = isStale ? "stale" : row.status;
              const dotClass =
                status === "healthy"
                  ? "bg-emerald-500"
                  : status === "degraded"
                    ? "bg-amber-500"
                    : status === "down"
                      ? "bg-rose-500"
                      : "bg-zinc-400";

              return (
                <div key={row.feature} className="brand-surface flex items-start justify-between gap-3 p-3 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-zinc-900">{row.feature}</p>
                    <p className="text-zinc-600">
                      {row.provider} / {row.model}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Letzter Check: {row.checked_at ? new Date(row.checked_at).toLocaleString("de-CH") : "-"}
                      {row.latency_ms != null ? ` | ${row.latency_ms} ms` : ""}
                      {row.http_status != null ? ` | HTTP ${row.http_status}` : ""}
                    </p>
                    {row.error_code || row.error_message ? (
                      <p className="text-xs text-rose-700">
                        {row.error_code ?? "ERROR"}: {row.error_message ?? "Unbekannter Fehler"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className={`inline-block h-3 w-3 rounded-full ${dotClass}`} />
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-700">{status}</span>
                    {row.fallback_active ? (
                      <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">
                        Fallback: {row.fallback_mode ?? "none"}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="brand-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <a href="/llm-usage?days=7" className={`rounded-md px-3 py-1.5 text-xs ${days === 7 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>7 Tage</a>
          <a href="/llm-usage?days=30" className={`rounded-md px-3 py-1.5 text-xs ${days === 30 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>30 Tage</a>
          <a href="/llm-usage?days=90" className={`rounded-md px-3 py-1.5 text-xs ${days === 90 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>90 Tage</a>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="brand-surface p-3">
            <p className="text-xs text-zinc-500">Requests</p>
            <p className="text-xl font-semibold text-zinc-900">{events.length}</p>
          </div>
          <div className="brand-surface p-3">
            <p className="text-xs text-zinc-500">Prompt Tokens</p>
            <p className="text-xl font-semibold text-zinc-900">{totalPrompt.toLocaleString("de-CH")}</p>
          </div>
          <div className="brand-surface p-3">
            <p className="text-xs text-zinc-500">Completion Tokens</p>
            <p className="text-xl font-semibold text-zinc-900">{totalCompletion.toLocaleString("de-CH")}</p>
          </div>
          <div className="brand-surface p-3">
            <p className="text-xs text-zinc-500">Total Tokens</p>
            <p className="text-xl font-semibold text-zinc-900">{totalTokens.toLocaleString("de-CH")}</p>
            <p className="mt-1 text-xs text-zinc-500">usage_missing: {missingUsageCount}</p>
          </div>
        </div>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Verbrauch nach Feature</h2>
        <div className="mt-3 space-y-2">
          {featureRows.length === 0 ? (
            <p className="text-sm text-zinc-600">Keine Daten im gewaehlten Zeitraum.</p>
          ) : (
            featureRows.map(([feature, values]) => (
              <div key={feature} className="brand-surface flex items-center justify-between p-3 text-sm">
                <span className="font-medium text-zinc-900">{feature}</span>
                <span className="text-zinc-600">
                  {values.tokens.toLocaleString("de-CH")} Tokens ({values.count} Requests)
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Verbrauch nach Provider/Modell</h2>
        <div className="mt-3 space-y-2">
          {modelRows.length === 0 ? (
            <p className="text-sm text-zinc-600">Keine Daten im gewaehlten Zeitraum.</p>
          ) : (
            modelRows.map(([model, values]) => (
              <div key={model} className="brand-surface flex items-center justify-between p-3 text-sm">
                <span className="font-medium text-zinc-900">{model}</span>
                <span className="text-zinc-600">
                  {values.tokens.toLocaleString("de-CH")} Tokens ({values.count} Requests)
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
