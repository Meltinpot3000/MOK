-- 0018_traceability_links.sql
-- Explicit traceability links across strategy/planning/execution.
-- migrate:up

create table if not exists app.direction_metric_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  strategic_metric_id uuid not null references app.strategic_metrics(id) on delete cascade,
  contribution_level text not null default 'medium' check (contribution_level in ('low', 'medium', 'high')),
  comment text,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, strategic_direction_id, strategic_metric_id)
);

create index if not exists idx_direction_metric_links_org_cycle
  on app.direction_metric_links (organization_id, planning_cycle_id);

create table if not exists app.target_metric_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  strategic_metric_id uuid not null references app.strategic_metrics(id) on delete cascade,
  contribution_level text not null default 'medium' check (contribution_level in ('low', 'medium', 'high')),
  comment text,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, annual_target_id, strategic_metric_id)
);

create index if not exists idx_target_metric_links_org_cycle
  on app.target_metric_links (organization_id, planning_cycle_id);

create table if not exists app.initiative_target_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  initiative_id uuid not null references app.initiatives(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  contribution_level text not null default 'medium' check (contribution_level in ('low', 'medium', 'high')),
  comment text,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, initiative_id, annual_target_id)
);

create index if not exists idx_initiative_target_links_org_cycle
  on app.initiative_target_links (organization_id, planning_cycle_id);

create table if not exists app.objective_target_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  contribution_level text not null default 'medium' check (contribution_level in ('low', 'medium', 'high')),
  comment text,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, objective_id, annual_target_id)
);

create index if not exists idx_objective_target_links_org_cycle
  on app.objective_target_links (organization_id, planning_cycle_id);

create table if not exists app.objective_direction_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  contribution_level text not null default 'medium' check (contribution_level in ('low', 'medium', 'high')),
  comment text,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, objective_id, strategic_direction_id)
);

create index if not exists idx_objective_direction_links_org_cycle
  on app.objective_direction_links (organization_id, planning_cycle_id);

create table if not exists app.key_result_target_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  key_result_id uuid not null references app.key_results(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  contribution_level text not null default 'medium' check (contribution_level in ('low', 'medium', 'high')),
  comment text,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, key_result_id, annual_target_id)
);

create index if not exists idx_key_result_target_links_org_cycle
  on app.key_result_target_links (organization_id, planning_cycle_id);

-- migrate:down
drop table if exists app.key_result_target_links;
drop table if exists app.objective_direction_links;
drop table if exists app.objective_target_links;
drop table if exists app.initiative_target_links;
drop table if exists app.target_metric_links;
drop table if exists app.direction_metric_links;
