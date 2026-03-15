import { redirect } from "next/navigation";
import {
  createOperatingModel,
  linkOperatingModelToBusinessModel,
  linkOperatingModelToIndustry,
} from "@/app/(ceo)/strategy-dimensions/actions";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { getPhase0Context, getPlanningCycles } from "@/lib/phase0/queries";
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
  if (error === "missing-link") return { type: "error", text: "Bitte gueltige Verknuepfung waehlen." };
  if (success === "saved") return { type: "success", text: "Operating Model wurde gespeichert." };
  if (success === "linked") return { type: "success", text: "Verknuepfung wurde gespeichert." };
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
  const cycles = await getPlanningCycles(context.organizationId);
  const cycle = cycles[0];
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
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Core Strategy Dimensions</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Operating Models</h1>
        <p className="mt-1 text-sm text-zinc-600">Operating Model Canvas inkl. Verknuepfung zu Industry und Business Model.</p>
      </header>

      <OrganizationTabs />

      {status ? (
        <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {status.text}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Neues Operating Model</h2>
          <form action={createOperatingModel} className="mt-4 space-y-2">
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
            <textarea name="processes" rows={2} placeholder="processes (Zeilen oder komma-separiert)" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="organization_design" rows={2} placeholder="organization" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="capabilities" rows={2} placeholder="capabilities" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="technology" rows={2} placeholder="technology" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="data_assets" rows={2} placeholder="data" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="governance" rows={2} placeholder="governance" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="locations" rows={2} placeholder="locations" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <textarea name="partners" rows={2} placeholder="partners" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs" />
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">Operating Model speichern</button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Modelle ({models.length})</h2>
          <div className="mt-3 space-y-3">
            {models.length === 0 ? (
              <p className="brand-surface p-3 text-sm text-zinc-600">Noch keine Eintraege vorhanden.</p>
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
                    <p className="text-xs text-zinc-600">Processes: {asList(model.processes) || "-"}</p>
                    <p className="text-xs text-zinc-600">Capabilities: {asList(model.capabilities) || "-"}</p>
                    <p className="text-xs text-zinc-600">Technology: {asList(model.technology) || "-"}</p>
                    <p className="text-xs text-zinc-600">Industries: {linkedIndustries.map((i) => i.name).join(", ") || "-"}</p>
                    <p className="text-xs text-zinc-600">Business Models: {linkedBusinessModels.map((bm) => bm.name).join(", ") || "-"}</p>

                    <div className="flex flex-wrap gap-2">
                      <form action={linkOperatingModelToIndustry} className="flex gap-2">
                        <input type="hidden" name="operating_model_id" value={model.id} />
                        <select name="industry_id" defaultValue="" className="min-w-[210px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                          <option value="">Industry verknuepfen</option>
                          {industries.map((industry) => (
                            <option key={industry.id} value={industry.id}>{industry.name}</option>
                          ))}
                        </select>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">Link</button>
                      </form>
                      <form action={linkOperatingModelToBusinessModel} className="flex gap-2">
                        <input type="hidden" name="operating_model_id" value={model.id} />
                        <select name="business_model_id" defaultValue="" className="min-w-[230px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                          <option value="">Business Model verknuepfen</option>
                          {businessModels.map((bm) => (
                            <option key={bm.id} value={bm.id}>{bm.name} (v{bm.version_no})</option>
                          ))}
                        </select>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">Link</button>
                      </form>
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
