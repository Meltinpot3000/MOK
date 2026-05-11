-- 0131_ai_assistant_core.sql
-- Sentinel Assistant MVP: Conversations, Messages, Agent Runs, Tool Calls,
-- Context Sources, Admin Settings sowie additive Felder auf llm_usage_events.
-- migrate:up

-- ---------------------------------------------------------------------------
-- 1) Additive Korrelationsfelder auf app.llm_usage_events
-- ---------------------------------------------------------------------------

alter table app.llm_usage_events
  add column if not exists sub_feature text,
  add column if not exists related_entity_type text,
  add column if not exists related_entity_id uuid,
  add column if not exists agent_run_id uuid;

create index if not exists idx_llm_usage_events_agent_run
  on app.llm_usage_events (agent_run_id)
  where agent_run_id is not null;

create index if not exists idx_llm_usage_events_feature_subfeature
  on app.llm_usage_events (organization_id, feature, sub_feature, created_at desc);

-- ---------------------------------------------------------------------------
-- 2) RBAC: neue Permissions fuer Sentinel
-- ---------------------------------------------------------------------------

insert into rbac.permissions (code, name, description)
values
  (
    'nav.ai-assistant.read',
    'Sidebar Sentinel Assistant Read',
    'Sidebar-Sichtbarkeit und lesender API-Zugriff fuer Sentinel Assistant'
  ),
  (
    'ai.assistant.use',
    'Sentinel Assistant Use',
    'Eigene Konversationen und Nachrichten erstellen, Chat fuehren'
  ),
  (
    'ai.admin_settings.write',
    'Sentinel Admin Settings Write',
    'Admin-Konfiguration fuer Sentinel Assistant aendern (ai_admin_settings)'
  )
on conflict (code) do nothing;

-- nav.ai-assistant.read + ai.assistant.use an alle Standard-Rollen, die das System nutzen.
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('nav.ai-assistant.read', 'ai.assistant.use')
where r.code in ('org_admin', 'executive', 'department_lead', 'team_member')
on conflict (role_id, permission_id) do nothing;

-- ai.admin_settings.write nur an org_admin.
insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code = 'ai.admin_settings.write'
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3) app.ai_conversations
-- ---------------------------------------------------------------------------

create table if not exists app.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  created_by_user_id uuid not null,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  title text,
  status text not null default 'active' check (status in ('active', 'archived')),
  -- MVP-Vorbereitungsfelder fuer Phase 2 (Team-Konversationen, Object-Linked-Chats):
  visibility text not null default 'private' check (visibility in ('private', 'team', 'shared')),
  linked_object_type text,
  linked_object_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_conversations_org_user_created
  on app.ai_conversations (organization_id, created_by_user_id, created_at desc);

create index if not exists idx_ai_conversations_org_linked_object
  on app.ai_conversations (organization_id, linked_object_type, linked_object_id)
  where linked_object_id is not null;

drop trigger if exists trg_ai_conversations_updated_at on app.ai_conversations;
create trigger trg_ai_conversations_updated_at
before update on app.ai_conversations
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.ai_conversations to authenticated;

alter table app.ai_conversations enable row level security;

-- MVP: nur eigene Konversationen sichtbar. Phase 2: visibility/linked_object_* freischalten.
drop policy if exists ai_conversations_select on app.ai_conversations;
create policy ai_conversations_select on app.ai_conversations
for select using (
  app.has_permission(organization_id, 'nav.ai-assistant.read')
  and created_by_user_id = app.current_user_id()
);

drop policy if exists ai_conversations_modify on app.ai_conversations;
create policy ai_conversations_modify on app.ai_conversations
for all using (
  app.has_permission(organization_id, 'ai.assistant.use')
  and created_by_user_id = app.current_user_id()
)
with check (
  app.has_permission(organization_id, 'ai.assistant.use')
  and created_by_user_id = app.current_user_id()
);

-- ---------------------------------------------------------------------------
-- 4) app.ai_messages (role ohne 'tool' - Tool-Calls leben in ai_tool_calls)
-- ---------------------------------------------------------------------------

create table if not exists app.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references app.ai_conversations(id) on delete cascade,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_conversation_created
  on app.ai_messages (conversation_id, created_at);

create index if not exists idx_ai_messages_org_created
  on app.ai_messages (organization_id, created_at desc);

grant select, insert, update, delete on app.ai_messages to authenticated;

alter table app.ai_messages enable row level security;

drop policy if exists ai_messages_select on app.ai_messages;
create policy ai_messages_select on app.ai_messages
for select using (
  exists (
    select 1
    from app.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.organization_id = ai_messages.organization_id
      and app.has_permission(c.organization_id, 'nav.ai-assistant.read')
      and c.created_by_user_id = app.current_user_id()
  )
);

drop policy if exists ai_messages_modify on app.ai_messages;
create policy ai_messages_modify on app.ai_messages
for all using (
  exists (
    select 1
    from app.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.organization_id = ai_messages.organization_id
      and app.has_permission(c.organization_id, 'ai.assistant.use')
      and c.created_by_user_id = app.current_user_id()
  )
)
with check (
  exists (
    select 1
    from app.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.organization_id = ai_messages.organization_id
      and app.has_permission(c.organization_id, 'ai.assistant.use')
      and c.created_by_user_id = app.current_user_id()
  )
);

-- ---------------------------------------------------------------------------
-- 5) app.ai_agent_runs
-- ---------------------------------------------------------------------------

create table if not exists app.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references app.ai_conversations(id) on delete cascade,
  message_id uuid references app.ai_messages(id) on delete set null,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  user_id uuid not null,
  membership_id uuid references app.organization_memberships(id) on delete set null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'blocked')),
  task_type text,
  domains text[] not null default '{}',
  sentinel_plan jsonb,
  model_tier text,
  provider text,
  requires_web_search boolean not null default false,
  requires_frontier_model boolean not null default false,
  sensitive_data_detected boolean not null default false,
  error_message text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_ai_agent_runs_org_created
  on app.ai_agent_runs (organization_id, created_at desc);

create index if not exists idx_ai_agent_runs_conversation
  on app.ai_agent_runs (conversation_id, created_at desc);

create index if not exists idx_ai_agent_runs_user_created
  on app.ai_agent_runs (organization_id, user_id, created_at desc);

grant select, insert, update, delete on app.ai_agent_runs to authenticated;

alter table app.ai_agent_runs enable row level security;

drop policy if exists ai_agent_runs_select on app.ai_agent_runs;
create policy ai_agent_runs_select on app.ai_agent_runs
for select using (
  app.has_permission(organization_id, 'nav.ai-assistant.read')
  and user_id = app.current_user_id()
);

drop policy if exists ai_agent_runs_modify on app.ai_agent_runs;
create policy ai_agent_runs_modify on app.ai_agent_runs
for all using (
  app.has_permission(organization_id, 'ai.assistant.use')
  and user_id = app.current_user_id()
)
with check (
  app.has_permission(organization_id, 'ai.assistant.use')
  and user_id = app.current_user_id()
);

-- ---------------------------------------------------------------------------
-- 6) app.ai_tool_calls
-- ---------------------------------------------------------------------------

create table if not exists app.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references app.ai_agent_runs(id) on delete cascade,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  tool_name text not null,
  tool_domain text,
  input_payload jsonb not null default '{}'::jsonb,
  output_summary text,
  success boolean not null,
  permission_result jsonb,
  error_message text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_tool_calls_agent_run_created
  on app.ai_tool_calls (agent_run_id, created_at);

create index if not exists idx_ai_tool_calls_org_tool_created
  on app.ai_tool_calls (organization_id, tool_name, created_at desc);

grant select, insert, update, delete on app.ai_tool_calls to authenticated;

alter table app.ai_tool_calls enable row level security;

drop policy if exists ai_tool_calls_select on app.ai_tool_calls;
create policy ai_tool_calls_select on app.ai_tool_calls
for select using (
  exists (
    select 1
    from app.ai_agent_runs r
    where r.id = ai_tool_calls.agent_run_id
      and r.organization_id = ai_tool_calls.organization_id
      and app.has_permission(r.organization_id, 'nav.ai-assistant.read')
      and r.user_id = app.current_user_id()
  )
);

drop policy if exists ai_tool_calls_modify on app.ai_tool_calls;
create policy ai_tool_calls_modify on app.ai_tool_calls
for all using (
  exists (
    select 1
    from app.ai_agent_runs r
    where r.id = ai_tool_calls.agent_run_id
      and r.organization_id = ai_tool_calls.organization_id
      and app.has_permission(r.organization_id, 'ai.assistant.use')
      and r.user_id = app.current_user_id()
  )
)
with check (
  exists (
    select 1
    from app.ai_agent_runs r
    where r.id = ai_tool_calls.agent_run_id
      and r.organization_id = ai_tool_calls.organization_id
      and app.has_permission(r.organization_id, 'ai.assistant.use')
      and r.user_id = app.current_user_id()
  )
);

-- ---------------------------------------------------------------------------
-- 7) app.ai_context_sources (source_id als TEXT fuer externe/zusammengesetzte IDs)
-- ---------------------------------------------------------------------------

create table if not exists app.ai_context_sources (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references app.ai_agent_runs(id) on delete cascade,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  source_type text not null,
  source_id text,
  source_title text,
  relevance_score numeric(6, 3),
  classification text not null default 'internal'
    check (classification in ('public', 'internal', 'confidential', 'restricted')),
  source_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_context_sources_agent_run
  on app.ai_context_sources (agent_run_id);

create index if not exists idx_ai_context_sources_org_type
  on app.ai_context_sources (organization_id, source_type, created_at desc);

grant select, insert, update, delete on app.ai_context_sources to authenticated;

alter table app.ai_context_sources enable row level security;

drop policy if exists ai_context_sources_select on app.ai_context_sources;
create policy ai_context_sources_select on app.ai_context_sources
for select using (
  exists (
    select 1
    from app.ai_agent_runs r
    where r.id = ai_context_sources.agent_run_id
      and r.organization_id = ai_context_sources.organization_id
      and app.has_permission(r.organization_id, 'nav.ai-assistant.read')
      and r.user_id = app.current_user_id()
  )
);

drop policy if exists ai_context_sources_modify on app.ai_context_sources;
create policy ai_context_sources_modify on app.ai_context_sources
for all using (
  exists (
    select 1
    from app.ai_agent_runs r
    where r.id = ai_context_sources.agent_run_id
      and r.organization_id = ai_context_sources.organization_id
      and app.has_permission(r.organization_id, 'ai.assistant.use')
      and r.user_id = app.current_user_id()
  )
)
with check (
  exists (
    select 1
    from app.ai_agent_runs r
    where r.id = ai_context_sources.agent_run_id
      and r.organization_id = ai_context_sources.organization_id
      and app.has_permission(r.organization_id, 'ai.assistant.use')
      and r.user_id = app.current_user_id()
  )
);

-- ---------------------------------------------------------------------------
-- 8) app.ai_admin_settings (eine Zeile pro Organisation; Sentinel-Toggles only)
-- ---------------------------------------------------------------------------

create table if not exists app.ai_admin_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references app.organizations(id) on delete cascade,
  ai_enabled boolean not null default false,
  local_llm_enabled boolean not null default true,
  external_models_enabled boolean not null default false,
  web_search_enabled boolean not null default false,
  write_actions_enabled boolean not null default false,
  require_human_approval boolean not null default true,
  default_local_model text,
  default_fast_model text,
  default_frontier_model text,
  max_tool_calls_per_run integer not null default 8 check (max_tool_calls_per_run between 1 and 64),
  max_context_objects integer not null default 30 check (max_context_objects between 1 and 500),
  log_prompts boolean not null default true,
  log_responses boolean not null default true,
  log_tool_calls boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_ai_admin_settings_updated_at on app.ai_admin_settings;
create trigger trg_ai_admin_settings_updated_at
before update on app.ai_admin_settings
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.ai_admin_settings to authenticated;

alter table app.ai_admin_settings enable row level security;

-- Lesen darf jeder, der den Assistant ueberhaupt sehen darf (Status fuer UI sichtbar machen).
drop policy if exists ai_admin_settings_select on app.ai_admin_settings;
create policy ai_admin_settings_select on app.ai_admin_settings
for select using (
  app.has_permission(organization_id, 'nav.ai-assistant.read')
);

-- Schreiben/Anlegen/Loeschen nur mit ai.admin_settings.write.
drop policy if exists ai_admin_settings_modify on app.ai_admin_settings;
create policy ai_admin_settings_modify on app.ai_admin_settings
for all using (
  app.has_permission(organization_id, 'ai.admin_settings.write')
)
with check (
  app.has_permission(organization_id, 'ai.admin_settings.write')
);

-- ---------------------------------------------------------------------------
-- migrate:down
-- ---------------------------------------------------------------------------

drop policy if exists ai_admin_settings_modify on app.ai_admin_settings;
drop policy if exists ai_admin_settings_select on app.ai_admin_settings;
drop trigger if exists trg_ai_admin_settings_updated_at on app.ai_admin_settings;
drop table if exists app.ai_admin_settings;

drop policy if exists ai_context_sources_modify on app.ai_context_sources;
drop policy if exists ai_context_sources_select on app.ai_context_sources;
drop table if exists app.ai_context_sources;

drop policy if exists ai_tool_calls_modify on app.ai_tool_calls;
drop policy if exists ai_tool_calls_select on app.ai_tool_calls;
drop table if exists app.ai_tool_calls;

drop policy if exists ai_agent_runs_modify on app.ai_agent_runs;
drop policy if exists ai_agent_runs_select on app.ai_agent_runs;
drop table if exists app.ai_agent_runs;

drop policy if exists ai_messages_modify on app.ai_messages;
drop policy if exists ai_messages_select on app.ai_messages;
drop table if exists app.ai_messages;

drop policy if exists ai_conversations_modify on app.ai_conversations;
drop policy if exists ai_conversations_select on app.ai_conversations;
drop trigger if exists trg_ai_conversations_updated_at on app.ai_conversations;
drop table if exists app.ai_conversations;

delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions
  where code in ('nav.ai-assistant.read', 'ai.assistant.use', 'ai.admin_settings.write')
);

delete from rbac.permissions
where code in ('nav.ai-assistant.read', 'ai.assistant.use', 'ai.admin_settings.write');

drop index if exists idx_llm_usage_events_feature_subfeature;
drop index if exists idx_llm_usage_events_agent_run;

alter table app.llm_usage_events drop column if exists agent_run_id;
alter table app.llm_usage_events drop column if exists related_entity_id;
alter table app.llm_usage_events drop column if exists related_entity_type;
alter table app.llm_usage_events drop column if exists sub_feature;
