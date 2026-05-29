import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getOkrWorkspaceEffectiveCanWrite, getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOkrPlanningWorkspaceData } from "@/lib/okr/planning-data";
import {
  filterPlanningObjectivesForRead,
  loadPlanningReadBulkContext,
} from "@/lib/okr/okr-tracking-filter";
import { OkrAreaNavWithCounts } from "@/components/ceo/okr/OkrAreaNavWithCounts";
import { OkrCycleCarousel } from "@/components/ceo/okr/OkrCycleCarousel";
import { OkrPlanningDirtyProvider } from "@/components/ceo/okr/okr-planning-dirty";
import { OkrPlanningWorkspace } from "@/components/ceo/okr/OkrPlanningWorkspace";
import { buildOkrPlanningEditFlags } from "@/app/(ceo)/okr/planning/build-okr-planning-edit-flags";
import { filterResponsiblesForOkrObjectiveOwnerSelect } from "@/lib/okr/okr-planning-owner-choices";
import { buildOkrApprovalSubmitEligibilityByObjectiveId } from "@/lib/okr/okr-approval-submit-eligibility";

/** Frische Workspace-Daten nach Server-Mutationen (`router.refresh()`). */
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ okrCycle?: string }>;
};

export default async function OkrPlanningPage({ searchParams }: PageProps) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const canWriteOkrArea = await getOkrWorkspaceEffectiveCanWrite(pageAccess);

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) {
    return (
      <section className="space-y-4">
        <div className="brand-card space-y-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Zyklus</p>
          <h1 className="text-xl font-semibold text-zinc-900">OKR-Planung</h1>
          <p className="text-sm text-zinc-600">Kein aktiver Planungszyklus vorhanden.</p>
        </div>
        <OkrAreaNavWithCounts okrCycle={null} />
      </section>
    );
  }

  const params = await searchParams;
  const preferredOkrCycle = params.okrCycle?.trim() || null;

  const workspaceRaw = await getOkrPlanningWorkspaceData(
    context.organizationId,
    cycle.id,
    preferredOkrCycle
  );

  const inCycleOkrObjectiveCountBeforeReadFilter = workspaceRaw.okrObjectives.length;
  const planningBulk = await loadPlanningReadBulkContext(
    context.membershipId,
    workspaceRaw.okrObjectives
  );
  const workspace = {
    ...workspaceRaw,
    okrObjectives: filterPlanningObjectivesForRead(workspaceRaw.okrObjectives, planningBulk),
  };

  const editFlags = await buildOkrPlanningEditFlags(context.membershipId, workspace);
  const approvalSubmitByObjectiveId = await buildOkrApprovalSubmitEligibilityByObjectiveId(
    context.organizationId,
    context.membershipId,
    workspace.okrObjectives
  );
  const objectiveOwnerChoices = await filterResponsiblesForOkrObjectiveOwnerSelect({
    organizationId: context.organizationId,
    currentMembershipId: context.membershipId,
    responsibles: workspace.responsibles,
  });

  return (
    <section className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Zyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">OKR-Planung</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Erstelle OKRs und verknüpfe sie mit strategischen Zielen der Organisation.
        </p>
      </article>

      <OkrPlanningDirtyProvider>
        <OkrAreaNavWithCounts okrCycle={preferredOkrCycle} />

        {workspace.okrCycles.length > 0 ? (
          <OkrCycleCarousel cycles={workspace.okrCycles} selectedId={workspace.selectedOkrCycleId} />
        ) : null}

        {!canWriteOkrArea ? (
          <p className="brand-surface p-3 text-sm text-zinc-600">
            Leserechte: Bearbeitung ist deaktiviert.
          </p>
        ) : null}

        <OkrPlanningWorkspace
          data={workspace}
          organizationId={context.organizationId}
          cycleInstanceId={cycle.id}
          canWrite={canWriteOkrArea}
          currentMembershipId={context.membershipId}
          approvalSubmitByObjectiveId={approvalSubmitByObjectiveId}
          objectiveOwnerChoices={objectiveOwnerChoices}
          objectiveEditById={editFlags.objectiveEditById}
          keyResultEditById={editFlags.keyResultEditById}
          canCreateKeyResultByObjectiveId={editFlags.canCreateKeyResultByObjectiveId}
          inCycleOkrObjectiveCountBeforeReadFilter={inCycleOkrObjectiveCountBeforeReadFilter}
        />
      </OkrPlanningDirtyProvider>
    </section>
  );
}
