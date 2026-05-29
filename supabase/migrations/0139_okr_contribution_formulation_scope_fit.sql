-- OKR-Contribution v5: Formulierung (Klarheit/Messbarkeit) und Quartals-Fit (Scope) statt ambition_level.
-- migrate:up

alter table app.okr_contribution_edges
  add column if not exists llm_formulation_level text,
  add column if not exists llm_scope_fit_level text;

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_formulation_level_check;
alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_llm_formulation_level_check check (
    llm_formulation_level is null
    or llm_formulation_level = any (
      array['low'::text, 'medium'::text, 'high'::text, 'insufficient'::text]
    )
  );

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_scope_fit_level_check;
alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_llm_scope_fit_level_check check (
    llm_scope_fit_level is null
    or llm_scope_fit_level = any (
      array['low'::text, 'medium'::text, 'high'::text, 'insufficient'::text]
    )
  );

comment on column app.okr_contribution_edges.llm_level is
  'Gesamtstufe (overall_level) für Freigabe/UI; bei strategic_direction aus Alignment, Formulierung und Quartals-Fit.';

comment on column app.okr_contribution_edges.llm_formulation_level is
  'Nur strategic_direction: Klarheit und Messbarkeit von Objective und KRs (hoch = gut formuliert).';

comment on column app.okr_contribution_edges.llm_scope_fit_level is
  'Nur strategic_direction: Scope-Fit zum OKR-Zeitraum (low=zu eng, medium=passend, high=überladen).';

comment on column app.okr_contribution_edges.llm_ambition_level is
  'Deprecated (v4): durch llm_formulation_level und llm_scope_fit_level ersetzt.';

-- migrate:down

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_scope_fit_level_check;
alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_formulation_level_check;

alter table app.okr_contribution_edges
  drop column if exists llm_scope_fit_level,
  drop column if exists llm_formulation_level;
