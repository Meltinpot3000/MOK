-- 0116_okr_contribution_assessment.sql
-- LLM-gestützte OKR-Contribution-Kanten (Vorschlag vs. Nutzerbestätigung), Background-Job.
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
        'okr_contribution_assessment'::text
      ]
    )
  );

drop policy if exists analysis_background_jobs_okr_contribution_enqueue on app.analysis_background_jobs;

create policy analysis_background_jobs_okr_contribution_enqueue on app.analysis_background_jobs for insert
with check (
  job_type = 'okr_contribution_assessment'::text
  and app.has_permission(organization_id, 'okr.write'::text)
);

create table if not exists app.okr_contribution_assessment_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances (id) on delete cascade,
  okr_objective_id uuid not null references app.okr_objectives (id) on delete cascade,
  trigger text not null default 'update',
  status text not null default 'completed',
  raw_response jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  constraint okr_contribution_assessment_runs_status_check check (
    status = any (array['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])
  )
);

create index if not exists idx_okr_contrib_runs_okr
  on app.okr_contribution_assessment_runs (okr_objective_id, created_at desc);

comment on table app.okr_contribution_assessment_runs is
  'Audit-Protokoll für LLM-Runs zur OKR-Contribution-Bewertung (Roh-JSON, Trigger).';

alter table app.okr_contribution_assessment_runs enable row level security;

create policy okr_contribution_runs_select on app.okr_contribution_assessment_runs for select using (
  app.is_member_of_org(organization_id)
);

create table if not exists app.okr_contribution_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances (id) on delete cascade,
  okr_objective_id uuid not null references app.okr_objectives (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  llm_level text,
  llm_reason text,
  llm_assessment_run_id uuid references app.okr_contribution_assessment_runs (id) on delete set null,
  confirmed_level text,
  value_source text not null default 'none',
  llm_suggestion_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint okr_contribution_edges_target_type_check check (
    target_type = any (array['initiative'::text, 'strategy_objective'::text])
  ),
  constraint okr_contribution_edges_llm_level_check check (
    llm_level is null
    or llm_level = any (array['low'::text, 'medium'::text, 'high'::text])
  ),
  constraint okr_contribution_edges_confirmed_level_check check (
    confirmed_level is null
    or confirmed_level = any (array['low'::text, 'medium'::text, 'high'::text])
  ),
  constraint okr_contribution_edges_value_source_check check (
    value_source = any (array['none'::text, 'llm_accepted'::text, 'manual'::text])
  ),
  constraint okr_contribution_edges_unique_target unique (okr_objective_id, target_type, target_id)
);

create index if not exists idx_okr_contrib_edges_okr
  on app.okr_contribution_edges (okr_objective_id);

comment on table app.okr_contribution_edges is
  'OKR-Einzahlung in verknüpfte Initiativen bzw. Strategieziele: LLM-Vorschlag (llm_*) vs. bestätigter Wert (confirmed_level, value_source).';

drop trigger if exists trg_okr_contribution_edges_updated_at on app.okr_contribution_edges;

create trigger trg_okr_contribution_edges_updated_at before
update on app.okr_contribution_edges for each row execute function app.set_updated_at();

alter table app.okr_contribution_edges enable row level security;

create policy okr_contribution_edges_select on app.okr_contribution_edges for select using (
  exists (
    select 1
    from app.okr_objectives o
    where
      o.id = okr_contribution_edges.okr_objective_id
      and o.organization_id = okr_contribution_edges.organization_id
      and app.is_member_of_org(o.organization_id)
  )
);

create policy okr_contribution_edges_modify on app.okr_contribution_edges for all using (
  exists (
    select 1
    from app.okr_objectives o
    where
      o.id = okr_contribution_edges.okr_objective_id
      and o.organization_id = okr_contribution_edges.organization_id
      and (
        app.has_permission(o.organization_id, 'nav.strategy-cycle.write'::text)
        or app.has_permission(o.organization_id, 'nav.strategy-matrix.write'::text)
        or (
          app.has_permission(o.organization_id, 'okr.write'::text)
          and app.okr_can_modify_objective(
            o.organization_id,
            o.owner_membership_id,
            o.deputy_membership_id
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from app.okr_objectives o
    where
      o.id = okr_contribution_edges.okr_objective_id
      and o.organization_id = okr_contribution_edges.organization_id
      and (
        app.has_permission(o.organization_id, 'nav.strategy-cycle.write'::text)
        or app.has_permission(o.organization_id, 'nav.strategy-matrix.write'::text)
        or (
          app.has_permission(o.organization_id, 'okr.write'::text)
          and app.okr_can_modify_objective(
            o.organization_id,
            o.owner_membership_id,
            o.deputy_membership_id
          )
        )
      )
  )
);

grant select, insert, update, delete on app.okr_contribution_edges to authenticated;
grant select on app.okr_contribution_assessment_runs to authenticated;

-- migrate:down
drop policy if exists okr_contribution_edges_modify on app.okr_contribution_edges;
drop policy if exists okr_contribution_edges_select on app.okr_contribution_edges;
drop trigger if exists trg_okr_contribution_edges_updated_at on app.okr_contribution_edges;
drop table if exists app.okr_contribution_edges;

drop policy if exists okr_contribution_runs_select on app.okr_contribution_assessment_runs;
drop table if exists app.okr_contribution_assessment_runs;

drop policy if exists analysis_background_jobs_okr_contribution_enqueue on app.analysis_background_jobs;

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
        'gaps_recompute'::text
      ]
    )
  );
