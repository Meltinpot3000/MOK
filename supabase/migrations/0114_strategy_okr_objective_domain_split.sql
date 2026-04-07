-- 0114_strategy_okr_objective_domain_split.sql
-- Fachliche Trennung: strategy_objectives (langfristig, Stoßrichtung) vs. okr_objectives (Quartal) vs. key_results nur an OKR-Ziele.
-- migrate:up

-- ---------------------------------------------------------------------------
-- 1) Neue Tabellen
-- ---------------------------------------------------------------------------

create table app.strategy_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  cycle_id uuid references app.planning_cycles (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft',
  owner_membership_id uuid references app.organization_memberships (id) on delete set null,
  deputy_membership_id uuid references app.organization_memberships (id) on delete set null,
  progress_percent numeric(5, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cycle_instance_id uuid not null references app.cycle_instances (id) on delete cascade,
  time_horizon text,
  importance_score smallint not null default 3,
  ai_clarity_score smallint,
  ai_strategic_relevance_score smallint,
  ai_feasibility_score smallint,
  ai_fit_to_company_score smallint,
  ai_confidence_score smallint,
  ai_external_internal_classification text,
  ai_short_long_term_classification text,
  ai_exploit_explore_classification text,
  ai_issues_json jsonb not null default '[]'::jsonb,
  ai_improvement_suggestion text,
  ai_summary text,
  ai_objective_score numeric(6, 2),
  ai_evaluation_status text not null default 'not_run',
  ai_evaluated_at timestamptz,
  ai_evaluation_version text,
  ai_manual_override boolean not null default false,
  ai_manual_comment text,
  created_by_membership_id uuid references app.organization_memberships (id) on delete set null,
  created_by_source text not null default 'user',
  objective_health_override text,
  objective_health_override_by_membership_id uuid references app.organization_memberships (id) on delete set null,
  objective_health_override_at timestamptz,
  objective_review_comment text,
  strategy_carry_source_id uuid,
  strategy_carry_metadata jsonb not null default '{}'::jsonb,
  constraint strategy_objectives_ai_clarity_score_check check (
    ai_clarity_score is null or (ai_clarity_score >= 1 and ai_clarity_score <= 5)
  ),
  constraint strategy_objectives_ai_confidence_score_check check (
    ai_confidence_score is null or (ai_confidence_score >= 1 and ai_confidence_score <= 5)
  ),
  constraint strategy_objectives_ai_evaluation_status_check check (
    ai_evaluation_status = any (array['not_run'::text, 'valid'::text, 'outdated'::text, 'failed'::text])
  ),
  constraint strategy_objectives_ai_exploit_explore_classification_check check (
    ai_exploit_explore_classification is null
    or ai_exploit_explore_classification = any (
      array['exploit'::text, 'explore'::text, 'balanced'::text]
    )
  ),
  constraint strategy_objectives_ai_external_internal_classification_check check (
    ai_external_internal_classification is null
    or ai_external_internal_classification = any (array['internal'::text, 'external'::text, 'balanced'::text])
  ),
  constraint strategy_objectives_ai_feasibility_score_check check (
    ai_feasibility_score is null or (ai_feasibility_score >= 1 and ai_feasibility_score <= 5)
  ),
  constraint strategy_objectives_ai_fit_to_company_score_check check (
    ai_fit_to_company_score is null or (ai_fit_to_company_score >= 1 and ai_fit_to_company_score <= 5)
  ),
  constraint strategy_objectives_ai_short_long_term_classification_check check (
    ai_short_long_term_classification is null
    or ai_short_long_term_classification = any (array['short'::text, 'mid'::text, 'long'::text])
  ),
  constraint strategy_objectives_ai_strategic_relevance_score_check check (
    ai_strategic_relevance_score is null
    or (ai_strategic_relevance_score >= 1 and ai_strategic_relevance_score <= 5)
  ),
  constraint strategy_objectives_created_by_source_check check (
    created_by_source = any (array['user'::text, 'sentinel'::text])
  ),
  constraint strategy_objectives_importance_score_check check (importance_score >= 1 and importance_score <= 5),
  constraint strategy_objectives_objective_health_override_check check (
    objective_health_override is null
    or objective_health_override = any (array['on_track'::text, 'at_risk'::text, 'off_track'::text])
  ),
  constraint strategy_objectives_progress_percent_check check (
    progress_percent >= 0 and progress_percent <= 100
  ),
  constraint strategy_objectives_status_check check (
    status = any (array['draft'::text, 'active'::text, 'at_risk'::text, 'completed'::text, 'archived'::text])
  )
);

create index idx_strategy_objectives_org_cycle_instance
  on app.strategy_objectives (organization_id, cycle_instance_id);

create index idx_strategy_objectives_owner_membership_idx
  on app.strategy_objectives (owner_membership_id)
  where owner_membership_id is not null;

create index idx_strategy_objectives_deputy_membership_idx
  on app.strategy_objectives (deputy_membership_id)
  where deputy_membership_id is not null;

comment on table app.strategy_objectives is
  'Langfristige Strategie-Ziele; Verknuepfung zu Stossrichtungen; Fortschritt aggregiert aus OKR-Objectives.';

alter table app.strategy_objectives
  add constraint strategy_objectives_strategy_carry_source_id_fkey
  foreign key (strategy_carry_source_id) references app.strategy_objectives (id) on delete set null;

create table app.okr_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  cycle_id uuid references app.planning_cycles (id) on delete set null,
  cycle_instance_id uuid not null references app.cycle_instances (id) on delete cascade,
  okr_cycle_id uuid not null references app.okr_cycles (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  owner_membership_id uuid references app.organization_memberships (id) on delete set null,
  deputy_membership_id uuid references app.organization_memberships (id) on delete set null,
  progress_percent numeric(5, 2) not null default 0,
  confidence_level smallint,
  importance_score smallint not null default 3,
  time_horizon text,
  created_by_membership_id uuid references app.organization_memberships (id) on delete set null,
  created_by_source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint okr_objectives_confidence_level_check check (
    confidence_level is null or (confidence_level >= 1 and confidence_level <= 10)
  ),
  constraint okr_objectives_created_by_source_check check (
    created_by_source = any (array['user'::text, 'sentinel'::text])
  ),
  constraint okr_objectives_importance_score_check check (importance_score >= 1 and importance_score <= 5),
  constraint okr_objectives_progress_percent_check check (progress_percent >= 0 and progress_percent <= 100),
  constraint okr_objectives_status_check check (
    status = any (
      array[
        'draft'::text,
        'active'::text,
        'at_risk'::text,
        'completed'::text,
        'archived'::text,
        'shifted'::text
      ]
    )
  )
);

create index idx_okr_objectives_org_cycle_instance
  on app.okr_objectives (organization_id, cycle_instance_id);

create index idx_okr_objectives_org_okr_cycle
  on app.okr_objectives (organization_id, okr_cycle_id);

create index idx_okr_objectives_owner
  on app.okr_objectives (owner_membership_id)
  where owner_membership_id is not null;

comment on table app.okr_objectives is
  'Zeitlich begrenzte OKR-Auspraegung (Quartal); Heimat der Key Results; operationalisiert Strategie-Ziele.';

create table app.okr_objective_strategy_objectives (
  okr_objective_id uuid not null references app.okr_objectives (id) on delete cascade,
  strategy_objective_id uuid not null references app.strategy_objectives (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (okr_objective_id, strategy_objective_id)
);

create index idx_okr_obj_strat_strat on app.okr_objective_strategy_objectives (strategy_objective_id);

comment on table app.okr_objective_strategy_objectives is
  'M:N: ein OKR-Ziel kann zu einem oder mehreren Strategie-Zielen beitragen.';

-- ---------------------------------------------------------------------------
-- 2) Datenmigration von app.objectives
-- ---------------------------------------------------------------------------

-- sync_legacy_cycle_columns setzt bei UPDATE cycle_id aus cycle_instance (coalesce(legacy, id)).
-- cycle_instance.id ist keine planning_cycles-UUID → bricht danach INSERT in strategy_objectives (FK cycle_id).
alter table app.objectives disable trigger trg_sync_cycles_objectives;

-- Verwaiste cycle_id (kein passender planning_cycles-Eintrag) brechen den FK auf strategy_objectives.
-- Uebernehme legacy_planning_cycle_id der cycle_instance, sonst setze cycle_id auf NULL.
update app.objectives o
set cycle_id = ci.legacy_planning_cycle_id
from app.cycle_instances ci
where o.cycle_instance_id = ci.id
  and ci.legacy_planning_cycle_id is not null
  and exists (
    select 1 from app.planning_cycles pc where pc.id = ci.legacy_planning_cycle_id
  )
  and (
    o.cycle_id is null
    or not exists (select 1 from app.planning_cycles pc where pc.id = o.cycle_id)
  );

update app.objectives
set cycle_id = null
where cycle_id is not null
  and not exists (select 1 from app.planning_cycles pc where pc.id = cycle_id);

-- cycle_id muss zur Organisation des Objectives passieren (sonst logisch ungueltig, FK kann je nach Daten dennoch scheitern).
update app.objectives o
set cycle_id = null
where o.cycle_id is not null
  and not exists (
    select 1
    from app.planning_cycles pc
    where pc.id = o.cycle_id
      and pc.organization_id = o.organization_id
  );

create temporary table _split_old (
  old_id uuid primary key,
  strategy_id uuid not null,
  okr_id uuid
) on commit drop;

-- Harte Fallback-Bereinigung: cycle_id allein fuer den Split irrelevant (cycle_instance_id bleibt).
-- Verhindert FK-Fehler auf strategy_objectives.cycle_id bei historisch inkonsistenten Seeds.
update app.objectives
set cycle_id = null;

-- Rein strategische Zeilen (kein OKR-Zyklus)
insert into app.strategy_objectives (
  id,
  organization_id,
  cycle_id,
  title,
  description,
  status,
  owner_membership_id,
  deputy_membership_id,
  progress_percent,
  created_at,
  updated_at,
  cycle_instance_id,
  time_horizon,
  importance_score,
  ai_clarity_score,
  ai_strategic_relevance_score,
  ai_feasibility_score,
  ai_fit_to_company_score,
  ai_confidence_score,
  ai_external_internal_classification,
  ai_short_long_term_classification,
  ai_exploit_explore_classification,
  ai_issues_json,
  ai_improvement_suggestion,
  ai_summary,
  ai_objective_score,
  ai_evaluation_status,
  ai_evaluated_at,
  ai_evaluation_version,
  ai_manual_override,
  ai_manual_comment,
  created_by_membership_id,
  created_by_source,
  objective_health_override,
  objective_health_override_by_membership_id,
  objective_health_override_at,
  objective_review_comment,
  strategy_carry_source_id,
  strategy_carry_metadata
)
select
  o.id,
  o.organization_id,
  o.cycle_id,
  o.title,
  o.description,
  case
    when o.status = 'shifted'::text then 'active'::text
    else o.status
  end,
  o.owner_membership_id,
  o.deputy_membership_id,
  o.progress_percent,
  o.created_at,
  o.updated_at,
  o.cycle_instance_id,
  o.time_horizon,
  o.importance_score,
  o.ai_clarity_score,
  o.ai_strategic_relevance_score,
  o.ai_feasibility_score,
  o.ai_fit_to_company_score,
  o.ai_confidence_score,
  o.ai_external_internal_classification,
  o.ai_short_long_term_classification,
  o.ai_exploit_explore_classification,
  o.ai_issues_json,
  o.ai_improvement_suggestion,
  o.ai_summary,
  o.ai_objective_score,
  o.ai_evaluation_status,
  o.ai_evaluated_at,
  o.ai_evaluation_version,
  o.ai_manual_override,
  o.ai_manual_comment,
  o.created_by_membership_id,
  o.created_by_source,
  o.objective_health_override,
  o.objective_health_override_by_membership_id,
  o.objective_health_override_at,
  o.objective_review_comment,
  o.strategy_carry_source_id,
  o.strategy_carry_metadata
from app.objectives o
where o.okr_cycle_id is null;

insert into _split_old (old_id, strategy_id, okr_id)
select o.id, o.id, null::uuid
from app.objectives o
where o.okr_cycle_id is null;

delete from app.objectives o
where o.okr_cycle_id is null;

-- Nach Entfernen strategischer Zeilen: verbleibende OKR-Rows nochmals bereinigen.
update app.objectives o
set cycle_id = case
  when o.cycle_id is not null
    and exists (
      select 1
      from app.planning_cycles pc
      where pc.id = o.cycle_id
        and pc.organization_id = o.organization_id
    )
  then o.cycle_id
  else null
end;

-- Diese FKs verweisen auf app.objectives(id). Der Split schreibt neue IDs aus strategy_objectives / okr_objectives.
alter table app.strategic_direction_objective_links
  drop constraint if exists strategic_direction_objective_links_objective_id_fkey;

alter table app.objective_direction_links
  drop constraint if exists objective_direction_links_objective_id_fkey;

alter table app.objective_target_links
  drop constraint if exists objective_target_links_objective_id_fkey;

alter table app.objective_business_models
  drop constraint if exists objective_business_models_objective_id_fkey;

alter table app.objective_industries
  drop constraint if exists objective_industries_objective_id_fkey;

alter table app.objective_operating_models
  drop constraint if exists objective_operating_models_objective_id_fkey;

alter table app.cluster_objective_relations
  drop constraint if exists cluster_objective_relations_objective_id_fkey;

alter table app.strategy_correlation_status_overrides
  drop constraint if exists strategy_correlation_status_overrides_objective_id_fkey;

alter table app.key_results
  drop constraint if exists key_results_objective_id_fkey;

-- OKR-Zeilen: Split in neues Strategie-Ziel + OKR-Ziel + Verknuepfung
do $$
declare
  r record;
  sid uuid;
  oid uuid;
  st text;
begin
  for r in
    select * from app.objectives
  loop
    sid := gen_random_uuid ();
    oid := gen_random_uuid ();
    st := r.status;
    if st = 'shifted'::text then
      st := 'draft'::text;
    end if;

    insert into app.strategy_objectives (
      id,
      organization_id,
      cycle_id,
      title,
      description,
      status,
      owner_membership_id,
      deputy_membership_id,
      progress_percent,
      created_at,
      updated_at,
      cycle_instance_id,
      time_horizon,
      importance_score,
      ai_clarity_score,
      ai_strategic_relevance_score,
      ai_feasibility_score,
      ai_fit_to_company_score,
      ai_confidence_score,
      ai_external_internal_classification,
      ai_short_long_term_classification,
      ai_exploit_explore_classification,
      ai_issues_json,
      ai_improvement_suggestion,
      ai_summary,
      ai_objective_score,
      ai_evaluation_status,
      ai_evaluated_at,
      ai_evaluation_version,
      ai_manual_override,
      ai_manual_comment,
      created_by_membership_id,
      created_by_source,
      objective_health_override,
      objective_health_override_by_membership_id,
      objective_health_override_at,
      objective_review_comment,
      strategy_carry_source_id,
      strategy_carry_metadata
    )
    values (
      sid,
      r.organization_id,
      r.cycle_id,
      r.title,
      r.description,
      case
        when r.status = 'shifted'::text then 'active'::text
        else r.status
      end,
      r.owner_membership_id,
      r.deputy_membership_id,
      r.progress_percent,
      r.created_at,
      r.updated_at,
      r.cycle_instance_id,
      r.time_horizon,
      r.importance_score,
      r.ai_clarity_score,
      r.ai_strategic_relevance_score,
      r.ai_feasibility_score,
      r.ai_fit_to_company_score,
      r.ai_confidence_score,
      r.ai_external_internal_classification,
      r.ai_short_long_term_classification,
      r.ai_exploit_explore_classification,
      r.ai_issues_json,
      r.ai_improvement_suggestion,
      r.ai_summary,
      r.ai_objective_score,
      r.ai_evaluation_status,
      r.ai_evaluated_at,
      r.ai_evaluation_version,
      r.ai_manual_override,
      r.ai_manual_comment,
      r.created_by_membership_id,
      r.created_by_source,
      r.objective_health_override,
      r.objective_health_override_by_membership_id,
      r.objective_health_override_at,
      r.objective_review_comment,
      r.strategy_carry_source_id,
      r.strategy_carry_metadata
    );

    insert into app.okr_objectives (
      id,
      organization_id,
      cycle_id,
      cycle_instance_id,
      okr_cycle_id,
      title,
      description,
      status,
      owner_membership_id,
      deputy_membership_id,
      progress_percent,
      confidence_level,
      importance_score,
      time_horizon,
      created_by_membership_id,
      created_by_source,
      created_at,
      updated_at
    )
    values (
      oid,
      r.organization_id,
      r.cycle_id,
      r.cycle_instance_id,
      r.okr_cycle_id,
      r.title,
      r.description,
      r.status,
      r.owner_membership_id,
      r.deputy_membership_id,
      r.progress_percent,
      r.confidence_level,
      r.importance_score,
      r.time_horizon,
      r.created_by_membership_id,
      r.created_by_source,
      r.created_at,
      r.updated_at
    );

    insert into app.okr_objective_strategy_objectives (okr_objective_id, strategy_objective_id)
    values (oid, sid);

    update app.strategic_direction_objective_links l
    set objective_id = sid
    where l.objective_id = r.id;

    update app.objective_direction_links l
    set objective_id = sid
    where l.objective_id = r.id;

    update app.objective_target_links l
    set objective_id = sid
    where l.objective_id = r.id;

    update app.objective_business_models l
    set objective_id = sid
    where l.objective_id = r.id;

    update app.objective_industries l
    set objective_id = sid
    where l.objective_id = r.id;

    update app.objective_operating_models l
    set objective_id = sid
    where l.objective_id = r.id;

    update app.cluster_objective_relations l
    set objective_id = sid
    where l.objective_id = r.id;

    update app.strategy_correlation_status_overrides l
    set objective_id = sid
    where l.objective_id = r.id;

    update app.strategy_programs p
    set supported_objective_ids = (
      select coalesce(array_agg(
        case
          when x = r.id then sid
          else x
        end
      ), array[]::uuid[])
      from unnest(p.supported_objective_ids) as u (x)
    )
    where r.id = any (p.supported_objective_ids);

    update app.key_results kr
    set objective_id = oid
    where kr.objective_id = r.id;

    insert into _split_old (old_id, strategy_id, okr_id)
    values (r.id, sid, oid);

    delete from app.objectives o where o.id = r.id;
  end loop;
end
$$;

-- objectives sollte leer sein
do $$
declare
  c integer;
begin
  select count(*) into c from app.objectives;
  if c > 0 then
    raise exception '0114: app.objectives nicht leer nach Migration (% Zeilen)', c;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3) Umbenennung objective_id -> strategy_objective_id (strategische Tabellen)
-- ---------------------------------------------------------------------------

alter table app.objective_business_models
  drop constraint if exists objective_business_models_planning_cycle_id_objective_id_bu_key;

alter table app.objective_industries
  drop constraint if exists objective_industries_planning_cycle_id_objective_id_industr_key;

alter table app.objective_operating_models
  drop constraint if exists objective_operating_models_planning_cycle_id_objective_id_o_key;

alter table app.objective_direction_links
  drop constraint if exists objective_direction_links_planning_cycle_id_objective_id_st_key;

alter table app.objective_target_links
  drop constraint if exists objective_target_links_planning_cycle_id_objective_id_annua_key;

alter table app.strategic_direction_objective_links
  drop constraint if exists strategic_direction_objective_links_objective_id_fkey;

alter table app.strategic_direction_objective_links
  rename column objective_id to strategy_objective_id;

alter table app.strategic_direction_objective_links
  add constraint strategic_direction_objective_links_strategy_objective_id_fkey
  foreign key (strategy_objective_id) references app.strategy_objectives (id) on delete cascade;

drop index if exists app.uq_direction_objective_links_cycle;

create unique index uq_direction_strategy_objective_links_cycle
  on app.strategic_direction_objective_links (
    cycle_instance_id,
    strategic_direction_id,
    strategy_objective_id
  );

-- weiter FKs
alter table app.objective_direction_links
  drop constraint if exists objective_direction_links_objective_id_fkey;

alter table app.objective_direction_links
  rename column objective_id to strategy_objective_id;

alter table app.objective_direction_links
  add constraint objective_direction_links_strategy_objective_id_fkey
  foreign key (strategy_objective_id) references app.strategy_objectives (id) on delete cascade;

drop index if exists app.uq_objective_direction_links_cycle;

create unique index uq_objective_direction_links_cycle
  on app.objective_direction_links (
    cycle_instance_id,
    strategy_objective_id,
    strategic_direction_id
  );

alter table app.objective_target_links
  drop constraint if exists objective_target_links_objective_id_fkey;

alter table app.objective_target_links
  rename column objective_id to strategy_objective_id;

alter table app.objective_target_links
  add constraint objective_target_links_strategy_objective_id_fkey
  foreign key (strategy_objective_id) references app.strategy_objectives (id) on delete cascade;

drop index if exists app.uq_objective_target_links_cycle;

create unique index uq_objective_target_links_cycle
  on app.objective_target_links (
    cycle_instance_id,
    strategy_objective_id,
    annual_target_id
  );

alter table app.objective_business_models
  drop constraint if exists objective_business_models_objective_id_fkey;

alter table app.objective_business_models
  rename column objective_id to strategy_objective_id;

alter table app.objective_business_models
  add constraint objective_business_models_strategy_objective_id_fkey
  foreign key (strategy_objective_id) references app.strategy_objectives (id) on delete cascade;

alter table app.objective_business_models
  add constraint objective_business_models_planning_cycle_id_strategy_objective_bu_key unique (
    planning_cycle_id,
    strategy_objective_id,
    business_model_id
  );

alter table app.objective_industries
  drop constraint if exists objective_industries_objective_id_fkey;

alter table app.objective_industries
  rename column objective_id to strategy_objective_id;

alter table app.objective_industries
  add constraint objective_industries_strategy_objective_id_fkey
  foreign key (strategy_objective_id) references app.strategy_objectives (id) on delete cascade;

alter table app.objective_industries
  add constraint objective_industries_planning_cycle_id_strategy_objective_industr_key unique (
    planning_cycle_id,
    strategy_objective_id,
    industry_id
  );

alter table app.objective_operating_models
  drop constraint if exists objective_operating_models_objective_id_fkey;

alter table app.objective_operating_models
  rename column objective_id to strategy_objective_id;

alter table app.objective_operating_models
  add constraint objective_operating_models_strategy_objective_id_fkey
  foreign key (strategy_objective_id) references app.strategy_objectives (id) on delete cascade;

alter table app.objective_operating_models
  add constraint objective_operating_models_planning_cycle_id_strategy_objective_o_key unique (
    planning_cycle_id,
    strategy_objective_id,
    operating_model_id
  );

alter table app.objective_direction_links
  add constraint objective_direction_links_planning_cycle_id_strategy_objective_st_key unique (
    planning_cycle_id,
    strategy_objective_id,
    strategic_direction_id
  );

alter table app.objective_target_links
  add constraint objective_target_links_planning_cycle_id_strategy_objective_annua_key unique (
    planning_cycle_id,
    strategy_objective_id,
    annual_target_id
  );

alter table app.cluster_objective_relations
  drop constraint if exists cluster_objective_relations_objective_id_fkey;

alter table app.cluster_objective_relations
  rename column objective_id to strategy_objective_id;

alter table app.cluster_objective_relations
  add constraint cluster_objective_relations_strategy_objective_id_fkey
  foreign key (strategy_objective_id) references app.strategy_objectives (id) on delete cascade;

drop index if exists app.uq_cluster_objective_relations_cycle_cluster_objective;

create unique index uq_cluster_objective_relations_cycle_cluster_strategy_objective
  on app.cluster_objective_relations (cycle_instance_id, cluster_id, strategy_objective_id);

alter table app.strategy_correlation_status_overrides
  drop constraint if exists strategy_correlation_status_overrides_objective_id_fkey;

alter table app.strategy_correlation_status_overrides
  rename column objective_id to strategy_objective_id;

alter table app.strategy_correlation_status_overrides
  add constraint strategy_correlation_status_overrides_strategy_objective_id_fkey
  foreign key (strategy_objective_id) references app.strategy_objectives (id) on delete cascade;

drop index if exists app.uq_strategy_correlation_status_overrides_triplet;

create unique index uq_strategy_correlation_status_overrides_triplet
  on app.strategy_correlation_status_overrides (
    cycle_instance_id,
    strategy_objective_id,
    challenge_id,
    strategic_direction_id
  );

-- key_results
alter table app.key_results
  drop constraint if exists key_results_objective_id_fkey;

alter table app.key_results
  rename column objective_id to okr_objective_id;

alter table app.key_results
  add constraint key_results_okr_objective_id_fkey
  foreign key (okr_objective_id) references app.okr_objectives (id) on delete cascade;

drop index if exists app.idx_key_results_org_objective;

create index idx_key_results_org_okr_objective on app.key_results (organization_id, okr_objective_id);

-- Alte objectives-Tabelle entfernen
drop trigger if exists trg_audit_objectives on app.objectives;

drop trigger if exists trg_objectives_require_context on app.objectives;

drop trigger if exists trg_objectives_updated_at on app.objectives;

drop trigger if exists trg_sync_cycles_objectives on app.objectives;

-- Verbleibende FKs auf app.objectives (z. B. spaetere Migrationen / lokale Varianten).
do $$
declare
  r record;
begin
  for r in
    select
      c.conname,
      c.conrelid::regclass as tbl
    from
      pg_constraint c
    where
      c.confrelid = 'app.objectives'::regclass
      and c.contype = 'f'
  loop
    execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
  end loop;
end
$$;

-- Ohne CASCADE: kann z. B. eine Legacy-View auf app.objectives blockieren (kein FK in pg_constraint).
drop table if exists app.objectives cascade;

-- Audit / Sync / updated_at auf neuen Tabellen
create trigger trg_audit_strategy_objectives
after insert or delete or update on app.strategy_objectives
for each row
execute function audit.log_row_change ();

create trigger trg_audit_okr_objectives
after insert or delete or update on app.okr_objectives
for each row
execute function audit.log_row_change ();

create trigger trg_strategy_objectives_updated_at
before update on app.strategy_objectives
for each row
execute function app.set_updated_at ();

create trigger trg_okr_objectives_updated_at
before update on app.okr_objectives
for each row
execute function app.set_updated_at ();

create trigger trg_sync_cycles_strategy_objectives
before insert or update on app.strategy_objectives
for each row
execute function app.sync_legacy_cycle_columns ();

create trigger trg_sync_cycles_okr_objectives
before insert or update on app.okr_objectives
for each row
execute function app.sync_legacy_cycle_columns ();

-- Kontext-Trigger Strategie
create trigger trg_strategy_objectives_require_context
before insert on app.strategy_objectives
for each row
execute function app.ensure_objective_context ();

-- RLS
alter table app.strategy_objectives enable row level security;

alter table app.okr_objectives enable row level security;

create policy strategy_objectives_select on app.strategy_objectives for
select
  using (app.is_member_of_org (organization_id));

drop policy if exists objectives_modify on app.strategy_objectives;

create policy strategy_objectives_modify on app.strategy_objectives for all using (
  app.has_permission (organization_id, 'nav.strategy-cycle.write'::text)
  or app.has_permission (organization_id, 'nav.strategy-matrix.write'::text)
  or app.has_permission (organization_id, 'okr.write'::text)
)
with check (
  app.has_permission (organization_id, 'nav.strategy-cycle.write'::text)
  or app.has_permission (organization_id, 'nav.strategy-matrix.write'::text)
  or app.has_permission (organization_id, 'okr.write'::text)
);

create policy okr_objectives_select on app.okr_objectives for
select
  using (app.is_member_of_org (organization_id));

create policy okr_objectives_modify on app.okr_objectives for all using (
  app.has_permission (organization_id, 'nav.strategy-cycle.write'::text)
  or app.has_permission (organization_id, 'nav.strategy-matrix.write'::text)
  or (
    app.has_permission (organization_id, 'okr.write'::text)
    and app.okr_can_modify_objective (organization_id, owner_membership_id, deputy_membership_id)
  )
)
with check (
  app.has_permission (organization_id, 'nav.strategy-cycle.write'::text)
  or app.has_permission (organization_id, 'nav.strategy-matrix.write'::text)
  or (
    app.has_permission (organization_id, 'okr.write'::text)
    and app.okr_can_modify_objective (organization_id, owner_membership_id, deputy_membership_id)
  )
);

alter table app.okr_objective_strategy_objectives enable row level security;

create policy okr_strategy_links_select on app.okr_objective_strategy_objectives for
select
  using (
    exists (
      select 1
      from app.okr_objectives o
      where
        o.id = okr_objective_strategy_objectives.okr_objective_id
        and app.is_member_of_org (o.organization_id)
    )
  );

create policy okr_strategy_links_modify on app.okr_objective_strategy_objectives for all using (
  exists (
    select 1
    from app.okr_objectives o
    where
      o.id = okr_objective_strategy_objectives.okr_objective_id
      and (
        app.has_permission (o.organization_id, 'okr.write'::text)
        or app.has_permission (o.organization_id, 'nav.strategy-cycle.write'::text)
      )
  )
)
with check (
  exists (
    select 1
    from app.okr_objectives o
    where
      o.id = okr_objective_strategy_objectives.okr_objective_id
      and (
        app.has_permission (o.organization_id, 'okr.write'::text)
        or app.has_permission (o.organization_id, 'nav.strategy-cycle.write'::text)
      )
  )
);

-- key_results Policies: Join okr_objectives statt objectives
drop policy if exists key_results_modify on app.key_results;

create policy key_results_modify on app.key_results for all using (
  app.has_permission (organization_id, 'okr.write'::text)
  and exists (
    select
      1
    from
      app.okr_objectives o
    where
      o.id = key_results.okr_objective_id
      and o.organization_id = key_results.organization_id
      and app.okr_can_modify_key_result (
        key_results.organization_id,
        key_results.owner_membership_id,
        key_results.deputy_membership_id,
        o.owner_membership_id,
        o.deputy_membership_id
      )
  )
)
with check (
  app.has_permission (organization_id, 'okr.write'::text)
  and exists (
    select
      1
    from
      app.okr_objectives o
    where
      o.id = key_results.okr_objective_id
      and o.organization_id = key_results.organization_id
      and app.okr_can_modify_key_result (
        key_results.organization_id,
        key_results.owner_membership_id,
        key_results.deputy_membership_id,
        o.owner_membership_id,
        o.deputy_membership_id
      )
  )
);

-- ensure_key_result_context
create or replace function app.ensure_key_result_context () returns trigger
language plpgsql
as $$
declare
  v_cycle_id uuid;
  v_cycle_instance_id uuid;
  v_org_id uuid;
  v_has_objective_links boolean;
begin
  select
    o.cycle_id,
    o.cycle_instance_id,
    o.organization_id into v_cycle_id,
    v_cycle_instance_id,
    v_org_id
  from
    app.okr_objectives o
  where
    o.id = new.okr_objective_id;

  if v_org_id is null then
    raise exception 'Cannot create key result: okr objective context not found.';
  end if;

  if v_org_id <> new.organization_id then
    raise exception 'Cannot create key result: organization mismatch.';
  end if;

  if v_cycle_id is null and v_cycle_instance_id is null then
    raise exception 'Cannot create key result: okr objective has no cycle context.';
  end if;

  v_has_objective_links := false;

  if v_cycle_id is not null then
    select
      exists (
        select
          1
        from
          app.okr_objective_strategy_objectives j
          join app.objective_target_links l on l.strategy_objective_id = j.strategy_objective_id
        where
          j.okr_objective_id = new.okr_objective_id
          and l.organization_id = new.organization_id
          and l.planning_cycle_id = v_cycle_id
      )
    into v_has_objective_links;

    if not v_has_objective_links then
      select
        exists (
          select
            1
          from
            app.okr_objective_strategy_objectives j
            join app.objective_direction_links l on l.strategy_objective_id = j.strategy_objective_id
          where
            j.okr_objective_id = new.okr_objective_id
            and l.organization_id = new.organization_id
            and l.planning_cycle_id = v_cycle_id
        )
      into v_has_objective_links;
    end if;
  end if;

  if not v_has_objective_links and v_cycle_instance_id is not null then
    select
      exists (
        select
          1
        from
          app.okr_objective_strategy_objectives j
          join app.strategic_direction_objective_links l on l.strategy_objective_id = j.strategy_objective_id
        where
          j.okr_objective_id = new.okr_objective_id
          and l.organization_id = new.organization_id
          and l.cycle_instance_id = v_cycle_instance_id
      )
    into v_has_objective_links;
  end if;

  if not v_has_objective_links then
    raise exception 'Cannot create key result: okr objective is not linked to a strategy objective with direction/target context.';
  end if;

  return new;
end;
$$;

-- ensure_objective_context bleibt fuer strategy_objectives; Trigger zeigt auf strategy_objectives (s.u.)

comment on column app.key_results.okr_objective_id is 'FK zum zeitlich begrenzten OKR-Objective (Key Results nie am Strategie-Ziel).';

comment on column app.strategy_programs.supported_objective_ids is 'UUIDs von app.strategy_objectives (Matrix-/Programmkontext).';

-- prepare_strategy_review: Scope + Payload nutzt strategy_objectives + KRs ueber OKR-Verknuepfung
create or replace function app.prepare_strategy_review (p_review_id uuid) returns void
language plpgsql
security definer
set search_path to app, public
as $$
declare
  v_org uuid;
  v_ci uuid;
  v_challenge_ids uuid[];
  v_focus_ids uuid[];
  v_obj_ids uuid[];
  v_payload jsonb;
begin
  select
    organization_id,
    cycle_instance_id into v_org,
    v_ci
  from
    app.okr_reviews
  where
    id = p_review_id
    and review_mode = 'strategy_review';

  if v_ci is null then
    raise exception 'prepare_strategy_review: not found';
  end if;

  if not app.has_permission (v_org, 'strategy_review.moderate') then
    raise exception 'prepare_strategy_review: forbidden';
  end if;

  select
    coalesce(array_agg(id order by title), array[]::uuid[]) into v_challenge_ids
  from
    app.strategic_challenges
  where
    organization_id = v_org
    and cycle_instance_id = v_ci;

  select
    coalesce(array_agg(id order by title), array[]::uuid[]) into v_focus_ids
  from
    app.strategic_directions
  where
    organization_id = v_org
    and cycle_instance_id = v_ci;

  select
    coalesce(array_agg(id order by title), array[]::uuid[]) into v_obj_ids
  from
    app.strategy_objectives
  where
    organization_id = v_org
    and cycle_instance_id = v_ci;

  v_payload := jsonb_build_object(
    'generated_at',
    to_jsonb (now()),
    'scope',
    jsonb_build_object(
      'challenge_ids',
      coalesce(to_jsonb (v_challenge_ids), '[]'::jsonb),
      'focus_area_ids',
      coalesce(to_jsonb (v_focus_ids), '[]'::jsonb),
      'objective_ids',
      coalesce(to_jsonb (v_obj_ids), '[]'::jsonb)
    ),
    'challenges',
    coalesce((
      select
        jsonb_agg(
          jsonb_build_object(
            'id',
            c.id,
            'title',
            c.title,
            'description',
            c.description,
            'priority',
            c.priority,
            'visibility',
            c.visibility
          )
          order by
            c.title
        )
      from
        app.strategic_challenges c
      where
        c.organization_id = v_org
        and c.cycle_instance_id = v_ci
    ), '[]'::jsonb),
    'focus_areas',
    coalesce((
      select
        jsonb_agg(
          jsonb_build_object(
            'id',
            d.id,
            'title',
            d.title,
            'description',
            d.description,
            'status',
            d.status,
            'priority',
            d.priority
          )
          order by
            d.title
        )
      from
        app.strategic_directions d
      where
        d.organization_id = v_org
        and d.cycle_instance_id = v_ci
    ), '[]'::jsonb),
    'objectives',
    coalesce((
      select
        jsonb_agg(x.obj order by x.sort_title)
      from (
        select
          s.title as sort_title,
          jsonb_build_object(
            'id',
            s.id,
            'title',
            s.title,
            'description',
            s.description,
            'status',
            s.status,
            'progress_percent',
            s.progress_percent,
            'key_results',
            coalesce((
              select
                jsonb_agg(
                  jsonb_build_object(
                    'id',
                    kr.id,
                    'title',
                    kr.title,
                    'metric_type',
                    kr.metric_type,
                    'target_value',
                    kr.target_value,
                    'current_value',
                    kr.current_value
                  )
                  order by
                    kr.title
                )
              from
                app.key_results kr
                join app.okr_objective_strategy_objectives j on j.okr_objective_id = kr.okr_objective_id
              where
                j.strategy_objective_id = s.id
            ), '[]'::jsonb)
          ) as obj
        from
          app.strategy_objectives s
        where
          s.organization_id = v_org
          and s.cycle_instance_id = v_ci
      ) x
    ), '[]'::jsonb)
  );

  update app.okr_reviews
  set
    pre_read_payload = v_payload,
    procedure_status = 'pre_read_open'
  where
    id = p_review_id
    and procedure_status = 'announcement_sent';

  if not found then
    raise exception 'prepare_strategy_review: expected procedure_status announcement_sent';
  end if;
end;
$$;

-- OKR Shift auf okr_objectives + Junction statt Richtungs-Link fuer neues OKR
create or replace function app.okr_shift_objective_to_next_cycle (
  p_organization_id uuid,
  p_cycle_instance_id uuid,
  p_objective_id uuid,
  p_from_okr_cycle_id uuid,
  p_to_okr_cycle_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to app, public
as $$
declare
  v_mid uuid;
  v_obj record;
  v_from_oc record;
  v_to_oc record;
  v_scope uuid[];
  v_sid uuid;
  v_new_okr_id uuid;
  v_kr record;
  v_new_kr_id uuid;
  v_to_end date;
begin
  v_mid := app.current_membership_id (p_organization_id);
  if v_mid is null then
    return jsonb_build_object('error', 'Nicht angemeldet oder keine Mitgliedschaft.');
  end if;

  if p_from_okr_cycle_id = p_to_okr_cycle_id then
    return jsonb_build_object('error', 'Quell- und Ziel-OKR-Zyklus duerfen nicht identisch sein.');
  end if;

  select
    o.*
  into v_obj
  from
    app.okr_objectives o
  where
    o.id = p_objective_id
    and o.organization_id = p_organization_id
    and o.cycle_instance_id = p_cycle_instance_id
    and o.okr_cycle_id = p_from_okr_cycle_id;

  if v_obj.id is null then
    return jsonb_build_object('error', 'OKR-Objective nicht gefunden oder falscher Zeitraum.');
  end if;

  if v_obj.status in ('shifted', 'archived') then
    return jsonb_build_object('error', 'OKR-Objective kann nicht verschoben werden (Status).');
  end if;

  if not (
    app.has_permission (p_organization_id, 'nav.strategy-cycle.write')
    or app.has_permission (p_organization_id, 'nav.strategy-matrix.write')
    or (
      app.has_permission (p_organization_id, 'okr.write')
      and app.okr_can_modify_objective (
        p_organization_id,
        v_obj.owner_membership_id,
        v_obj.deputy_membership_id
      )
    )
  ) then
    return jsonb_build_object('error', 'Keine Berechtigung zum Verschieben.');
  end if;

  select
    oc.id,
    oc.organization_id,
    oc.cycle_instance_id
  into v_from_oc
  from
    app.okr_cycles oc
  where
    oc.id = p_from_okr_cycle_id
    and oc.organization_id = p_organization_id;

  if v_from_oc.id is null then
    return jsonb_build_object('error', 'Ungueltiger Quell-OKR-Zyklus.');
  end if;

  select
    oc.id,
    oc.organization_id,
    oc.cycle_instance_id,
    oc.end_date
  into v_to_oc
  from
    app.okr_cycles oc
  where
    oc.id = p_to_okr_cycle_id
    and oc.organization_id = p_organization_id;

  if v_to_oc.id is null then
    return jsonb_build_object('error', 'Ungueltiger Ziel-OKR-Zyklus.');
  end if;

  v_scope := app.okr_cycle_instance_scope_ids (p_organization_id, p_cycle_instance_id);

  if not (
    v_from_oc.cycle_instance_id = any (v_scope)
    and v_to_oc.cycle_instance_id = any (v_scope)
  ) then
    return jsonb_build_object('error', 'OKR-Zyklus liegt ausserhalb des gueltigen Scopes.');
  end if;

  select
    j.strategy_objective_id
  into v_sid
  from
    app.okr_objective_strategy_objectives j
  where
    j.okr_objective_id = p_objective_id
  order by
    j.created_at asc
  limit 1;

  if v_sid is null then
    return jsonb_build_object('error', 'Kein Strategie-Ziel verknuepft — Verschieben abgebrochen.');
  end if;

  v_to_end := v_to_oc.end_date;

  update app.okr_objectives
  set
    status = 'shifted',
    updated_at = now()
  where
    id = p_objective_id
    and organization_id = p_organization_id;

  insert into app.okr_objectives (
    organization_id,
    cycle_instance_id,
    cycle_id,
    okr_cycle_id,
    title,
    description,
    status,
    owner_membership_id,
    deputy_membership_id,
    progress_percent,
    confidence_level,
    importance_score,
    time_horizon,
    created_by_membership_id,
    created_by_source
  )
  values (
    p_organization_id,
    p_cycle_instance_id,
    v_obj.cycle_id,
    p_to_okr_cycle_id,
    v_obj.title,
    v_obj.description,
    'draft',
    v_obj.owner_membership_id,
    v_obj.deputy_membership_id,
    v_obj.progress_percent,
    v_obj.confidence_level,
    v_obj.importance_score,
    v_obj.time_horizon,
    v_mid,
    coalesce (v_obj.created_by_source, 'user')
  )
  returning id into v_new_okr_id;

  insert into app.okr_objective_strategy_objectives (okr_objective_id, strategy_objective_id)
  values (v_new_okr_id, v_sid);

  for v_kr in
    select
      kr.*
    from
      app.key_results kr
    where
      kr.okr_objective_id = p_objective_id
      and kr.organization_id = p_organization_id
      and app.kr_metric_progress_pct (
        kr.metric_type,
        kr.start_value,
        kr.target_value,
        kr.current_value
      ) < 100
    order by
      kr.created_at asc,
      kr.id asc
  loop
    insert into app.key_results (
      organization_id,
      okr_objective_id,
      title,
      metric_type,
      start_value,
      target_value,
      current_value,
      status,
      due_date,
      measurement_unit,
      owner_membership_id,
      deputy_membership_id,
      created_by_membership_id,
      created_by_source
    )
    values (
      p_organization_id,
      v_new_okr_id,
      v_kr.title,
      v_kr.metric_type,
      v_kr.start_value,
      v_kr.target_value,
      v_kr.current_value,
      v_kr.status,
      v_to_end,
      v_kr.measurement_unit,
      v_kr.owner_membership_id,
      v_kr.deputy_membership_id,
      coalesce (v_kr.created_by_membership_id, v_mid),
      coalesce (v_kr.created_by_source, 'user')
    )
    returning id into v_new_kr_id;

    update app.initiative_key_result_links l
    set
      key_result_id = v_new_kr_id
    where
      l.organization_id = p_organization_id
      and l.cycle_instance_id = p_cycle_instance_id
      and l.key_result_id = v_kr.id;

    insert into app.okr_updates (
      id,
      organization_id,
      planning_cycle_id,
      okr_cycle_id,
      key_result_id,
      progress_value,
      confidence_level,
      comment,
      created_by_membership_id,
      created_at,
      cycle_instance_id
    )
    select
      gen_random_uuid (),
      u.organization_id,
      u.planning_cycle_id,
      p_to_okr_cycle_id,
      v_new_kr_id,
      u.progress_value,
      u.confidence_level,
      u.comment,
      u.created_by_membership_id,
      u.created_at,
      p_cycle_instance_id
    from
      app.okr_updates u
    where
      u.key_result_id = v_kr.id
      and u.organization_id = p_organization_id;
  end loop;

  return jsonb_build_object(
    'new_objective_id',
    v_new_okr_id,
    'new_okr_cycle_id',
    p_to_okr_cycle_id
  );
end;
$$;

revoke all on function app.okr_shift_objective_to_next_cycle (uuid, uuid, uuid, uuid, uuid)
from public;

grant execute on function app.okr_shift_objective_to_next_cycle (uuid, uuid, uuid, uuid, uuid) to authenticated;

-- apply_strategy_review_decisions: Objectives -> strategy_objectives; KRs an neue OKR-Kopien
create or replace function app.apply_strategy_review_decisions (
  p_review_id uuid,
  p_from_cycle_instance_id uuid,
  p_to_cycle_instance_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to app, public
as $$
declare
  v_org uuid;
  v_planning_to uuid;
  v_dec jsonb;
  v_challenge_map jsonb := '{}'::jsonb;
  v_direction_map jsonb := '{}'::jsonb;
  v_strategy_objective_map jsonb := '{}'::jsonb;
  v_okr_objective_map jsonb := '{}'::jsonb;
  v_kr_map jsonb := '{}'::jsonb;
  v_program_map jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_old uuid;
  v_new_str uuid;
  v_new_okr uuid;
  v_decision text;
  v_rec record;
  v_summary jsonb := '{}'::jsonb;
  v_programs_skipped jsonb := '[]'::jsonb;
  v_inits_skipped jsonb := '[]'::jsonb;
  v_kr record;
  v_new_kr uuid;
  v_prog record;
  v_init record;
  v_new_prog uuid;
  v_new_init uuid;
  v_supported uuid[];
  v_mapped uuid[];
  v_dir_ok boolean;
  v_ch_ok boolean;
  v_okr record;
  v_to_okr uuid;
begin
  select
    organization_id,
    decision_payload into v_org,
    v_dec
  from
    app.okr_reviews
  where
    id = p_review_id;

  if v_org is null or v_dec is null or v_dec = '{}'::jsonb then
    raise exception 'apply_strategy_review_decisions: missing review or decisions';
  end if;

  select
    legacy_planning_cycle_id into v_planning_to
  from
    app.cycle_instances
  where
    id = p_to_cycle_instance_id
    and organization_id = v_org;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'challenges', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('keep', 'adjust') then
      select
        * into v_rec
      from
        app.strategic_challenges
      where
        id = v_old
        and organization_id = v_org;
      if not found then
        raise exception 'challenge % not found', v_old;
      end if;
      insert into app.strategic_challenges (
        organization_id,
        planning_cycle_id,
        title,
        priority,
        visibility,
        created_by_membership_id,
        source_analysis_entry_id,
        cycle_instance_id,
        relevance_level,
        risk_level,
        description,
        impact_score,
        urgency_score,
        scope_score,
        root_cause_score,
        challenge_score,
        created_by_source,
        source_cluster_id,
        strategy_carry_source_id,
        strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case
          when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title)
          else v_rec.title
        end,
        v_rec.priority,
        v_rec.visibility,
        v_rec.created_by_membership_id,
        v_rec.source_analysis_entry_id,
        p_to_cycle_instance_id,
        v_rec.relevance_level,
        v_rec.risk_level,
        case
          when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description)
          else v_rec.description
        end,
        v_rec.impact_score,
        v_rec.urgency_score,
        v_rec.scope_score,
        v_rec.root_cause_score,
        v_rec.challenge_score,
        v_rec.created_by_source,
        v_rec.source_cluster_id,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object(
          'strategy_review_carry',
          true,
          'decision',
          v_decision
        )
      )
      returning id into v_new_str;
      v_challenge_map := v_challenge_map || jsonb_build_object(v_old::text, v_new_str);
    elsif v_decision = 'replace' then
      insert into app.strategic_challenges (
        organization_id,
        planning_cycle_id,
        title,
        priority,
        visibility,
        cycle_instance_id,
        relevance_level,
        risk_level,
        description,
        impact_score,
        urgency_score,
        scope_score,
        root_cause_score,
        challenge_score,
        created_by_source,
        strategy_carry_metadata
      )
      values (
        v_org,
        v_planning_to,
        coalesce(v_elem #>> '{replacement,title}', 'Challenge'),
        3,
        'internal',
        p_to_cycle_instance_id,
        3,
        3,
        v_elem #>> '{replacement,description}',
        3,
        3,
        3,
        3,
        3,
        'user',
        jsonb_build_object('strategy_review_replace_of', v_old::text)
      )
      returning id into v_new_str;
      v_challenge_map := v_challenge_map || jsonb_build_object(v_old::text, v_new_str);
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'focus_areas', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('double_down', 'adjust') then
      select
        * into v_rec
      from
        app.strategic_directions
      where
        id = v_old
        and organization_id = v_org;
      if not found then
        raise exception 'direction % not found', v_old;
      end if;
      insert into app.strategic_directions (
        organization_id,
        planning_cycle_id,
        title,
        description,
        owner_membership_id,
        priority,
        status,
        grouping,
        created_by_membership_id,
        cycle_instance_id,
        relevance_level,
        risk_level,
        strategic_value_score,
        capability_fit_score,
        feasibility_score,
        created_by_source,
        review_comment,
        strategy_carry_source_id,
        strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case
          when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title)
          else v_rec.title
        end,
        case
          when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description)
          else v_rec.description
        end,
        v_rec.owner_membership_id,
        v_rec.priority,
        v_rec.status,
        v_rec.grouping,
        v_rec.created_by_membership_id,
        p_to_cycle_instance_id,
        v_rec.relevance_level,
        v_rec.risk_level,
        v_rec.strategic_value_score,
        v_rec.capability_fit_score,
        v_rec.feasibility_score,
        v_rec.created_by_source,
        v_rec.review_comment,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object(
          'strategy_review_carry',
          true,
          'decision',
          v_decision
        )
      )
      returning id into v_new_str;
      v_direction_map := v_direction_map || jsonb_build_object(v_old::text, v_new_str);
    end if;
  end loop;

  select
    decision_payload into v_dec
  from
    app.okr_reviews
  where
    id = p_review_id;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'objectives', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('keep', 'change') then
      select
        * into v_rec
      from
        app.strategy_objectives
      where
        id = v_old
        and organization_id = v_org;
      if not found then
        raise exception 'strategy objective % not found', v_old;
      end if;
      insert into app.strategy_objectives (
        organization_id,
        cycle_id,
        title,
        description,
        status,
        owner_membership_id,
        deputy_membership_id,
        progress_percent,
        cycle_instance_id,
        time_horizon,
        importance_score,
        ai_clarity_score,
        ai_strategic_relevance_score,
        ai_feasibility_score,
        ai_fit_to_company_score,
        ai_confidence_score,
        ai_external_internal_classification,
        ai_short_long_term_classification,
        ai_exploit_explore_classification,
        ai_issues_json,
        ai_improvement_suggestion,
        ai_summary,
        ai_objective_score,
        ai_evaluation_status,
        ai_evaluated_at,
        ai_evaluation_version,
        ai_manual_override,
        ai_manual_comment,
        created_by_membership_id,
        created_by_source,
        objective_health_override,
        objective_health_override_by_membership_id,
        objective_health_override_at,
        objective_review_comment,
        strategy_carry_source_id,
        strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case
          when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title)
          else v_rec.title
        end,
        case
          when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description)
          else v_rec.description
        end,
        v_rec.status,
        v_rec.owner_membership_id,
        v_rec.deputy_membership_id,
        v_rec.progress_percent,
        p_to_cycle_instance_id,
        case
          when v_decision = 'change' then coalesce(
            v_elem #>> '{proposed_changes,time_horizon}',
            v_rec.time_horizon
          )
          else v_rec.time_horizon
        end,
        v_rec.importance_score,
        v_rec.ai_clarity_score,
        v_rec.ai_strategic_relevance_score,
        v_rec.ai_feasibility_score,
        v_rec.ai_fit_to_company_score,
        v_rec.ai_confidence_score,
        v_rec.ai_external_internal_classification,
        v_rec.ai_short_long_term_classification,
        v_rec.ai_exploit_explore_classification,
        v_rec.ai_issues_json,
        v_rec.ai_improvement_suggestion,
        v_rec.ai_summary,
        v_rec.ai_objective_score,
        v_rec.ai_evaluation_status,
        v_rec.ai_evaluated_at,
        v_rec.ai_evaluation_version,
        v_rec.ai_manual_override,
        v_rec.ai_manual_comment,
        v_rec.created_by_membership_id,
        v_rec.created_by_source,
        v_rec.objective_health_override,
        v_rec.objective_health_override_by_membership_id,
        v_rec.objective_health_override_at,
        v_rec.objective_review_comment,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object(
          'strategy_review_carry',
          true,
          'decision',
          v_decision
        )
      )
      returning id into v_new_str;
      v_strategy_objective_map := v_strategy_objective_map || jsonb_build_object(v_old::text, v_new_str);

      for v_okr in
        select
          o.*
        from
          app.okr_objectives o
          join app.okr_objective_strategy_objectives j on j.okr_objective_id = o.id
        where
          j.strategy_objective_id = v_old
          and o.organization_id = v_org
          and o.cycle_instance_id = p_from_cycle_instance_id
      loop
        select
          oc2.id into v_to_okr
        from
          app.okr_cycles oc1
          join app.okr_cycles oc2
            on oc1.organization_id = oc2.organization_id
            and oc1.start_date = oc2.start_date
            and oc1.end_date = oc2.end_date
        where
          oc1.id = v_okr.okr_cycle_id
          and oc2.cycle_instance_id = p_to_cycle_instance_id
        limit 1;
        if v_to_okr is null then
          continue;
        end if;
        insert into app.okr_objectives (
          organization_id,
          cycle_id,
          cycle_instance_id,
          okr_cycle_id,
          title,
          description,
          status,
          owner_membership_id,
          deputy_membership_id,
          progress_percent,
          confidence_level,
          importance_score,
          time_horizon,
          created_by_membership_id,
          created_by_source
        )
        values (
          v_okr.organization_id,
          v_planning_to,
          p_to_cycle_instance_id,
          v_to_okr,
          v_okr.title,
          v_okr.description,
          case v_okr.status
            when 'shifted' then 'draft'::text
            else v_okr.status
          end,
          v_okr.owner_membership_id,
          v_okr.deputy_membership_id,
          v_okr.progress_percent,
          v_okr.confidence_level,
          v_okr.importance_score,
          v_okr.time_horizon,
          v_okr.created_by_membership_id,
          v_okr.created_by_source
        )
        returning id into v_new_okr;
        v_okr_objective_map := v_okr_objective_map || jsonb_build_object(v_okr.id::text, v_new_okr);
        insert into app.okr_objective_strategy_objectives (okr_objective_id, strategy_objective_id)
        values (v_new_okr, v_new_str);
        for v_kr in
          select
            kr.*
          from
            app.key_results kr
          where
            kr.okr_objective_id = v_okr.id
        loop
          insert into app.key_results (
            organization_id,
            okr_objective_id,
            title,
            metric_type,
            start_value,
            target_value,
            current_value,
            status,
            due_date,
            measurement_unit,
            created_by_membership_id,
            created_by_source,
            owner_membership_id,
            deputy_membership_id
          )
          values (
            v_kr.organization_id,
            v_new_okr,
            v_kr.title,
            v_kr.metric_type,
            v_kr.start_value,
            v_kr.target_value,
            v_kr.current_value,
            v_kr.status,
            v_kr.due_date,
            v_kr.measurement_unit,
            v_kr.created_by_membership_id,
            v_kr.created_by_source,
            v_kr.owner_membership_id,
            v_kr.deputy_membership_id
          )
          returning id into v_new_kr;
          v_kr_map := v_kr_map || jsonb_build_object(v_kr.id::text, v_new_kr);
        end loop;
      end loop;
    end if;
  end loop;

  insert into app.objective_direction_links (
    organization_id,
    planning_cycle_id,
    strategy_objective_id,
    strategic_direction_id,
    contribution_level,
    comment,
    cycle_instance_id
  )
  select
    l.organization_id,
    v_planning_to,
    (v_strategy_objective_map ->> l.strategy_objective_id::text)::uuid,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    l.contribution_level,
    l.comment,
    p_to_cycle_instance_id
  from
    app.objective_direction_links l
  where
    l.cycle_instance_id = p_from_cycle_instance_id
    and v_strategy_objective_map ? l.strategy_objective_id::text
    and v_direction_map ? l.strategic_direction_id::text;

  insert into app.strategic_direction_objective_links (
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    strategic_direction_id,
    strategy_objective_id,
    created_by_membership_id,
    contribution_level
  )
  select
    l.organization_id,
    v_planning_to,
    p_to_cycle_instance_id,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    (v_strategy_objective_map ->> l.strategy_objective_id::text)::uuid,
    l.created_by_membership_id,
    l.contribution_level
  from
    app.strategic_direction_objective_links l
  where
    l.cycle_instance_id = p_from_cycle_instance_id
    and v_strategy_objective_map ? l.strategy_objective_id::text
    and v_direction_map ? l.strategic_direction_id::text;

  insert into app.challenge_direction_links (
    organization_id,
    planning_cycle_id,
    strategic_direction_id,
    strategic_challenge_id,
    contribution_level,
    note,
    created_by_membership_id,
    cycle_instance_id
  )
  select
    l.organization_id,
    v_planning_to,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    (v_challenge_map ->> l.strategic_challenge_id::text)::uuid,
    l.contribution_level,
    l.note,
    l.created_by_membership_id,
    p_to_cycle_instance_id
  from
    app.challenge_direction_links l
  where
    l.cycle_instance_id = p_from_cycle_instance_id
    and v_direction_map ? l.strategic_direction_id::text
    and v_challenge_map ? l.strategic_challenge_id::text;

  for v_prog in
    select
      *
    from
      app.strategy_programs
    where
      organization_id = v_org
      and cycle_instance_id = p_from_cycle_instance_id
  loop
    v_ch_ok := v_prog.strategic_challenge_id is null
    or v_challenge_map ? v_prog.strategic_challenge_id::text;
    v_dir_ok := v_prog.strategic_direction_id is null
    or v_direction_map ? v_prog.strategic_direction_id::text;
    v_supported := v_prog.supported_objective_ids;
    v_mapped := app._remap_uuid_array_from_map (v_supported, v_strategy_objective_map);
    if v_ch_ok
    and v_dir_ok
    and (
      cardinality(v_supported) = 0
      or cardinality(v_mapped) > 0
    ) then
      insert into app.strategy_programs (
        organization_id,
        planning_cycle_id,
        cycle_instance_id,
        strategic_direction_id,
        title,
        description,
        owner_membership_id,
        budget_total,
        timeline,
        created_by_membership_id,
        status,
        review_comment,
        strategic_challenge_id,
        program_origin,
        matrix_cell_score,
        supported_objective_ids,
        start_date,
        end_date
      )
      values (
        v_prog.organization_id,
        v_planning_to,
        p_to_cycle_instance_id,
        case
          when v_prog.strategic_direction_id is not null then (
            v_direction_map ->> v_prog.strategic_direction_id::text
          )::uuid
        end,
        v_prog.title,
        v_prog.description,
        v_prog.owner_membership_id,
        v_prog.budget_total,
        v_prog.timeline,
        v_prog.created_by_membership_id,
        v_prog.status,
        v_prog.review_comment,
        case
          when v_prog.strategic_challenge_id is not null then (
            v_challenge_map ->> v_prog.strategic_challenge_id::text
          )::uuid
        end,
        v_prog.program_origin,
        v_prog.matrix_cell_score,
        case
          when cardinality(v_supported) = 0 then v_supported
          else v_mapped
        end,
        v_prog.start_date,
        v_prog.end_date
      )
      returning id into v_new_prog;
      v_program_map := v_program_map || jsonb_build_object(v_prog.id::text, v_new_prog);
    else
      v_programs_skipped := v_programs_skipped || jsonb_build_object(
        'program_id',
        v_prog.id,
        'reason',
        'references_not_carried'
      );
    end if;
  end loop;

  for v_init in
    select
      *
    from
      app.initiatives
    where
      organization_id = v_org
      and cycle_instance_id = p_from_cycle_instance_id
  loop
    if not (v_program_map ? v_init.program_id::text) then
      v_inits_skipped := v_inits_skipped || jsonb_build_object('initiative_id', v_init.id, 'reason', 'program_not_carried');
      continue;
    end if;
    if not exists (
      select
        1
      from
        app.initiative_key_result_links l
      where
        l.initiative_id = v_init.id
        and l.cycle_instance_id = p_from_cycle_instance_id
        and v_kr_map ? l.key_result_id::text
    ) then
      v_inits_skipped := v_inits_skipped || jsonb_build_object('initiative_id', v_init.id, 'reason', 'no_carried_kr_link');
      continue;
    end if;
    insert into app.initiatives (
      organization_id,
      planning_cycle_id,
      title,
      description,
      owner_membership_id,
      start_date,
      end_date,
      status,
      priority,
      budget,
      created_by_membership_id,
      cycle_instance_id,
      program_id,
      linked_okrs,
      deliverables,
      created_by_source,
      execution_health_override,
      execution_health_override_by_membership_id,
      execution_health_override_at,
      review_comment,
      weight,
      progress_percent,
      last_review_update_at
    )
    values (
      v_init.organization_id,
      v_planning_to,
      v_init.title,
      v_init.description,
      v_init.owner_membership_id,
      v_init.start_date,
      v_init.end_date,
      v_init.status,
      v_init.priority,
      v_init.budget,
      v_init.created_by_membership_id,
      p_to_cycle_instance_id,
      (v_program_map ->> v_init.program_id::text)::uuid,
      v_init.linked_okrs,
      v_init.deliverables,
      v_init.created_by_source,
      v_init.execution_health_override,
      v_init.execution_health_override_by_membership_id,
      v_init.execution_health_override_at,
      v_init.review_comment,
      v_init.weight,
      v_init.progress_percent,
      v_init.last_review_update_at
    )
    returning id into v_new_init;
    insert into app.initiative_key_result_links (
      organization_id,
      cycle_instance_id,
      initiative_id,
      key_result_id
    )
    select
      v_init.organization_id,
      p_to_cycle_instance_id,
      v_new_init,
      (v_kr_map ->> l.key_result_id::text)::uuid
    from
      app.initiative_key_result_links l
    where
      l.initiative_id = v_init.id
      and l.cycle_instance_id = p_from_cycle_instance_id
      and v_kr_map ? l.key_result_id::text;
  end loop;

  v_summary := jsonb_build_object(
    'challenge_map',
    v_challenge_map,
    'direction_map',
    v_direction_map,
    'strategy_objective_map',
    v_strategy_objective_map,
    'okr_objective_map',
    v_okr_objective_map,
    'key_result_map',
    v_kr_map,
    'program_map',
    v_program_map,
    'programs_skipped',
    v_programs_skipped,
    'initiatives_skipped',
    v_inits_skipped
  );
  return v_summary;
end;
$$;

-- Legacy Planning-Cycle-Vollklon: Ziele liegen in strategy_objectives; KRs folgen okr_objectives und werden hier nicht mitgeklont.
create or replace function app.clone_planning_cycle_full_snapshot (
  p_organization_id uuid,
  p_source_cycle_id uuid,
  p_new_code text,
  p_new_name text,
  p_start_date date,
  p_end_date date,
  p_actor_membership_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path to public, app, rbac, audit
as $$
declare
  v_new_cycle_id uuid;
  v_goal record;
  v_strategy record;
  v_objective record;
  v_link record;
  v_new_id uuid;
  v_new_from uuid;
  v_new_to uuid;
begin
  if p_start_date > p_end_date then
    raise exception 'start date must be before or equal to end date';
  end if;

  insert into app.planning_cycles (
    organization_id,
    code,
    name,
    start_date,
    end_date,
    status,
    rolling_window_months,
    created_by_membership_id,
    source_cycle_id,
    clone_type,
    cloned_at,
    cloned_by_membership_id
  )
  select
    p_organization_id,
    p_new_code,
    p_new_name,
    p_start_date,
    p_end_date,
    'draft',
    rolling_window_months,
    p_actor_membership_id,
    id,
    'full_snapshot',
    now(),
    p_actor_membership_id
  from app.planning_cycles
  where id = p_source_cycle_id
    and organization_id = p_organization_id
  returning id into v_new_cycle_id;

  if v_new_cycle_id is null then
    raise exception 'source cycle not found in organization';
  end if;

  create temporary table if not exists tmp_goal_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table if not exists tmp_strategy_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table if not exists tmp_objective_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table if not exists tmp_kr_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  for v_goal in
    select *
    from app.strategic_goals
    where organization_id = p_organization_id
      and cycle_id = p_source_cycle_id
  loop
    insert into app.strategic_goals (
      organization_id, cycle_id, title, description, status, priority, owner_membership_id, due_date
    )
    values (
      v_goal.organization_id, v_new_cycle_id, v_goal.title, v_goal.description, v_goal.status,
      v_goal.priority, v_goal.owner_membership_id, v_goal.due_date
    )
    returning id into v_new_id;

    insert into tmp_goal_map(old_id, new_id) values (v_goal.id, v_new_id);
  end loop;

  for v_strategy in
    select *
    from app.functional_strategies
    where organization_id = p_organization_id
      and cycle_id = p_source_cycle_id
  loop
    insert into app.functional_strategies (
      organization_id, cycle_id, function_name, title, description, status, owner_membership_id
    )
    values (
      v_strategy.organization_id, v_new_cycle_id, v_strategy.function_name, v_strategy.title,
      v_strategy.description, v_strategy.status, v_strategy.owner_membership_id
    )
    returning id into v_new_id;

    insert into tmp_strategy_map(old_id, new_id) values (v_strategy.id, v_new_id);
  end loop;

  for v_objective in
    select *
    from app.strategy_objectives
    where organization_id = p_organization_id
      and cycle_id = p_source_cycle_id
  loop
    insert into app.strategy_objectives (
      organization_id,
      cycle_id,
      cycle_instance_id,
      title,
      description,
      status,
      owner_membership_id,
      deputy_membership_id,
      progress_percent
    )
    values (
      v_objective.organization_id,
      v_new_cycle_id,
      v_objective.cycle_instance_id,
      v_objective.title,
      v_objective.description,
      v_objective.status,
      v_objective.owner_membership_id,
      v_objective.deputy_membership_id,
      v_objective.progress_percent
    )
    returning id into v_new_id;

    insert into tmp_objective_map(old_id, new_id) values (v_objective.id, v_new_id);
  end loop;

  for v_link in
    select *
    from app.entity_links
    where organization_id = p_organization_id
      and (
        (from_type = 'strategic_goal' and from_id in (select old_id from tmp_goal_map)) or
        (from_type = 'functional_strategy' and from_id in (select old_id from tmp_strategy_map)) or
        (from_type = 'objective' and from_id in (select old_id from tmp_objective_map)) or
        (from_type = 'key_result' and from_id in (select old_id from tmp_kr_map)) or
        (to_type = 'strategic_goal' and to_id in (select old_id from tmp_goal_map)) or
        (to_type = 'functional_strategy' and to_id in (select old_id from tmp_strategy_map)) or
        (to_type = 'objective' and to_id in (select old_id from tmp_objective_map)) or
        (to_type = 'key_result' and to_id in (select old_id from tmp_kr_map))
      )
  loop
    v_new_from := case
      when v_link.from_type = 'strategic_goal' then (select new_id from tmp_goal_map where old_id = v_link.from_id)
      when v_link.from_type = 'functional_strategy' then (select new_id from tmp_strategy_map where old_id = v_link.from_id)
      when v_link.from_type = 'objective' then (select new_id from tmp_objective_map where old_id = v_link.from_id)
      when v_link.from_type = 'key_result' then (select new_id from tmp_kr_map where old_id = v_link.from_id)
      else null
    end;

    v_new_to := case
      when v_link.to_type = 'strategic_goal' then (select new_id from tmp_goal_map where old_id = v_link.to_id)
      when v_link.to_type = 'functional_strategy' then (select new_id from tmp_strategy_map where old_id = v_link.to_id)
      when v_link.to_type = 'objective' then (select new_id from tmp_objective_map where old_id = v_link.to_id)
      when v_link.to_type = 'key_result' then (select new_id from tmp_kr_map where old_id = v_link.to_id)
      else null
    end;

    if v_new_from is not null and v_new_to is not null then
      insert into app.entity_links (
        organization_id, from_type, from_id, to_type, to_id, relation_type
      )
      values (
        p_organization_id, v_link.from_type, v_new_from, v_link.to_type, v_new_to, v_link.relation_type
      )
      on conflict do nothing;
    end if;
  end loop;

  return v_new_cycle_id;
end;
$$;

-- migrate:down
-- Nicht unterstuetzt: Domain-Split rueckgaengig machen waere Datenverlust.
select 1;
