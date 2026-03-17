-- 0041_llm_model_health_status.sql
-- Persisted model availability health for LLM providers.
-- migrate:up

create table if not exists app.llm_model_health_status (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  feature text not null,
  provider text not null check (provider in ('gemini', 'groq')),
  model text not null,
  status text not null check (status in ('healthy', 'degraded', 'down')),
  fallback_active boolean not null default false,
  fallback_mode text not null default 'none' check (fallback_mode in ('none', 'groq', 'rule')),
  latency_ms integer,
  http_status integer,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature)
);

create index if not exists idx_llm_model_health_status_org_checked
  on app.llm_model_health_status (organization_id, checked_at desc);
create index if not exists idx_llm_model_health_status_org_status
  on app.llm_model_health_status (organization_id, status);

drop trigger if exists trg_llm_model_health_status_updated_at on app.llm_model_health_status;
create trigger trg_llm_model_health_status_updated_at
before update on app.llm_model_health_status
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.llm_model_health_status to authenticated;
grant select on app.llm_model_health_status to anon;
alter table app.llm_model_health_status enable row level security;

drop policy if exists llm_model_health_status_select on app.llm_model_health_status;
create policy llm_model_health_status_select on app.llm_model_health_status
for select using (
  app.has_permission(organization_id, 'nav.llm-usage.read')
);

drop policy if exists llm_model_health_status_modify on app.llm_model_health_status;
create policy llm_model_health_status_modify on app.llm_model_health_status
for all using (
  app.has_permission(organization_id, 'nav.llm-usage.write')
)
with check (
  app.has_permission(organization_id, 'nav.llm-usage.write')
);

-- migrate:down
drop policy if exists llm_model_health_status_modify on app.llm_model_health_status;
drop policy if exists llm_model_health_status_select on app.llm_model_health_status;
drop trigger if exists trg_llm_model_health_status_updated_at on app.llm_model_health_status;
drop table if exists app.llm_model_health_status;
