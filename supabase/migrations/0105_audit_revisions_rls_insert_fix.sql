-- 0105_audit_revisions_rls_insert_fix.sql
-- Audit-Trigger (audit.log_row_change) schreibt in audit.revisions / audit.revision_events.
-- Fehlt die INSERT-Policy oder gilt sie nur fuer ungeeignete Rollen, schlaegt z.B. app.objectives-INSERT
-- mit "new row violates row-level security policy for table revisions" fehl.
-- migrate:up

drop policy if exists revisions_insert on audit.revisions;
create policy revisions_insert on audit.revisions
as permissive
for insert
to authenticated, service_role
with check (true);

drop policy if exists revision_events_insert on audit.revision_events;
create policy revision_events_insert on audit.revision_events
as permissive
for insert
to authenticated, service_role
with check (true);

grant insert on table audit.revisions to authenticated, service_role;
grant insert on table audit.revision_events to authenticated, service_role;

-- migrate:down

drop policy if exists revisions_insert on audit.revisions;
drop policy if exists revision_events_insert on audit.revision_events;

create policy revisions_insert on audit.revisions
for insert
with check (true);

create policy revision_events_insert on audit.revision_events
for insert
with check (true);
