-- 0040_llm_usage_and_challenge_candidates.sql
-- LLM usage tracking and challenge candidate workspace.
-- migrate:up

insert into rbac.permissions (code, name, description)
values
  ('nav.llm-usage.read', 'Sidebar LLM Usage Read', 'Read access to LLM usage analytics'),
  ('nav.llm-usage.write', 'Sidebar LLM Usage Write', 'Write access to LLM usage analytics')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('nav.llm-usage.read', 'nav.llm-usage.write')
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('nav.llm-usage.read')
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

create table if not exists app.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid references app.cycle_instances(id) on delete set null,
  feature text not null,
  provider text not null,
  model text not null,
  prompt_version text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  billable_cost numeric(12,6),
  usage_missing boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (prompt_tokens is null or prompt_tokens >= 0),
  check (completion_tokens is null or completion_tokens >= 0),
  check (total_tokens is null or total_tokens >= 0)
);

create index if not exists idx_llm_usage_events_org_created
  on app.llm_usage_events (organization_id, created_at desc);
create index if not exists idx_llm_usage_events_feature_created
  on app.llm_usage_events (organization_id, feature, created_at desc);

drop trigger if exists trg_llm_usage_events_updated_at on app.llm_usage_events;
create trigger trg_llm_usage_events_updated_at
before update on app.llm_usage_events
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.llm_usage_events to authenticated;
grant select on app.llm_usage_events to anon;
alter table app.llm_usage_events enable row level security;

drop policy if exists llm_usage_events_select on app.llm_usage_events;
create policy llm_usage_events_select on app.llm_usage_events
for select using (
  app.has_permission(organization_id, 'nav.llm-usage.read')
);

drop policy if exists llm_usage_events_modify on app.llm_usage_events;
create policy llm_usage_events_modify on app.llm_usage_events
for all using (
  app.has_permission(organization_id, 'nav.llm-usage.write')
)
with check (
  app.has_permission(organization_id, 'nav.llm-usage.write')
);

create table if not exists app.analysis_challenge_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  title text not null,
  description text,
  priority smallint not null default 3 check (priority between 1 and 5),
  source_type text not null check (source_type in ('cluster', 'gap')),
  source_ref text not null,
  status text not null default 'draft' check (status in ('draft', 'promoted', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_instance_id, source_type, source_ref, title)
);

create index if not exists idx_analysis_challenge_candidates_org_cycle
  on app.analysis_challenge_candidates (organization_id, cycle_instance_id, status, priority desc);

drop trigger if exists trg_analysis_challenge_candidates_updated_at on app.analysis_challenge_candidates;
create trigger trg_analysis_challenge_candidates_updated_at
before update on app.analysis_challenge_candidates
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.analysis_challenge_candidates to authenticated;
grant select on app.analysis_challenge_candidates to anon;
alter table app.analysis_challenge_candidates enable row level security;

drop policy if exists analysis_challenge_candidates_select on app.analysis_challenge_candidates;
create policy analysis_challenge_candidates_select on app.analysis_challenge_candidates
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
);

drop policy if exists analysis_challenge_candidates_modify on app.analysis_challenge_candidates;
create policy analysis_challenge_candidates_modify on app.analysis_challenge_candidates
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
);

-- migrate:down
drop policy if exists analysis_challenge_candidates_modify on app.analysis_challenge_candidates;
drop policy if exists analysis_challenge_candidates_select on app.analysis_challenge_candidates;
drop trigger if exists trg_analysis_challenge_candidates_updated_at on app.analysis_challenge_candidates;
drop table if exists app.analysis_challenge_candidates;

drop policy if exists llm_usage_events_modify on app.llm_usage_events;
drop policy if exists llm_usage_events_select on app.llm_usage_events;
drop trigger if exists trg_llm_usage_events_updated_at on app.llm_usage_events;
drop table if exists app.llm_usage_events;

delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions where code in ('nav.llm-usage.read', 'nav.llm-usage.write')
);

delete from rbac.permissions
where code in ('nav.llm-usage.read', 'nav.llm-usage.write');
