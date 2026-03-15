-- 0016_analysis_entries_for_matrix_import.sql
-- Analysis pool as secondary source for strategy matrix imports.
-- migrate:up

create table if not exists app.analysis_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  analysis_type text not null check (
    analysis_type in ('environment', 'company', 'competitor', 'swot', 'pestel', 'workshop', 'other')
  ),
  sub_type text,
  title text not null,
  description text,
  impact_level smallint check (impact_level between 1 and 5),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_analysis_entries_org_cycle
  on app.analysis_entries (organization_id, planning_cycle_id);

drop trigger if exists trg_analysis_entries_updated_at on app.analysis_entries;
create trigger trg_analysis_entries_updated_at
before update on app.analysis_entries
for each row execute function app.set_updated_at();

alter table app.strategic_challenges
  add column if not exists source_analysis_entry_id uuid references app.analysis_entries(id) on delete set null;

grant select, insert, update, delete on app.analysis_entries to authenticated;
grant select on app.analysis_entries to anon;

alter table app.analysis_entries enable row level security;

drop policy if exists analysis_entries_select on app.analysis_entries;
create policy analysis_entries_select on app.analysis_entries
for select using (app.has_permission(organization_id, 'nav.strategy-matrix.read'));

drop policy if exists analysis_entries_modify on app.analysis_entries;
create policy analysis_entries_modify on app.analysis_entries
for all using (app.has_permission(organization_id, 'nav.strategy-matrix.write'))
with check (app.has_permission(organization_id, 'nav.strategy-matrix.write'));

-- migrate:down
drop policy if exists analysis_entries_modify on app.analysis_entries;
drop policy if exists analysis_entries_select on app.analysis_entries;
drop trigger if exists trg_analysis_entries_updated_at on app.analysis_entries;
drop table if exists app.analysis_entries;
