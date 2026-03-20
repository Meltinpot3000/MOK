-- 0063_analysis_item_link_cycle_instance_unique.sql
-- Add unique constraint on cycle_instance_id for upsert compatibility (v3 strategy framework).
-- migrate:up

-- Remove potential duplicates before adding constraint (keep oldest per key)
delete from app.analysis_item_link a
using app.analysis_item_link b
where a.cycle_instance_id = b.cycle_instance_id
  and a.source_analysis_item_id = b.source_analysis_item_id
  and a.target_analysis_item_id = b.target_analysis_item_id
  and a.link_type = b.link_type
  and a.created_at > b.created_at;

create unique index if not exists uq_analysis_item_link_cycle_instance_source_target_type
  on app.analysis_item_link (cycle_instance_id, source_analysis_item_id, target_analysis_item_id, link_type);

-- migrate:down
drop index if exists app.uq_analysis_item_link_cycle_instance_source_target_type;
