import { redirect } from "next/navigation";
import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";
import {
  createOperatingModel,
  linkOperatingModelToBusinessModel,
  linkOperatingModelToIndustry,
  unlinkOperatingModelFromBusinessModel,
  unlinkOperatingModelFromIndustry,
} from "@/app/(ceo)/strategy-dimensions/actions";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  getBusinessModels,
  getDimensionLinks,
  getIndustries,
  getOperatingModels,
} from "@/lib/strategy-dimensions/queries";

type OperatingModelsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function getMessage(error?: string, success?: string) {
  if (error === "missing-name") return { type: "error", text: "Name ist erforderlich." };
  if (error === "missing-link") return { type: "error", text: "Bitte g\u00FCltige Verkn\u00FCpfung waehlen." };
  if (success === "saved") return { type: "success", text: "Betriebsmodell wurde gespeichert." };
  if (success === "linked") return { type: "success", text: "Verkn\u00FCpfung wurde gespeichert." };
  if (success === "unlinked") return { type: "success", text: "Verkn\u00FCpfung wurde entfernt." };
  return null;
}

function asList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (typeof item === "object" && item !== null && "text" in item ? String((item as { text: unknown }).text) : ""))
    .filter(Boolean)
    .join(", ");
}

export default async function OperatingModelsPage({ searchParams }: OperatingModelsPageProps) {
  const pageAccess = await getSidebarAccessContext("organization");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) redirect("/planning-cycles");

  const [models, industries, businessModels, links] = await Promise.all([
    getOperatingModels(context.organizationId, cycle.id),
    getIndustries(context.organizationId, cycle.id),
    getBusinessModels(context.organizationId, cycle.id),
    getDimensionLinks(context.organizationId, cycle.id),
  ]);
  const linkedIndustryIdsByModel = new Map<string, string[]>();
  for (const link of links.operatingModelIndustries) {
    const list = linkedIndustryIdsByModel.get(link.operating_model_id) ?? [];
    list.push(link.industry_id);
    linkedIndustryIdsByModel.set(link.operating_model_id, list);
  }
  const linkedBusinessModelIdsByModel = new Map<string, string[]>();
  for (const link of links.operatingModelBusinessModels) {
    const list = linkedBusinessModelIdsByModel.get(link.operating_model_id) ?? [];
    list.push(link.business_model_id);
    linkedBusinessModelIdsByModel.set(link.operating_model_id, list);
  }

  const params = await searchParams;
  const status = getMessage(params.error, params.success);

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Organisationsstruktur</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Betriebsmodelle</h1>
        <p className="mt-1 text-sm text-zinc-600">Definiere Betriebsmodelle und ordne sie passend zu Industrien und Geschäftsmodellen zu.</p>
      </header>

      <OrganizationTabs />

      {status ? (
        <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {status.text}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Neues Betriebsmodell</h2>
          <form action={createOperatingModel} className="mt-4 space-y-2">
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
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Prozesse</span>
              <textarea name="processes" rows={2} placeholder="Prozesse (Zeilen oder komma-separiert)" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Organisationsdesign</span>
              <textarea name="organization_design" rows={2} placeholder="Organisationsdesign" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Fähigkeiten</span>
              <textarea name="capabilities" rows={2} placeholder="F\u00E4higkeiten" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Technologie</span>
              <textarea name="technology" rows={2} placeholder="Technologie" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Datenressourcen</span>
              <textarea name="data_assets" rows={2} placeholder="Datenressourcen" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Governance</span>
              <textarea name="governance" rows={2} placeholder="Governance" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Standorte</span>
              <textarea name="locations" rows={2} placeholder="Standorte" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Partner</span>
              <textarea name="partners" rows={2} placeholder="Partner" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            </label>
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">Betriebsmodell speichern</button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Betriebsmodelle ({models.length})</h2>
          <div className="mt-3 space-y-3">
            {models.length === 0 ? (
              <p className="brand-surface p-3 text-sm text-zinc-600">Noch keine Einträge vorhanden.</p>
            ) : (
              models.map((model) => {
                const industryIds = new Set(linkedIndustryIdsByModel.get(model.id) ?? []);
                const bmIds = new Set(linkedBusinessModelIdsByModel.get(model.id) ?? []);
                const linkedIndustries = industries.filter((industry) => industryIds.has(industry.id));
                const linkedBusinessModels = businessModels.filter((bm) => bmIds.has(bm.id));
                return (
                  <div key={model.id} className="brand-surface p-3 space-y-2">
                    <p className="text-sm font-semibold text-zinc-900">{model.name} (v{model.version_no})</p>
                    <p className="text-xs text-zinc-600">Status: {model.status}</p>
                    <p className="text-xs text-zinc-600">Prozesse: {asList(model.processes) || "-"}</p>
                    <p className="text-xs text-zinc-600">Fähigkeiten: {asList(model.capabilities) || "-"}</p>
                    <p className="text-xs text-zinc-600">Technologie: {asList(model.technology) || "-"}</p>
                    <p className="text-xs text-zinc-600">Industrien: {linkedIndustries.map((i) => i.name).join(", ") || "-"}</p>
                    <p className="text-xs text-zinc-600">Geschäftsmodelle: {linkedBusinessModels.map((bm) => bm.name).join(", ") || "-"}</p>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Industrien verknüpfen/entfernen</p>
                        <div className="flex flex-wrap gap-2">
                          {industries.map((industry) => {
                            const isLinked = industryIds.has(industry.id);
                            return (
                              <ConfirmBeforeSubmitForm
                                key={`${model.id}-industry-${industry.id}`}
                                action={isLinked ? unlinkOperatingModelFromIndustry : linkOperatingModelToIndustry}
                                className="inline-flex"
                                requireConfirm={isLinked}
                                title="Industrie-Zuordnung entfernen?"
                                description={`Die Verknüpfung zu „${industry.name}“ wird aufgehoben.`}
                                confirmLabel="Entfernen"
                              >
                                <input type="hidden" name="operating_model_id" value={model.id} />
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
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Geschäftsmodelle verknüpfen/entfernen</p>
                        <div className="flex flex-wrap gap-2">
                          {businessModels.map((bm) => {
                            const isLinked = bmIds.has(bm.id);
                            return (
                              <ConfirmBeforeSubmitForm
                                key={`${model.id}-bm-${bm.id}`}
                                action={isLinked ? unlinkOperatingModelFromBusinessModel : linkOperatingModelToBusinessModel}
                                className="inline-flex"
                                requireConfirm={isLinked}
                                title="Geschäftsmodell-Zuordnung entfernen?"
                                description={`Die Verknüpfung zu „${bm.name}“ wird aufgehoben.`}
                                confirmLabel="Entfernen"
                              >
                                <input type="hidden" name="operating_model_id" value={model.id} />
                                <input type="hidden" name="business_model_id" value={bm.id} />
                                <button
                                  type="submit"
                                  disabled={!canWrite}
                                  className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-50 ${
                                    isLinked
                                      ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                                  }`}
                                >
                                  {isLinked ? `Entfernen: ${bm.name}` : `${bm.name} (v${bm.version_no})`}
                                </button>
                              </ConfirmBeforeSubmitForm>
                            );
                          })}
                        </div>
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
