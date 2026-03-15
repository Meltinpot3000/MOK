import { redirect } from "next/navigation";
import {
  linkAnnualTargetToBusinessModel,
  linkAnnualTargetToIndustry,
  linkAnnualTargetToOperatingModel,
} from "@/app/(ceo)/strategy-dimensions/actions";
import { getPhase0Context, getPlanningCycles } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  getBusinessModels,
  getDimensionLinks,
  getIndustries,
  getOperatingModels,
} from "@/lib/strategy-dimensions/queries";

type AnnualTargetsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function getStatus(error?: string, success?: string) {
  if (error === "missing-link") return { type: "error", text: "Bitte gueltige Verknuepfung auswaehlen." };
  if (success === "linked") return { type: "success", text: "Dimension wurde erfolgreich verknuepft." };
  return null;
}

export default async function AnnualTargetsPage({ searchParams }: AnnualTargetsPageProps) {
  const pageAccess = await getSidebarAccessContext("annual-targets");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycles = await getPlanningCycles(context.organizationId);
  const cycle = cycles[0];
  if (!cycle) redirect("/planning-cycles");

  const [industries, businessModels, operatingModels, links] = await Promise.all([
    getIndustries(context.organizationId, cycle.id),
    getBusinessModels(context.organizationId, cycle.id),
    getOperatingModels(context.organizationId, cycle.id),
    getDimensionLinks(context.organizationId, cycle.id),
  ]);

  const industryIdsByTarget = new Map<string, string[]>();
  for (const row of links.annualTargetIndustries) {
    const current = industryIdsByTarget.get(row.annual_target_id) ?? [];
    current.push(row.industry_id);
    industryIdsByTarget.set(row.annual_target_id, current);
  }
  const businessModelIdsByTarget = new Map<string, string[]>();
  for (const row of links.annualTargetBusinessModels) {
    const current = businessModelIdsByTarget.get(row.annual_target_id) ?? [];
    current.push(row.business_model_id);
    businessModelIdsByTarget.set(row.annual_target_id, current);
  }
  const operatingModelIdsByTarget = new Map<string, string[]>();
  for (const row of links.annualTargetOperatingModels) {
    const current = operatingModelIdsByTarget.get(row.annual_target_id) ?? [];
    current.push(row.operating_model_id);
    operatingModelIdsByTarget.set(row.annual_target_id, current);
  }

  const params = await searchParams;
  const status = getStatus(params.error, params.success);

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dimension Tagging</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Annual Targets</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Verbinde Jahresziele direkt mit den drei CITADEL Kern-Dimensionen.
        </p>
      </header>

      {status ? (
        <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {status.text}
        </p>
      ) : null}

      <section className="brand-card p-6">
        <div className="space-y-3">
          {links.annualTargets.length === 0 ? (
            <p className="brand-surface p-3 text-sm text-zinc-600">
              Noch keine Annual Targets vorhanden.
            </p>
          ) : (
            links.annualTargets.map((target) => {
              const industryIds = new Set(industryIdsByTarget.get(target.id) ?? []);
              const businessModelIds = new Set(businessModelIdsByTarget.get(target.id) ?? []);
              const operatingModelIds = new Set(operatingModelIdsByTarget.get(target.id) ?? []);
              const linkedIndustries = industries.filter((item) => industryIds.has(item.id));
              const linkedBusinessModels = businessModels.filter((item) => businessModelIds.has(item.id));
              const linkedOperatingModels = operatingModels.filter((item) => operatingModelIds.has(item.id));

              return (
                <div key={target.id} className="brand-surface p-3 space-y-2">
                  <p className="text-sm font-semibold text-zinc-900">{target.title}</p>
                  <p className="text-xs text-zinc-600">
                    Industries: {linkedIndustries.map((x) => x.name).join(", ") || "-"}
                  </p>
                  <p className="text-xs text-zinc-600">
                    Business Models: {linkedBusinessModels.map((x) => `${x.name} (v${x.version_no})`).join(", ") || "-"}
                  </p>
                  <p className="text-xs text-zinc-600">
                    Operating Models: {linkedOperatingModels.map((x) => `${x.name} (v${x.version_no})`).join(", ") || "-"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <form action={linkAnnualTargetToIndustry} className="flex gap-2">
                      <input type="hidden" name="annual_target_id" value={target.id} />
                      <select name="industry_id" defaultValue="" className="min-w-[200px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                        <option value="">Industry verbinden</option>
                        {industries.map((industry) => (
                          <option key={industry.id} value={industry.id}>{industry.name}</option>
                        ))}
                      </select>
                      <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Link</button>
                    </form>
                    <form action={linkAnnualTargetToBusinessModel} className="flex gap-2">
                      <input type="hidden" name="annual_target_id" value={target.id} />
                      <select name="business_model_id" defaultValue="" className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                        <option value="">Business Model verbinden</option>
                        {businessModels.map((model) => (
                          <option key={model.id} value={model.id}>{model.name} (v{model.version_no})</option>
                        ))}
                      </select>
                      <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Link</button>
                    </form>
                    <form action={linkAnnualTargetToOperatingModel} className="flex gap-2">
                      <input type="hidden" name="annual_target_id" value={target.id} />
                      <select name="operating_model_id" defaultValue="" className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                        <option value="">Operating Model verbinden</option>
                        {operatingModels.map((model) => (
                          <option key={model.id} value={model.id}>{model.name} (v{model.version_no})</option>
                        ))}
                      </select>
                      <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Link</button>
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
