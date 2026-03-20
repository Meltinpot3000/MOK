-- 0065_source_cluster_id_for_strategic_challenges.sql
-- Verknüpfung Cluster → Challenge: promotete Cluster ausblenden, Sentinel-Duplikate vermeiden.
-- migrate:up

alter table app.strategic_challenges
  add column if not exists source_cluster_id uuid references app.analysis_clusters(id) on delete set null;

create index if not exists idx_strategic_challenges_source_cluster_id
  on app.strategic_challenges (source_cluster_id)
  where source_cluster_id is not null;

-- migrate:down
drop index if exists app.idx_strategic_challenges_source_cluster_id;
alter table app.strategic_challenges drop column if exists source_cluster_id;
