-- 0147_annual_targets_smart_check.sql
-- SMART-Prüfung nach Sentinel-Ausarbeitung persistieren (Tabellen-Spalten S/M/A/R/T).
-- migrate:up

alter table app.annual_targets
  add column if not exists smart_check jsonb;

comment on column app.annual_targets.smart_check is
  'Letzte SMART-Bewertung (specific, measurable, achievable, relevant, time_bound) nach Sentinel-Ausarbeitung.';

-- migrate:down

alter table app.annual_targets drop column if exists smart_check;
