import { redirect } from "next/navigation";
import { AnnualTargetsAreaNav } from "@/components/ceo/annual-targets/AnnualTargetsAreaNav";
import { AnnualTargetsPlanningWorkspace } from "@/components/ceo/annual-targets/AnnualTargetsPlanningWorkspace";
import { AnnualTargetsTeamFilters } from "@/components/ceo/annual-targets/AnnualTargetsTeamFilters";
import { getPhase0Context, getPlanningCycleAtLevel } from "@/lib/phase0/queries";
import { getAnnualTargetsAccessContext } from "@/lib/rbac/page-access";
import { getAnnualTargetsWorkspaceData } from "@/lib/annual-targets/planning-data";
import type { AnnualTargetsFilters, AnnualTargetsTab } from "@/lib/annual-targets/types";
import type { AnnualTargetLifecycleStatus, AnnualTargetType } from "@/lib/annual-targets/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    targetId?: string;
    target_year?: string;
    owner?: string;
    direction?: string;
    objective?: string;
    status?: string;
    type?: string;
    okr_alignment?: string;
    error?: string;
    success?: string;
  }>;
};

function parseTab(raw: string | undefined): AnnualTargetsTab {
  return raw === "team" ? "team" : "mine";
}

export default async function AnnualTargetsPage({ searchParams }: PageProps) {
  const pageAccess = await getAnnualTargetsAccessContext();
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getPlanningCycleAtLevel(context.organizationId, 2);
  if (!cycle) {
    return (
      <section className="space-y-4">
        <article className="brand-card p-6">
          <h1 className="text-xl font-semibold text-zinc-900">Jahresziele</h1>
          <p className="mt-2 text-sm text-zinc-600">Kein aktiver Planungszyklus vorhanden.</p>
        </article>
      </section>
    );
  }

  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const filters: AnnualTargetsFilters = {
    targetYear: sp.target_year ? Number(sp.target_year) : null,
    ownerMembershipId: sp.owner?.trim() || null,
    strategicDirectionId: sp.direction?.trim() || null,
    strategicObjectiveId: sp.objective?.trim() || null,
    status: (sp.status?.trim() as AnnualTargetLifecycleStatus) || null,
    annualTargetType: (sp.type?.trim() as AnnualTargetType) || null,
    okrAlignment:
      sp.okr_alignment === "aligned" || sp.okr_alignment === "not_aligned"
        ? sp.okr_alignment
        : "all",
  };

  const { rows, context: workspaceContext } = await getAnnualTargetsWorkspaceData({
    organizationId: context.organizationId,
    cycleInstanceId: cycle.id,
    currentMembershipId: context.membershipId,
    tab,
    filters,
    editTargetId: sp.targetId?.trim() || null,
  });

  const defaultTargetYear = new Date(cycle.start_date).getUTCFullYear();
  const statusMessage = sp.error
    ? { type: "error" as const, text: mapError(sp.error) }
    : sp.success
      ? { type: "success" as const, text: mapSuccess(sp.success) }
      : null;

  return (
    <section className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Jahresplanung</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Jahresziele</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Run-Jahresziele an Stoßrichtungen, Change-Jahresziele an Programmen — strukturiert nach
          SMART und mit Sentinel-Review beim Speichern.
        </p>
        {statusMessage ? (
          <p
            className={`mt-3 text-sm ${statusMessage.type === "error" ? "text-red-700" : "text-emerald-700"}`}
          >
            {statusMessage.text}
          </p>
        ) : null}
      </article>

      <AnnualTargetsAreaNav />

      {tab === "team" ? (
        <AnnualTargetsTeamFilters
          filters={filters}
          directions={workspaceContext.directions}
          ownerOptions={workspaceContext.teamOwnerOptions}
        />
      ) : null}

      <AnnualTargetsPlanningWorkspace
        tab={tab}
        rows={rows}
        context={workspaceContext}
        canWrite={pageAccess.canWrite}
        defaultTargetYear={defaultTargetYear}
        editTargetId={sp.targetId?.trim() || null}
      />
    </section>
  );
}

function mapError(code: string): string {
  const map: Record<string, string> = {
    validation: "Bitte Pflichtfelder prüfen.",
    "activation-validation": "Aktivierung nicht möglich — Pflichtfelder oder Signatur fehlen.",
    "owner-forbidden": "Keine Berechtigung für diesen Ziel-Owner.",
    "alignment-invalid":
      "Auswahl konnte nicht gespeichert werden — bitte Stoßrichtung bzw. Programm erneut wählen.",
    "create-failed": "Jahresziel konnte nicht angelegt werden.",
    "invalid-transition": "Statusübergang ist nicht erlaubt.",
    "not-found": "Jahresziel nicht gefunden.",
    "signature-not-ready": "Zur Signatur nur im Status Freigegeben.",
  };
  return map[code] ?? "Aktion fehlgeschlagen.";
}

function mapSuccess(code: string): string {
  const map: Record<string, string> = {
    created: "Jahresziel als Entwurf gespeichert.",
    updated: "Jahresziel gespeichert.",
    deleted: "Entwurf gelöscht.",
    lifecycle: "Status aktualisiert.",
    "signature-sent": "Zur Signatur gesendet.",
    "draft-saved": "Entwurf gespeichert.",
    "draft-saved-sentinel":
      "Entwurf gespeichert. Sentinel-Vorschläge und Anker-Fit sind in der Übersicht (Zeile aufklappen).",
    "draft-saved-sentinel-failed":
      "Entwurf gespeichert, aber Sentinel konnte nicht antworten. Bitte später erneut prüfen.",
    "proposal-accepted": "Vorschlag übernommen.",
    "proposal-dismissed": "Sentinel-Vorschläge verworfen.",
  };
  return map[code] ?? "Gespeichert.";
}
