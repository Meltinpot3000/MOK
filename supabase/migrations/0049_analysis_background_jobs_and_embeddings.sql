-- 0049_analysis_background_jobs_and_embeddings.sql
-- Background job queue for strategy-cycle heavy tasks and semantic embeddings on analysis entries.
-- migrate:up

create extension if not exists vector;

alter table app.analysis_entries
  add column if not exists semantic_embedding vector(768),
  add column if not exists semantic_embedding_model text,
  add column if not exists semantic_embedding_version text,
  add column if not exists semantic_embedding_calculated_at timestamptz,
  add column if not exists semantic_embedding_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'analysis_entries_semantic_embedding_status_check'
  ) then
    alter table app.analysis_entries
      add constraint analysis_entries_semantic_embedding_status_check
      check (
        semantic_embedding_status is null
        or semantic_embedding_status in ('pending', 'ready', 'failed')
      );
  end if;
end $$;

create index if not exists idx_analysis_entries_semantic_embedding_status
  on app.analysis_entries (organization_id, cycle_instance_id, semantic_embedding_status);

create table if not exists app.analysis_background_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  progress_done integer not null default 0,
  progress_total integer not null default 0,
  cursor text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    job_type in ('quality_backfill', 'graph_layout_recompute', 'entry_embedding_backfill')
  ),
  check (
    status in ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  check (progress_done >= 0),
  check (progress_total >= 0),
  check (attempt_count >= 0),
  check (max_attempts >= 1)
);

create index if not exists idx_analysis_background_jobs_lookup
  on app.analysis_background_jobs (organization_id, cycle_instance_id, job_type, status, created_at desc);

create index if not exists idx_analysis_background_jobs_pending
  on app.analysis_background_jobs (status, created_at asc)
  where status in ('pending', 'running');

drop trigger if exists trg_analysis_background_jobs_updated_at on app.analysis_background_jobs;
create trigger trg_analysis_background_jobs_updated_at
before update on app.analysis_background_jobs
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.analysis_background_jobs to authenticated;
grant select on app.analysis_background_jobs to anon;
alter table app.analysis_background_jobs enable row level security;

drop policy if exists analysis_background_jobs_select on app.analysis_background_jobs;
create policy analysis_background_jobs_select on app.analysis_background_jobs
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
);

drop policy if exists analysis_background_jobs_modify on app.analysis_background_jobs;
create policy analysis_background_jobs_modify on app.analysis_background_jobs
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
);

-- migrate:down
drop policy if exists analysis_background_jobs_modify on app.analysis_background_jobs;
drop policy if exists analysis_background_jobs_select on app.analysis_background_jobs;
drop trigger if exists trg_analysis_background_jobs_updated_at on app.analysis_background_jobs;
drop table if exists app.analysis_background_jobs;

drop index if exists idx_analysis_entries_semantic_embedding_status;
alter table app.analysis_entries
  drop constraint if exists analysis_entries_semantic_embedding_status_check,
  drop column if exists semantic_embedding_status,
  drop column if exists semantic_embedding_calculated_at,
  drop column if exists semantic_embedding_version,
  drop column if exists semantic_embedding_model,
  drop column if exists semantic_embedding;
