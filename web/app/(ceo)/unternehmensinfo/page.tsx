import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RefreshOnSuccess } from "@/components/ceo/RefreshOnSuccess";
import { UnternehmensinfoSection } from "@/components/ceo/company-info/UnternehmensinfoSection";
import { coerceStrategicContextOutput } from "@/lib/analysis-network/objective-evaluation-providers";
import { getTenantBranding } from "@/lib/ceo/queries";
import { getUnternehmensinfoStatusMessage, UNTERNEHMENSINFO_TABS } from "@/lib/company-info/unternehmensinfo-ui";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { readCompanyKennzahlenFromBrandingConfig } from "@/lib/strategy-cycle/company-info";
import { readStrategyReferenceFieldsFromBrandingConfig } from "@/lib/strategy-cycle/strategy-reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Unternehmensinfo",
};

type UnternehmensinfoPageProps = {
  searchParams: Promise<{
    l2?: string;
    tab?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function UnternehmensinfoPage({ searchParams }: UnternehmensinfoPageProps) {
  const resolvedSearchParams = await searchParams;
  const rawL2 = resolvedSearchParams.l2 ?? resolvedSearchParams.tab;
  const requestedL2 = rawL2 != null && String(rawL2).trim() !== "" ? String(rawL2).trim() : "";
  const activeTab =
    requestedL2 && UNTERNEHMENSINFO_TABS.includes(requestedL2 as (typeof UNTERNEHMENSINFO_TABS)[number])
      ? (requestedL2 as (typeof UNTERNEHMENSINFO_TABS)[number])
      : "kennwerte";

  const pageAccess = await getSidebarAccessContext("strategy-cycle");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const hasActiveCycle = Boolean(await getActivePlanningCycle(context.organizationId));

  if (!hasActiveCycle) {
    return (
      <section className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Organisation</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Unternehmensinfo</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Kein Planungszyklus vorhanden. Bitte zuerst einen Zyklus anlegen.
        </p>
      </section>
    );
  }

  const branding = await getTenantBranding(context.organizationId);
  const companyKennzahlen = readCompanyKennzahlenFromBrandingConfig(branding?.branding_config ?? null);
  const strategyReferenceFields = readStrategyReferenceFieldsFromBrandingConfig(branding?.branding_config ?? null);

  const supabase = await createSupabaseServerClient();
  const { data: strategicContextRow } = await supabase
    .schema("app")
    .from("strategic_context_cache")
    .select("context_json, provider, model, prompt_version, created_at")
    .eq("organization_id", context.organizationId)
    .eq("is_current", true)
    .maybeSingle();

  const strategicContextCache = strategicContextRow
    ? {
        parsed: coerceStrategicContextOutput(strategicContextRow.context_json),
        provider: strategicContextRow.provider,
        model: strategicContextRow.model,
        prompt_version: strategicContextRow.prompt_version,
        created_at: strategicContextRow.created_at,
      }
    : null;

  const statusMessage = getUnternehmensinfoStatusMessage(resolvedSearchParams.success);

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Organisation</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Unternehmensinfo</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Kennwerte, Strategiereferenz (Mission, Vision, …) und Sentinel✨-Kontext für den aktuellen Planungszyklus.
        </p>
      </header>

      <Suspense fallback={null}>
        <RefreshOnSuccess />
      </Suspense>
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat Leserechte. Erstellen/Bearbeiten ist deaktiviert.
        </p>
      ) : null}
      {statusMessage ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {statusMessage.text}
        </p>
      ) : null}

      <UnternehmensinfoSection
        activeTab={activeTab}
        canWrite={canWrite}
        companyKennzahlen={companyKennzahlen}
        strategyReferenceFields={strategyReferenceFields}
        strategicContextCache={strategicContextCache}
      />
    </div>
  );
}
