-- 0163_strategic_context_rebuild_job.sql
-- Background-Job-Typ: Sentinel-Zusammenfassung nach Aenderung der Unternehmensinfo neu erzeugen.
-- migrate:up

alter table app.analysis_background_jobs drop constraint if exists analysis_background_jobs_job_type_check;

alter table app.analysis_background_jobs
  add constraint analysis_background_jobs_job_type_check check (
    job_type = any (
      array[
        'quality_backfill'::text,
        'graph_layout_recompute'::text,
        'entry_embedding_backfill'::text,
        'objective_evaluation_backfill'::text,
        'link_draft_generation'::text,
        'cluster_recompute'::text,
        'gaps_recompute'::text,
        'okr_contribution_assessment'::text,
        'kr_initiative_matching'::text,
        'strategic_context_rebuild'::text
      ]
    )
  );

-- migrate:down

alter table app.analysis_background_jobs drop constraint if exists analysis_background_jobs_job_type_check;

alter table app.analysis_background_jobs
  add constraint analysis_background_jobs_job_type_check check (
    job_type = any (
      array[
        'quality_backfill'::text,
        'graph_layout_recompute'::text,
        'entry_embedding_backfill'::text,
        'objective_evaluation_backfill'::text,
        'link_draft_generation'::text,
        'cluster_recompute'::text,
        'gaps_recompute'::text,
        'okr_contribution_assessment'::text,
        'kr_initiative_matching'::text
      ]
    )
  );
