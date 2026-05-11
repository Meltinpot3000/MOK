/**
 * Planner-Preflight + Strategy-Smoke-Bewertung (reines JS für node ai-smoke Skripte).
 */

/**
 * @param {(key: string) => string} loadEnv
 * @param {{ skipGenerate?: boolean }} [opts]
 */
export async function runPlannerPreflight(loadEnv, opts = {}) {
  const provider = (loadEnv("SENTINEL_LOCAL_LLM_PROVIDER") || "ollama").trim().toLowerCase();
  const baseUrlRaw =
    loadEnv("SENTINEL_LOCAL_LLM_BASE_URL") || loadEnv("OLLAMA_BASE_URL") || "http://localhost:11434";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const model =
    loadEnv("SENTINEL_LOCAL_LLM_MODEL") || loadEnv("OLLAMA_MODEL") || "llama3.1:8b-instruct-q4_K_M";

  /** @type {{ provider: string; baseUrl: string; model: string; reachable: boolean; modelAvailable: boolean; generateOk?: boolean; error?: string }} */
  const out = {
    provider,
    baseUrl,
    model,
    reachable: false,
    modelAvailable: false,
  };

  const skipGenerate =
    opts.skipGenerate === true ||
    (loadEnv("AI_SMOKE_PREFLIGHT_SKIP_GENERATE") || "").toLowerCase() === "true";

  try {
    if (provider === "ollama") {
      const tagsRes = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });
      if (!tagsRes.ok) {
        out.error = `tags_http_${tagsRes.status}`;
        return out;
      }
      out.reachable = true;
      const tagsJson = await tagsRes.json();
      const names = (tagsJson?.models ?? []).map((m) => m?.name).filter(Boolean);
      out.modelAvailable = names.some((n) => n === model || n.split(":")[0] === model.split(":")[0]);

      if (!skipGenerate && out.modelAvailable) {
        const genRes = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            model,
            prompt: "Reply with exactly: ok",
            stream: false,
          }),
        });
        out.generateOk = genRes.ok;
        if (!genRes.ok) {
          out.error = out.error ?? `generate_http_${genRes.status}`;
        }
      } else if (skipGenerate) {
        out.generateOk = undefined;
      }
      return out;
    }

    if (provider === "openai_compat" || provider === "vllm") {
      const modelsRes = await fetch(`${baseUrl}/v1/models`, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });
      out.reachable = modelsRes.ok;
      if (!modelsRes.ok) {
        out.error = `models_http_${modelsRes.status}`;
        return out;
      }
      const mj = await modelsRes.json();
      const ids = (mj?.data ?? []).map((x) => x?.id).filter(Boolean);
      out.modelAvailable =
        ids.length > 0 && (ids.includes(model) || ids.some((id) => model.startsWith(id)));

      if (!skipGenerate && out.modelAvailable) {
        const chatRes = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Say ok." }],
            max_tokens: 8,
          }),
        });
        out.generateOk = chatRes.ok;
        if (!chatRes.ok) out.error = out.error ?? `chat_http_${chatRes.status}`;
      } else if (skipGenerate) {
        out.generateOk = undefined;
      }
      return out;
    }

    out.error = `unsupported_provider:${provider}`;
    return out;
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return out;
  }
}

/**
 * @param {unknown} contract
 */
export function hasDegradationSignal(contract) {
  if (!contract || typeof contract !== "object") return false;
  const c = contract;
  const status = c.retrievalStatus;
  const partialOrFailed = status === "partial" || status === "failed";
  const miss = Array.isArray(c.missingOps) && c.missingOps.length > 0;
  const cov = Array.isArray(c.coveredOps) && c.coveredOps.length > 0;
  return partialOrFailed && (miss || cov);
}

/**
 * @param {string} answer
 * @param {unknown} contract
 */
export function scanAnswerQualityFlags(answer, contract) {
  const text = typeof answer === "string" ? answer : "";
  const lower = text.toLowerCase();

  const containsPlaceholderText =
    /smoke fast mode:\s*no synthesis/i.test(text) ||
    /\bplatzhalter\b/i.test(lower) ||
    /\(keine auswertung\)/i.test(text);

  const containsUnknownText = /\bunknown\b/i.test(lower);

  let hasContractData = false;
  if (contract && typeof contract === "object") {
    const co = contract;
    if (typeof co.totalItems === "number" && co.totalItems > 0) hasContractData = true;
    if (typeof co.value === "number" && co.value > 0) hasContractData = true;
    if (Array.isArray(co.items) && co.items.length > 0) hasContractData = true;
    if (Array.isArray(co.coveredItems) && co.coveredItems.length > 0) hasContractData = true;
    if (typeof co.total === "number" && co.total > 0) hasContractData = true;
  }

  const containsNoDataClaimDespiteContract =
    hasContractData &&
    (/\bkeine daten\b/i.test(lower) ||
      /\bkein kontext\b/i.test(lower) ||
      /\bno data\b/i.test(lower) ||
      /\bkeine inhaltlichen daten\b/i.test(lower));

  return {
    containsPlaceholderText,
    containsUnknownText,
    containsNoDataClaimDespiteContract,
  };
}

/**
 * @param {ReturnType<typeof runPlannerPreflight> extends Promise<infer U> ? U : never} preflight
 */
export function deriveRunQuality(preflight) {
  if (!preflight.reachable || !preflight.modelAvailable) {
    return "planner_unavailable";
  }
  if (preflight.generateOk === false) {
    return "technical_only";
  }
  return "verification_ready";
}

/**
 * @param {{ catalogEntry: object | null; result: Record<string, unknown>; plannerPreflight: Record<string, unknown>; runQuality: string }} args
 */
export function evaluateStrategyQuestion(args) {
  const { catalogEntry, result, plannerPreflight, runQuality } = args;
  const diagnostics = /** @type {Record<string, unknown>} */ (result.diagnostics ?? {});
  const plan = /** @type {Record<string, unknown>} */ (diagnostics.plan ?? {});
  const dispatch = /** @type {Record<string, unknown>} */ (diagnostics.dispatch ?? {});
  const contract = result.contract ?? null;

  const actualPath = typeof dispatch.selectedPath === "string" ? dispatch.selectedPath : null;
  const planClass = typeof plan.queryClass === "string" ? plan.queryClass : null;
  const contractClass =
    contract && typeof contract === "object" && typeof contract.queryClass === "string"
      ? contract.queryClass
      : null;
  const actualQueryClass = contractClass ?? planClass;

  const retrievalStatus =
    contract && typeof contract === "object" && typeof contract.retrievalStatus === "string"
      ? contract.retrievalStatus
      : null;

  const hasStructuredContract =
    contract != null &&
    typeof contract === "object" &&
    typeof contract.queryClass === "string" &&
    contract.queryClass !== "unknown";

  const hasCompositeContract = hasStructuredContract && contract?.queryClass === "composite";
  const hasCompositeDiagnostics = !!(contract && typeof contract === "object" && contract.compositeDiagnostics);
  const hasCompositeDiagnosticsSteps =
    !!(contract &&
      typeof contract === "object" &&
      Array.isArray(contract.compositeDiagnosticsSteps) &&
      contract.compositeDiagnosticsSteps.length > 0);

  const tools = Array.isArray(diagnostics.tools) ? diagnostics.tools : [];
  const usedToolCallCount = tools.length;

  let plannerStatus = "unknown";
  if (!plannerPreflight.reachable) {
    plannerStatus = "unavailable";
  } else if (plan.usedFallback === true) {
    plannerStatus = "fallback";
  } else {
    plannerStatus = "ok";
  }

  const answer = typeof result.answer === "string" ? result.answer : "";
  const flags = scanAnswerQualityFlags(answer, contract);

  const expected = catalogEntry?.expected;
  const failReasons = [];

  if (runQuality === "planner_unavailable") {
    failReasons.push("run_planner_unavailable_not_domain_verified");
  }

  if (expected) {
    if (expected.path === "pipeline" && actualPath !== "pipeline") {
      failReasons.push(`expected_pipeline_got_${actualPath ?? "null"}`);
    }

    const classes = Array.isArray(expected.queryClass)
      ? expected.queryClass
      : expected.queryClass
        ? [expected.queryClass]
        : [];

    if (classes.length > 0 && actualQueryClass) {
      if (!classes.includes(actualQueryClass)) {
        if (!(expected.allowDegradation && hasDegradationSignal(contract))) {
          failReasons.push(`queryClass_unexpected:${actualQueryClass}`);
        }
      }
    }

    if (actualQueryClass === "unknown" && !expected.allowDegradation) {
      failReasons.push("queryClass_unknown");
    }

    if (actualQueryClass === "unknown" && expected.allowDegradation && !hasDegradationSignal(contract)) {
      failReasons.push("queryClass_unknown_without_degradation_contract");
    }

    if (retrievalStatus === "failed" && !expected.allowPartial && !expected.allowDegradation) {
      failReasons.push("retrieval_failed");
    }

    if (expected.requiredContract && !hasStructuredContract) {
      failReasons.push("missing_structured_contract");
    }

    if (expected.requiredDiagnostics && hasCompositeContract) {
      if (!hasCompositeDiagnostics && !hasCompositeDiagnosticsSteps) {
        failReasons.push("missing_composite_diagnostics");
      }
    }

    if (expected.requiredMissingOps && retrievalStatus === "failed") {
      const mo = contract && typeof contract === "object" ? contract.missingOps : null;
      if (!Array.isArray(mo) || mo.length === 0) {
        failReasons.push("expected_missingOps_for_failed_retrieval");
      }
    }

    if (plannerStatus === "fallback" && actualPath === "legacy" && !expected.allowDegradation) {
      failReasons.push("planner_fallback_and_legacy");
    }

    if (plannerStatus === "fallback" && actualPath === "pipeline" && actualQueryClass === "unknown") {
      if (!(expected.allowDegradation && hasDegradationSignal(contract))) {
        failReasons.push("planner_fallback_unknown_class");
      }
    }
  }

  if (flags.containsPlaceholderText) {
    failReasons.push("answer_contains_placeholder_or_fast_mode_stub");
  }
  if (flags.containsUnknownText && hasStructuredContract) {
    failReasons.push("answer_contains_unknown_token");
  }
  if (flags.containsNoDataClaimDespiteContract) {
    failReasons.push("answer_no_data_claim_despite_contract_items");
  }

  if (runQuality === "technical_only") {
    failReasons.push("run_technical_only_preflight_generate_failed");
  }

  const pass = failReasons.length === 0;

  return {
    expectedPath: expected?.path,
    actualPath,
    expectedQueryClass: expected?.queryClass,
    actualQueryClass,
    retrievalStatus,
    hasStructuredContract,
    hasCompositeContract,
    hasCompositeDiagnostics,
    hasCompositeDiagnosticsSteps,
    usedToolCallCount,
    plannerStatus,
    answerQualityFlags: flags,
    pass,
    failReasons,
  };
}

/**
 * @param {Array<{ id: string; question: string; evaluation: ReturnType<typeof evaluateStrategyQuestion> }>} rows
 * @param {{
 *   totalQuestions: number;
 *   runQuality: string;
 *   plannerPreflight: Awaited<ReturnType<typeof runPlannerPreflight>>;
 * }} meta
 */
export function buildRunSummary(rows, meta) {
  let pipelineCount = 0;
  let legacyCount = 0;
  let unknownCount = 0;
  let compositeCount = 0;
  let passed = 0;
  let failed = 0;

  const failedQuestions = [];

  for (const row of rows) {
    const ev = row.evaluation;
    if (ev.actualPath === "pipeline") pipelineCount += 1;
    if (ev.actualPath === "legacy") legacyCount += 1;
    if (ev.actualQueryClass === "unknown") unknownCount += 1;
    if (ev.actualQueryClass === "composite" || ev.hasCompositeContract) compositeCount += 1;

    if (ev.pass) passed += 1;
    else {
      failed += 1;
      failedQuestions.push({
        id: row.id,
        question: row.question,
        failReasons: ev.failReasons,
      });
    }
  }

  return {
    totalQuestions: meta.totalQuestions,
    passed,
    failed,
    technicalOnly: meta.runQuality === "technical_only" || meta.runQuality === "planner_unavailable",
    plannerAvailable: meta.plannerPreflight.reachable && meta.plannerPreflight.modelAvailable,
    pipelineCount,
    legacyCount,
    unknownCount,
    compositeCount,
    failedQuestions,
    runQuality: meta.runQuality,
  };
}

export function printSmokeConsoleLine(summary, plannerPreflight) {
  const plannerOk = plannerPreflight.reachable && plannerPreflight.modelAvailable;
  const total = summary.totalQuestions || 1;
  console.error("");
  console.error(
    [
      `Planner: ${plannerOk ? "OK" : "unavailable"}`,
      `Pipeline: ${summary.pipelineCount}/${total}`,
      `Composite: ${summary.compositeCount}/${total}`,
      `Legacy: ${summary.legacyCount}/${total}`,
      `Unknown: ${summary.unknownCount}/${total}`,
      `PASS: ${summary.passed}/${total}`,
      `FAIL: ${summary.failed}/${total}`,
    ].join(" | ")
  );
}
