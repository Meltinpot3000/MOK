import { redirect } from "next/navigation";
import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";
import {
  createIndustry,
  linkIndustryToOrganizationUnit,
  unlinkIndustryFromOrganizationUnit,
} from "@/app/(ceo)/strategy-dimensions/actions";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { getActivePlanningCycle, getOrganizationUnits, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  getIndustries,
  getOrganizationUnitDimensionLinks,
} from "@/lib/strategy-dimensions/queries";

type IndustriesPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function getMessage(error?: string, success?: string) {
  if (error === "missing-name") return { type: "error", text: "Name ist erforderlich." };
  if (error === "link-failed") return { type: "error", text: "Industrie konnte Organisationseinheit nicht zugeordnet werden." };
  if (error === "save-failed") return { type: "error", text: "Industrie konnte nicht gespeichert werden." };
  if (success === "saved") return { type: "success", text: "Industrie wurde gespeichert." };
  if (success === "linked") return { type: "success", text: "Industrie wurde Organisationseinheit zugeordnet." };
  if (success === "unlinked") return { type: "success", text: "Zuordnung zur Organisationseinheit wurde entfernt." };
  if (error === "missing-link") return { type: "error", text: "Bitte gueltige Verknuepfung waehlen." };
  return null;
}

export default async function IndustriesPage({ searchParams }: IndustriesPageProps) {
  const pageAccess = await getSidebarAccessContext("organization");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) redirect("/planning-cycles");
  const [industries, orgUnits, orgUnitLinks] = await Promise.all([
    getIndustries(context.organizationId, cycle.id),
    getOrganizationUnits(context.organizationId),
    getOrganizationUnitDimensionLinks(context.organizationId, cycle.id),
  ]);
  const linkedUnitsByIndustry = new Map<string, string[]>();
  for (const link of orgUnitLinks.organizationUnitIndustries) {
    const list = linkedUnitsByIndustry.get(link.industry_id) ?? [];
    list.push(link.organization_unit_id);
    linkedUnitsByIndustry.set(link.industry_id, list);
  }
  const status = getMessage((await searchParams).error, (await searchParams).success);

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Organisationsstruktur</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Industrien</h1>
        <p className="mt-1 text-sm text-zinc-600">Wahle relevante Industrien aus und verknupfe sie direkt mit den zustandigen Organisationseinheiten.</p>
      </header>

      <OrganizationTabs />

      {status ? (
        <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {status.text}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Neue Industrie</h2>
          <form action={createIndustry} className="mt-4 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Name</span>
              <input name="name" required placeholder="Name" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Beschreibung</span>
              <textarea name="description" rows={3} placeholder="Beschreibung" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Marktmerkmale</span>
              <textarea name="market_characteristics" rows={3} placeholder="Market Characteristics" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Wachstumsrate</span>
              <input type="number" step="0.001" name="growth_rate" placeholder="Growth Rate (z. B. 0.045)" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Portfolio-Anteil</span>
              <input type="number" step="0.001" name="portfolio_share" placeholder="Portfolio-Anteil (z. B. 0.250)" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Strategische Relevanz</span>
              <select name="strategic_importance" defaultValue="medium" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Status</span>
              <select name="status" defaultValue="active" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">Industrie speichern</button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Bestehende Industrien ({industries.length})</h2>
          <div className="mt-3 space-y-2">
            {industries.length === 0 ? (
              <p className="brand-surface p-3 text-sm text-zinc-600">Noch keine Einträge vorhanden.</p>
            ) : (
              industries.map((industry) => (
                <div key={industry.id} className="brand-surface p-3">
                  <p className="text-sm font-semibold text-zinc-900">{industry.name}</p>
                  <p className="mt-1 text-xs text-zinc-600">Status: {industry.status} | Relevanz: {industry.strategic_importance}</p>
                  <p className="mt-1 text-xs text-zinc-600">Portfolio-Anteil: {industry.portfolio_share ?? "-"}</p>
                  {industry.description ? <p className="mt-1 text-xs text-zinc-600">{industry.description}</p> : null}
                  <p className="mt-2 text-xs text-zinc-600">
                    Zugeordnete Organisationen:{" "}
                    {orgUnits
                      .filter((unit) =>
                        (linkedUnitsByIndustry.get(industry.id) ?? []).includes(unit.id)
                      )
                      .map((unit) => `${unit.code} (${unit.name})`)
                      .join(", ") || "-"}
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Organisationseinheiten verknuepfen/entfernen
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {orgUnits.map((unit) => {
                        const isLinked = (linkedUnitsByIndustry.get(industry.id) ?? []).includes(unit.id);
                        return (
                          <ConfirmBeforeSubmitForm
                            key={`${industry.id}-${unit.id}`}
                            action={isLinked ? unlinkIndustryFromOrganizationUnit : linkIndustryToOrganizationUnit}
                            className="inline-flex"
                            requireConfirm={isLinked}
                            title="Organisationseinheit entfernen?"
                            description={`Die Verknüpfung zu „${unit.code}“ wird aufgehoben.`}
                            confirmLabel="Entfernen"
                          >
                            <input type="hidden" name="industry_id" value={industry.id} />
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
              ))
            )}
          </div>
        </article>
      </section>

      <OrganizationGraphPanel organizationId={context.organizationId} cycleInstanceId={cycle.id} />
    </div>
  );
}
