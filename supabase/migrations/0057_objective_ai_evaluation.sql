-- 0057_objective_ai_evaluation.sql
-- AI-driven objective evaluation: strategic context cache, objective ai_* columns, portfolio evaluation.
-- migrate:up

-- Strategic context cache (one per organization, invalidated when company info changes)
create table if not exists app.strategic_context_cache (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  context_json jsonb not null,
  is_current boolean not null default true,
  provider text,
  model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists idx_strategic_context_cache_org_current
  on app.strategic_context_cache (organization_id, is_current) where is_current = true;

grant select, insert, update, delete on app.strategic_context_cache to authenticated;
alter table app.strategic_context_cache enable row level security;

drop policy if exists strategic_context_cache_select on app.strategic_context_cache;
create policy strategic_context_cache_select on app.strategic_context_cache
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategic_context_cache_modify on app.strategic_context_cache;
create policy strategic_context_cache_modify on app.strategic_context_cache
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

-- AI evaluation columns on objectives
alter table app.objectives
  add column if not exists ai_clarity_score smallint check (ai_clarity_score is null or ai_clarity_score between 1 and 5),
  add column if not exists ai_strategic_relevance_score smallint check (ai_strategic_relevance_score is null or ai_strategic_relevance_score between 1 and 5),
  add column if not exists ai_feasibility_score smallint check (ai_feasibility_score is null or ai_feasibility_score between 1 and 5),
  add column if not exists ai_fit_to_company_score smallint check (ai_fit_to_company_score is null or ai_fit_to_company_score between 1 and 5),
  add column if not exists ai_confidence_score smallint check (ai_confidence_score is null or ai_confidence_score between 1 and 5),
  add column if not exists ai_external_internal_classification text check (ai_external_internal_classification is null or ai_external_internal_classification in ('internal', 'external', 'balanced')),
  add column if not exists ai_short_long_term_classification text check (ai_short_long_term_classification is null or ai_short_long_term_classification in ('short', 'mid', 'long')),
  add column if not exists ai_exploit_explore_classification text check (ai_exploit_explore_classification is null or ai_exploit_explore_classification in ('exploit', 'explore', 'balanced')),
  add column if not exists ai_issues_json jsonb default '[]'::jsonb,
  add column if not exists ai_improvement_suggestion text,
  add column if not exists ai_summary text,
  add column if not exists ai_objective_score numeric(6,2),
  add column if not exists ai_evaluation_status text default 'not_run' check (ai_evaluation_status in ('not_run', 'valid', 'outdated', 'failed')),
  add column if not exists ai_evaluated_at timestamptz,
  add column if not exists ai_evaluation_version text,
  add column if not exists ai_manual_override boolean not null default false,
  add column if not exists ai_manual_comment text;

-- Portfolio evaluation (one per cycle instance)
create table if not exists app.cycle_instance_portfolio_evaluation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  balance_score smallint check (balance_score is null or balance_score between 1 and 5),
  distribution_internal_external_json jsonb default '{}'::jsonb,
  distribution_exploit_explore_json jsonb default '{}'::jsonb,
  distribution_short_long_json jsonb default '{}'::jsonb,
  portfolio_gaps_json jsonb default '[]'::jsonb,
  portfolio_risks_json jsonb default '[]'::jsonb,
  portfolio_recommendation text,
  portfolio_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_instance_id)
);

create index if not exists idx_cycle_instance_portfolio_eval_org
  on app.cycle_instance_portfolio_evaluation (organization_id);

drop trigger if exists trg_cycle_instance_portfolio_eval_updated_at on app.cycle_instance_portfolio_evaluation;
create trigger trg_cycle_instance_portfolio_eval_updated_at
before update on app.cycle_instance_portfolio_evaluation
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.cycle_instance_portfolio_evaluation to authenticated;
alter table app.cycle_instance_portfolio_evaluation enable row level security;

drop policy if exists cycle_instance_portfolio_eval_select on app.cycle_instance_portfolio_evaluation;
create policy cycle_instance_portfolio_eval_select on app.cycle_instance_portfolio_evaluation
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists cycle_instance_portfolio_eval_modify on app.cycle_instance_portfolio_evaluation;
create policy cycle_instance_portfolio_eval_modify on app.cycle_instance_portfolio_evaluation
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

-- migrate:down
drop policy if exists cycle_instance_portfolio_eval_modify on app.cycle_instance_portfolio_evaluation;
drop policy if exists cycle_instance_portfolio_eval_select on app.cycle_instance_portfolio_evaluation;
drop trigger if exists trg_cycle_instance_portfolio_eval_updated_at on app.cycle_instance_portfolio_evaluation;
drop table if exists app.cycle_instance_portfolio_evaluation;

alter table app.objectives
  drop column if exists ai_clarity_score,
  drop column if exists ai_strategic_relevance_score,
  drop column if exists ai_feasibility_score,
  drop column if exists ai_fit_to_company_score,
  drop column if exists ai_confidence_score,
  drop column if exists ai_external_internal_classification,
  drop column if exists ai_short_long_term_classification,
  drop column if exists ai_exploit_explore_classification,
  drop column if exists ai_issues_json,
  drop column if exists ai_improvement_suggestion,
  drop column if exists ai_summary,
  drop column if exists ai_objective_score,
  drop column if exists ai_evaluation_status,
  drop column if exists ai_evaluated_at,
  drop column if exists ai_evaluation_version,
  drop column if exists ai_manual_override,
  drop column if exists ai_manual_comment;

drop policy if exists strategic_context_cache_modify on app.strategic_context_cache;
drop policy if exists strategic_context_cache_select on app.strategic_context_cache;
drop table if exists app.strategic_context_cache;
