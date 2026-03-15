-- 0023_analysis_entry_quality_fields.sql
-- Adds uncertainty scoring for analysis quality.
-- migrate:up

alter table app.analysis_entries
  add column if not exists uncertainty_level smallint
  check (uncertainty_level between 1 and 5);

-- migrate:down
alter table app.analysis_entries
  drop column if exists uncertainty_level;
