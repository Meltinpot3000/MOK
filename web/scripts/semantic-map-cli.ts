/**
 * CLI: Semantic Map Discovery (Build / Validate / Publish / Inspect / Test-Reference / Backend-Smoke).
 * Ausführen aus `web/`: npm run ai:semantic-map:inspect
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFiles() {
  const tryPaths = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env.local"),
    resolve(process.cwd(), "..", ".env"),
  ];
  for (const p of tryPaths) {
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

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function printSummary(title: string, rows: Record<string, string | number | boolean>) {
  console.log("");
  console.log(title);
  for (const [k, v] of Object.entries(rows)) {
    console.log(`- ${k}: ${v}`);
  }
  console.log("");
}

async function main() {
  loadEnvFiles();
  const {
    buildSemanticMapDraft,
    buildSemanticMapRunDiagnostics,
    deriveEvidenceRequirementsFromResolution,
    evaluateSemanticEvidenceCoverage,
    getActiveSemanticMap,
    inspectSemanticMap,
    placeKeyToEvidenceSlots,
    publishSemanticMapSnapshot,
    resolveQuestionAgainstSemanticMap,
    validateSemanticMapDraft,
  } = await import("../lib/ai/semantic-map");

  const cmd = process.argv[2] ?? "inspect";
  const orgId = arg("--org");
  const draftId = arg("--draft");
  const runId = arg("--run");

  if (cmd === "build") {
    const scopeArg = arg("--scope");
    const r = await buildSemanticMapDraft({
      organizationId: orgId,
      webRoot: resolve(process.cwd()),
      scope: scopeArg,
    });
    printSummary("Semantic Map Build", {
      scope: scopeArg ?? process.env.AI_SEMANTIC_MAP_BUILD_SCOPE ?? "full",
      "inventory tables": r.inventorySummary.tables,
      tools: r.inventorySummary.tools,
      "draft places": r.draft.places.length,
      "draft roads": r.draft.roads.length,
      runId: r.runId,
      draftId: r.draftId,
    });
    console.log(JSON.stringify({ ok: true, ...r }, null, 2));
    return;
  }

  if (cmd === "validate") {
    if (!draftId) {
      console.error("Bitte --draft <uuid> angeben.");
      process.exit(1);
    }
    const v = await validateSemanticMapDraft({ draftId });
    printSummary("Semantic Map Validate", {
      "places total": v.summary.places.total,
      "places verified": v.summary.places.verified,
      "places inferred": v.summary.places.inferred,
      "places unsupported": v.summary.places.unsupported,
      "roads total": v.summary.roads.total,
      "roads verified": v.summary.roads.verified,
      "roads inferred": v.summary.roads.inferred,
      "roads missing_tool": v.summary.roads.missing_tool,
      "roads unsupported": v.summary.roads.unsupported,
      "gaps count": v.summary.gapsCount,
    });
    console.log(JSON.stringify({ ok: true, ...v }, null, 2));
    return;
  }

  if (cmd === "publish") {
    if (!draftId || !runId) {
      console.error("Bitte --run <uuid> und --draft <uuid> angeben.");
      process.exit(1);
    }
    const s = await publishSemanticMapSnapshot({ runId, validatedDraftId: draftId });
    printSummary("Semantic Map Publish", {
      snapshotId: s.id,
      isActive: s.isActive,
      "places verified": s.validationSummary.places.verified,
      "roads verified": s.validationSummary.roads.verified,
      "gaps count": s.validationSummary.gapsCount,
    });
    console.log(JSON.stringify({ ok: true, snapshot: s }, null, 2));
    return;
  }

  if (cmd === "test-reference") {
    const question =
      arg("--question") ??
      "What is our biggest strategic challenge and which initiatives address it?";
    const useLlm = process.env.AI_SEMANTIC_MAP_LIVE_TEST === "true" && arg("--use-llm") === "1";
    const { validateDraftToExecutable } = await import("../lib/ai/semantic-map/semantic-map-test-helpers");
    const { mockResolveQuestionForTests } = await import(
      "../lib/ai/semantic-map/__fixtures__/mock-resolve-question"
    );
    const { strategyMapThreePlaceDraftFixture } = await import(
      "../lib/ai/semantic-map/__fixtures__/strategy-map-draft.fixture"
    );
    const { strategyInventoryFixture } = await import(
      "../lib/ai/semantic-map/__fixtures__/strategy-inventory.fixture"
    );

    let map: Awaited<ReturnType<typeof getActiveSemanticMap>> = null;
    try {
      map = await getActiveSemanticMap({ organizationId: orgId });
    } catch {
      map = null;
    }
    if (!map) {
      map = validateDraftToExecutable({
        draft: strategyMapThreePlaceDraftFixture,
        inventory: strategyInventoryFixture,
      }).map;
    }

    let resolution = mockResolveQuestionForTests();
    if (useLlm) {
      resolution = await resolveQuestionAgainstSemanticMap({ question, map });
    }

    const evidenceRequirements = deriveEvidenceRequirementsFromResolution({ resolution, map });
    const coverageDry = evaluateSemanticEvidenceCoverage({
      requiredEvidence: evidenceRequirements,
      usedSources: [],
      questionClaimsTopStrategicChallenge: true,
    });

    printSummary("Semantic Map Test-Reference (keine Business-Antwort)", {
      question,
      "map source": orgId ? "active snapshot or fixture fallback" : "fixture (kein aktiver Snapshot)",
      "resolution mode": useLlm ? "LLM (AI_SEMANTIC_MAP_LIVE_TEST + --use-llm 1)" : "Mock (CI)",
      "evidence rows": evidenceRequirements.length,
      "answerAllowed (ohne usedSources)": coverageDry.answerAllowed,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          question,
          resolution,
          evidenceRequirements,
          coverageIfNoTools: coverageDry,
        },
        null,
        2
      )
    );
    return;
  }

  if (cmd === "backend-smoke") {
    const question =
      arg("--question") ??
      "Welches ist die grösste strategische Herausforderung im aktuellen Zyklus und welche Initiativen laufen, um diese zu lösen oder zu meistern?";
    const toolCalls = [{ toolName: "get_current_okr_cycle" as const }];

    const { validateDraftToExecutable } = await import("../lib/ai/semantic-map/semantic-map-test-helpers");
    const { strategyMapThreePlaceDraftFixture } = await import(
      "../lib/ai/semantic-map/__fixtures__/strategy-map-draft.fixture"
    );
    const { strategyInventoryFixture } = await import(
      "../lib/ai/semantic-map/__fixtures__/strategy-inventory.fixture"
    );

    const { map } = validateDraftToExecutable({
      draft: strategyMapThreePlaceDraftFixture,
      inventory: strategyInventoryFixture,
    });

    const semanticMapDiagnostics = await buildSemanticMapRunDiagnostics({
      question,
      toolCalls,
      map,
      useMockResolver: true,
    });

    const requiredEvidenceSlots = new Set<string>();
    for (const r of semanticMapDiagnostics.requiredEvidence) {
      for (const slot of placeKeyToEvidenceSlots(r.placeKey)) {
        requiredEvidenceSlots.add(slot);
      }
    }

    printSummary("Semantic Map Backend-Smoke (kein LLM, kein Frontend)", {
      question: question.slice(0, 72) + (question.length > 72 ? "…" : ""),
      "tool calls": toolCalls.map((t) => t.toolName).join(", "),
      resolutionStatus: semanticMapDiagnostics.resolutionStatus,
      answerAllowed: semanticMapDiagnostics.evidenceCoverage.answerAllowed,
      executionReadiness: semanticMapDiagnostics.executionReadiness,
      "missing evidence": semanticMapDiagnostics.evidenceCoverage.missingEvidence.join(", ") || "(keine)",
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          question,
          toolCalls: toolCalls.map((t) => t.toolName),
          requiredEvidenceSlots: [...requiredEvidenceSlots],
          semanticMapDiagnostics,
        },
        null,
        2
      )
    );
    return;
  }

  if (cmd === "inspect") {
    const state = await inspectSemanticMap({ organizationId: orgId });
    const d = state.diagnostics;
    printSummary("Semantic Map Inspect", {
      "active snapshot": state.activeSnapshotId ?? "(keiner)",
      "runtime executable (strict: verified roads only)": d.runtimeExecutableStrict ? "ja" : "nein",
      "executable places-only (verified places)": d.executableForPlacesOnly ? "ja" : "nein",
      "executable cross-place (verified roads)": d.executableForCrossPlaceRoutes ? "ja" : "nein",
      "verified roads": d.verifiedRoadsCount,
      "inferred roads (Hinweis, nicht Standard-Execution)": d.inferredRoadsCount,
    });
    const map = await getActiveSemanticMap({ organizationId: orgId });
    console.log(
      JSON.stringify(
        {
          ok: true,
          ...state,
          compactHint: map
            ? {
                verifiedRoads: map.roadsExecutableVerified.length,
                allRoads: map.roadsAll.length,
              }
            : null,
        },
        null,
        2
      )
    );
    return;
  }

  console.error("Unbekannter Befehl:", cmd);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
