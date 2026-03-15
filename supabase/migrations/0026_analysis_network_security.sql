-- 0026_analysis_network_security.sql
-- RLS, grants and audit triggers for analysis network tables.
-- migrate:up

grant select, insert, update, delete on app.analysis_links_draft to authenticated;
grant select on app.analysis_links_draft to anon;
grant select, insert, update, delete on app.analysis_links to authenticated;
grant select on app.analysis_links to anon;
grant select, insert, update, delete on app.analysis_clusters to authenticated;
grant select on app.analysis_clusters to anon;
grant select, insert, update, delete on app.analysis_cluster_members to authenticated;
grant select on app.analysis_cluster_members to anon;
grant select, insert, update, delete on app.analysis_gap_findings to authenticated;
grant select on app.analysis_gap_findings to anon;

alter table app.analysis_links_draft enable row level security;
alter table app.analysis_links enable row level security;
alter table app.analysis_clusters enable row level security;
alter table app.analysis_cluster_members enable row level security;
alter table app.analysis_gap_findings enable row level security;

drop policy if exists analysis_links_draft_select on app.analysis_links_draft;
create policy analysis_links_draft_select on app.analysis_links_draft
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists analysis_links_draft_modify on app.analysis_links_draft;
create policy analysis_links_draft_modify on app.analysis_links_draft
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists analysis_links_select on app.analysis_links;
create policy analysis_links_select on app.analysis_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists analysis_links_modify on app.analysis_links;
create policy analysis_links_modify on app.analysis_links
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists analysis_clusters_select on app.analysis_clusters;
create policy analysis_clusters_select on app.analysis_clusters
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists analysis_clusters_modify on app.analysis_clusters;
create policy analysis_clusters_modify on app.analysis_clusters
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists analysis_cluster_members_select on app.analysis_cluster_members;
create policy analysis_cluster_members_select on app.analysis_cluster_members
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists analysis_cluster_members_modify on app.analysis_cluster_members;
create policy analysis_cluster_members_modify on app.analysis_cluster_members
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists analysis_gap_findings_select on app.analysis_gap_findings;
create policy analysis_gap_findings_select on app.analysis_gap_findings
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists analysis_gap_findings_modify on app.analysis_gap_findings;
create policy analysis_gap_findings_modify on app.analysis_gap_findings
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop trigger if exists trg_audit_analysis_links_draft on app.analysis_links_draft;
create trigger trg_audit_analysis_links_draft
after insert or update or delete on app.analysis_links_draft
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_analysis_links on app.analysis_links;
create trigger trg_audit_analysis_links
after insert or update or delete on app.analysis_links
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_analysis_clusters on app.analysis_clusters;
create trigger trg_audit_analysis_clusters
after insert or update or delete on app.analysis_clusters
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_analysis_gap_findings on app.analysis_gap_findings;
create trigger trg_audit_analysis_gap_findings
after insert or update or delete on app.analysis_gap_findings
for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_analysis_gap_findings on app.analysis_gap_findings;
drop trigger if exists trg_audit_analysis_clusters on app.analysis_clusters;
drop trigger if exists trg_audit_analysis_links on app.analysis_links;
drop trigger if exists trg_audit_analysis_links_draft on app.analysis_links_draft;

drop policy if exists analysis_gap_findings_modify on app.analysis_gap_findings;
drop policy if exists analysis_gap_findings_select on app.analysis_gap_findings;
drop policy if exists analysis_cluster_members_modify on app.analysis_cluster_members;
drop policy if exists analysis_cluster_members_select on app.analysis_cluster_members;
drop policy if exists analysis_clusters_modify on app.analysis_clusters;
drop policy if exists analysis_clusters_select on app.analysis_clusters;
drop policy if exists analysis_links_modify on app.analysis_links;
drop policy if exists analysis_links_select on app.analysis_links;
drop policy if exists analysis_links_draft_modify on app.analysis_links_draft;
drop policy if exists analysis_links_draft_select on app.analysis_links_draft;
