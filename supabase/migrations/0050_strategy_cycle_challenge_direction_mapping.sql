-- 0050_strategy_cycle_challenge_direction_mapping.sql
-- Add relevance/risk scores and challenge dimension mappings for strategy cycle.
-- migrate:up

alter table app.strategic_challenges
  add column if not exists relevance_level smallint not null default 3,
  add column if not exists risk_level smallint not null default 3;

alter table app.strategic_directions
  add column if not exists relevance_level smallint not null default 3,
  add column if not exists risk_level smallint not null default 3;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'strategic_challenges_relevance_level_check'
  ) then
    alter table app.strategic_challenges
      add constraint strategic_challenges_relevance_level_check
      check (relevance_level between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'strategic_challenges_risk_level_check'
  ) then
    alter table app.strategic_challenges
      add constraint strategic_challenges_risk_level_check
      check (risk_level between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'strategic_directions_relevance_level_check'
  ) then
    alter table app.strategic_directions
      add constraint strategic_directions_relevance_level_check
      check (relevance_level between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'strategic_directions_risk_level_check'
  ) then
    alter table app.strategic_directions
      add constraint strategic_directions_risk_level_check
      check (risk_level between 1 and 5);
  end if;
end $$;

create table if not exists app.strategic_challenge_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  strategic_challenge_id uuid not null references app.strategic_challenges(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, strategic_challenge_id, industry_id)
);

create table if not exists app.strategic_challenge_business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  strategic_challenge_id uuid not null references app.strategic_challenges(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, strategic_challenge_id, business_model_id)
);

create index if not exists idx_strategic_challenge_industries_org_cycle_instance
  on app.strategic_challenge_industries (organization_id, cycle_instance_id);

create index if not exists idx_strategic_challenge_business_models_org_cycle_instance
  on app.strategic_challenge_business_models (organization_id, cycle_instance_id);

drop trigger if exists trg_sync_cycles_strategic_challenge_industries on app.strategic_challenge_industries;
create trigger trg_sync_cycles_strategic_challenge_industries
before insert or update on app.strategic_challenge_industries
for each row execute function app.sync_legacy_cycle_columns();

drop trigger if exists trg_sync_cycles_strategic_challenge_business_models on app.strategic_challenge_business_models;
create trigger trg_sync_cycles_strategic_challenge_business_models
before insert or update on app.strategic_challenge_business_models
for each row execute function app.sync_legacy_cycle_columns();

grant select, insert, update, delete on app.strategic_challenge_industries to authenticated;
grant select on app.strategic_challenge_industries to anon;
grant select, insert, update, delete on app.strategic_challenge_business_models to authenticated;
grant select on app.strategic_challenge_business_models to anon;

alter table app.strategic_challenge_industries enable row level security;
alter table app.strategic_challenge_business_models enable row level security;

drop policy if exists strategic_challenge_industries_select on app.strategic_challenge_industries;
create policy strategic_challenge_industries_select on app.strategic_challenge_industries
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'nav.strategy-cycle.read')
);

drop policy if exists strategic_challenge_industries_modify on app.strategic_challenge_industries;
create policy strategic_challenge_industries_modify on app.strategic_challenge_industries
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
);

drop policy if exists strategic_challenge_business_models_select on app.strategic_challenge_business_models;
create policy strategic_challenge_business_models_select on app.strategic_challenge_business_models
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'nav.strategy-cycle.read')
);

drop policy if exists strategic_challenge_business_models_modify on app.strategic_challenge_business_models;
create policy strategic_challenge_business_models_modify on app.strategic_challenge_business_models
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
);

-- migrate:down
drop policy if exists strategic_challenge_business_models_modify on app.strategic_challenge_business_models;
drop policy if exists strategic_challenge_business_models_select on app.strategic_challenge_business_models;
drop policy if exists strategic_challenge_industries_modify on app.strategic_challenge_industries;
drop policy if exists strategic_challenge_industries_select on app.strategic_challenge_industries;

drop trigger if exists trg_sync_cycles_strategic_challenge_business_models on app.strategic_challenge_business_models;
drop trigger if exists trg_sync_cycles_strategic_challenge_industries on app.strategic_challenge_industries;

drop table if exists app.strategic_challenge_business_models;
drop table if exists app.strategic_challenge_industries;

alter table app.strategic_directions
  drop constraint if exists strategic_directions_risk_level_check,
  drop constraint if exists strategic_directions_relevance_level_check,
  drop column if exists risk_level,
  drop column if exists relevance_level;

alter table app.strategic_challenges
  drop constraint if exists strategic_challenges_risk_level_check,
  drop constraint if exists strategic_challenges_relevance_level_check,
  drop column if exists risk_level,
  drop column if exists relevance_level;
