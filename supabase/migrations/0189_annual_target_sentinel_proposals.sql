-- 0189_annual_target_sentinel_proposals.sql
-- Pending Sentinel-SMART-Vorschläge + Fit zum Anker (Stoßrichtung oder Programm).

-- migrate:up

alter table app.annual_targets
  add column if not exists smart_proposal jsonb;

alter table app.annual_targets
  add column if not exists anchor_fit jsonb;

comment on column app.annual_targets.smart_proposal is
  'Pending Sentinel-Vorschläge: { title, formulation{S,M,A,R,T}, smart_check, improvement_notes, generated_at }. Akzeptierte Werte bleiben in title/smart_formulation.';

comment on column app.annual_targets.anchor_fit is
  'Sentinel-Fit zum Anker: { anchor_type, anchor_id, anchor_title, overall_level, alignment_level, formulation_level, reason, improvement_hint, assessed_at }.';

-- migrate:down

alter table app.annual_targets drop column if exists smart_proposal;
alter table app.annual_targets drop column if exists anchor_fit;
