-- OKR-Contribution v4: Stoßrichtung als Bewertungskante; Alignment/Ambition getrennt von Overall.
-- migrate:up

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_target_type_check;

alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_target_type_check check (
    target_type = any (
      array['initiative'::text, 'strategy_objective'::text, 'strategic_direction'::text]
    )
  );

alter table app.okr_contribution_edges
  add column if not exists llm_alignment_level text,
  add column if not exists llm_ambition_level text;

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_alignment_level_check;
alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_llm_alignment_level_check check (
    llm_alignment_level is null
    or llm_alignment_level = any (
      array['low'::text, 'medium'::text, 'high'::text, 'insufficient'::text]
    )
  );

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_ambition_level_check;
alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_llm_ambition_level_check check (
    llm_ambition_level is null
    or llm_ambition_level = any (
      array['low'::text, 'medium'::text, 'high'::text, 'insufficient'::text]
    )
  );

comment on table app.okr_contribution_edges is
  'OKR-Einzahlung: Stoßrichtung (primär, llm_level=overall), Strategieziele unter Richtung, Initiativen (optional).';

comment on column app.okr_contribution_edges.llm_level is
  'Gesamtstufe (overall_level) für Freigabe/UI; bei strategic_direction zusammen mit llm_alignment_level und llm_ambition_level.';

comment on column app.okr_contribution_edges.llm_alignment_level is
  'Nur strategic_direction: strategischer Fit zur Stoßrichtung.';

comment on column app.okr_contribution_edges.llm_ambition_level is
  'Nur strategic_direction: Anspruch/Ambition von Objective und KRs.';

comment on column app.okr_contribution_edges.llm_tension_note is
  'Verbesserungsvorschlag (improvement_hint), wenn overall nicht high.';

-- migrate:down

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_ambition_level_check;
alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_alignment_level_check;

alter table app.okr_contribution_edges
  drop column if exists llm_ambition_level,
  drop column if exists llm_alignment_level;

delete from app.okr_contribution_edges where target_type = 'strategic_direction';

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_target_type_check;

alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_target_type_check check (
    target_type = any (array['initiative'::text, 'strategy_objective'::text])
  );
