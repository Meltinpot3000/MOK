/**
 * Standard-Einstieg für Thomas-Maissen Strategy-Smoke (Preset + Fragenkatalog).
 *
 * Nutzung:
 *   node scripts/run-strategy-thomas-smoke.mjs           # gleich wie ai:smoke:strategy-thomas
 *   node scripts/run-strategy-thomas-smoke.mjs full      # AI_SMOKE_FAST_MODE=false (Synthesis)
 *   node scripts/run-strategy-thomas-smoke.mjs preflight # nur Planner-Preflight
 */
async function bootstrap() {
  const arg = (process.argv[2] ?? "").trim().toLowerCase();
  if (arg === "preflight") process.env.AI_SMOKE_MODE = "preflight";
  if (arg === "full") process.env.AI_SMOKE_FAST_MODE = "false";
  if (!process.env.AI_SMOKE_PRESET) process.env.AI_SMOKE_PRESET = "thomas_maissen";
  if (!process.env.AI_SMOKE_QUESTION_SET) process.env.AI_SMOKE_QUESTION_SET = "strategy_directions";
  await import("./ai-assistant-smoke-complex.mjs");
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
