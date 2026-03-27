-- 0107_audit_trigger_bypass_rls_for_writes.sql
-- audit.log_row_change inserted als Session-Rolle (z.B. authenticated) in audit.revisions.
-- Unter manchen Postgres-/RLS-Konstellationen schlagen INSERT-Policies trotz WITH CHECK (true) fehl
-- (42501 auf "revisions"). SECURITY DEFINER + row_security=off fuer die Funktionsausfuehrung
-- schreibt nur den Audit-Pfad; Session-nutzer lautet weiterhin fuer auth.uid() (Akteur).
-- migrate:up

create or replace function audit.start_revision(
  p_organization_id uuid,
  p_actor_membership_id uuid default null,
  p_reason text default null,
  p_source text default 'api'
)
returns bigint
language plpgsql
security definer
set search_path = public, app, audit, rbac, auth
set row_security = off
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
security definer
set search_path = public, app, audit, rbac, auth
set row_security = off
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

alter function audit.start_revision(uuid, uuid, text, text) owner to postgres;
alter function audit.log_row_change() owner to postgres;

-- migrate:down
-- Funktionen ohne Bypass wiederherstellen: 0004_revision_audit.sql erneut anwenden oder manuell zuruecksetzen.
