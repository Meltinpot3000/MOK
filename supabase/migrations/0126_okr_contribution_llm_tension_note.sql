-- Sentinel OKR-Einzahlung: zweite Begründungsebene (inhaltliches Spannungsfeld / Umsetzungsabweichung).
-- migrate:up

alter table app.okr_contribution_edges
  add column if not exists llm_tension_note text;

comment on column app.okr_contribution_edges.llm_tension_note is
  'Optional: zweiter Satz vom LLM — Spannung zwischen thematischer Deckung und Details (Ambition, Fokus, Komplexität).';

-- migrate:down

alter table app.okr_contribution_edges drop column if exists llm_tension_note;
