/**
 * Semantic Evidence Guard — Smoke in zwei Modi:
 *
 * A) Fixture (Standard): `verifyAnswer` + feste Diagnostik, ohne DB/LLM/Orchestrator.
 *    `npm run ai:semantic-evidence-guard:smoke`
 *
 * B) Active-Snapshot: echte `runChat`-Runde, Sentinel-Map aus Postgres.
 *    `npm run ai:semantic-evidence-guard:smoke:active`
 *    Voraussetzung: `.env.local` mit Admin-Client + DB-URL; optional aktiver Snapshot.
 *
 * Bei fehlendem aktiven Snapshot meldet Modus B `infra_missing_active_snapshot` (Exit 0), kein Guard-Logik-Fehler.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { RankingContract } from "../lib/ai/answers/answer-contracts";
import type { SemanticMapRunDiagnostics } from "../lib/ai/semantic-map/types";

const ACTIVE_SNAPSHOT_ARG = "--active-snapshot";

function loadEnvFiles() {
  const roots = [process.cwd(), resolve(process.cwd(), "..")];
  const names = [".env.local", ".env"];
  for (const root of roots) {
    for (const name of names) {
      const p = resolve(root, name);
      if (!existsSync(p)) continue;
      for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const idx = line.indexOf("=");
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        if (!process.env[key]) {
          process.env[key] = line.slice(idx + 1).trim();
        }
      }
    }
  }
}

async function getPermissionCodesForMembership(
  admin: import("@supabase/supabase-js").SupabaseClient,
  membershipId: string
): Promise<Set<string>> {
  const codes = new Set<string>();
  const { data: memberRoles } = await admin
    .schema("rbac")
    .from("member_roles")
    .select("role_id")
    .eq("membership_id", membershipId);
  const roleIds = [...new Set((memberRoles ?? []).map((row: { role_id: string }) => row.role_id))];
  if (roleIds.length === 0) return codes;
  const { data: rolePermissions } = await admin
    .schema("rbac")
    .from("role_permissions")
    .select("permission_id")
    .in("role_id", roleIds);
  const permissionIds = [...new Set((rolePermissions ?? []).map((r: { permission_id: string }) => r.permission_id))];
  if (permissionIds.length === 0) return codes;
  const { data: permissions } = await admin
    .schema("rbac")
    .from("permissions")
    .select("code")
    .in("id", permissionIds);
  for (const row of permissions ?? []) {
    if (row.code) codes.add(row.code as string);
  }
  return codes;
}

async function runFixtureMode(): Promise<void> {
  process.env.AI_SEMANTIC_EVIDENCE_GUARD_ENABLED = "true";

  const { verifyAnswer } = await import("../lib/ai/answers/answer-verifier");
  const typeMod = await import("../lib/ai/semantic-map/types");
  const SEMANTIC_MAP_BLOCKED_CLAIMS = typeMod.SEMANTIC_MAP_BLOCKED_CLAIMS;

  const rankingContract: RankingContract = {
    queryClass: "ranking",
    domain: "okr",
    metric: "objective_count",
    groupBy: "owner",
    scope: { cycleId: "c1", cycleLabel: "Aktueller Zyklus" },
    totalItems: 5,
    top: [
      { rank: 1, label: "Carmelo", count: 4, evidenceIds: ["o1", "o2", "o3", "o4"] },
      { rank: 2, label: "Karl", count: 1, evidenceIds: ["o5"] },
    ],
    evidenceSummary: "owner ranking",
    confidence: "high",
    retrievalStatus: "ok",
    missingCapabilities: [],
    missingTools: [],
    requestedOps: ["rank", "count_total"],
    coveredOps: ["rank", "count_total"],
    missingOps: [],
  };

  const diag: SemanticMapRunDiagnostics = {
    enabled: true,
    resolutionStatus: "ok",
    requiredEvidence: [],
    usedSources: [{ sourceType: "tool", sourceRef: "get_current_okr_cycle", placeKey: "okr.cycle" }],
    evidenceCoverage: {
      status: "failed",
      answerAllowed: false,
      missingEvidence: ["strategy_challenge", "initiative"],
      blockedClaims: [
        SEMANTIC_MAP_BLOCKED_CLAIMS.challengeClaimWithoutEvidence,
        SEMANTIC_MAP_BLOCKED_CLAIMS.initiativeClaimWithoutEvidence,
      ],
    },
    executionReadiness: "missing_evidence",
    diagnosticsOnly: true,
  };

  const llmText =
    "Die grösste strategische Herausforderung ist Kundenzufriedenheit und Wertschöpfung; mehrere Initiativen laufen bereits.";

  const result = verifyAnswer({
    contract: rankingContract,
    llmText,
    semanticMapRunDiagnostics: diag,
  });

  const hallucinationPattern = /kundenzufriedenheit|wertschöpfung|wertschoepfung/i;
  const checks = {
    verifierStatusBlocked: result.status === "blocked",
    reasonSemanticEvidence: result.status === "blocked" && result.reason === "semantic_evidence_incomplete",
    guardHasMissingChallenge: diag.evidenceCoverage.missingEvidence.includes("strategy_challenge"),
    guardHasMissingInitiative: diag.evidenceCoverage.missingEvidence.includes("initiative"),
    blockedClaimsChallenge:
      diag.evidenceCoverage.blockedClaims.includes(SEMANTIC_MAP_BLOCKED_CLAIMS.challengeClaimWithoutEvidence),
    blockedClaimsInitiative:
      diag.evidenceCoverage.blockedClaims.includes(SEMANTIC_MAP_BLOCKED_CLAIMS.initiativeClaimWithoutEvidence),
    replacementUsed:
      result.status === "blocked" &&
      /strategischen Herausforderungen|belastbare Daten|nicht seriös/i.test(result.replacementText) &&
      !hallucinationPattern.test(result.replacementText),
  };

  const out = {
    ok: true,
    mode: "fixture",
    env: { AI_SEMANTIC_EVIDENCE_GUARD_ENABLED: process.env.AI_SEMANTIC_EVIDENCE_GUARD_ENABLED },
    verifyAnswer: result,
    assertions: checks,
    assertionsOk: Object.values(checks).every(Boolean),
  };

  console.log(JSON.stringify(out, null, 2));

  if (!out.assertionsOk) {
    console.error("\nFixture-Smoke: verifyAnswer / Evidence-Guard-Erwartung nicht erfüllt.");
    process.exit(1);
  }
}

async function runActiveSnapshotMode(): Promise<void> {
  loadEnvFiles();
  process.env.AI_SEMANTIC_EVIDENCE_GUARD_ENABLED = "true";

  const { formatDatabaseTargetLogLine, getResolvedDatabaseUrlMeta } = await import(
    "../lib/ai/semantic-map/inventory/resolve-database-url"
  );
  const dbMeta = getResolvedDatabaseUrlMeta();
  console.error(formatDatabaseTargetLogLine("[semantic-evidence-guard:active]", dbMeta));

  const { createSupabaseAdminClient } = await import("../lib/supabase/admin");
  const { runChat } = await import("../lib/ai/orchestrator");
  const { getActiveSemanticMap } = await import("../lib/ai/semantic-map");

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error(JSON.stringify({ ok: false, mode: "active-snapshot", error: "admin-client-unavailable" }));
    process.exit(1);
  }

  const { data: memberships } = await admin
    .schema("app")
    .from("organization_memberships")
    .select("id, organization_id, user_id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(25);

  if (!memberships?.length) {
    console.error(JSON.stringify({ ok: false, mode: "active-snapshot", error: "no_active_membership" }));
    process.exit(1);
  }

  let best: {
    userId: string;
    organizationId: string;
    membershipId: string;
    permissionCodes: Set<string>;
  } | null = null;
  let bestScore = -1;
  for (const m of memberships) {
    const permissionCodes = await getPermissionCodesForMembership(admin, m.id as string);
    permissionCodes.add("ai.assistant.use");
    permissionCodes.add("nav.okr-workspace.read");
    permissionCodes.add("okr.read");
    const score =
      Number(permissionCodes.has("ai.assistant.use")) * 10 +
      Number(permissionCodes.has("nav.okr-workspace.read")) +
      Number(permissionCodes.has("okr.read"));
    if (score > bestScore) {
      bestScore = score;
      best = {
        userId: m.user_id as string,
        organizationId: m.organization_id as string,
        membershipId: m.id as string,
        permissionCodes,
      };
    }
  }
  if (!best) {
    console.error(JSON.stringify({ ok: false, mode: "active-snapshot", error: "no_context" }));
    process.exit(1);
  }

  const question =
    "Welches ist die grösste strategische Herausforderung im aktuellen Zyklus und welche Initiativen laufen, um diese zu lösen oder zu meistern?";

  const { data: conversation, error: conversationError } = await admin
    .schema("app")
    .from("ai_conversations")
    .insert({
      organization_id: best.organizationId,
      created_by_user_id: best.userId,
      created_by_membership_id: best.membershipId,
    })
    .select("id")
    .maybeSingle();

  const conversationId = (conversation?.id as string | undefined) ?? crypto.randomUUID();
  if (conversationError) {
    console.error(JSON.stringify({ ok: false, mode: "active-snapshot", error: conversationError.message }));
    process.exit(1);
  }

  const out: Record<string, unknown> = {
    ok: true,
    mode: "active-snapshot",
    question,
    env: { AI_SEMANTIC_EVIDENCE_GUARD_ENABLED: process.env.AI_SEMANTIC_EVIDENCE_GUARD_ENABLED },
    databaseTarget: dbMeta.connection
      ? {
          databaseUrlSource: dbMeta.envSource,
          host: dbMeta.connection.host,
          port: dbMeta.connection.port,
          database: dbMeta.connection.database,
          user: dbMeta.connection.user,
        }
      : {
          databaseUrlSource: dbMeta.envSource,
          host: null,
          port: null,
          database: null,
          user: null,
        },
  };

  const iterator = runChat({
    question,
    conversationId,
    recentMessages: [],
    userContext: {
      userId: best.userId,
      organizationId: best.organizationId,
      organizationName: "Smoke",
      membershipId: best.membershipId,
      roleCodes: [],
      permissionCodes: best.permissionCodes,
    },
    uiContext: null,
    supabase: admin,
    domainHints: [],
    skipSynthesis: true,
  });

  for await (const event of iterator) {
    if (event.type === "diagnostics") out.diagnostics = event.data;
    if (event.type === "answer") out.answer = event.text;
    if (event.type === "verifier_blocked") out.verifier_blocked = { reason: event.reason };
    if (event.type === "error") out.error = event.message;
  }

  const diag = out.diagnostics as { verifier?: Record<string, unknown> } | undefined;
  const verifier = diag?.verifier as
    | {
        status?: string;
        reason?: string;
        semanticEvidenceGuard?: {
          missingEvidence?: string[] | null;
          blockedBySemanticGuard?: boolean;
          diagnosticsLoaded?: boolean;
        };
      }
    | undefined;

  const guard = verifier?.semanticEvidenceGuard;
  const answer = String(out.answer ?? "");
  const hallucinationPattern = /kundenzufriedenheit|wertschöpfung|wertschoepfung|kundenzufriedenheit/i;

  const diagnosticsLoaded = guard?.diagnosticsLoaded === true;

  const checks = {
    verifierStatusBlocked: verifier?.status === "blocked",
    reasonSemanticEvidence: verifier?.reason === "semantic_evidence_incomplete",
    guardHasMissingChallenge: guard?.missingEvidence?.includes("strategy_challenge") === true,
    guardHasMissingInitiative: guard?.missingEvidence?.includes("initiative") === true,
    answerNoHallucinationKeywords: !hallucinationPattern.test(answer),
    answerLooksLikeGuard: /strategischen Herausforderungen|belastbare Daten|nicht seriös/i.test(answer),
  };

  out.assertions = checks;
  const assertionsOk = diagnosticsLoaded && Object.values(checks).every(Boolean);
  out.assertionsOk = assertionsOk;

  if (!assertionsOk && !diagnosticsLoaded) {
    let activeMap: Awaited<ReturnType<typeof getActiveSemanticMap>> = null;
    let activeMapError: string | null = null;
    try {
      activeMap = await getActiveSemanticMap({ organizationId: best.organizationId });
    } catch (e) {
      activeMapError = e instanceof Error ? e.message : String(e);
    }
    if (activeMapError) {
      out.outcome = "infra_sentinel_map_db_error";
      out.errorDetail = activeMapError;
      console.log(JSON.stringify(out, null, 2));
      console.error(
        "\nActive-Snapshot-Smoke: Postgres/sentinel_map-Fehler (SSL, fehlendes Schema, o. Ä.). Siehe outcome.errorDetail — nicht mit fehlendem Snapshot verwechseln."
      );
      process.exit(1);
    }
    if (!activeMap) {
      out.outcome = "infra_missing_active_snapshot";
      out.hint =
        "Kein aktiver Snapshot in sentinel_map. Optional: npm run ai:semantic-map:build → validate → publish → inspect.";
      console.log(JSON.stringify(out, null, 2));
      console.error(
        "\nActive-Snapshot-Smoke: keine aktive Semantic Map (infra_missing_active_snapshot). Exit 0 — kein Guard-Logik-Fehler."
      );
      process.exit(0);
    }
    out.outcome = "diagnostics_load_failed";
    out.hint =
      "Aktive Map vorhanden, aber semanticMapRunDiagnostics nicht geladen (z. B. Question-Resolution-LLM). Siehe stderr [sentinel].";
    console.log(JSON.stringify(out, null, 2));
    console.error(
      "\nActive-Snapshot-Smoke: Diagnostik nicht geladen trotz aktiver Map (diagnostics_load_failed)."
    );
    process.exit(1);
  }

  if (!out.outcome) {
    out.outcome = assertionsOk ? "ok" : "assertions_failed";
  }

  console.log(JSON.stringify(out, null, 2));

  if (out.outcome === "assertions_failed") {
    console.error("\nActive-Snapshot-Smoke: Erwartung nicht erfüllt (Toolplan / Evidence). Siehe diagnostics.verifier.");
    process.exit(1);
  }
}

async function main() {
  const active = process.argv.includes(ACTIVE_SNAPSHOT_ARG);
  if (active) {
    await runActiveSnapshotMode();
  } else {
    await runFixtureMode();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
