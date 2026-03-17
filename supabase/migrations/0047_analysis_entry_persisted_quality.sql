-- 0047_analysis_entry_persisted_quality.sql
-- Persist quality scoring metadata on analysis entries.
-- migrate:up

alter table app.analysis_entries
  add column if not exists quality_score smallint,
  add column if not exists quality_band text,
  add column if not exists quality_source text,
  add column if not exists quality_explanation text,
  add column if not exists quality_calculated_at timestamptz,
  add column if not exists quality_fallback_reason text,
  add column if not exists quality_provider text,
  add column if not exists quality_model text,
  add column if not exists quality_prompt_version text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'analysis_entries_quality_score_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_quality_score_check
      check (quality_score is null or (quality_score between 0 and 100));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'analysis_entries_quality_band_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_quality_band_check
      check (quality_band is null or quality_band in ('high', 'medium', 'low'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'analysis_entries_quality_source_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_quality_source_check
      check (quality_source is null or quality_source in ('llm', 'rule'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'analysis_entries_quality_fallback_reason_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_quality_fallback_reason_check
      check (
        quality_fallback_reason is null
        or quality_fallback_reason in ('llm_not_requested', 'llm_no_result')
      );
  end if;
end $$;

-- migrate:down
alter table app.analysis_entries
  drop constraint if exists analysis_entries_quality_fallback_reason_check,
  drop constraint if exists analysis_entries_quality_source_check,
  drop constraint if exists analysis_entries_quality_band_check,
  drop constraint if exists analysis_entries_quality_score_check,
  drop column if exists quality_prompt_version,
  drop column if exists quality_model,
  drop column if exists quality_provider,
  drop column if exists quality_fallback_reason,
  drop column if exists quality_calculated_at,
  drop column if exists quality_explanation,
  drop column if exists quality_source,
  drop column if exists quality_band,
  drop column if exists quality_score;
