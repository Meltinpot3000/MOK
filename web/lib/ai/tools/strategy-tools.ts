import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AiContextSource } from "@/lib/ai/types";
import type { AiToolDefinition, AiToolExecuteArgs, AiToolResult } from "./types";

const initiativeInputSchema = z.object({
  cycleInstanceId: z.string().uuid().optional(),
  status: z
    .enum(["draft", "pending_approval", "planned", "active", "at_risk", "on_hold", "completed", "archived"])
    .optional(),
  ownerMembershipId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const getVisibleInitiativesTool: AiToolDefinition<typeof initiativeInputSchema> = {
  name: "get_visible_initiatives",
  description:
    "Listet sichtbare Initiativen mit Status, Fortschritt, Owner und Programm-Bezug. Wrapper um app.initiatives.",
  domain: "initiative",
  mode: "read",
  requiredCapabilities: ["nav.initiatives.read"],
  inputSchema: initiativeInputSchema,
  inputSchemaHint:
    "{ cycleInstanceId?: uuid, status?: enum, ownerMembershipId?: uuid, programId?: uuid, limit?: number }",
  dataClassification: "internal",
  maxResults: 30,
  async execute({
    userContext,
    uiContext,
    input,
  }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const parsed = initiativeInputSchema.parse(input);
    const cycleInstanceId = parsed.cycleInstanceId ?? uiContext?.cycleId ?? null;
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .schema("app")
      .from("initiatives")
      .select(
        "id, title, status, owner_membership_id, program_id, start_date, end_date, weight, progress_percent, last_review_update_at, created_at, cycle_instance_id"
      )
      .eq("organization_id", userContext.organizationId);
    if (cycleInstanceId) {
      query = query.eq("cycle_instance_id", cycleInstanceId);
    }
    if (parsed.status) query = query.eq("status", parsed.status);
    if (parsed.ownerMembershipId)
      query = query.eq("owner_membership_id", parsed.ownerMembershipId);
    if (parsed.programId) query = query.eq("program_id", parsed.programId);

    const limit = parsed.limit ?? 30;
    const { data, error } = await query
      .order("last_review_update_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) {
      return {
        toolName: "get_visible_initiatives",
        success: false,
        data: null,
        outputSummary: `Initiativen-Query fehlgeschlagen: ${error.message}`,
        error: error.message,
      };
    }
    const rows = (data ?? []) as Array<{
      id: string;
      title: string;
      status: string;
      owner_membership_id: string | null;
      program_id: string | null;
      start_date: string | null;
      end_date: string | null;
      weight: number | null;
      progress_percent: number | null;
      last_review_update_at: string | null;
      created_at: string;
      cycle_instance_id: string | null;
    }>;
    const initiatives = rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      ownerMembershipId: r.owner_membership_id,
      programId: r.program_id,
      startDate: r.start_date,
      endDate: r.end_date,
      weight: r.weight,
      progressPercent: r.progress_percent,
      lastReviewUpdateAt: r.last_review_update_at,
      cycleInstanceId: r.cycle_instance_id,
    }));
    return {
      toolName: "get_visible_initiatives",
      success: true,
      data: { totalCount: initiatives.length, initiatives },
      outputSummary: `${initiatives.length} Initiativen sichtbar (gefiltert nach Status/Owner/Programm soweit angegeben).`,
      contextSources: initiatives.map(
        (i): AiContextSource => ({
          sourceType: "initiative",
          sourceId: i.id,
          sourceTitle: i.title,
          classification: "internal",
          relevanceScore: i.status === "at_risk" ? 0.9 : i.status === "active" ? 0.6 : 0.4,
          sourceReason: `Status=${i.status}, Progress=${i.progressPercent ?? "n/a"}`,
        })
      ),
    };
  },
};
