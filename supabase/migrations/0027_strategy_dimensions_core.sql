-- 0027_strategy_dimensions_core.sql
-- Core Strategy Dimensions for Industry / Business Model / Operating Model.
-- migrate:up

create table if not exists app.industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  name text not null,
  description text,
  market_characteristics text,
  growth_rate numeric(6,3),
  strategic_importance text not null default 'medium' check (strategic_importance in ('low', 'medium', 'high')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_cycle_id, name)
);

create index if not exists idx_industries_org_cycle
  on app.industries (organization_id, planning_cycle_id, status);

drop trigger if exists trg_industries_updated_at on app.industries;
create trigger trg_industries_updated_at
before update on app.industries
for each row execute function app.set_updated_at();

create table if not exists app.business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  version_no integer not null default 1 check (version_no >= 1),
  customer_segments jsonb not null default '[]'::jsonb,
  value_proposition jsonb not null default '[]'::jsonb,
  channels jsonb not null default '[]'::jsonb,
  customer_relationships jsonb not null default '[]'::jsonb,
  revenue_streams jsonb not null default '[]'::jsonb,
  key_resources jsonb not null default '[]'::jsonb,
  key_activities jsonb not null default '[]'::jsonb,
  key_partners jsonb not null default '[]'::jsonb,
  cost_structure jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_cycle_id, name, version_no)
);

create index if not exists idx_business_models_org_cycle
  on app.business_models (organization_id, planning_cycle_id, status);

drop trigger if exists trg_business_models_updated_at on app.business_models;
create trigger trg_business_models_updated_at
before update on app.business_models
for each row execute function app.set_updated_at();

create table if not exists app.operating_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  version_no integer not null default 1 check (version_no >= 1),
  processes jsonb not null default '[]'::jsonb,
  organization_design jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  technology jsonb not null default '[]'::jsonb,
  data_assets jsonb not null default '[]'::jsonb,
  governance jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  partners jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_cycle_id, name, version_no)
);

create index if not exists idx_operating_models_org_cycle
  on app.operating_models (organization_id, planning_cycle_id, status);

drop trigger if exists trg_operating_models_updated_at on app.operating_models;
create trigger trg_operating_models_updated_at
before update on app.operating_models
for each row execute function app.set_updated_at();

create table if not exists app.business_model_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, business_model_id, industry_id)
);

create table if not exists app.operating_model_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  operating_model_id uuid not null references app.operating_models(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, operating_model_id, industry_id)
);

create table if not exists app.operating_model_business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  operating_model_id uuid not null references app.operating_models(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, operating_model_id, business_model_id)
);

create table if not exists app.strategic_direction_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, strategic_direction_id, industry_id)
);

create table if not exists app.strategic_direction_business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, strategic_direction_id, business_model_id)
);

create table if not exists app.strategic_direction_operating_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  operating_model_id uuid not null references app.operating_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, strategic_direction_id, operating_model_id)
);

create table if not exists app.annual_target_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, annual_target_id, industry_id)
);

create table if not exists app.annual_target_business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, annual_target_id, business_model_id)
);

create table if not exists app.annual_target_operating_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  operating_model_id uuid not null references app.operating_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, annual_target_id, operating_model_id)
);

create table if not exists app.initiative_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  initiative_id uuid not null references app.initiatives(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, initiative_id, industry_id)
);

create table if not exists app.initiative_business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  initiative_id uuid not null references app.initiatives(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, initiative_id, business_model_id)
);

create table if not exists app.initiative_operating_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  initiative_id uuid not null references app.initiatives(id) on delete cascade,
  operating_model_id uuid not null references app.operating_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, initiative_id, operating_model_id)
);

create table if not exists app.objective_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, objective_id, industry_id)
);

create table if not exists app.objective_business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, objective_id, business_model_id)
);

create table if not exists app.objective_operating_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  operating_model_id uuid not null references app.operating_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, objective_id, operating_model_id)
);

create table if not exists app.key_result_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  key_result_id uuid not null references app.key_results(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, key_result_id, industry_id)
);

create table if not exists app.key_result_business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  key_result_id uuid not null references app.key_results(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, key_result_id, business_model_id)
);

create table if not exists app.key_result_operating_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  key_result_id uuid not null references app.key_results(id) on delete cascade,
  operating_model_id uuid not null references app.operating_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, key_result_id, operating_model_id)
);

create index if not exists idx_business_model_industries_org_cycle on app.business_model_industries (organization_id, planning_cycle_id);
create index if not exists idx_operating_model_industries_org_cycle on app.operating_model_industries (organization_id, planning_cycle_id);
create index if not exists idx_operating_model_business_models_org_cycle on app.operating_model_business_models (organization_id, planning_cycle_id);
create index if not exists idx_strategic_direction_industries_org_cycle on app.strategic_direction_industries (organization_id, planning_cycle_id);
create index if not exists idx_strategic_direction_business_models_org_cycle on app.strategic_direction_business_models (organization_id, planning_cycle_id);
create index if not exists idx_strategic_direction_operating_models_org_cycle on app.strategic_direction_operating_models (organization_id, planning_cycle_id);
create index if not exists idx_annual_target_industries_org_cycle on app.annual_target_industries (organization_id, planning_cycle_id);
create index if not exists idx_annual_target_business_models_org_cycle on app.annual_target_business_models (organization_id, planning_cycle_id);
create index if not exists idx_annual_target_operating_models_org_cycle on app.annual_target_operating_models (organization_id, planning_cycle_id);
create index if not exists idx_initiative_industries_org_cycle on app.initiative_industries (organization_id, planning_cycle_id);
create index if not exists idx_initiative_business_models_org_cycle on app.initiative_business_models (organization_id, planning_cycle_id);
create index if not exists idx_initiative_operating_models_org_cycle on app.initiative_operating_models (organization_id, planning_cycle_id);
create index if not exists idx_objective_industries_org_cycle on app.objective_industries (organization_id, planning_cycle_id);
create index if not exists idx_objective_business_models_org_cycle on app.objective_business_models (organization_id, planning_cycle_id);
create index if not exists idx_objective_operating_models_org_cycle on app.objective_operating_models (organization_id, planning_cycle_id);
create index if not exists idx_key_result_industries_org_cycle on app.key_result_industries (organization_id, planning_cycle_id);
create index if not exists idx_key_result_business_models_org_cycle on app.key_result_business_models (organization_id, planning_cycle_id);
create index if not exists idx_key_result_operating_models_org_cycle on app.key_result_operating_models (organization_id, planning_cycle_id);

create or replace view app.strategy_dimension_alignment as
select
  'strategic_direction'::text as object_type,
  sdi.strategic_direction_id as object_id,
  sdi.organization_id,
  sdi.planning_cycle_id,
  i.id as industry_id,
  null::uuid as business_model_id,
  null::uuid as operating_model_id
from app.strategic_direction_industries sdi
join app.industries i on i.id = sdi.industry_id
union all
select
  'strategic_direction',
  sdbm.strategic_direction_id,
  sdbm.organization_id,
  sdbm.planning_cycle_id,
  null::uuid,
  bm.id,
  null::uuid
from app.strategic_direction_business_models sdbm
join app.business_models bm on bm.id = sdbm.business_model_id
union all
select
  'strategic_direction',
  sdom.strategic_direction_id,
  sdom.organization_id,
  sdom.planning_cycle_id,
  null::uuid,
  null::uuid,
  om.id
from app.strategic_direction_operating_models sdom
join app.operating_models om on om.id = sdom.operating_model_id;

-- migrate:down
drop view if exists app.strategy_dimension_alignment;
drop table if exists app.key_result_operating_models;
drop table if exists app.key_result_business_models;
drop table if exists app.key_result_industries;
drop table if exists app.objective_operating_models;
drop table if exists app.objective_business_models;
drop table if exists app.objective_industries;
drop table if exists app.initiative_operating_models;
drop table if exists app.initiative_business_models;
drop table if exists app.initiative_industries;
drop table if exists app.annual_target_operating_models;
drop table if exists app.annual_target_business_models;
drop table if exists app.annual_target_industries;
drop table if exists app.strategic_direction_operating_models;
drop table if exists app.strategic_direction_business_models;
drop table if exists app.strategic_direction_industries;
drop table if exists app.operating_model_business_models;
drop table if exists app.operating_model_industries;
drop table if exists app.business_model_industries;
drop trigger if exists trg_operating_models_updated_at on app.operating_models;
drop trigger if exists trg_business_models_updated_at on app.business_models;
drop trigger if exists trg_industries_updated_at on app.industries;
drop table if exists app.operating_models;
drop table if exists app.business_models;
drop table if exists app.industries;
