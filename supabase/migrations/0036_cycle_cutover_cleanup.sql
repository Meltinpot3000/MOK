-- 0036_cycle_cutover_cleanup.sql
-- migrate:up


drop function if exists public.clone_planning_cycle_full_snapshot(uuid, uuid, text, text, date, date, uuid);

drop table if exists app.analysis_links_draft cascade;
drop table if exists app.analysis_links cascade;

alter table app.planning_cycles
  drop column if exists source_cycle_id,
  drop column if exists clone_type,
  drop column if exists cloned_at,
  drop column if exists cloned_by_membership_id;


-- migrate:down
-- irreversible migration (no-op)
