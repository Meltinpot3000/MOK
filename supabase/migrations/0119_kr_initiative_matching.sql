-- 0119_kr_initiative_matching.sql
-- Sentinel-Vorschlaege fuer KR<->Initiative inklusive User-Bestaetigung und Run-Status.
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
        'kr_initiative_matching'::text
      ]
    )
  );

drop policy if exists analysis_background_jobs_kr_initiative_matching_enqueue on app.analysis_background_jobs;
create policy analysis_background_jobs_kr_initiative_matching_enqueue on app.analysis_background_jobs for insert
with check (
  job_type = 'kr_initiative_matching'::text
  and app.has_permission(organization_id, 'okr.write'::text)
);

alter table app.initiative_key_result_links
  add column if not exists llm_level text,
  add column if not exists llm_reason text,
  add column if not exists llm_run_id uuid,
  add column if not exists confirmed_level text,
  add column if not exists confirmation_status text not null default 'none';

alter table app.initiative_key_result_links drop constraint if exists initiative_key_result_links_llm_level_check;
alter table app.initiative_key_result_links drop constraint if exists initiative_key_result_links_confirmed_level_check;
alter table app.initiative_key_result_links drop constraint if exists initiative_key_result_links_confirmation_status_check;

alter table app.initiative_key_result_links
  add constraint initiative_key_result_links_llm_level_check check (
    llm_level is null
    or llm_level = any (array['low'::text, 'medium'::text, 'high'::text])
  ),
  add constraint initiative_key_result_links_confirmed_level_check check (
    confirmed_level is null
    or confirmed_level = any (array['low'::text, 'medium'::text, 'high'::text])
  ),
  add constraint initiative_key_result_links_confirmation_status_check check (
    confirmation_status = any (array['none'::text, 'pending'::text, 'accepted'::text, 'rejected'::text, 'manual'::text])
  );

create table if not exists app.kr_initiative_matching_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances (id) on delete cascade,
  key_result_id uuid not null references app.key_results (id) on delete cascade,
  trigger text not null default 'update',
  status text not null default 'ok',
  insufficient_context_reason text,
  raw_response jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  constraint kr_initiative_matching_runs_status_check check (
    status = any (array['ok'::text, 'insufficient_context'::text, 'failed'::text])
  )
);

create index if not exists idx_kr_initiative_matching_runs_kr_created
  on app.kr_initiative_matching_runs (key_result_id, created_at desc);

comment on table app.kr_initiative_matching_runs is
  'Audit und UI-Status fuer KR-Initiative-Matching-Laeufe (ok, insufficient_context, failed).';

alter table app.kr_initiative_matching_runs enable row level security;

drop policy if exists kr_initiative_matching_runs_select on app.kr_initiative_matching_runs;
create policy kr_initiative_matching_runs_select on app.kr_initiative_matching_runs for select using (
  app.is_member_of_org(organization_id)
);

grant select on app.kr_initiative_matching_runs to authenticated;

-- migrate:down

drop policy if exists kr_initiative_matching_runs_select on app.kr_initiative_matching_runs;
drop table if exists app.kr_initiative_matching_runs;

alter table app.initiative_key_result_links drop constraint if exists initiative_key_result_links_llm_level_check;
alter table app.initiative_key_result_links drop constraint if exists initiative_key_result_links_confirmed_level_check;
alter table app.initiative_key_result_links drop constraint if exists initiative_key_result_links_confirmation_status_check;

alter table app.initiative_key_result_links
  drop column if exists llm_level,
  drop column if exists llm_reason,
  drop column if exists llm_run_id,
  drop column if exists confirmed_level,
  drop column if exists confirmation_status;

drop policy if exists analysis_background_jobs_kr_initiative_matching_enqueue on app.analysis_background_jobs;

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
        'okr_contribution_assessment'::text
      ]
    )
  );
