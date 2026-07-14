import { redirect } from "next/navigation";
import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";
import {
  createBusinessModel,
  linkBusinessModelToOrganizationUnit,
  linkBusinessModelToIndustry,
  unlinkBusinessModelFromIndustry,
  unlinkBusinessModelFromOrganizationUnit,
} from "@/app/(ceo)/strategy-dimensions/actions";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { getOrganizationUnits, getPhase0Context } from "@/lib/phase0/queries";
import { resolveStrategyPlanningCycle } from "@/lib/strategy-cycle/pick-strategy-planning-cycle";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  getBusinessModels,
  getDimensionLinks,
  getIndustries,
  getOrganizationUnitDimensionLinks,
} from "@/lib/strategy-dimensions/queries";

type BusinessModelsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function getMessage(error?: string, success?: string) {
  if (error === "missing-name") return { type: "error", text: "Name ist erforderlich." };
  if (error === "missing-link") return { type: "error", text: "Bitte g\u00FCltige Verkn\u00FCpfung waehlen." };
  if (error === "save-failed") return { type: "error", text: "Business Model konnte nicht gespeichert werden." };
  if (success === "saved") return { type: "success", text: "Business Model wurde gespeichert." };
  if (success === "linked") return { type: "success", text: "Verkn\u00FCpfung wurde gespeichert." };
  if (success === "unlinked-industry") return { type: "success", text: "Industrie-Zuordnung wurde entfernt." };
  if (success === "unlinked") return { type: "success", text: "Zuordnung zur Organisationseinheit wurde entfernt." };
  return null;
}

function asList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (typeof item === "object" && item !== null && "text" in item ? String((item as { text: unknown }).text) : ""))
    .filter(Boolean)
    .join(", ");
}

export default async function BusinessModelsPage({ searchParams }: BusinessModelsPageProps) {
  const pageAccess = await getSidebarAccessContext("organization");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await resolveStrategyPlanningCycle(context.organizationId);
  if (!cycle) redirect("/planning-cycles");

  const [models, industries, links] = await Promise.all([
    getBusinessModels(context.organizationId, cycle.id),
    getIndustries(context.organizationId, cycle.id),
    getDimensionLinks(context.organizationId, cycle.id),
  ]);
  const [orgUnits, orgUnitLinks] = await Promise.all([
    getOrganizationUnits(context.organizationId),
    getOrganizationUnitDimensionLinks(context.organizationId, cycle.id),
  ]);
  const linkedIndustryIdsByModel = new Map<string, string[]>();
  for (const link of links.businessModelIndustries) {
    const list = linkedIndustryIdsByModel.get(link.business_model_id) ?? [];
    list.push(link.industry_id);
    linkedIndustryIdsByModel.set(link.business_model_id, list);
  }
  const linkedUnitIdsByBusinessModel = new Map<string, string[]>();
  for (const link of orgUnitLinks.organizationUnitBusinessModels) {
    const list = linkedUnitIdsByBusinessModel.get(link.business_model_id) ?? [];
    list.push(link.organization_unit_id);
    linkedUnitIdsByBusinessModel.set(link.business_model_id, list);
  }

  const params = await searchParams;
  const status = getMessage(params.error, params.success);

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Organisationsstruktur</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Geschäftsmodelle</h1>
        <p className="mt-1 text-sm text-zinc-600">Erstelle Geschäftsmodelle und verknupfe sie mit Industrien und Organisationseinheiten.</p>
      </header>

      <OrganizationTabs />

      {status ? (
        <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {status.text}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Neues Geschäftsmodell</h2>
          <form action={createBusinessModel} className="mt-4 space-y-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Name</span>
              <input name="name" required placeholder="Name" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Beschreibung</span>
              <textarea name="description" rows={2} placeholder="Beschreibung" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Status</span>
                <select name="status" defaultValue="active" className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm">
                  <option value="draft">Entwurf</option>
                  <option value="active">Aktiv</option>
                  <option value="archived">Archiviert</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Version</span>
                <input type="number" min={1} name="version_no" defaultValue={1} className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm" />
              </label>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Kundensegmente (Industrien)</span>
              {industries.length === 0 ? (
                <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  Keine Industrien vorhanden. Bitte zuerst unter Industrien anlegen.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {industries.map((industry) => (
                    <label key={industry.id} className="inline-flex">
                      <input
                        type="checkbox"
                        name="industry_ids"
                        value={industry.id}
                        disabled={!canWrite}
                        className="peer sr-only"
                      />
                      <span className="cursor-pointer rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 transition hover:border-zinc-400 peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-checked:text-white peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                        {industry.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Wertversprechen</span>
              <textarea name="value_proposition" rows={2} placeholder="Wertversprechen eingeben" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Kanaele</span>
              <textarea name="channels" rows={2} placeholder="Kanaele eingeben" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Kundenbeziehungen</span>
              <textarea name="customer_relationships" rows={2} placeholder="Kundenbeziehungen eingeben" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Einnahmequellen</span>
              <textarea name="revenue_streams" rows={2} placeholder="Einnahmequellen eingeben" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Schlüsselressourcen</span>
              <textarea name="key_resources" rows={2} placeholder="Schl\u00FCsselressourcen eingeben" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Schlüsselaktivitäten</span>
              <textarea name="key_activities" rows={2} placeholder="Schl\u00FCsselaktivit\u00E4ten eingeben" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Schlüsselpartner</span>
              <textarea name="key_partners" rows={2} placeholder="Schl\u00FCsselpartner eingeben" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Kostenstruktur</span>
              <textarea name="cost_structure" rows={2} placeholder="Kostenstruktur eingeben" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">Geschäftsmodell speichern</button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Geschäftsmodelle ({models.length})</h2>
          <div className="mt-3 space-y-3">
            {models.length === 0 ? (
              <p className="brand-surface p-3 text-sm text-zinc-600">Noch keine Einträge vorhanden.</p>
            ) : (
              models.map((model) => {
                const linkedIds = new Set(linkedIndustryIdsByModel.get(model.id) ?? []);
                const linkedIndustries = industries.filter((industry) => linkedIds.has(industry.id));
                const customerSegmentsText = linkedIndustries.map((industry) => industry.name).join(", ") || "-";
                return (
                  <div key={model.id} className="brand-surface p-3 space-y-2">
                    <p className="text-sm font-semibold text-zinc-900">{model.name} (v{model.version_no})</p>
                    <p className="text-xs text-zinc-600">Status: {model.status}</p>
                    <p className="text-xs text-zinc-600">Kundensegmente: {customerSegmentsText}</p>
                    <p className="text-xs text-zinc-600">Wertversprechen: {asList(model.value_proposition) || "-"}</p>
                    <p className="text-xs text-zinc-600">Industrien: {linkedIndustries.map((i) => i.name).join(", ") || "-"}</p>
                    <p className="text-xs text-zinc-600">
                      Organisationseinheiten:{" "}
                      {orgUnits
                        .filter((unit) =>
                          (linkedUnitIdsByBusinessModel.get(model.id) ?? []).includes(unit.id)
                        )
                        .map((unit) => `${unit.code} (${unit.name})`)
                        .join(", ") || "-"}
                    </p>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Industrien verknüpfen/entfernen</p>
                      <div className="flex flex-wrap gap-2">
                        {industries.map((industry) => {
                          const isLinked = linkedIds.has(industry.id);
                          return (
                            <ConfirmBeforeSubmitForm
                              key={`${model.id}-${industry.id}`}
                              action={isLinked ? unlinkBusinessModelFromIndustry : linkBusinessModelToIndustry}
                              className="inline-flex"
                              requireConfirm={isLinked}
                              title="Industrie-Zuordnung entfernen?"
                              description={`Die Verknüpfung zu „${industry.name}“ wird aufgehoben.`}
                              confirmLabel="Entfernen"
                            >
                              <input type="hidden" name="business_model_id" value={model.id} />
                              <input type="hidden" name="industry_id" value={industry.id} />
                              <button
                                type="submit"
                                disabled={!canWrite}
                                className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-50 ${
                                  isLinked
                                    ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                                }`}
                              >
                                {isLinked ? `Entfernen: ${industry.name}` : industry.name}
                              </button>
                            </ConfirmBeforeSubmitForm>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Organisationseinheiten verknüpfen/entfernen</p>
                      <div className="flex flex-wrap gap-2">
                        {orgUnits.map((unit) => {
                          const isLinked = (linkedUnitIdsByBusinessModel.get(model.id) ?? []).includes(unit.id);
                          return (
                            <ConfirmBeforeSubmitForm
                              key={`${model.id}-${unit.id}`}
                              action={isLinked ? unlinkBusinessModelFromOrganizationUnit : linkBusinessModelToOrganizationUnit}
                              className="inline-flex"
                              requireConfirm={isLinked}
                              title="Organisationseinheit entfernen?"
                              description={`Die Verknüpfung zu „${unit.code}“ wird aufgehoben.`}
                              confirmLabel="Entfernen"
                            >
                              <input type="hidden" name="business_model_id" value={model.id} />
                              <input type="hidden" name="organization_unit_id" value={unit.id} />
                              <button
                                type="submit"
                                disabled={!canWrite}
                                className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-50 ${
                                  isLinked
                                    ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                                }`}
                              >
                                {isLinked ? `Entfernen: ${unit.code}` : `${unit.code} - ${unit.name}`}
                              </button>
                            </ConfirmBeforeSubmitForm>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <OrganizationGraphPanel organizationId={context.organizationId} cycleInstanceId={cycle.id} />
    </div>
  );
}
