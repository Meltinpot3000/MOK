-- 0052_strategy_framework_v3_core.sql
-- Strategic framework v3 core data model and constraints.
-- migrate:up

alter table app.strategic_challenges
  add column if not exists description text,
  add column if not exists impact_score smallint not null default 3,
  add column if not exists urgency_score smallint not null default 3,
  add column if not exists scope_score smallint not null default 3,
  add column if not exists root_cause_score smallint not null default 3,
  add column if not exists challenge_score numeric(6,2) not null default 3.00;

alter table app.strategic_directions
  add column if not exists strategic_value_score smallint not null default 3,
  add column if not exists capability_fit_score smallint not null default 3,
  add column if not exists feasibility_score smallint not null default 3,
  add column if not exists direction_score numeric(6,2) not null default 3.00;

alter table app.objectives
  add column if not exists time_horizon text,
  add column if not exists importance_score smallint not null default 3;

create table if not exists app.strategy_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  strategic_direction_id uuid references app.strategic_directions(id) on delete set null,
  title text not null,
  description text,
  owner_membership_id uuid references app.memberships(id) on delete set null,
  budget numeric(18,2),
  timeline text,
  created_by_membership_id uuid references app.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.cluster_objective_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  cluster_id uuid not null references app.analysis_clusters(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  relation_strength smallint not null default 1,
  gap_score numeric(10,2) not null default 0,
  created_by_membership_id uuid references app.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cluster_objective_relations_relation_strength_check check (relation_strength between 0 and 3)
);

create table if not exists app.strategic_direction_cluster_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  cluster_id uuid not null references app.analysis_clusters(id) on delete cascade,
  created_by_membership_id uuid references app.memberships(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists app.strategic_direction_objective_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  created_by_membership_id uuid references app.memberships(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists app.strategic_direction_gap_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  cluster_objective_relation_id uuid not null references app.cluster_objective_relations(id) on delete cascade,
  created_by_membership_id uuid references app.memberships(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table app.initiatives
  add column if not exists program_id uuid references app.strategy_programs(id) on delete set null,
  add column if not exists linked_okrs jsonb not null default '[]'::jsonb,
  add column if not exists deliverables jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'strategic_challenges_impact_score_check') then
    alter table app.strategic_challenges add constraint strategic_challenges_impact_score_check check (impact_score between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strategic_challenges_urgency_score_check') then
    alter table app.strategic_challenges add constraint strategic_challenges_urgency_score_check check (urgency_score between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strategic_challenges_scope_score_check') then
    alter table app.strategic_challenges add constraint strategic_challenges_scope_score_check check (scope_score between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strategic_challenges_root_cause_score_check') then
    alter table app.strategic_challenges add constraint strategic_challenges_root_cause_score_check check (root_cause_score between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strategic_directions_strategic_value_score_check') then
    alter table app.strategic_directions add constraint strategic_directions_strategic_value_score_check check (strategic_value_score between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strategic_directions_capability_fit_score_check') then
    alter table app.strategic_directions add constraint strategic_directions_capability_fit_score_check check (capability_fit_score between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strategic_directions_feasibility_score_check') then
    alter table app.strategic_directions add constraint strategic_directions_feasibility_score_check check (feasibility_score between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'objectives_importance_score_check') then
    alter table app.objectives add constraint objectives_importance_score_check check (importance_score between 1 and 5);
  end if;
end $$;

create unique index if not exists uq_strategy_programs_cycle_title
  on app.strategy_programs(cycle_instance_id, title);
create unique index if not exists uq_cluster_objective_relations_cycle_cluster_objective
  on app.cluster_objective_relations(cycle_instance_id, cluster_id, objective_id);
create unique index if not exists uq_direction_cluster_links_cycle
  on app.strategic_direction_cluster_links(cycle_instance_id, strategic_direction_id, cluster_id);
create unique index if not exists uq_direction_objective_links_cycle
  on app.strategic_direction_objective_links(cycle_instance_id, strategic_direction_id, objective_id);
create unique index if not exists uq_direction_gap_links_cycle
  on app.strategic_direction_gap_links(cycle_instance_id, strategic_direction_id, cluster_objective_relation_id);

create unique index if not exists uq_challenge_direction_links_cycle
  on app.challenge_direction_links(cycle_instance_id, strategic_direction_id, strategic_challenge_id);
create unique index if not exists uq_initiative_target_links_cycle
  on app.initiative_target_links(cycle_instance_id, initiative_id, annual_target_id);
create unique index if not exists uq_objective_direction_links_cycle
  on app.objective_direction_links(cycle_instance_id, objective_id, strategic_direction_id);
create unique index if not exists uq_objective_target_links_cycle
  on app.objective_target_links(cycle_instance_id, objective_id, annual_target_id);
create unique index if not exists uq_strategic_challenge_industries_cycle
  on app.strategic_challenge_industries(cycle_instance_id, strategic_challenge_id, industry_id);
create unique index if not exists uq_strategic_challenge_business_models_cycle
  on app.strategic_challenge_business_models(cycle_instance_id, strategic_challenge_id, business_model_id);

drop trigger if exists trg_sync_cycles_strategy_programs on app.strategy_programs;
create trigger trg_sync_cycles_strategy_programs
before insert or update on app.strategy_programs
for each row execute function app.sync_legacy_cycle_columns();

drop trigger if exists trg_sync_cycles_cluster_objective_relations on app.cluster_objective_relations;
create trigger trg_sync_cycles_cluster_objective_relations
before insert or update on app.cluster_objective_relations
for each row execute function app.sync_legacy_cycle_columns();

drop trigger if exists trg_sync_cycles_strategic_direction_cluster_links on app.strategic_direction_cluster_links;
create trigger trg_sync_cycles_strategic_direction_cluster_links
before insert or update on app.strategic_direction_cluster_links
for each row execute function app.sync_legacy_cycle_columns();

drop trigger if exists trg_sync_cycles_strategic_direction_objective_links on app.strategic_direction_objective_links;
create trigger trg_sync_cycles_strategic_direction_objective_links
before insert or update on app.strategic_direction_objective_links
for each row execute function app.sync_legacy_cycle_columns();

drop trigger if exists trg_sync_cycles_strategic_direction_gap_links on app.strategic_direction_gap_links;
create trigger trg_sync_cycles_strategic_direction_gap_links
before insert or update on app.strategic_direction_gap_links
for each row execute function app.sync_legacy_cycle_columns();

create or replace function app.enforce_direction_activation_links()
returns trigger
language plpgsql
as $$
declare
  cluster_count integer;
  objective_count integer;
begin
  if new.status = 'active' then
    select count(*) into cluster_count
    from app.strategic_direction_cluster_links
    where organization_id = new.organization_id
      and cycle_instance_id = new.cycle_instance_id
      and strategic_direction_id = new.id;
    select count(*) into objective_count
    from app.strategic_direction_objective_links
    where organization_id = new.organization_id
      and cycle_instance_id = new.cycle_instance_id
      and strategic_direction_id = new.id;
    if cluster_count < 1 or objective_count < 1 then
      raise exception 'direction-needs-cluster-and-objective';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_direction_activation_links on app.strategic_directions;
create trigger trg_enforce_direction_activation_links
before insert or update on app.strategic_directions
for each row execute function app.enforce_direction_activation_links();

do $$
declare
  row_record record;
  fallback_program_id uuid;
begin
  for row_record in
    select distinct i.organization_id, i.cycle_instance_id
    from app.initiatives i
    where i.program_id is null
  loop
    insert into app.strategy_programs (
      organization_id,
      cycle_instance_id,
      title,
      description
    )
    values (
      row_record.organization_id,
      row_record.cycle_instance_id,
      'Legacy Program',
      'Auto-created during v3 migration'
    )
    on conflict (cycle_instance_id, title) do nothing;

    select id into fallback_program_id
    from app.strategy_programs
    where organization_id = row_record.organization_id
      and cycle_instance_id = row_record.cycle_instance_id
      and title = 'Legacy Program'
    order by created_at asc
    limit 1;

    if fallback_program_id is not null then
      update app.initiatives
      set program_id = fallback_program_id
      where organization_id = row_record.organization_id
        and cycle_instance_id = row_record.cycle_instance_id
        and program_id is null;
    end if;
  end loop;
end $$;

alter table app.initiatives
  alter column program_id set not null;

grant select, insert, update, delete on app.strategy_programs to authenticated;
grant select on app.strategy_programs to anon;
grant select, insert, update, delete on app.cluster_objective_relations to authenticated;
grant select on app.cluster_objective_relations to anon;
grant select, insert, update, delete on app.strategic_direction_cluster_links to authenticated;
grant select on app.strategic_direction_cluster_links to anon;
grant select, insert, update, delete on app.strategic_direction_objective_links to authenticated;
grant select on app.strategic_direction_objective_links to anon;
grant select, insert, update, delete on app.strategic_direction_gap_links to authenticated;
grant select on app.strategic_direction_gap_links to anon;

alter table app.strategy_programs enable row level security;
alter table app.cluster_objective_relations enable row level security;
alter table app.strategic_direction_cluster_links enable row level security;
alter table app.strategic_direction_objective_links enable row level security;
alter table app.strategic_direction_gap_links enable row level security;

drop policy if exists strategy_programs_select on app.strategy_programs;
create policy strategy_programs_select on app.strategy_programs
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategy_programs_modify on app.strategy_programs;
create policy strategy_programs_modify on app.strategy_programs
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists cluster_objective_relations_select on app.cluster_objective_relations;
create policy cluster_objective_relations_select on app.cluster_objective_relations
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists cluster_objective_relations_modify on app.cluster_objective_relations;
create policy cluster_objective_relations_modify on app.cluster_objective_relations
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists strategic_direction_cluster_links_select on app.strategic_direction_cluster_links;
create policy strategic_direction_cluster_links_select on app.strategic_direction_cluster_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategic_direction_cluster_links_modify on app.strategic_direction_cluster_links;
create policy strategic_direction_cluster_links_modify on app.strategic_direction_cluster_links
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists strategic_direction_objective_links_select on app.strategic_direction_objective_links;
create policy strategic_direction_objective_links_select on app.strategic_direction_objective_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategic_direction_objective_links_modify on app.strategic_direction_objective_links;
create policy strategic_direction_objective_links_modify on app.strategic_direction_objective_links
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists strategic_direction_gap_links_select on app.strategic_direction_gap_links;
create policy strategic_direction_gap_links_select on app.strategic_direction_gap_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategic_direction_gap_links_modify on app.strategic_direction_gap_links;
create policy strategic_direction_gap_links_modify on app.strategic_direction_gap_links
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

-- migrate:down
drop policy if exists strategic_direction_gap_links_modify on app.strategic_direction_gap_links;
drop policy if exists strategic_direction_gap_links_select on app.strategic_direction_gap_links;
drop policy if exists strategic_direction_objective_links_modify on app.strategic_direction_objective_links;
drop policy if exists strategic_direction_objective_links_select on app.strategic_direction_objective_links;
drop policy if exists strategic_direction_cluster_links_modify on app.strategic_direction_cluster_links;
drop policy if exists strategic_direction_cluster_links_select on app.strategic_direction_cluster_links;
drop policy if exists cluster_objective_relations_modify on app.cluster_objective_relations;
drop policy if exists cluster_objective_relations_select on app.cluster_objective_relations;
drop policy if exists strategy_programs_modify on app.strategy_programs;
drop policy if exists strategy_programs_select on app.strategy_programs;

drop trigger if exists trg_sync_cycles_strategic_direction_gap_links on app.strategic_direction_gap_links;
drop trigger if exists trg_sync_cycles_strategic_direction_objective_links on app.strategic_direction_objective_links;
drop trigger if exists trg_sync_cycles_strategic_direction_cluster_links on app.strategic_direction_cluster_links;
drop trigger if exists trg_sync_cycles_cluster_objective_relations on app.cluster_objective_relations;
drop trigger if exists trg_sync_cycles_strategy_programs on app.strategy_programs;
drop trigger if exists trg_enforce_direction_activation_links on app.strategic_directions;

drop function if exists app.enforce_direction_activation_links();

drop table if exists app.strategic_direction_gap_links;
drop table if exists app.strategic_direction_objective_links;
drop table if exists app.strategic_direction_cluster_links;
drop table if exists app.cluster_objective_relations;
drop table if exists app.strategy_programs;

alter table app.initiatives
  drop column if exists deliverables,
  drop column if exists linked_okrs,
  drop column if exists program_id;

alter table app.objectives
  drop constraint if exists objectives_importance_score_check,
  drop column if exists importance_score,
  drop column if exists time_horizon;

alter table app.strategic_directions
  drop constraint if exists strategic_directions_feasibility_score_check,
  drop constraint if exists strategic_directions_capability_fit_score_check,
  drop constraint if exists strategic_directions_strategic_value_score_check,
  drop column if exists direction_score,
  drop column if exists feasibility_score,
  drop column if exists capability_fit_score,
  drop column if exists strategic_value_score;

alter table app.strategic_challenges
  drop constraint if exists strategic_challenges_root_cause_score_check,
  drop constraint if exists strategic_challenges_scope_score_check,
  drop constraint if exists strategic_challenges_urgency_score_check,
  drop constraint if exists strategic_challenges_impact_score_check,
  drop column if exists challenge_score,
  drop column if exists root_cause_score,
  drop column if exists scope_score,
  drop column if exists urgency_score,
  drop column if exists impact_score,
  drop column if exists description;
