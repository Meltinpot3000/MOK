import { z } from "zod";

import { getReviewFeedback, getReviewSnapshots } from "@/lib/review/queries";

import type { AiContextSource } from "@/lib/ai/types";
import type { AiToolDefinition, AiToolExecuteArgs, AiToolResult } from "./types";

const reviewInputSchema = z.object({
  cycleInstanceId: z.string().uuid().optional(),
  objectType: z.string().min(1).max(80).optional(),
  objectId: z.string().uuid().optional(),
  snapshotLimit: z.number().int().min(1).max(20).optional(),
  feedbackLimit: z.number().int().min(1).max(50).optional(),
});

export const getLatestReviewNotesTool: AiToolDefinition<typeof reviewInputSchema> = {
  name: "get_latest_review_notes",
  description:
    "Liefert die letzten Review-Snapshots und Feedback-Eintraege fuer einen Zyklus oder ein konkretes Objekt.",
  domain: "review",
  mode: "read",
  requiredCapabilities: ["nav.reviews.read"],
  inputSchema: reviewInputSchema,
  inputSchemaHint:
    "{ cycleInstanceId?: uuid, objectType?: string, objectId?: uuid, snapshotLimit?: number, feedbackLimit?: number }",
  dataClassification: "internal",
  async execute({
    userContext,
    uiContext,
    input,
  }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const parsed = reviewInputSchema.parse(input);
    const cycleInstanceId = parsed.cycleInstanceId ?? uiContext?.cycleId ?? null;
    if (!cycleInstanceId) {
      return {
        toolName: "get_latest_review_notes",
        success: false,
        data: null,
        outputSummary: "Kein cycleInstanceId angegeben.",
        error: "missing_cycle_instance_id",
      };
    }
    const [snapshots, feedback] = await Promise.all([
      getReviewSnapshots(userContext.organizationId, cycleInstanceId, parsed.snapshotLimit ?? 5),
      getReviewFeedback(
        userContext.organizationId,
        cycleInstanceId,
        parsed.objectType,
        parsed.objectId
      ).then((rows) => rows.slice(0, parsed.feedbackLimit ?? 20)),
    ]);
    const data = {
      cycleInstanceId,
      snapshots: snapshots.map((s) => ({
        id: s.id,
        type: s.snapshot_type,
        snapshotAt: s.snapshot_at,
        comment: s.comment,
      })),
      feedback: feedback.map((f) => ({
        id: f.id,
        feedbackType: f.feedback_type,
        objectType: f.object_type,
        objectId: f.object_id,
        comment: f.comment,
        createdAt: f.created_at,
      })),
    };
    return {
      toolName: "get_latest_review_notes",
      success: true,
      data,
      outputSummary: `${snapshots.length} Snapshots und ${feedback.length} Feedback-Eintraege geladen.`,
      contextSources: [
        ...data.snapshots.map(
          (s): AiContextSource => ({
            sourceType: "review_snapshot",
            sourceId: s.id,
            sourceTitle: `${s.type} @ ${s.snapshotAt}`,
            classification: "internal",
            relevanceScore: 0.7,
            sourceReason: "Aktueller Review-Snapshot",
          })
        ),
        ...data.feedback.map(
          (f): AiContextSource => ({
            sourceType: "review_feedback",
            sourceId: f.id,
            sourceTitle: `${f.feedbackType} fuer ${f.objectType}`,
            classification: "internal",
            relevanceScore: 0.6,
            sourceReason: "Review-Feedback",
          })
        ),
      ],
    };
  },
};
