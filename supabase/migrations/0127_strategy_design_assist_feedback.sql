-- Hybrid Strategic Design: persist assist decisions and telemetry.
-- migrate:up

create table if not exists app.strategy_design_assist_feedback (
  organization_id uuid not null,
  cycle_instance_id uuid not null,
  challenge_id uuid not null,
  strategy_objective_id uuid not null,
  strategic_direction_id uuid not null,
  decision_state text not null check (decision_state in ('auto_suggested', 'accepted', 'rejected', 'manual_override')),
  recommendation_status text null check (recommendation_status in ('green', 'yellow', 'red', 'unknown')),
  recommendation_confidence text null check (recommendation_confidence in ('low', 'medium', 'high')),
  recommendation_explanation text null,
  decision_reason text null,
  source text not null default 'llm_assist' check (source in ('deterministic', 'llm_assist', 'manual')),
  first_suggested_at timestamptz null,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_membership_id uuid null,
  updated_by_membership_id uuid null,
  constraint strategy_design_assist_feedback_pkey primary key (
    cycle_instance_id,
    challenge_id,
    strategy_objective_id,
    strategic_direction_id
  )
);

create index if not exists idx_strategy_design_assist_feedback_org_cycle
  on app.strategy_design_assist_feedback (organization_id, cycle_instance_id);

create index if not exists idx_strategy_design_assist_feedback_decision_state
  on app.strategy_design_assist_feedback (decision_state);

-- migrate:down

drop table if exists app.strategy_design_assist_feedback;
