import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { loadOkrAreaNavTabCounts } from "@/lib/okr/okr-area-nav-counts";
import type { OkrAreaNavTabCounts } from "@/lib/okr/okr-area-nav-counts";
import { OkrAreaNav } from "@/components/ceo/okr/OkrAreaNav";

type Props = {
  okrCycle?: string | null;
};

export async function OkrAreaNavWithCounts({ okrCycle = null }: Props) {
  const context = await getPhase0Context();
  if (!context) {
    return <OkrAreaNav />;
  }

  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) {
    return <OkrAreaNav />;
  }

  let tabCounts: OkrAreaNavTabCounts | undefined;
  try {
    tabCounts = await loadOkrAreaNavTabCounts(
      context.organizationId,
      context.membershipId,
      cycle.id,
      okrCycle?.trim() || null
    );
  } catch {
    tabCounts = undefined;
  }

  return <OkrAreaNav tabCounts={tabCounts} />;
}
