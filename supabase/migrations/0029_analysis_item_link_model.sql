-- 0029_analysis_item_link_model.sql
-- Unified analysis item link model migration.
-- migrate:up

create table if not exists app.analysis_item_link_draft (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  source_analysis_item_id uuid not null references app.analysis_entries(id) on delete cascade,
  target_analysis_item_id uuid not null references app.analysis_entries(id) on delete cascade,
  link_type text not null check (
    link_type in ('related_to', 'causes', 'supports', 'contradicts', 'amplifies', 'depends_on', 'duplicates')
  ),
  strength smallint not null default 3 check (strength between 1 and 5),
  confidence numeric(5,4) not null default 0.5000 check (confidence >= 0 and confidence <= 1),
  comment text,
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
  check (source_analysis_item_id <> target_analysis_item_id),
  unique (planning_cycle_id, source_analysis_item_id, target_analysis_item_id, link_type)
);

create index if not exists idx_analysis_item_link_draft_org_cycle
  on app.analysis_item_link_draft (organization_id, planning_cycle_id, status);

drop trigger if exists trg_analysis_item_link_draft_updated_at on app.analysis_item_link_draft;
create trigger trg_analysis_item_link_draft_updated_at
before update on app.analysis_item_link_draft
for each row execute function app.set_updated_at();

create table if not exists app.analysis_item_link (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  source_analysis_item_id uuid not null references app.analysis_entries(id) on delete cascade,
  target_analysis_item_id uuid not null references app.analysis_entries(id) on delete cascade,
  link_type text not null check (
    link_type in ('related_to', 'causes', 'supports', 'contradicts', 'amplifies', 'depends_on', 'duplicates')
  ),
  strength smallint not null default 3 check (strength between 1 and 5),
  confidence numeric(5,4) not null default 0.5000 check (confidence >= 0 and confidence <= 1),
  comment text,
  source_draft_id uuid references app.analysis_item_link_draft(id) on delete set null,
  activated_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (source_analysis_item_id <> target_analysis_item_id),
  unique (planning_cycle_id, source_analysis_item_id, target_analysis_item_id, link_type)
);

create index if not exists idx_analysis_item_link_org_cycle
  on app.analysis_item_link (organization_id, planning_cycle_id);

drop trigger if exists trg_analysis_item_link_updated_at on app.analysis_item_link;
create trigger trg_analysis_item_link_updated_at
before update on app.analysis_item_link
for each row execute function app.set_updated_at();

insert into app.analysis_item_link_draft (
  organization_id,
  planning_cycle_id,
  source_analysis_item_id,
  target_analysis_item_id,
  link_type,
  strength,
  confidence,
  comment,
  origin,
  provider,
  model,
  prompt_version,
  status,
  created_by_membership_id,
  reviewed_by_membership_id,
  created_at,
  updated_at,
  reviewed_at,
  metadata
)
select
  d.organization_id,
  d.planning_cycle_id,
  d.source_entry_id,
  d.target_entry_id,
  case
    when d.link_type = 'causes' then 'causes'
    when d.link_type = 'contradicts' then 'contradicts'
    when d.link_type = 'depends_on' then 'depends_on'
    when d.link_type = 'reinforces' then 'supports'
    when d.link_type = 'same_driver' then 'related_to'
    when d.link_type = 'overlaps' then 'duplicates'
    else 'related_to'
  end,
  d.strength,
  d.confidence,
  d.rationale,
  d.origin,
  d.provider,
  d.model,
  d.prompt_version,
  d.status,
  d.created_by_membership_id,
  d.reviewed_by_membership_id,
  d.created_at,
  d.updated_at,
  d.reviewed_at,
  d.metadata
from app.analysis_links_draft d
on conflict (planning_cycle_id, source_analysis_item_id, target_analysis_item_id, link_type) do nothing;

insert into app.analysis_item_link (
  organization_id,
  planning_cycle_id,
  source_analysis_item_id,
  target_analysis_item_id,
  link_type,
  strength,
  confidence,
  comment,
  activated_by_membership_id,
  created_at,
  updated_at,
  metadata
)
select
  l.organization_id,
  l.planning_cycle_id,
  l.source_entry_id,
  l.target_entry_id,
  case
    when l.link_type = 'causes' then 'causes'
    when l.link_type = 'contradicts' then 'contradicts'
    when l.link_type = 'depends_on' then 'depends_on'
    when l.link_type = 'reinforces' then 'supports'
    when l.link_type = 'same_driver' then 'related_to'
    when l.link_type = 'overlaps' then 'duplicates'
    else 'related_to'
  end,
  l.strength,
  l.confidence,
  l.rationale,
  l.activated_by_membership_id,
  l.created_at,
  l.updated_at,
  l.metadata
from app.analysis_links l
on conflict (planning_cycle_id, source_analysis_item_id, target_analysis_item_id, link_type) do nothing;

-- migrate:down
drop trigger if exists trg_analysis_item_link_updated_at on app.analysis_item_link;
drop trigger if exists trg_analysis_item_link_draft_updated_at on app.analysis_item_link_draft;
drop table if exists app.analysis_item_link;
drop table if exists app.analysis_item_link_draft;
