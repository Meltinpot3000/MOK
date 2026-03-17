-- 0048_analysis_entry_graph_layout_fields.sql
-- Persist graph layout positions for analysis entries.
-- migrate:up

alter table app.analysis_entries
  add column if not exists graph_layout_x double precision,
  add column if not exists graph_layout_y double precision,
  add column if not exists graph_layout_z double precision,
  add column if not exists graph_layout_confidence double precision,
  add column if not exists graph_layout_reason text,
  add column if not exists graph_layout_source text,
  add column if not exists graph_layout_fallback_reason text,
  add column if not exists graph_layout_provider text,
  add column if not exists graph_layout_model text,
  add column if not exists graph_layout_prompt_version text,
  add column if not exists graph_layout_calculated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'analysis_entries_graph_layout_x_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_graph_layout_x_check
      check (graph_layout_x is null or (graph_layout_x between -1 and 1));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'analysis_entries_graph_layout_y_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_graph_layout_y_check
      check (graph_layout_y is null or (graph_layout_y between -1 and 1));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'analysis_entries_graph_layout_z_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_graph_layout_z_check
      check (graph_layout_z is null or (graph_layout_z between -1 and 1));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'analysis_entries_graph_layout_confidence_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_graph_layout_confidence_check
      check (graph_layout_confidence is null or (graph_layout_confidence between 0 and 1));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'analysis_entries_graph_layout_source_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_graph_layout_source_check
      check (graph_layout_source is null or graph_layout_source in ('llm', 'rule'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'analysis_entries_graph_layout_fallback_reason_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_graph_layout_fallback_reason_check
      check (
        graph_layout_fallback_reason is null
        or graph_layout_fallback_reason in ('llm_not_requested', 'llm_no_result')
      );
  end if;
end $$;

-- migrate:down
alter table app.analysis_entries
  drop constraint if exists analysis_entries_graph_layout_fallback_reason_check,
  drop constraint if exists analysis_entries_graph_layout_source_check,
  drop constraint if exists analysis_entries_graph_layout_confidence_check,
  drop constraint if exists analysis_entries_graph_layout_z_check,
  drop constraint if exists analysis_entries_graph_layout_y_check,
  drop constraint if exists analysis_entries_graph_layout_x_check,
  drop column if exists graph_layout_calculated_at,
  drop column if exists graph_layout_prompt_version,
  drop column if exists graph_layout_model,
  drop column if exists graph_layout_provider,
  drop column if exists graph_layout_fallback_reason,
  drop column if exists graph_layout_source,
  drop column if exists graph_layout_reason,
  drop column if exists graph_layout_confidence,
  drop column if exists graph_layout_z,
  drop column if exists graph_layout_y,
  drop column if exists graph_layout_x;
