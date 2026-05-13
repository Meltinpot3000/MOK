-- 0133_repair_sentinel_map_workspace.sql
-- Repair: schema_migrations kann 0131/0132 als angewendet führen, ohne dass Objekte existieren.
-- Idempotent, nicht destruktiv (kein DROP, kein TRUNCATE), keine Datenüberschreibung.
-- migrate:up

create schema if not exists sentinel_map;

create table if not exists sentinel_map.map_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references app.organizations (id) on delete set null,
  triggered_by_membership_id uuid references app.organization_memberships (id) on delete set null,
  status text not null default 'drafting',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  model_provider text,
  model_name text,
  schema_hash text,
  error text,
  check (
    status in ('drafting', 'validating', 'completed', 'failed')
  )
);

create index if not exists idx_map_runs_org_started
  on sentinel_map.map_runs (organization_id, started_at desc);

create table if not exists sentinel_map.source_inventory (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references sentinel_map.map_runs (id) on delete cascade,
  inventory jsonb not null,
  schema_hash text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_source_inventory_run
  on sentinel_map.source_inventory (run_id);

create table if not exists sentinel_map.map_drafts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references sentinel_map.map_runs (id) on delete cascade,
  draft jsonb not null,
  raw_llm_text text,
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_map_drafts_run on sentinel_map.map_drafts (run_id, created_at desc);

create table if not exists sentinel_map.map_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references sentinel_map.map_runs (id) on delete set null,
  draft_id uuid references sentinel_map.map_drafts (id) on delete set null,
  organization_id uuid references app.organizations (id) on delete set null,
  is_active boolean not null default false,
  generated_at timestamptz not null default now(),
  model_provider text,
  model_name text,
  validation_summary jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now()
);

create unique index if not exists uq_map_snapshots_active_per_org
  on sentinel_map.map_snapshots (organization_id)
  where is_active and organization_id is not null;

create unique index if not exists uq_map_snapshots_active_global
  on sentinel_map.map_snapshots ((1))
  where is_active and organization_id is null;

create index if not exists idx_map_snapshots_org_generated
  on sentinel_map.map_snapshots (organization_id, generated_at desc);

create table if not exists sentinel_map.map_places (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references sentinel_map.map_snapshots (id) on delete cascade,
  place_key text not null,
  canonical_name text not null,
  domain text not null default '',
  business_meaning text not null default '',
  description_for_planner text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  validation_status text not null,
  confidence double precision not null default 0,
  check (
    validation_status in ('verified', 'inferred', 'unsupported')
  ),
  check (confidence >= 0 and confidence <= 1)
);

create unique index if not exists uq_map_places_snapshot_key
  on sentinel_map.map_places (snapshot_id, place_key);

create index if not exists idx_map_places_snapshot_status
  on sentinel_map.map_places (snapshot_id, validation_status);

create table if not exists sentinel_map.map_roads (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references sentinel_map.map_snapshots (id) on delete cascade,
  road_key text not null,
  from_place_key text not null,
  to_place_key text not null,
  business_meaning text not null default '',
  relation_type text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  validation_status text not null,
  confidence double precision not null default 0,
  check (
    validation_status in ('verified', 'inferred', 'unsupported', 'missing_tool')
  ),
  check (confidence >= 0 and confidence <= 1)
);

create unique index if not exists uq_map_roads_snapshot_key
  on sentinel_map.map_roads (snapshot_id, road_key);

create index if not exists idx_map_roads_snapshot_status
  on sentinel_map.map_roads (snapshot_id, validation_status);

create table if not exists sentinel_map.map_metadata (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references sentinel_map.map_snapshots (id) on delete cascade,
  meta_key text not null,
  meta_value jsonb not null default '{}'::jsonb,
  unique (snapshot_id, meta_key)
);

create table if not exists sentinel_map.validation_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references sentinel_map.map_runs (id) on delete set null,
  draft_id uuid not null references sentinel_map.map_drafts (id) on delete cascade,
  snapshot_id uuid references sentinel_map.map_snapshots (id) on delete set null,
  passed boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_validation_results_draft
  on sentinel_map.validation_results (draft_id, created_at desc);

create table if not exists sentinel_map.map_gaps (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references sentinel_map.map_drafts (id) on delete cascade,
  snapshot_id uuid references sentinel_map.map_snapshots (id) on delete cascade,
  gap_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_map_gaps_draft on sentinel_map.map_gaps (draft_id);
create index if not exists idx_map_gaps_snapshot on sentinel_map.map_gaps (snapshot_id);

alter table sentinel_map.map_runs enable row level security;
alter table sentinel_map.source_inventory enable row level security;
alter table sentinel_map.map_drafts enable row level security;
alter table sentinel_map.map_snapshots enable row level security;
alter table sentinel_map.map_places enable row level security;
alter table sentinel_map.map_roads enable row level security;
alter table sentinel_map.map_metadata enable row level security;
alter table sentinel_map.validation_results enable row level security;
alter table sentinel_map.map_gaps enable row level security;

-- 0132-Äquivalent: service_role (kein authenticated/anon)
grant usage on schema sentinel_map to service_role;

grant select, insert, update, delete on all tables in schema sentinel_map to service_role;
grant usage, select on all sequences in schema sentinel_map to service_role;

alter default privileges in schema sentinel_map
grant select, insert, update, delete on tables to service_role;
alter default privileges in schema sentinel_map
grant usage, select on sequences to service_role;

-- migrate:down
-- Repair-Migration: kein automatisches DROP (bewusst irreversibel über diesen Down-Pfad).
