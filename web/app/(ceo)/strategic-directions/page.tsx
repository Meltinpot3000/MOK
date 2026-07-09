import { redirect } from "next/navigation";
import {
  linkStrategicDirectionToBusinessModel,
  linkStrategicDirectionToIndustry,
  linkStrategicDirectionToOperatingModel,
} from "@/app/(ceo)/strategy-dimensions/actions";
import { getPhase0Context, getPlanningCycleAtLevel } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  getBusinessModels,
  getDimensionLinks,
  getIndustries,
  getOperatingModels,
} from "@/lib/strategy-dimensions/queries";

type StrategicDirectionsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function getStatus(error?: string, success?: string) {
  if (error === "missing-link") return { type: "error", text: "Bitte g\u00FCltige Verkn\u00FCpfung ausw\u00E4hlen." };
  if (success === "linked") return { type: "success", text: "Dimension wurde erfolgreich verkn\u00FCpft." };
  return null;
}

export default async function StrategicDirectionsPage({ searchParams }: StrategicDirectionsPageProps) {
  const pageAccess = await getSidebarAccessContext("strategic-directions");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getPlanningCycleAtLevel(context.organizationId, 1);
  if (!cycle) redirect("/planning-cycles");

  const [industries, businessModels, operatingModels, links] = await Promise.all([
    getIndustries(context.organizationId, cycle.id),
    getBusinessModels(context.organizationId, cycle.id),
    getOperatingModels(context.organizationId, cycle.id),
    getDimensionLinks(context.organizationId, cycle.id),
  ]);

  const industryIdsByDirection = new Map<string, string[]>();
  for (const row of links.strategicDirectionIndustries) {
    const current = industryIdsByDirection.get(row.strategic_direction_id) ?? [];
    current.push(row.industry_id);
    industryIdsByDirection.set(row.strategic_direction_id, current);
  }
  const businessModelIdsByDirection = new Map<string, string[]>();
  for (const row of links.strategicDirectionBusinessModels) {
    const current = businessModelIdsByDirection.get(row.strategic_direction_id) ?? [];
    current.push(row.business_model_id);
    businessModelIdsByDirection.set(row.strategic_direction_id, current);
  }
  const operatingModelIdsByDirection = new Map<string, string[]>();
  for (const row of links.strategicDirectionOperatingModels) {
    const current = operatingModelIdsByDirection.get(row.strategic_direction_id) ?? [];
    current.push(row.operating_model_id);
    operatingModelIdsByDirection.set(row.strategic_direction_id, current);
  }

  const params = await searchParams;
  const status = getStatus(params.error, params.success);

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategische Stoßrichtungen</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Strategische Stoßrichtungen</h1>
        <p className="mt-1 text-sm text-zinc-600">
          
          Verknüpfe strategische Stoßrichtungen mit Industrien, Geschäftsmodellen und Betriebsmodellen.
        </p>
      </header>

      {status ? (
        <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {status.text}
        </p>
      ) : null}

      <section className="brand-card p-6">
        <div className="space-y-3">
          {links.strategicDirections.length === 0 ? (
            <p className="brand-surface p-3 text-sm text-zinc-600">
              
              Noch keine strategischen Stoßrichtungen vorhanden.
            </p>
          ) : (
            links.strategicDirections.map((direction) => {
              const industryIds = new Set(industryIdsByDirection.get(direction.id) ?? []);
              const businessModelIds = new Set(businessModelIdsByDirection.get(direction.id) ?? []);
              const operatingModelIds = new Set(operatingModelIdsByDirection.get(direction.id) ?? []);

              const linkedIndustries = industries.filter((item) => industryIds.has(item.id));
              const linkedBusinessModels = businessModels.filter((item) => businessModelIds.has(item.id));
              const linkedOperatingModels = operatingModels.filter((item) => operatingModelIds.has(item.id));

              return (
                <div key={direction.id} className="brand-surface p-3 space-y-2">
                  <p className="text-sm font-semibold text-zinc-900">{direction.title}</p>
                  <p className="text-xs text-zinc-600">
                    Industrien: {linkedIndustries.map((x) => x.name).join(", ") || "-"}
                  </p>
                  <p className="text-xs text-zinc-600">
                    
                    Geschäftsmodelle: {linkedBusinessModels.map((x) => `${x.name} (v${x.version_no})`).join(", ") || "-"}
                  </p>
                  <p className="text-xs text-zinc-600">
                    Betriebsmodelle: {linkedOperatingModels.map((x) => `${x.name} (v${x.version_no})`).join(", ") || "-"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <form action={linkStrategicDirectionToIndustry} className="flex gap-2">
                      <input type="hidden" name="strategic_direction_id" value={direction.id} />
                      <select name="industry_id" defaultValue="" className="min-w-[200px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                        <option value="">Industrie verknüpfen</option>
                        {industries.map((industry) => (
                          <option key={industry.id} value={industry.id}>{industry.name}</option>
                        ))}
                      </select>
                      <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Verknüpfen</button>
                    </form>
                    <form action={linkStrategicDirectionToBusinessModel} className="flex gap-2">
                      <input type="hidden" name="strategic_direction_id" value={direction.id} />
                      <select name="business_model_id" defaultValue="" className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                        <option value="">Geschäftsmodell verknüpfen</option>
                        {businessModels.map((model) => (
                          <option key={model.id} value={model.id}>{model.name} (v{model.version_no})</option>
                        ))}
                      </select>
                      <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Verknüpfen</button>
                    </form>
                    <form action={linkStrategicDirectionToOperatingModel} className="flex gap-2">
                      <input type="hidden" name="strategic_direction_id" value={direction.id} />
                      <select name="operating_model_id" defaultValue="" className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                        <option value="">Betriebsmodell verknüpfen</option>
                        {operatingModels.map((model) => (
                          <option key={model.id} value={model.id}>{model.name} (v{model.version_no})</option>
                        ))}
                      </select>
                      <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Verknüpfen</button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
