-- 0129_strategic_challenge_analysis_entries.sql
-- Many-to-many: strategische Herausforderungen ↔ Analyse-Einträge (Zyklus).
-- migrate:up

create table if not exists app.strategic_challenge_analysis_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  strategic_challenge_id uuid not null references app.strategic_challenges(id) on delete cascade,
  analysis_entry_id uuid not null references app.analysis_entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cycle_instance_id, strategic_challenge_id, analysis_entry_id),
  unique (cycle_instance_id, analysis_entry_id)
);

create index if not exists idx_strategic_challenge_analysis_entries_org_cycle
  on app.strategic_challenge_analysis_entries (organization_id, cycle_instance_id);

create index if not exists idx_strategic_challenge_analysis_entries_challenge
  on app.strategic_challenge_analysis_entries (strategic_challenge_id);

drop trigger if exists trg_sync_cycles_strategic_challenge_analysis_entries
  on app.strategic_challenge_analysis_entries;
create trigger trg_sync_cycles_strategic_challenge_analysis_entries
before insert or update on app.strategic_challenge_analysis_entries
for each row execute function app.sync_legacy_cycle_columns();

insert into app.strategic_challenge_analysis_entries (
  organization_id,
  planning_cycle_id,
  cycle_instance_id,
  strategic_challenge_id,
  analysis_entry_id
)
select
  sc.organization_id,
  sc.planning_cycle_id,
  sc.cycle_instance_id,
  sc.id,
  sc.source_analysis_entry_id
from app.strategic_challenges sc
where sc.source_analysis_entry_id is not null
on conflict (cycle_instance_id, analysis_entry_id) do nothing;

grant select, insert, update, delete on app.strategic_challenge_analysis_entries to authenticated;
grant select on app.strategic_challenge_analysis_entries to anon;

alter table app.strategic_challenge_analysis_entries enable row level security;

drop policy if exists strategic_challenge_analysis_entries_select on app.strategic_challenge_analysis_entries;
create policy strategic_challenge_analysis_entries_select on app.strategic_challenge_analysis_entries
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'nav.strategy-cycle.read')
);

drop policy if exists strategic_challenge_analysis_entries_modify on app.strategic_challenge_analysis_entries;
create policy strategic_challenge_analysis_entries_modify on app.strategic_challenge_analysis_entries
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'nav.strategy-cycle.write')
);

-- migrate:down

drop policy if exists strategic_challenge_analysis_entries_modify on app.strategic_challenge_analysis_entries;
drop policy if exists strategic_challenge_analysis_entries_select on app.strategic_challenge_analysis_entries;

drop trigger if exists trg_sync_cycles_strategic_challenge_analysis_entries
  on app.strategic_challenge_analysis_entries;

drop table if exists app.strategic_challenge_analysis_entries;
