import { OrganizationHierarchyGraph } from "@/components/ceo/OrganizationHierarchyGraph";
import { getOrganizationUnits } from "@/lib/phase0/queries";
import { getOrganizationGraphOverlays } from "@/lib/organization-graph/queries";

type OrganizationGraphPanelProps = {
  organizationId: string;
  planningCycleId: string | null;
};

export async function OrganizationGraphPanel({
  organizationId,
  planningCycleId,
}: OrganizationGraphPanelProps) {
  const [units, overlays] = await Promise.all([
    getOrganizationUnits(organizationId),
    getOrganizationGraphOverlays(organizationId, planningCycleId),
  ]);

  return (
    <section className="brand-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Organisationsgraph (hierarchisch)</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Farbcodierte Marker zeigen je Einheit verknuepfte Verantwortliche, Industrien und
            Business Models.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="graph-legend graph-legend-resp">RESP</span>
          <span className="graph-legend graph-legend-ind">IND</span>
          <span className="graph-legend graph-legend-bm">BM</span>
        </div>
      </div>
      {!planningCycleId ? (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Kein aktiver Planungszyklus gefunden: Es werden aktuell nur Verantwortliche im Graphen
          angezeigt.
        </p>
      ) : null}
      <div className="mt-4">
        <OrganizationHierarchyGraph units={units} overlays={overlays} />
      </div>
    </section>
  );
}
