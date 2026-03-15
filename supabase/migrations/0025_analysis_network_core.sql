-- 0025_analysis_network_core.sql
-- Core relational model for analysis network (no vector DB).
-- migrate:up

create table if not exists app.analysis_links_draft (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  source_entry_id uuid not null references app.analysis_entries(id) on delete cascade,
  target_entry_id uuid not null references app.analysis_entries(id) on delete cascade,
  link_type text not null check (
    link_type in ('reinforces', 'contradicts', 'causes', 'depends_on', 'same_driver', 'overlaps')
  ),
  strength smallint not null default 3 check (strength between 1 and 5),
  confidence numeric(5,4) not null default 0.5000 check (confidence >= 0 and confidence <= 1),
  rationale text,
  origin text not null default 'hybrid' check (origin in ('rule', 'llm', 'hybrid', 'manual')),
  provider text,
  model text,
  prompt_version text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  reviewed_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (source_entry_id <> target_entry_id),
  unique (planning_cycle_id, source_entry_id, target_entry_id, link_type)
);

create index if not exists idx_analysis_links_draft_org_cycle
  on app.analysis_links_draft (organization_id, planning_cycle_id, status);

drop trigger if exists trg_analysis_links_draft_updated_at on app.analysis_links_draft;
create trigger trg_analysis_links_draft_updated_at
before update on app.analysis_links_draft
for each row execute function app.set_updated_at();

create table if not exists app.analysis_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  source_entry_id uuid not null references app.analysis_entries(id) on delete cascade,
  target_entry_id uuid not null references app.analysis_entries(id) on delete cascade,
  link_type text not null check (
    link_type in ('reinforces', 'contradicts', 'causes', 'depends_on', 'same_driver', 'overlaps')
  ),
  strength smallint not null default 3 check (strength between 1 and 5),
  confidence numeric(5,4) not null default 0.5000 check (confidence >= 0 and confidence <= 1),
  rationale text,
  source_draft_id uuid references app.analysis_links_draft(id) on delete set null,
  activated_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (source_entry_id <> target_entry_id),
  unique (planning_cycle_id, source_entry_id, target_entry_id, link_type)
);

create index if not exists idx_analysis_links_org_cycle
  on app.analysis_links (organization_id, planning_cycle_id);

drop trigger if exists trg_analysis_links_updated_at on app.analysis_links;
create trigger trg_analysis_links_updated_at
before update on app.analysis_links
for each row execute function app.set_updated_at();

create table if not exists app.analysis_clusters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  label text not null,
  summary text,
  cluster_score numeric(8,4) not null default 0,
  method text not null default 'graph-v1',
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_analysis_clusters_org_cycle
  on app.analysis_clusters (organization_id, planning_cycle_id, cluster_score desc);

drop trigger if exists trg_analysis_clusters_updated_at on app.analysis_clusters;
create trigger trg_analysis_clusters_updated_at
before update on app.analysis_clusters
for each row execute function app.set_updated_at();

create table if not exists app.analysis_cluster_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  cluster_id uuid not null references app.analysis_clusters(id) on delete cascade,
  entry_id uuid not null references app.analysis_entries(id) on delete cascade,
  membership_strength numeric(5,4) not null default 0.5 check (membership_strength >= 0 and membership_strength <= 1),
  created_at timestamptz not null default now(),
  unique (cluster_id, entry_id)
);

create index if not exists idx_analysis_cluster_members_org_cycle
  on app.analysis_cluster_members (organization_id, planning_cycle_id, cluster_id);

create table if not exists app.analysis_gap_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  dimension text not null,
  gap_type text not null check (
    gap_type in ('coverage', 'connectivity', 'traceability', 'evidence')
  ),
  severity smallint not null default 3 check (severity between 1 and 5),
  recommendation text not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'resolved')),
  related_cluster_id uuid references app.analysis_clusters(id) on delete set null,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_analysis_gap_findings_org_cycle
  on app.analysis_gap_findings (organization_id, planning_cycle_id, severity desc, status);

drop trigger if exists trg_analysis_gap_findings_updated_at on app.analysis_gap_findings;
create trigger trg_analysis_gap_findings_updated_at
before update on app.analysis_gap_findings
for each row execute function app.set_updated_at();

-- migrate:down
drop trigger if exists trg_analysis_gap_findings_updated_at on app.analysis_gap_findings;
drop trigger if exists trg_analysis_clusters_updated_at on app.analysis_clusters;
drop trigger if exists trg_analysis_links_updated_at on app.analysis_links;
drop trigger if exists trg_analysis_links_draft_updated_at on app.analysis_links_draft;
drop table if exists app.analysis_gap_findings;
drop table if exists app.analysis_cluster_members;
drop table if exists app.analysis_clusters;
drop table if exists app.analysis_links;
drop table if exists app.analysis_links_draft;
