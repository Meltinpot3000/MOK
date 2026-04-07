-- 0118_okr_contribution_insufficient_tier.sql
-- Stufe "insufficient" (UI: unzureichend beschrieben) für OKR-Einzahlungskanten.
-- migrate:up

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_level_check;
alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_confirmed_level_check;

alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_llm_level_check check (
    llm_level is null
    or llm_level = any (array['low'::text, 'medium'::text, 'high'::text, 'insufficient'::text])
  );

alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_confirmed_level_check check (
    confirmed_level is null
    or confirmed_level = any (array['low'::text, 'medium'::text, 'high'::text, 'insufficient'::text])
  );

comment on table app.okr_contribution_edges is
  'OKR-Einzahlung in verknüpfte Initiativen bzw. Strategieziele: LLM-Vorschlag (llm_*) vs. bestätigter Wert. Stufen: low/medium/high/insufficient (unzureichend beschrieben).';

-- migrate:down

alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_llm_level_check;
alter table app.okr_contribution_edges drop constraint if exists okr_contribution_edges_confirmed_level_check;

update app.okr_contribution_edges
set llm_level = 'low'
where llm_level = 'insufficient';

update app.okr_contribution_edges
set confirmed_level = 'low'
where confirmed_level = 'insufficient';

alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_llm_level_check check (
    llm_level is null or llm_level = any (array['low'::text, 'medium'::text, 'high'::text])
  );

alter table app.okr_contribution_edges
  add constraint okr_contribution_edges_confirmed_level_check check (
    confirmed_level is null or confirmed_level = any (array['low'::text, 'medium'::text, 'high'::text])
  );
