import type { SupabaseClient } from "@supabase/supabase-js";
import type { DirectorySyncMode, DirectorySyncRunResult } from "@/lib/directory-sync/types";
import { computeSyncDiff } from "@/lib/directory-sync/build-diff";
import { applyDirectorySync } from "@/lib/directory-sync/apply-directory-sync";
import { loadDirectoryConnection } from "@/lib/directory-sync/load-context";

export async function runDirectorySync(params: {
  admin: SupabaseClient;
  organizationId: string;
  mode: DirectorySyncMode;
  previewRunId?: string | null;
  createdByMembershipId?: string | null;
}): Promise<DirectorySyncRunResult> {
  const connection = await loadDirectoryConnection(params.admin, params.organizationId);

  if (!connection) {
    throw new Error("Keine Entra-Verbindung konfiguriert.");
  }

  if (!connection.sync_enabled && params.mode === "apply") {
    throw new Error("Entra-Sync ist für diesen Mandanten nicht aktiviert.");
  }

  if (params.mode === "apply") {
    if (!params.previewRunId) {
      throw new Error("Apply erfordert eine Preview-Run-ID.");
    }
    const { data: previewRun } = await params.admin
      .schema("app")
      .from("directory_sync_runs")
      .select("id, mode, status, organization_id")
      .eq("id", params.previewRunId)
      .eq("organization_id", params.organizationId)
      .maybeSingle();

    if (!previewRun || previewRun.mode !== "preview" || previewRun.status !== "completed") {
      throw new Error("Ungültige oder unvollständige Preview.");
    }
  }

  const { data: runRow, error: runInsertErr } = await params.admin
    .schema("app")
    .from("directory_sync_runs")
    .insert({
      organization_id: params.organizationId,
      mode: params.mode,
      preview_run_id: params.mode === "apply" ? params.previewRunId : null,
      status: "running",
      created_by_membership_id: params.createdByMembershipId ?? null,
    })
    .select("id")
    .single();

  if (runInsertErr || !runRow?.id) {
    throw new Error(runInsertErr?.message ?? "Sync-Run konnte nicht gestartet werden.");
  }

  const runId = runRow.id as string;

  try {
    if (params.mode === "preview") {
      const diffSummary = await computeSyncDiff(params.admin, params.organizationId, connection);

      await params.admin
        .schema("app")
        .from("directory_sync_runs")
        .update({
          status: "completed",
          diff_summary: diffSummary,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);

      await params.admin
        .schema("app")
        .from("directory_connections")
        .update({
          last_preview_run_id: runId,
          last_error: null,
        })
        .eq("organization_id", params.organizationId);

      return {
        runId,
        mode: "preview",
        status: "completed",
        diffSummary,
      };
    }

    const stats = await applyDirectorySync(params.admin, params.organizationId, connection);
    const diffSummary = await computeSyncDiff(params.admin, params.organizationId, connection);

    await params.admin
      .schema("app")
      .from("directory_sync_runs")
      .update({
        status: "completed",
        diff_summary: diffSummary,
        stats,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await params.admin
      .schema("app")
      .from("directory_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("organization_id", params.organizationId);

    return {
      runId,
      mode: "apply",
      status: "completed",
      diffSummary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await params.admin
      .schema("app")
      .from("directory_sync_runs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await params.admin
      .schema("app")
      .from("directory_connections")
      .update({ last_error: message })
      .eq("organization_id", params.organizationId);

    return {
      runId,
      mode: params.mode,
      status: "failed",
      diffSummary: { entries: [], counts: { create: 0, update: 0, archive: 0, skip: 0, delete: 0 } },
      errorMessage: message,
    };
  }
}
