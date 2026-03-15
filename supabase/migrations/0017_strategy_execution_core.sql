-- 0017_strategy_execution_core.sql
-- Core strategy + execution entities (metrics, initiatives, okr cycles).
-- migrate:up

create table if not exists app.strategic_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  current_state text,
  desired_state text,
  importance_level smallint not null default 3 check (importance_level between 1 and 5),
  owner_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_cycle_id, name)
);

create index if not exists idx_strategic_metrics_org_cycle
  on app.strategic_metrics (organization_id, planning_cycle_id);

drop trigger if exists trg_strategic_metrics_updated_at on app.strategic_metrics;
create trigger trg_strategic_metrics_updated_at
before update on app.strategic_metrics
for each row execute function app.set_updated_at();

create table if not exists app.initiatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  title text not null,
  description text,
  owner_membership_id uuid references app.organization_memberships(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft', 'planned', 'active', 'at_risk', 'completed', 'archived')),
  priority smallint not null default 3 check (priority between 1 and 5),
  budget numeric(18,2),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or start_date <= end_date)
);

create index if not exists idx_initiatives_org_cycle
  on app.initiatives (organization_id, planning_cycle_id);

drop trigger if exists trg_initiatives_updated_at on app.initiatives;
create trigger trg_initiatives_updated_at
before update on app.initiatives
for each row execute function app.set_updated_at();

create table if not exists app.okr_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  name text not null,
  code text,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed', 'archived')),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_cycle_id, name),
  check (start_date <= end_date)
);

create index if not exists idx_okr_cycles_org_cycle
  on app.okr_cycles (organization_id, planning_cycle_id);

drop trigger if exists trg_okr_cycles_updated_at on app.okr_cycles;
create trigger trg_okr_cycles_updated_at
before update on app.okr_cycles
for each row execute function app.set_updated_at();

alter table app.objectives
  add column if not exists okr_cycle_id uuid references app.okr_cycles(id) on delete set null;

alter table app.objectives
  add column if not exists confidence_level smallint check (confidence_level between 1 and 10);

create index if not exists idx_objectives_okr_cycle
  on app.objectives (organization_id, okr_cycle_id);

alter table app.key_results
  add column if not exists measurement_unit text;

-- migrate:down
drop trigger if exists trg_okr_cycles_updated_at on app.okr_cycles;
drop trigger if exists trg_initiatives_updated_at on app.initiatives;
drop trigger if exists trg_strategic_metrics_updated_at on app.strategic_metrics;
drop table if exists app.okr_cycles;
drop table if exists app.initiatives;
drop table if exists app.strategic_metrics;
