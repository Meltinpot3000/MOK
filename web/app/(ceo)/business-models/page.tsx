import { redirect } from "next/navigation";
import {
  createBusinessModel,
  linkBusinessModelToOrganizationUnit,
  linkBusinessModelToIndustry,
  unlinkBusinessModelFromOrganizationUnit,
} from "@/app/(ceo)/strategy-dimensions/actions";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { getOrganizationUnits, getPhase0Context, getPlanningCycles } from "@/lib/phase0/queries";
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
  if (error === "missing-link") return { type: "error", text: "Bitte gueltige Verknuepfung waehlen." };
  if (success === "saved") return { type: "success", text: "Business Model wurde gespeichert." };
  if (success === "linked") return { type: "success", text: "Verknuepfung wurde gespeichert." };
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
  const cycles = await getPlanningCycles(context.organizationId);
  const cycle = cycles[0];
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
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Core Strategy Dimensions</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Business Models</h1>
        <p className="mt-1 text-sm text-zinc-600">Business Model Canvas pro Zyklus inkl. Industrie-Relationen.</p>
      </header>

      <OrganizationTabs />

      {status ? (
        <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {status.text}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Neues Business Model</h2>
          <form action={createBusinessModel} className="mt-4 space-y-2">
            <input name="name" required placeholder="Name" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            <textarea name="description" rows={2} placeholder="Beschreibung" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select name="status" defaultValue="active" className="rounded-md border border-zinc-300 px-2 py-2 text-sm">
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
              <input type="number" min={1} name="version_no" defaultValue={1} className="rounded-md border border-zinc-300 px-2 py-2 text-sm" />
            </div>
            <textarea name="customer_segments" rows={2} placeholder="customer_segments (Zeilen oder komma-separiert)" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="value_proposition" rows={2} placeholder="value_proposition" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="channels" rows={2} placeholder="channels" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="customer_relationships" rows={2} placeholder="customer_relationships" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="revenue_streams" rows={2} placeholder="revenue_streams" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="key_resources" rows={2} placeholder="key_resources" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="key_activities" rows={2} placeholder="key_activities" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="key_partners" rows={2} placeholder="key_partners" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="cost_structure" rows={2} placeholder="cost_structure" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">Business Model speichern</button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Modelle ({models.length})</h2>
          <div className="mt-3 space-y-3">
            {models.length === 0 ? (
              <p className="brand-surface p-3 text-sm text-zinc-600">Noch keine Eintraege vorhanden.</p>
            ) : (
              models.map((model) => {
                const linkedIds = new Set(linkedIndustryIdsByModel.get(model.id) ?? []);
                const linkedIndustries = industries.filter((industry) => linkedIds.has(industry.id));
                return (
                  <div key={model.id} className="brand-surface p-3 space-y-2">
                    <p className="text-sm font-semibold text-zinc-900">{model.name} (v{model.version_no})</p>
                    <p className="text-xs text-zinc-600">Status: {model.status}</p>
                    <p className="text-xs text-zinc-600">Customer Segments: {asList(model.customer_segments) || "-"}</p>
                    <p className="text-xs text-zinc-600">Value Proposition: {asList(model.value_proposition) || "-"}</p>
                    <p className="text-xs text-zinc-600">Industries: {linkedIndustries.map((i) => i.name).join(", ") || "-"}</p>
                    <p className="text-xs text-zinc-600">
                      Organisationseinheiten:{" "}
                      {orgUnits
                        .filter((unit) =>
                          (linkedUnitIdsByBusinessModel.get(model.id) ?? []).includes(unit.id)
                        )
                        .map((unit) => `${unit.code} (${unit.name})`)
                        .join(", ") || "-"}
                    </p>
                    <form action={linkBusinessModelToIndustry} className="flex gap-2">
                      <input type="hidden" name="business_model_id" value={model.id} />
                      <select name="industry_id" defaultValue="" className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                        <option value="">Industrie verknuepfen</option>
                        {industries.map((industry) => (
                          <option key={industry.id} value={industry.id}>{industry.name}</option>
                        ))}
                      </select>
                      <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">Link</button>
                    </form>
                    <form action={linkBusinessModelToOrganizationUnit} className="flex gap-2">
                      <input type="hidden" name="business_model_id" value={model.id} />
                      <select
                        name="organization_unit_id"
                        defaultValue=""
                        className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                      >
                        <option value="">Organisationseinheit verknuepfen</option>
                        {orgUnits.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.code} - {unit.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!canWrite}
                        className="brand-btn-secondary px-3 py-1.5 text-xs"
                      >
                        Link
                      </button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                      {orgUnits
                        .filter((unit) =>
                          (linkedUnitIdsByBusinessModel.get(model.id) ?? []).includes(unit.id)
                        )
                        .map((unit) => (
                          <form
                            key={`${model.id}-${unit.id}`}
                            action={unlinkBusinessModelFromOrganizationUnit}
                            className="inline-flex"
                          >
                            <input type="hidden" name="business_model_id" value={model.id} />
                            <input type="hidden" name="organization_unit_id" value={unit.id} />
                            <button
                              type="submit"
                              disabled={!canWrite}
                              className="rounded-md border border-red-300 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Entfernen: {unit.code}
                            </button>
                          </form>
                        ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <OrganizationGraphPanel organizationId={context.organizationId} planningCycleId={cycle.id} />
    </div>
  );
}
