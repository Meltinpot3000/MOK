-- 0003_strategy_okr.sql
-- Strategy and OKR domain tables.
-- migrate:up

create table if not exists app.planning_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'published', 'archived')),
  rolling_window_months integer not null default 18 check (rolling_window_months between 3 and 60),
  created_by_membership_id uuid references app.organization_memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (start_date <= end_date)
);

create trigger trg_planning_cycles_updated_at
before update on app.planning_cycles
for each row
execute function app.set_updated_at();

create index if not exists idx_planning_cycles_org
  on app.planning_cycles (organization_id);

create table if not exists app.strategic_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'on_hold', 'completed', 'archived')),
  priority smallint not null default 3 check (priority between 1 and 5),
  owner_membership_id uuid references app.organization_memberships(id),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_strategic_goals_updated_at
before update on app.strategic_goals
for each row
execute function app.set_updated_at();

create index if not exists idx_strategic_goals_org_cycle
  on app.strategic_goals (organization_id, cycle_id);

create table if not exists app.functional_strategies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  function_name text not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'on_hold', 'completed', 'archived')),
  owner_membership_id uuid references app.organization_memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_functional_strategies_updated_at
before update on app.functional_strategies
for each row
execute function app.set_updated_at();

create index if not exists idx_functional_strategies_org_cycle
  on app.functional_strategies (organization_id, cycle_id);

create table if not exists app.objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'at_risk', 'completed', 'archived')),
  owner_membership_id uuid references app.organization_memberships(id),
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_objectives_updated_at
before update on app.objectives
for each row
execute function app.set_updated_at();

create index if not exists idx_objectives_org_cycle
  on app.objectives (organization_id, cycle_id);

create table if not exists app.key_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  title text not null,
  metric_type text not null default 'numeric' check (metric_type in ('numeric', 'percent', 'boolean')),
  start_value numeric(18,4),
  target_value numeric(18,4),
  current_value numeric(18,4),
  status text not null default 'draft' check (status in ('draft', 'active', 'at_risk', 'completed', 'archived')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_key_results_updated_at
before update on app.key_results
for each row
execute function app.set_updated_at();

create index if not exists idx_key_results_org_objective
  on app.key_results (organization_id, objective_id);

create table if not exists app.entity_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  from_type text not null check (from_type in ('strategic_goal', 'functional_strategy', 'objective', 'key_result')),
  from_id uuid not null,
  to_type text not null check (to_type in ('strategic_goal', 'functional_strategy', 'objective', 'key_result')),
  to_id uuid not null,
  relation_type text not null default 'supports',
  created_at timestamptz not null default now(),
  check ((from_type, from_id) <> (to_type, to_id)),
  unique (organization_id, from_type, from_id, to_type, to_id, relation_type)
);

create index if not exists idx_entity_links_org_from
  on app.entity_links (organization_id, from_type, from_id);

create index if not exists idx_entity_links_org_to
  on app.entity_links (organization_id, to_type, to_id);

-- migrate:down
drop table if exists app.entity_links;
drop table if exists app.key_results;
drop table if exists app.objectives;
drop table if exists app.functional_strategies;
drop table if exists app.strategic_goals;
drop table if exists app.planning_cycles;
