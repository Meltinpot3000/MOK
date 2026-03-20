#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

const root = resolve(process.cwd(), "..");
const localEnv = loadLocalEnv(resolve(root, ".env.local"));
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_POOLER_DB_URL ||
  localEnv.DATABASE_URL ||
  localEnv.SUPABASE_POOLER_DB_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL fehlt.");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

console.log("\n=== Alle Background-Jobs (letzte 10) ===\n");
const allJobs = await client.query(`
  select id, organization_id, cycle_instance_id, job_type, status, 
         progress_done, progress_total, last_error, created_at, started_at, finished_at
  from app.analysis_background_jobs 
  order by created_at desc
  limit 10
`);
console.table(allJobs.rows);

console.log("\n=== Backfill-Jobs (objective_evaluation_backfill) ===\n");
const jobs = await client.query(`
  select id, organization_id, cycle_instance_id, job_type, status, 
         progress_done, progress_total, last_error, created_at, started_at, finished_at, payload
  from app.analysis_background_jobs 
  where job_type = 'objective_evaluation_backfill'
  order by created_at desc
  limit 5
`);
console.table(jobs.rows);

console.log("\n=== Objectives gesamt (Status-Verteilung) ===\n");
const objStats = await client.query(`
  select ai_evaluation_status, count(*) as cnt
  from app.objectives
  group by ai_evaluation_status
  order by cnt desc
`);
console.table(objStats.rows);

console.log("\n=== Objectives mit AI-Bewertung ===\n");
const objectives = await client.query(`
  select id, title, ai_objective_score, ai_evaluation_status, ai_clarity_score, 
         ai_strategic_relevance_score, ai_feasibility_score, ai_fit_to_company_score,
         ai_external_internal_classification, ai_short_long_term_classification, ai_exploit_explore_classification,
         ai_evaluated_at
  from app.objectives 
  where ai_evaluation_status is not null and ai_evaluation_status != 'not_run'
  order by ai_evaluated_at desc nulls last
  limit 15
`);
console.table(objectives.rows);

console.log("\n=== Portfolio-Evaluation ===\n");
const portfolio = await client.query(`
  select cycle_instance_id, balance_score, portfolio_recommendation, portfolio_evaluated_at
  from app.cycle_instance_portfolio_evaluation
  order by portfolio_evaluated_at desc nulls last
  limit 3
`);
console.table(portfolio.rows);

console.log("\n=== LLM Usage (objective_evaluation) ===\n");
const usage = await client.query(`
  select organization_id, feature, provider, model, total_tokens, created_at
  from app.llm_usage_events 
  where feature = 'objective_evaluation'
  order by created_at desc
  limit 10
`);
console.table(usage.rows);

await client.end();
