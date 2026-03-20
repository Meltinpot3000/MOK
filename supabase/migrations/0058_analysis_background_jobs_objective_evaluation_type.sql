-- 0058_analysis_background_jobs_objective_evaluation_type.sql
-- Erlaubt objective_evaluation_backfill in der Job-Warteschlange (war nur im App-Code, nicht in der DB).
-- migrate:up

do $$
declare
  conname text;
begin
  select c.conname
    into conname
  from pg_constraint c
  where c.conrelid = 'app.analysis_background_jobs'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%job_type%'
    and pg_get_constraintdef(c.oid) like '%quality_backfill%';

  if conname is not null then
    execute format('alter table app.analysis_background_jobs drop constraint %I', conname);
  end if;
end $$;

alter table app.analysis_background_jobs
  add constraint analysis_background_jobs_job_type_check
  check (
    job_type in (
      'quality_backfill',
      'graph_layout_recompute',
      'entry_embedding_backfill',
      'objective_evaluation_backfill'
    )
  );

-- migrate:down
do $$
declare
  conname text;
begin
  select c.conname
    into conname
  from pg_constraint c
  where c.conrelid = 'app.analysis_background_jobs'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%job_type%';

  if conname is not null then
    execute format('alter table app.analysis_background_jobs drop constraint %I', conname);
  end if;
end $$;

alter table app.analysis_background_jobs
  add constraint analysis_background_jobs_job_type_check
  check (
    job_type in (
      'quality_backfill',
      'graph_layout_recompute',
      'entry_embedding_backfill'
    )
  );
