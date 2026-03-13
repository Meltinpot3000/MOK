-- 0004_revision_audit.sql
-- Revision and audit log model with automatic row-level logging.
-- migrate:up

create table if not exists audit.revisions (
  id bigint generated always as identity primary key,
  organization_id uuid references app.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_membership_id uuid references app.organization_memberships(id) on delete set null,
  source text not null default 'api',
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_revisions_org_created
  on audit.revisions (organization_id, created_at desc);

create table if not exists audit.revision_events (
  id bigint generated always as identity primary key,
  revision_id bigint not null references audit.revisions(id) on delete cascade,
  organization_id uuid references app.organizations(id) on delete cascade,
  table_schema text not null,
  table_name text not null,
  row_pk uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_revision_events_org_created
  on audit.revision_events (organization_id, created_at desc);

create index if not exists idx_revision_events_row_lookup
  on audit.revision_events (table_schema, table_name, row_pk, created_at desc);

create index if not exists idx_revision_events_payload_gin_before
  on audit.revision_events using gin (before_data);

create index if not exists idx_revision_events_payload_gin_after
  on audit.revision_events using gin (after_data);

create or replace function audit.start_revision(
  p_organization_id uuid,
  p_actor_membership_id uuid default null,
  p_reason text default null,
  p_source text default 'api'
)
returns bigint
language plpgsql
as $$
declare
  v_revision_id bigint;
  v_user_id uuid;
begin
  begin
    v_user_id := auth.uid();
  exception
    when others then
      v_user_id := null;
  end;

  insert into audit.revisions (
    organization_id,
    actor_user_id,
    actor_membership_id,
    source,
    reason
  )
  values (
    p_organization_id,
    v_user_id,
    p_actor_membership_id,
    p_source,
    p_reason
  )
  returning id into v_revision_id;

  perform set_config('app.current_revision_id', v_revision_id::text, true);
  return v_revision_id;
end;
$$;

create or replace function audit.log_row_change()
returns trigger
language plpgsql
as $$
declare
  v_revision_id bigint;
  v_revision_text text;
  v_action text;
  v_org_id uuid;
  v_row_pk uuid;
  v_user_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'INSERT';
    v_before := null;
    v_after := to_jsonb(new);
    v_org_id := (v_after ->> 'organization_id')::uuid;
    v_row_pk := (v_after ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    v_action := 'UPDATE';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_org_id := coalesce((v_after ->> 'organization_id')::uuid, (v_before ->> 'organization_id')::uuid);
    v_row_pk := coalesce((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid);
  else
    v_action := 'DELETE';
    v_before := to_jsonb(old);
    v_after := null;
    v_org_id := (v_before ->> 'organization_id')::uuid;
    v_row_pk := (v_before ->> 'id')::uuid;
  end if;

  v_revision_text := nullif(current_setting('app.current_revision_id', true), '');

  if v_revision_text is null then
    begin
      v_user_id := auth.uid();
    exception
      when others then
        v_user_id := null;
    end;

    insert into audit.revisions (organization_id, actor_user_id, source, reason)
    values (v_org_id, v_user_id, 'trigger', 'implicit row change')
    returning id into v_revision_id;
  else
    v_revision_id := v_revision_text::bigint;
  end if;

  insert into audit.revision_events (
    revision_id,
    organization_id,
    table_schema,
    table_name,
    row_pk,
    action,
    before_data,
    after_data
  )
  values (
    v_revision_id,
    v_org_id,
    tg_table_schema,
    tg_table_name,
    v_row_pk,
    v_action,
    v_before,
    v_after
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_planning_cycles on app.planning_cycles;
create trigger trg_audit_planning_cycles
after insert or update or delete on app.planning_cycles
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_strategic_goals on app.strategic_goals;
create trigger trg_audit_strategic_goals
after insert or update or delete on app.strategic_goals
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_functional_strategies on app.functional_strategies;
create trigger trg_audit_functional_strategies
after insert or update or delete on app.functional_strategies
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_objectives on app.objectives;
create trigger trg_audit_objectives
after insert or update or delete on app.objectives
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_key_results on app.key_results;
create trigger trg_audit_key_results
after insert or update or delete on app.key_results
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_entity_links on app.entity_links;
create trigger trg_audit_entity_links
after insert or update or delete on app.entity_links
for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_entity_links on app.entity_links;
drop trigger if exists trg_audit_key_results on app.key_results;
drop trigger if exists trg_audit_objectives on app.objectives;
drop trigger if exists trg_audit_functional_strategies on app.functional_strategies;
drop trigger if exists trg_audit_strategic_goals on app.strategic_goals;
drop trigger if exists trg_audit_planning_cycles on app.planning_cycles;
drop function if exists audit.log_row_change();
drop function if exists audit.start_revision(uuid, uuid, text, text);
drop table if exists audit.revision_events;
drop table if exists audit.revisions;
