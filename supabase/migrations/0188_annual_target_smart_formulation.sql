-- 0188_annual_target_smart_formulation.sql
-- SMART-Formulierungstexte am Jahresziel (neben boolean smart_check).

-- migrate:up

alter table app.annual_targets
  add column if not exists smart_formulation jsonb;

comment on column app.annual_targets.smart_formulation is
  'SMART-Texte: { specific, measurable, achievable, relevant, time_bound } (strings).';

-- migrate:down

alter table app.annual_targets
  drop column if exists smart_formulation;
