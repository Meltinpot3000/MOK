import type { NormalizedTaskStatus } from "@/lib/tasks/task-status";
import type { TaskUserRelation } from "@/lib/tasks/task-relations";

export type CanonicalOkrObjectiveFact = {
  id: string;
  title: string;
  cycleId: string | null;
  cycleLabel: string | null;
  ownerMembershipId: string | null;
  ownerDisplayName: string | null;
  status: string | null;
  progress: number | null;
};

export type CanonicalTaskFact = {
  factType: "task";
  id: string;
  title: string;
  taskType: string | null;
  status: string | null;
  normalizedStatus: NormalizedTaskStatus;
  assignedMembershipId: string | null;
  createdByMembershipId: string | null;
  completedByMembershipId: string | null;
  relationToCurrentUser: TaskUserRelation[];
  sourceObjectType: string | null;
  sourceObjectId: string | null;
  isLinkedToOkr: boolean;
  completedAt: string | null;
  dueAt: string | null;
};

export type CanonicalFact = CanonicalOkrObjectiveFact | CanonicalTaskFact;
