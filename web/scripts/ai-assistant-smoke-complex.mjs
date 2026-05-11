/**
 * Komplexer AI-Smoke gegen POST /api/internal/ai-smoke.
 *
 * Kontext-Preset Thomas Maissen — siehe web/scripts/doc/ai-smoke-thomas-maissen.md
 *
 * Strategy-Smoke mit Bewertung:
 *   node scripts/run-strategy-thomas-smoke.mjs
 *   AI_SMOKE_MODE=preflight node scripts/run-strategy-thomas-smoke.mjs preflight
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { findCatalogEntry, strategyDirectionQuestions } from "./lib/strategy-directions-catalog.mjs";
import {
  buildRunSummary,
  deriveRunQuality,
  evaluateStrategyQuestion,
  printSmokeConsoleLine,
  runPlannerPreflight,
} from "./lib/strategy-smoke-verification.mjs";

function loadEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envRaw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    return envRaw.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Preset: Thomas Maissen */
const PRESET_THOMAS_MAISSEN = {
  organizationId: "15fd7d63-dad1-44c4-9ee5-b3bc34f54e43",
  membershipId: "1fa2d469-db42-4d70-a255-d3ba4abcccb0",
  userId: "5301eae6-44c8-4231-a1bd-d49faf547016",
  defaultEmail: "info@messina-engineering.ch",
};

const BASE_URL = loadEnv("AI_SMOKE_BASE_URL") || "http://localhost:3000";
const SECRET = loadEnv("AI_SMOKE_SECRET") || loadEnv("CRON_SECRET");
const SUPABASE_URL = loadEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = loadEnv("SUPABASE_SERVICE_ROLE_KEY");
const BYPASS_PERMISSIONS =
  (loadEnv("AI_SMOKE_BYPASS_PERMISSIONS") || "true").toLowerCase() === "true";
const TASK_FETCH_TRACE = (loadEnv("AI_SMOKE_TASK_FETCH_TRACE") || "false").toLowerCase() === "true";
const FORCE_CYCLE_INSTANCE_ID = loadEnv("AI_SMOKE_CYCLE_INSTANCE_ID") || "";
const REQUEST_TIMEOUT_MS = Number(loadEnv("AI_SMOKE_REQUEST_TIMEOUT_MS") || 120000);
const CHAT_TIMEOUT_MS = Number(loadEnv("AI_SMOKE_CHAT_TIMEOUT_MS") || 90000);

const PRESET_KEY = loadEnv("AI_SMOKE_PRESET").trim().toLowerCase();
const QUESTION_SET_KEY = loadEnv("AI_SMOKE_QUESTION_SET").trim().toLowerCase();
const SMOKE_MODE = loadEnv("AI_SMOKE_MODE").trim().toLowerCase();

const FAST_MODE =
  (loadEnv("AI_SMOKE_FAST_MODE") || "true").trim().toLowerCase() !== "false";

function resolveTargetEmail() {
  const explicit = loadEnv("AI_SMOKE_USER_EMAIL").trim();
  if (explicit) return explicit;
  if (PRESET_KEY === "thomas_maissen") return PRESET_THOMAS_MAISSEN.defaultEmail;
  return "carmelo.messina@cabtecgroup.com";
}

const TARGET_USER_EMAIL = resolveTargetEmail();

const QUESTIONS_DEFAULT = [
  "Vergleiche den aktuellen mit dem vorherigen Zyklus: Wer hatte in beiden Zyklen die meisten OKRs und wie hat sich die Anzahl verändert?",
  "Wie verteilt sich der aktuelle Zyklus nach Owner und Status gleichzeitig, inklusive Statusmix pro Top-Owner?",
  "Nenne mir die OKRs ohne Owner im aktuellen Zyklus und ergänze jeweils, ob zugehörige Key Results existieren.",
  "Wie viele meiner offenen Aufgaben sind direkt mit OKRs verknüpft und wie viele nicht?",
  "Welche meiner erledigten Aufgaben gehören zu Objectives, die aktuell off_track oder at_risk sind?",
  "Gib mir die Top-3 Owner nach Objective-Anzahl und zusätzlich den Anteil ihrer Objectives am Gesamtbestand.",
  "Welche strategischen Richtungen haben die meisten Objectives im aktuellen Zyklus und wer sind dort die Hauptverantwortlichen?",
  "Zeige mir Widersprüche: Objectives mit hohem Fortschritt, aber kritischem Rollup-Status, inklusive Owner.",
  "Welche Initiativen haben keine KR-Verknüpfung, obwohl ihre zugeordneten Objectives aktiv sind?",
  "Welche Objectives ohne Owner haben gleichzeitig überfällige oder stale Key Results?",
];

function resolveQuestionList() {
  if (QUESTION_SET_KEY === "strategy_directions") return strategyDirectionQuestions();
  return QUESTIONS_DEFAULT;
}

async function issueFreshAccessTokenForEmail(email) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) return null;
  const tokenHash = link.data?.properties?.hashed_token;
  if (!tokenHash) return null;
  const anonKey = loadEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!anonKey) return null;
  const anon = createClient(SUPABASE_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await anon.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verified.error) return null;
  return verified.data.session?.access_token ?? null;
}

async function resolveLatestAiContext() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return {};
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase
    .schema("app")
    .from("ai_agent_runs")
    .select("organization_id,membership_id,user_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return {};
  return {
    organizationId: data.organization_id,
    membershipId: data.membership_id,
    userId: data.user_id,
  };
}

async function resolveSmokeContext() {
  const latest = await resolveLatestAiContext();
  let ctx = { ...latest };

  if (PRESET_KEY === "thomas_maissen") {
    ctx = {
      ...ctx,
      organizationId: PRESET_THOMAS_MAISSEN.organizationId,
      membershipId: PRESET_THOMAS_MAISSEN.membershipId,
      userId: PRESET_THOMAS_MAISSEN.userId,
    };
  }

  const org = loadEnv("AI_SMOKE_ORGANIZATION_ID").trim();
  const mem = loadEnv("AI_SMOKE_MEMBERSHIP_ID").trim();
  const uid = loadEnv("AI_SMOKE_USER_ID").trim();
  if (org) ctx.organizationId = org;
  if (mem) ctx.membershipId = mem;
  if (uid) ctx.userId = uid;

  return ctx;
}

function compactResult(result) {
  const contract = result.contract ?? null;
  const diagnostics = result.diagnostics ?? null;
  return {
    question: result.question,
    queryClass: contract?.queryClass ?? diagnostics?.plan?.queryClass ?? null,
    retrievalStatus: contract?.retrievalStatus ?? null,
    total:
      contract?.totalItems ??
      contract?.value ??
      contract?.total ??
      (Array.isArray(contract?.items) ? contract.items.length : null),
    selectedPath: diagnostics?.dispatch?.selectedPath ?? null,
    verifier: diagnostics?.verifier?.status ?? null,
    toolSummaries: (diagnostics?.tools ?? []).map((t) => ({
      tool: t.toolName,
      ok: t.success,
      summary: t.summary,
    })),
  };
}

async function main() {
  const plannerPreflight = await runPlannerPreflight(loadEnv);
  const runQuality = deriveRunQuality(plannerPreflight);

  if (SMOKE_MODE === "preflight") {
    console.log(
      JSON.stringify(
        {
          ok: true,
          smokeMeta: {
            plannerPreflight,
            runQuality,
            fastMode: FAST_MODE,
          },
        },
        null,
        2
      )
    );
    process.exit(0);
    return;
  }

  const freshToken = await issueFreshAccessTokenForEmail(TARGET_USER_EMAIL);
  const context = await resolveSmokeContext();
  const questions = resolveQuestionList();
  const strictStrategyEval = QUESTION_SET_KEY === "strategy_directions";

  const smokeMeta = {
    preset: PRESET_KEY || null,
    questionSet: QUESTION_SET_KEY || "default",
    targetUserEmail: TARGET_USER_EMAIL,
    context,
    questionCount: questions.length,
    plannerPreflight,
    runQuality,
    runQualityLabel:
      runQuality === "verification_ready"
        ? "fachliche_verifikation_moeglich"
        : runQuality === "planner_unavailable"
          ? "planner_unavailable"
          : "technical_only",
    fastMode: FAST_MODE,
  };

  const detailedResults = [];
  const evaluatedRows = [];

  for (let qi = 0; qi < questions.length; qi++) {
    const question = questions[qi];
    const catalogEntry = strictStrategyEval ? findCatalogEntry(question) : null;
    const qid = catalogEntry?.id ?? `default_${qi}`;

    if (strictStrategyEval && !catalogEntry) {
      const miss = {
        question,
        error: "catalog_entry_not_found_for_question",
      };
      detailedResults.push(miss);
      evaluatedRows.push({
        id: `orphan_${qi}`,
        question,
        evaluation: {
          expectedPath: undefined,
          actualPath: null,
          expectedQueryClass: undefined,
          actualQueryClass: null,
          retrievalStatus: null,
          hasStructuredContract: false,
          hasCompositeContract: false,
          hasCompositeDiagnostics: false,
          hasCompositeDiagnosticsSteps: false,
          usedToolCallCount: 0,
          plannerStatus: !plannerPreflight.reachable ? "unavailable" : "unknown",
          answerQualityFlags: {
            containsPlaceholderText: false,
            containsUnknownText: false,
            containsNoDataClaimDespiteContract: false,
          },
          pass: false,
          failReasons: ["strategy_catalog_mismatch"],
        },
      });
      continue;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("request_timeout"), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE_URL}/api/internal/ai-smoke`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(SECRET ? { authorization: `Bearer ${SECRET}` } : {}),
        },
        body: JSON.stringify({
          ...context,
          userEmail: TARGET_USER_EMAIL,
          ...(freshToken ? { userAccessToken: freshToken } : {}),
          ...(FORCE_CYCLE_INSTANCE_ID ? { cycleInstanceId: FORCE_CYCLE_INSTANCE_ID } : {}),
          chatTimeoutMs: CHAT_TIMEOUT_MS,
          fastMode: FAST_MODE,
          bypassPermissions: BYPASS_PERMISSIONS,
          ...(TASK_FETCH_TRACE ? { taskFetchTrace: true } : {}),
          questions: [question],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        const errPayload = {
          question,
          error: `http_${response.status}:${errorText}`,
        };
        detailedResults.push(errPayload);
        evaluatedRows.push({
          id: qid,
          question,
          evaluation: {
            expectedPath: catalogEntry?.expected?.path,
            actualPath: null,
            expectedQueryClass: catalogEntry?.expected?.queryClass,
            actualQueryClass: null,
            retrievalStatus: null,
            hasStructuredContract: false,
            hasCompositeContract: false,
            hasCompositeDiagnostics: false,
            hasCompositeDiagnosticsSteps: false,
            usedToolCallCount: 0,
            plannerStatus: !plannerPreflight.reachable ? "unavailable" : "unknown",
            answerQualityFlags: {
              containsPlaceholderText: false,
              containsUnknownText: false,
              containsNoDataClaimDespiteContract: false,
            },
            pass: false,
            failReasons: [`http_${response.status}`, errorText.slice(0, 200)],
          },
        });
        continue;
      }
      const payload = await response.json();
      const row = payload.results?.[0] ?? { question, error: "no_result" };
      detailedResults.push(row);

      if (strictStrategyEval && catalogEntry) {
        const evaluation = evaluateStrategyQuestion({
          catalogEntry,
          result: row,
          plannerPreflight,
          runQuality,
        });
        evaluatedRows.push({ id: qid, question, evaluation });
      } else if (!strictStrategyEval) {
        evaluatedRows.push({
          id: qid,
          question,
          evaluation: {
            expectedPath: undefined,
            actualPath: row.diagnostics?.dispatch?.selectedPath ?? null,
            expectedQueryClass: undefined,
            actualQueryClass: row.contract?.queryClass ?? row.diagnostics?.plan?.queryClass ?? null,
            retrievalStatus: row.contract?.retrievalStatus ?? null,
            hasStructuredContract: !!row.contract?.queryClass,
            hasCompositeContract: row.contract?.queryClass === "composite",
            hasCompositeDiagnostics: !!row.contract?.compositeDiagnostics,
            hasCompositeDiagnosticsSteps:
              Array.isArray(row.contract?.compositeDiagnosticsSteps) &&
              row.contract.compositeDiagnosticsSteps.length > 0,
            usedToolCallCount: (row.diagnostics?.tools ?? []).length,
            plannerStatus: plannerPreflight.reachable ? "ok" : "unavailable",
            answerQualityFlags: {
              containsPlaceholderText: false,
              containsUnknownText: false,
              containsNoDataClaimDespiteContract: false,
            },
            pass: true,
            failReasons: [],
            note: "strategy_catalog_evaluation_skipped",
          },
        });
      }
    } catch (error) {
      const errPayload = {
        question,
        error: error instanceof Error ? error.message : String(error),
      };
      detailedResults.push(errPayload);
      evaluatedRows.push({
        id: qid,
        question,
        evaluation: {
          pass: false,
          failReasons: [error instanceof Error ? error.message : String(error)],
          actualPath: null,
          actualQueryClass: null,
          retrievalStatus: null,
          hasStructuredContract: false,
          hasCompositeContract: false,
          hasCompositeDiagnostics: false,
          hasCompositeDiagnosticsSteps: false,
          usedToolCallCount: 0,
          plannerStatus: "unknown",
          answerQualityFlags: {
            containsPlaceholderText: false,
            containsUnknownText: false,
            containsNoDataClaimDespiteContract: false,
          },
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const summary = buildRunSummary(
    evaluatedRows.map((r) => ({
      id: r.id,
      question: r.question,
      evaluation: r.evaluation,
    })),
    {
      totalQuestions: questions.length,
      runQuality,
      plannerPreflight,
    }
  );

  const domainVerificationPass =
    summary.failed === 0 && !summary.technicalOnly && runQuality === "verification_ready";

  const output = {
    ok: true,
    smokeMeta,
    summary,
    domainVerificationPass,
    documentationHint:
      runQuality === "planner_unavailable"
        ? "Dieser Lauf bestätigt nur Skript/Backend-Kontext, nicht die fachliche Strategy-Auswertung (Planner nicht bereit)."
        : runQuality === "technical_only"
          ? "Preflight-Generate fehlgeschlagen — nur technischer Referenzlauf, keine volle fachliche Verifikation."
          : summary.failed > 0
            ? "Mindestens eine Strategy-Frage FAIL — Details unter summary.failedQuestions und results[].evaluation."
            : "Pipeline-/Contract-Pfad für den Lauf gemäß Bewertungslogik bestanden (Planner bereit, keine FAIL-Gründe).",
    compactSummary: detailedResults.map(compactResult),
    evaluatedRows,
    legacyQuestions: detailedResults
      .map(compactResult)
      .filter((r) => r.selectedPath === "legacy" || r.queryClass === "unknown")
      .map((r) => ({
        question: r.question,
        queryClass: r.queryClass,
        selectedPath: r.selectedPath,
      })),
    results: detailedResults.map((result, i) => ({
      ...result,
      ...(evaluatedRows[i]?.evaluation ? { evaluation: evaluatedRows[i].evaluation } : {}),
      catalogId: evaluatedRows[i]?.id,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
  printSmokeConsoleLine(summary, plannerPreflight);

  const strictExit = (loadEnv("AI_SMOKE_STRICT_EXIT") || "").toLowerCase() === "true";
  const exitCode =
    strictExit &&
    strictStrategyEval &&
    (!domainVerificationPass || runQuality !== "verification_ready")
      ? 1
      : 0;
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
