-- 0030_analysis_item_link_security.sql
-- RLS, grants and audit triggers for unified analysis item links.
-- migrate:up

grant select, insert, update, delete on app.analysis_item_link_draft to authenticated;
grant select on app.analysis_item_link_draft to anon;
grant select, insert, update, delete on app.analysis_item_link to authenticated;
grant select on app.analysis_item_link to anon;

alter table app.analysis_item_link_draft enable row level security;
alter table app.analysis_item_link enable row level security;

drop policy if exists analysis_item_link_draft_select on app.analysis_item_link_draft;
create policy analysis_item_link_draft_select on app.analysis_item_link_draft
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists analysis_item_link_draft_modify on app.analysis_item_link_draft;
create policy analysis_item_link_draft_modify on app.analysis_item_link_draft
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists analysis_item_link_select on app.analysis_item_link;
create policy analysis_item_link_select on app.analysis_item_link
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists analysis_item_link_modify on app.analysis_item_link;
create policy analysis_item_link_modify on app.analysis_item_link
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop trigger if exists trg_audit_analysis_item_link_draft on app.analysis_item_link_draft;
create trigger trg_audit_analysis_item_link_draft
after insert or update or delete on app.analysis_item_link_draft
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_analysis_item_link on app.analysis_item_link;
create trigger trg_audit_analysis_item_link
after insert or update or delete on app.analysis_item_link
for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_analysis_item_link on app.analysis_item_link;
drop trigger if exists trg_audit_analysis_item_link_draft on app.analysis_item_link_draft;
drop policy if exists analysis_item_link_modify on app.analysis_item_link;
drop policy if exists analysis_item_link_select on app.analysis_item_link;
drop policy if exists analysis_item_link_draft_modify on app.analysis_item_link_draft;
drop policy if exists analysis_item_link_draft_select on app.analysis_item_link_draft;
