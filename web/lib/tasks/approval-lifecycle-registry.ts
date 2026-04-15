import type { ApprovalSourceObjectType } from "@/lib/tasks/approval-source-types";

export type ApprovalLifecycleEntry = {
  sourceObjectType: ApprovalSourceObjectType;
  /** DB-Tabellenname im app-Schema */
  table: string;
  supportsSubmitForApproval: boolean;
  postApprovalStatus: "active" | "approved" | "planned";
  treatPendingAsDraftInUi: boolean;
  /**
   * Phase-1 gemäß Plan: fünf Edit-Pfade priorisieren; andere Typen können später nachgerüstet werden.
   */
  phase1Ui: boolean;
  buildDeepLink: (objectId: string, ctx: { okrCycleId?: string | null }) => string;
};

const defaultActive = (path: string) => () => path;

export const APPROVAL_LIFECYCLE_REGISTRY: Record<ApprovalSourceObjectType, ApprovalLifecycleEntry> = {
  okr_objective: {
    sourceObjectType: "okr_objective",
    table: "okr_objectives",
    supportsSubmitForApproval: true,
    postApprovalStatus: "active",
    treatPendingAsDraftInUi: true,
    phase1Ui: true,
    buildDeepLink: (objectId, ctx) => {
      const q = ctx.okrCycleId?.trim();
      const base = "/okr/planning";
      if (q) {
        return `${base}?okrCycle=${encodeURIComponent(q)}#okr-objective-${objectId}`;
      }
      return `${base}#okr-objective-${objectId}`;
    },
  },
  strategy_objective: {
    sourceObjectType: "strategy_objective",
    table: "strategy_objectives",
    supportsSubmitForApproval: true,
    postApprovalStatus: "active",
    treatPendingAsDraftInUi: true,
    phase1Ui: true,
    buildDeepLink: (objectId) => `/strategy-cycle#strategy-objective-${objectId}`,
  },
  initiative: {
    sourceObjectType: "initiative",
    table: "initiatives",
    supportsSubmitForApproval: true,
    postApprovalStatus: "planned",
    treatPendingAsDraftInUi: true,
    phase1Ui: true,
    buildDeepLink: defaultActive("/initiatives"),
  },
  strategic_direction: {
    sourceObjectType: "strategic_direction",
    table: "strategic_directions",
    supportsSubmitForApproval: true,
    postApprovalStatus: "approved",
    treatPendingAsDraftInUi: true,
    phase1Ui: true,
    buildDeepLink: defaultActive("/strategic-directions"),
  },
  strategy_program: {
    sourceObjectType: "strategy_program",
    table: "strategy_programs",
    supportsSubmitForApproval: true,
    postApprovalStatus: "active",
    treatPendingAsDraftInUi: true,
    phase1Ui: true,
    buildDeepLink: defaultActive("/strategy-cycle"),
  },
  strategic_goal: {
    sourceObjectType: "strategic_goal",
    table: "strategic_goals",
    supportsSubmitForApproval: true,
    postApprovalStatus: "active",
    treatPendingAsDraftInUi: true,
    phase1Ui: false,
    buildDeepLink: defaultActive("/annual-targets"),
  },
  functional_strategy: {
    sourceObjectType: "functional_strategy",
    table: "functional_strategies",
    supportsSubmitForApproval: true,
    postApprovalStatus: "active",
    treatPendingAsDraftInUi: true,
    phase1Ui: false,
    buildDeepLink: defaultActive("/strategy-cycle"),
  },
};

export function getApprovalLifecycleEntry(type: string): ApprovalLifecycleEntry | null {
  if (type in APPROVAL_LIFECYCLE_REGISTRY) {
    return APPROVAL_LIFECYCLE_REGISTRY[type as ApprovalSourceObjectType];
  }
  return null;
}
