-- 0152_strategy_object_identities_revisions.sql
-- Phase 1: Generic strategy object versioning (challenge, direction, objective).
-- migrate:up

create or replace function app.strategy_object_canonical_definition_text(
  p_object_type text,
  p_title text,
  p_description text,
  p_payload jsonb
) returns text
language sql
immutable
as $$
  select concat_ws(
    '|',
    lower(coalesce(p_object_type, '')),
    lower(trim(coalesce(p_title, ''))),
    lower(trim(coalesce(p_description, ''))),
    coalesce((p_payload - '_hash_excluded')::text, '{}'::text)
  );
$$;

create or replace function app.strategy_object_definition_hash(
  p_object_type text,
  p_title text,
  p_description text,
  p_payload jsonb
) returns text
language sql
immutable
as $$
  select encode(
    digest(
      app.strategy_object_canonical_definition_text(
        p_object_type,
        p_title,
        p_description,
        p_payload
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create table if not exists app.strategy_object_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  object_type text not null check (
    object_type in ('strategic_challenge', 'strategic_direction', 'strategic_objective')
  ),
  lifecycle_state text not null default 'active' check (
    lifecycle_state in ('draft', 'active', 'inactive', 'retired', 'archived')
  ),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategy_object_identities_org_type
  on app.strategy_object_identities (organization_id, object_type, lifecycle_state);

create table if not exists app.strategy_object_revisions (
  id uuid primary key default gen_random_uuid(),
  object_identity_id uuid not null references app.strategy_object_identities(id) on delete cascade,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  revision_state text not null default 'draft' check (
    revision_state in ('draft', 'pending_approval', 'current', 'superseded', 'archived')
  ),
  title text not null,
  description text,
  definition_payload jsonb not null default '{}'::jsonb,
  definition_hash text not null,
  supersedes_revision_id uuid references app.strategy_object_revisions(id) on delete set null,
  legacy_status text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_strategy_object_revisions_identity_cycle_rev
  on app.strategy_object_revisions (object_identity_id, cycle_instance_id, revision_number);

create unique index if not exists uq_strategy_object_revisions_current_per_identity_cycle
  on app.strategy_object_revisions (object_identity_id, cycle_instance_id)
  where revision_state = 'current';

create index if not exists idx_strategy_object_revisions_org_cycle
  on app.strategy_object_revisions (organization_id, cycle_instance_id, revision_state);

create table if not exists app.strategy_object_review_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  object_identity_id uuid not null references app.strategy_object_identities(id) on delete cascade,
  revision_id uuid references app.strategy_object_revisions(id) on delete set null,
  cycle_instance_id uuid references app.cycle_instances(id) on delete set null,
  strategy_review_id uuid references app.okr_reviews(id) on delete set null,
  assessment_source text not null check (
    assessment_source in (
      'legacy_objective_status',
      'legacy_objective_health_override',
      'legacy_direction_status',
      'legacy_direction_review_comment',
      'strategy_review',
      'manual',
      'system'
    )
  ),
  review_decision text not null check (
    review_decision in (
      'reconfirm',
      'escalate',
      'deprioritize',
      'revise',
      'complete',
      'retire',
      'remove'
    )
  ),
  operational_signal text not null default 'watch' check (
    operational_signal in ('on_track', 'watch', 'at_risk', 'completed', 'retired', 'removed')
  ),
  review_comment text,
  assessment_payload jsonb not null default '{}'::jsonb,
  assessed_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategy_object_review_assessments_identity_assessed
  on app.strategy_object_review_assessments (object_identity_id, assessed_at desc);

create table if not exists app.strategy_object_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  relationship_type text not null check (
    relationship_type in (
      'challenge_addresses_direction',
      'direction_pursues_objective',
      'objective_aligns_direction'
    )
  ),
  source_object_identity_id uuid not null references app.strategy_object_identities(id) on delete cascade,
  target_object_identity_id uuid not null references app.strategy_object_identities(id) on delete cascade,
  lifecycle_state text not null default 'active' check (
    lifecycle_state in ('draft', 'active', 'inactive', 'retired', 'archived')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_object_relationships_not_self_ref check (
    source_object_identity_id <> target_object_identity_id
  )
);

create unique index if not exists uq_strategy_object_relationships_cycle_type_source_target
  on app.strategy_object_relationships (
    cycle_instance_id,
    relationship_type,
    source_object_identity_id,
    target_object_identity_id
  );

create index if not exists idx_strategy_object_relationships_org_cycle
  on app.strategy_object_relationships (organization_id, cycle_instance_id, lifecycle_state);

create table if not exists app.strategy_object_migration_map (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  legacy_table text not null check (
    legacy_table in ('strategic_challenges', 'strategic_directions', 'strategy_objectives')
  ),
  legacy_id uuid not null,
  object_identity_id uuid not null references app.strategy_object_identities(id) on delete cascade,
  revision_id uuid not null references app.strategy_object_revisions(id) on delete cascade,
  legacy_id_preserved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legacy_table, legacy_id)
);

-- updated_at + audit triggers on all 5 tables

drop trigger if exists trg_strategy_object_identities_updated_at on app.strategy_object_identities;
create trigger trg_strategy_object_identities_updated_at
before update on app.strategy_object_identities
for each row execute function app.set_updated_at();

drop trigger if exists trg_audit_strategy_object_identities on app.strategy_object_identities;
create trigger trg_audit_strategy_object_identities
after insert or update or delete on app.strategy_object_identities
for each row execute function audit.log_row_change();

drop trigger if exists trg_strategy_object_revisions_updated_at on app.strategy_object_revisions;
create trigger trg_strategy_object_revisions_updated_at
before update on app.strategy_object_revisions
for each row execute function app.set_updated_at();

drop trigger if exists trg_audit_strategy_object_revisions on app.strategy_object_revisions;
create trigger trg_audit_strategy_object_revisions
after insert or update or delete on app.strategy_object_revisions
for each row execute function audit.log_row_change();

drop trigger if exists trg_strategy_object_review_assessments_updated_at on app.strategy_object_review_assessments;
create trigger trg_strategy_object_review_assessments_updated_at
before update on app.strategy_object_review_assessments
for each row execute function app.set_updated_at();

drop trigger if exists trg_audit_strategy_object_review_assessments on app.strategy_object_review_assessments;
create trigger trg_audit_strategy_object_review_assessments
after insert or update or delete on app.strategy_object_review_assessments
for each row execute function audit.log_row_change();

drop trigger if exists trg_strategy_object_relationships_updated_at on app.strategy_object_relationships;
create trigger trg_strategy_object_relationships_updated_at
before update on app.strategy_object_relationships
for each row execute function app.set_updated_at();

drop trigger if exists trg_audit_strategy_object_relationships on app.strategy_object_relationships;
create trigger trg_audit_strategy_object_relationships
after insert or update or delete on app.strategy_object_relationships
for each row execute function audit.log_row_change();

drop trigger if exists trg_strategy_object_migration_map_updated_at on app.strategy_object_migration_map;
create trigger trg_strategy_object_migration_map_updated_at
before update on app.strategy_object_migration_map
for each row execute function app.set_updated_at();

drop trigger if exists trg_audit_strategy_object_migration_map on app.strategy_object_migration_map;
create trigger trg_audit_strategy_object_migration_map
after insert or update or delete on app.strategy_object_migration_map
for each row execute function audit.log_row_change();

-- collision guard: legacy IDs must be globally unique across the 3 source tables

do $collision$
declare
  v_collision_count integer;
begin
  with all_ids as (
    select id, 'strategic_challenges'::text as src from app.strategic_challenges
    union all
    select id, 'strategic_directions'::text as src from app.strategic_directions
    union all
    select id, 'strategy_objectives'::text as src from app.strategy_objectives
  )
  select count(*) into v_collision_count
  from (
    select id
    from all_ids
    group by id
    having count(distinct src) > 1
  ) collisions;

  if v_collision_count > 0 then
    raise exception '0152 collision guard failed: % legacy IDs overlap across strategic_challenges/strategic_directions/strategy_objectives; cannot preserve revision IDs.', v_collision_count;
  end if;
end
$collision$;

create temporary table tmp_strategy_object_backfill (
  legacy_table text not null,
  legacy_id uuid not null,
  organization_id uuid not null,
  cycle_instance_id uuid not null,
  object_type text not null,
  identity_id uuid not null,
  identity_lifecycle_state text not null,
  revision_id uuid not null,
  revision_number integer not null,
  revision_state text not null,
  title text not null,
  description text,
  definition_payload jsonb not null,
  supersedes_revision_id uuid,
  legacy_status text,
  created_by_membership_id uuid,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  needs_assessment boolean not null default false,
  assessment_source text,
  assessment_decision text,
  assessment_signal text,
  assessment_comment text,
  assessment_payload jsonb,
  primary key (legacy_table, legacy_id)
) on commit drop;

-- strategy_objectives -> strategic_objective
insert into tmp_strategy_object_backfill (
  legacy_table,
  legacy_id,
  organization_id,
  cycle_instance_id,
  object_type,
  identity_id,
  identity_lifecycle_state,
  revision_id,
  revision_number,
  revision_state,
  title,
  description,
  definition_payload,
  supersedes_revision_id,
  legacy_status,
  created_by_membership_id,
  created_at,
  updated_at,
  needs_assessment,
  assessment_source,
  assessment_decision,
  assessment_signal,
  assessment_comment,
  assessment_payload
)
select
  'strategy_objectives'::text,
  o.id,
  o.organization_id,
  o.cycle_instance_id,
  'strategic_objective'::text,
  gen_random_uuid(),
  case
    when o.status = 'archived' then 'archived'
    when o.status = 'draft' then 'draft'
    else 'active'
  end,
  o.id,
  1,
  case
    when o.status = 'pending_approval' then 'pending_approval'
    when o.status = 'archived' then 'superseded'
    else 'current'
  end,
  o.title,
  o.description,
  jsonb_build_object(
    'time_horizon', o.time_horizon,
    'importance_score', o.importance_score,
    'deputy_membership_id', o.deputy_membership_id,
    'owner_membership_id', o.owner_membership_id,
    'ai_evaluation', jsonb_build_object(
      'clarity_score', o.ai_clarity_score,
      'strategic_relevance_score', o.ai_strategic_relevance_score,
      'feasibility_score', o.ai_feasibility_score,
      'fit_to_company_score', o.ai_fit_to_company_score,
      'confidence_score', o.ai_confidence_score,
      'summary', o.ai_summary,
      'issues_json', coalesce(o.ai_issues_json, '[]'::jsonb),
      'suggestion', o.ai_improvement_suggestion,
      'objective_score', o.ai_objective_score,
      'status', o.ai_evaluation_status,
      'evaluated_at', o.ai_evaluated_at,
      'evaluation_version', o.ai_evaluation_version,
      'manual_override', o.ai_manual_override,
      'manual_comment', o.ai_manual_comment,
      'external_internal_classification', o.ai_external_internal_classification,
      'short_long_term_classification', o.ai_short_long_term_classification,
      'exploit_explore_classification', o.ai_exploit_explore_classification
    ),
    'strategy_carry_metadata', coalesce(o.strategy_carry_metadata, '{}'::jsonb),
    '_hash_excluded', jsonb_build_object(
      'progress_percent', o.progress_percent,
      'objective_health_override', o.objective_health_override,
      'objective_health_override_by_membership_id', o.objective_health_override_by_membership_id,
      'objective_health_override_at', o.objective_health_override_at,
      'objective_review_comment', o.objective_review_comment,
      'approval_audit', jsonb_build_object(
        'submitted_for_approval_at', o.submitted_for_approval_at,
        'submitted_by_membership_id', o.submitted_by_membership_id,
        'approved_at', o.approved_at,
        'approved_by_membership_id', o.approved_by_membership_id,
        'rejected_at', o.rejected_at,
        'rejected_by_membership_id', o.rejected_by_membership_id,
        'approval_invalidated_at', o.approval_invalidated_at,
        'approval_invalidated_by_membership_id', o.approval_invalidated_by_membership_id,
        'approval_invalidation_reason', o.approval_invalidation_reason
      )
    )
  ),
  o.strategy_carry_source_id,
  o.status,
  o.created_by_membership_id,
  o.created_at,
  o.updated_at,
  (
    o.status in ('at_risk', 'completed')
    or o.objective_health_override is not null
    or nullif(btrim(coalesce(o.objective_review_comment, '')), '') is not null
  ),
  case
    when o.objective_health_override is not null then 'legacy_objective_health_override'
    else 'legacy_objective_status'
  end,
  case
    when o.status = 'completed' then 'complete'
    when o.status = 'at_risk' then 'escalate'
    when o.objective_health_override in ('at_risk', 'off_track') then 'escalate'
    when o.objective_health_override = 'on_track' then 'reconfirm'
    when nullif(btrim(coalesce(o.objective_review_comment, '')), '') is not null then 'revise'
    else 'reconfirm'
  end,
  case
    when o.status = 'completed' then 'completed'
    when o.status = 'at_risk' then 'at_risk'
    when o.objective_health_override in ('at_risk', 'off_track') then 'at_risk'
    when o.objective_health_override = 'on_track' then 'on_track'
    else 'watch'
  end,
  o.objective_review_comment,
  jsonb_build_object(
    'legacy_status', o.status,
    'objective_health_override', o.objective_health_override,
    'objective_health_override_by_membership_id', o.objective_health_override_by_membership_id,
    'objective_health_override_at', o.objective_health_override_at,
    'legacy_source_table', 'strategy_objectives'
  )
from app.strategy_objectives o;

-- strategic_directions -> strategic_direction
insert into tmp_strategy_object_backfill (
  legacy_table,
  legacy_id,
  organization_id,
  cycle_instance_id,
  object_type,
  identity_id,
  identity_lifecycle_state,
  revision_id,
  revision_number,
  revision_state,
  title,
  description,
  definition_payload,
  supersedes_revision_id,
  legacy_status,
  created_by_membership_id,
  created_at,
  updated_at,
  needs_assessment,
  assessment_source,
  assessment_decision,
  assessment_signal,
  assessment_comment,
  assessment_payload
)
select
  'strategic_directions'::text,
  d.id,
  d.organization_id,
  d.cycle_instance_id,
  'strategic_direction'::text,
  gen_random_uuid(),
  case
    when d.status = 'closed' then 'retired'
    when d.status = 'draft' then 'draft'
    else 'active'
  end,
  d.id,
  1,
  case
    when d.status = 'pending_approval' then 'pending_approval'
    when d.status = 'closed' then 'superseded'
    else 'current'
  end,
  d.title,
  d.description,
  jsonb_build_object(
    'priority', d.priority,
    'grouping', d.grouping,
    'relevance_level', d.relevance_level,
    'risk_level', d.risk_level,
    'strategic_value_score', d.strategic_value_score,
    'capability_fit_score', d.capability_fit_score,
    'feasibility_score', d.feasibility_score,    'strategy_carry_metadata', coalesce(d.strategy_carry_metadata, '{}'::jsonb),
    '_hash_excluded', jsonb_build_object(
      'review_comment', d.review_comment,
      'approval_audit', jsonb_build_object(
        'submitted_for_approval_at', d.submitted_for_approval_at,
        'submitted_by_membership_id', d.submitted_by_membership_id,
        'approved_at', d.approved_at,
        'approved_by_membership_id', d.approved_by_membership_id,
        'rejected_at', d.rejected_at,
        'rejected_by_membership_id', d.rejected_by_membership_id
      )
    )
  ),
  d.strategy_carry_source_id,
  d.status,
  d.created_by_membership_id,
  d.created_at,
  d.updated_at,
  (d.status = 'on_hold' or nullif(btrim(coalesce(d.review_comment, '')), '') is not null),
  case
    when d.status = 'on_hold' then 'legacy_direction_status'
    else 'legacy_direction_review_comment'
  end,
  case
    when d.status = 'on_hold' then 'deprioritize'
    when d.status = 'closed' then 'complete'
    else 'revise'
  end,
  case
    when d.status = 'on_hold' then 'watch'
    when d.status = 'closed' then 'completed'
    else 'watch'
  end,
  d.review_comment,
  jsonb_build_object(
    'legacy_status', d.status,
    'legacy_source_table', 'strategic_directions'
  )
from app.strategic_directions d;

-- strategic_challenges -> strategic_challenge (always active/current)
insert into tmp_strategy_object_backfill (
  legacy_table,
  legacy_id,
  organization_id,
  cycle_instance_id,
  object_type,
  identity_id,
  identity_lifecycle_state,
  revision_id,
  revision_number,
  revision_state,
  title,
  description,
  definition_payload,
  supersedes_revision_id,
  legacy_status,
  created_by_membership_id,
  created_at,
  updated_at,
  needs_assessment,
  assessment_source,
  assessment_decision,
  assessment_signal,
  assessment_comment,
  assessment_payload
)
select
  'strategic_challenges'::text,
  c.id,
  c.organization_id,
  c.cycle_instance_id,
  'strategic_challenge'::text,
  gen_random_uuid(),
  'active'::text,
  c.id,
  1,
  'current'::text,
  c.title,
  c.description,
  jsonb_build_object(
    'priority', c.priority,
    'visibility', c.visibility,
    'impact_score', c.impact_score,
    'urgency_score', c.urgency_score,
    'scope_score', c.scope_score,
    'root_cause_score', c.root_cause_score,
    'challenge_score', c.challenge_score,
    'relevance_level', c.relevance_level,
    'risk_level', c.risk_level,
    'source_cluster_id', c.source_cluster_id,
    'strategy_carry_metadata', coalesce(c.strategy_carry_metadata, '{}'::jsonb)
  ),
  c.strategy_carry_source_id,
  null,
  c.created_by_membership_id,
  c.created_at,
  c.updated_at,
  false,
  null,
  null,
  null,
  null,
  null
from app.strategic_challenges c;

insert into app.strategy_object_identities (
  id,
  organization_id,
  object_type,
  lifecycle_state,
  created_by_membership_id,
  created_at,
  updated_at
)
select
  b.identity_id,
  b.organization_id,
  b.object_type,
  b.identity_lifecycle_state,
  b.created_by_membership_id,
  b.created_at,
  b.updated_at
from tmp_strategy_object_backfill b;

insert into app.strategy_object_revisions (
  id,
  object_identity_id,
  organization_id,
  cycle_instance_id,
  revision_number,
  revision_state,
  title,
  description,
  definition_payload,
  definition_hash,
  supersedes_revision_id,
  legacy_status,
  created_by_membership_id,
  created_at,
  updated_at
)
select
  b.revision_id,
  b.identity_id,
  b.organization_id,
  b.cycle_instance_id,
  b.revision_number,
  b.revision_state,
  b.title,
  b.description,
  b.definition_payload,
  app.strategy_object_definition_hash(
    b.object_type,
    b.title,
    b.description,
    b.definition_payload
  ),
  b.supersedes_revision_id,
  b.legacy_status,
  b.created_by_membership_id,
  b.created_at,
  b.updated_at
from tmp_strategy_object_backfill b;

insert into app.strategy_object_migration_map (
  organization_id,
  legacy_table,
  legacy_id,
  object_identity_id,
  revision_id,
  legacy_id_preserved,
  created_at,
  updated_at
)
select
  b.organization_id,
  b.legacy_table,
  b.legacy_id,
  b.identity_id,
  b.revision_id,
  true,
  now(),
  now()
from tmp_strategy_object_backfill b;

insert into app.strategy_object_review_assessments (
  organization_id,
  object_identity_id,
  revision_id,
  cycle_instance_id,
  assessment_source,
  review_decision,
  operational_signal,
  review_comment,
  assessment_payload,
  assessed_by_membership_id,
  assessed_at,
  created_at,
  updated_at
)
select
  b.organization_id,
  b.identity_id,
  b.revision_id,
  b.cycle_instance_id,
  b.assessment_source,
  b.assessment_decision,
  b.assessment_signal,
  b.assessment_comment,
  coalesce(b.assessment_payload, '{}'::jsonb),
  b.created_by_membership_id,
  coalesce(b.updated_at, b.created_at, now()),
  now(),
  now()
from tmp_strategy_object_backfill b
where b.needs_assessment;

-- Relationship backfill (legacy link ID preserved where available)

insert into app.strategy_object_relationships (
  id,
  organization_id,
  cycle_instance_id,
  relationship_type,
  source_object_identity_id,
  target_object_identity_id,
  lifecycle_state,
  metadata,
  created_by_membership_id,
  created_at,
  updated_at
)
select
  l.id,
  l.organization_id,
  l.cycle_instance_id,
  'challenge_addresses_direction'::text,
  mch.object_identity_id,
  mdir.object_identity_id,
  'active'::text,
  jsonb_build_object(
    'legacy_table', 'challenge_direction_links',
    'legacy_id', l.id,
    'contribution_level', l.contribution_level,
    'note', l.note
  ),
  l.created_by_membership_id,
  l.created_at,
  l.updated_at
from app.challenge_direction_links l
join app.strategy_object_migration_map mch
  on mch.legacy_table = 'strategic_challenges'
 and mch.legacy_id = l.strategic_challenge_id
join app.strategy_object_migration_map mdir
  on mdir.legacy_table = 'strategic_directions'
 and mdir.legacy_id = l.strategic_direction_id
on conflict (id) do nothing;

insert into app.strategy_object_relationships (
  id,
  organization_id,
  cycle_instance_id,
  relationship_type,
  source_object_identity_id,
  target_object_identity_id,
  lifecycle_state,
  metadata,
  created_by_membership_id,
  created_at,
  updated_at
)
select
  l.id,
  l.organization_id,
  l.cycle_instance_id,
  'direction_pursues_objective'::text,
  mdir.object_identity_id,
  mobj.object_identity_id,
  'active'::text,
  jsonb_build_object(
    'legacy_table', 'strategic_direction_objective_links',
    'legacy_id', l.id,
    'contribution_level', l.contribution_level
  ),
  l.created_by_membership_id,
  l.created_at,
  l.created_at
from app.strategic_direction_objective_links l
join app.strategy_object_migration_map mdir
  on mdir.legacy_table = 'strategic_directions'
 and mdir.legacy_id = l.strategic_direction_id
join app.strategy_object_migration_map mobj
  on mobj.legacy_table = 'strategy_objectives'
 and mobj.legacy_id = l.strategy_objective_id
on conflict (id) do nothing;

insert into app.strategy_object_relationships (
  id,
  organization_id,
  cycle_instance_id,
  relationship_type,
  source_object_identity_id,
  target_object_identity_id,
  lifecycle_state,
  metadata,
  created_by_membership_id,
  created_at,
  updated_at
)
select
  l.id,
  l.organization_id,
  l.cycle_instance_id,
  'objective_aligns_direction'::text,
  mobj.object_identity_id,
  mdir.object_identity_id,
  'active'::text,
  jsonb_build_object(
    'legacy_table', 'objective_direction_links',
    'legacy_id', l.id,
    'contribution_level', l.contribution_level,
    'comment', l.comment
  ),
  null,
  l.created_at,
  l.created_at
from app.objective_direction_links l
join app.strategy_object_migration_map mobj
  on mobj.legacy_table = 'strategy_objectives'
 and mobj.legacy_id = l.strategy_objective_id
join app.strategy_object_migration_map mdir
  on mdir.legacy_table = 'strategic_directions'
 and mdir.legacy_id = l.strategic_direction_id
on conflict (id) do nothing;

create or replace view app.v_current_strategy_objects as
select
  i.id as object_identity_id,
  i.organization_id,
  r.cycle_instance_id,
  i.object_type,
  i.lifecycle_state as identity_lifecycle_state,
  r.id as revision_id,
  r.revision_number,
  r.revision_state,
  r.title,
  r.description,
  r.definition_payload,
  r.definition_hash,
  r.legacy_status,
  r.created_at,
  r.updated_at
from app.strategy_object_identities i
join app.strategy_object_revisions r
  on r.object_identity_id = i.id
where r.revision_state = 'current';

create or replace view app.v_latest_strategy_object_assessments as
select distinct on (a.object_identity_id)
  a.id,
  a.organization_id,
  a.object_identity_id,
  a.revision_id,
  a.cycle_instance_id,
  a.strategy_review_id,
  a.assessment_source,
  a.review_decision,
  a.operational_signal,
  a.review_comment,
  a.assessment_payload,
  a.assessed_by_membership_id,
  a.assessed_at,
  a.created_at,
  a.updated_at
from app.strategy_object_review_assessments a
order by a.object_identity_id, a.assessed_at desc, a.created_at desc;

create or replace view app.v_strategy_object_operational_status as
select
  c.object_identity_id,
  c.organization_id,
  c.cycle_instance_id,
  c.object_type,
  c.identity_lifecycle_state,
  c.revision_id,
  c.revision_state,
  c.title,
  c.description,
  c.legacy_status,
  la.review_decision as latest_review_decision,
  la.operational_signal as latest_operational_signal,
  la.assessed_at as latest_assessed_at,
  case
    when c.identity_lifecycle_state = 'archived' then 'archived'
    when c.identity_lifecycle_state = 'retired' then 'retired'
    when c.revision_state = 'pending_approval' then 'pending_approval'
    when la.review_decision = 'remove' then 'removed'
    when la.review_decision = 'retire' then 'retired'
    when la.review_decision = 'complete' then 'completed'
    when la.review_decision = 'escalate' then 'at_risk'
    when la.review_decision = 'deprioritize' then 'on_hold'
    when la.review_decision = 'revise' then 'needs_revision'
    when la.operational_signal = 'at_risk' then 'at_risk'
    when la.operational_signal = 'watch' then 'watch'
    when la.operational_signal = 'completed' then 'completed'
    else 'active'
  end as operational_status
from app.v_current_strategy_objects c
left join app.v_latest_strategy_object_assessments la
  on la.object_identity_id = c.object_identity_id;

create or replace view app.v_current_strategic_challenges as
select *
from app.v_current_strategy_objects
where object_type = 'strategic_challenge';

create or replace view app.v_current_strategic_directions as
select *
from app.v_current_strategy_objects
where object_type = 'strategic_direction';

create or replace view app.v_current_strategic_objectives as
select *
from app.v_current_strategy_objects
where object_type = 'strategic_objective';

-- RLS

alter table app.strategy_object_identities enable row level security;
alter table app.strategy_object_revisions enable row level security;
alter table app.strategy_object_review_assessments enable row level security;
alter table app.strategy_object_relationships enable row level security;
alter table app.strategy_object_migration_map enable row level security;

drop policy if exists strategy_object_identities_select on app.strategy_object_identities;
create policy strategy_object_identities_select on app.strategy_object_identities
for select using (app.is_member_of_org(organization_id));

drop policy if exists strategy_object_identities_modify on app.strategy_object_identities;
create policy strategy_object_identities_modify on app.strategy_object_identities
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
);

drop policy if exists strategy_object_revisions_select on app.strategy_object_revisions;
create policy strategy_object_revisions_select on app.strategy_object_revisions
for select using (app.is_member_of_org(organization_id));

drop policy if exists strategy_object_revisions_modify on app.strategy_object_revisions;
create policy strategy_object_revisions_modify on app.strategy_object_revisions
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
);

drop policy if exists strategy_object_review_assessments_select on app.strategy_object_review_assessments;
create policy strategy_object_review_assessments_select on app.strategy_object_review_assessments
for select using (app.is_member_of_org(organization_id));

drop policy if exists strategy_object_review_assessments_modify on app.strategy_object_review_assessments;
create policy strategy_object_review_assessments_modify on app.strategy_object_review_assessments
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
  or app.has_permission(organization_id, 'review.write')
  or app.has_permission(organization_id, 'strategy_review.moderate')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
  or app.has_permission(organization_id, 'review.write')
  or app.has_permission(organization_id, 'strategy_review.moderate')
);

drop policy if exists strategy_object_relationships_select on app.strategy_object_relationships;
create policy strategy_object_relationships_select on app.strategy_object_relationships
for select using (app.is_member_of_org(organization_id));

drop policy if exists strategy_object_relationships_modify on app.strategy_object_relationships;
create policy strategy_object_relationships_modify on app.strategy_object_relationships
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
);

drop policy if exists strategy_object_migration_map_select on app.strategy_object_migration_map;
create policy strategy_object_migration_map_select on app.strategy_object_migration_map
for select using (
  exists (
    select 1
    from app.strategy_object_identities i
    where i.id = object_identity_id
      and app.is_member_of_org(i.organization_id)
  )
);

-- no write policy for migration map; data is migration-managed.

-- grants

grant select, insert, update, delete on app.strategy_object_identities to authenticated;
grant select, insert, update, delete on app.strategy_object_revisions to authenticated;
grant select, insert, update, delete on app.strategy_object_review_assessments to authenticated;
grant select, insert, update, delete on app.strategy_object_relationships to authenticated;
grant select, insert, update, delete on app.strategy_object_migration_map to authenticated;

grant select on app.strategy_object_identities to anon;
grant select on app.strategy_object_revisions to anon;
grant select on app.strategy_object_review_assessments to anon;
grant select on app.strategy_object_relationships to anon;
grant select on app.strategy_object_migration_map to anon;

grant select on app.v_current_strategy_objects to authenticated, anon;
grant select on app.v_latest_strategy_object_assessments to authenticated, anon;
grant select on app.v_strategy_object_operational_status to authenticated, anon;
grant select on app.v_current_strategic_challenges to authenticated, anon;
grant select on app.v_current_strategic_directions to authenticated, anon;
grant select on app.v_current_strategic_objectives to authenticated, anon;

-- Validation block

do $validation$
declare
  v_count_challenges integer;
  v_count_directions integer;
  v_count_objectives integer;
  v_map_challenges integer;
  v_map_directions integer;
  v_map_objectives integer;
  v_invalid_preserved integer;
  v_operational_challenges integer;
  v_operational_directions integer;
  v_operational_objectives integer;
begin
  select count(*) into v_count_challenges from app.strategic_challenges;
  select count(*) into v_count_directions from app.strategic_directions;
  select count(*) into v_count_objectives from app.strategy_objectives;

  select count(*) into v_map_challenges
  from app.strategy_object_migration_map
  where legacy_table = 'strategic_challenges';

  select count(*) into v_map_directions
  from app.strategy_object_migration_map
  where legacy_table = 'strategic_directions';

  select count(*) into v_map_objectives
  from app.strategy_object_migration_map
  where legacy_table = 'strategy_objectives';

  if v_map_challenges <> v_count_challenges then
    raise exception '0152 validation failed: migration_map strategic_challenges count mismatch (% vs %)', v_map_challenges, v_count_challenges;
  end if;

  if v_map_directions <> v_count_directions then
    raise exception '0152 validation failed: migration_map strategic_directions count mismatch (% vs %)', v_map_directions, v_count_directions;
  end if;

  if v_map_objectives <> v_count_objectives then
    raise exception '0152 validation failed: migration_map strategy_objectives count mismatch (% vs %)', v_map_objectives, v_count_objectives;
  end if;

  select count(*) into v_invalid_preserved
  from app.strategy_object_migration_map
  where legacy_id_preserved is true
    and legacy_id <> revision_id;

  if v_invalid_preserved > 0 then
    raise exception '0152 validation failed: % preserved map rows have legacy_id <> revision_id', v_invalid_preserved;
  end if;

  select count(*) into v_operational_challenges
  from app.v_strategy_object_operational_status
  where object_type = 'strategic_challenge';

  select count(*) into v_operational_directions
  from app.v_strategy_object_operational_status
  where object_type = 'strategic_direction';

  select count(*) into v_operational_objectives
  from app.v_strategy_object_operational_status
  where object_type = 'strategic_objective';

  if v_operational_challenges <> v_count_challenges then
    raise exception '0152 validation failed: operational view challenge count mismatch (% vs %)', v_operational_challenges, v_count_challenges;
  end if;

  if v_operational_directions <> v_count_directions then
    raise exception '0152 validation failed: operational view direction count mismatch (% vs %)', v_operational_directions, v_count_directions;
  end if;

  if v_operational_objectives <> v_count_objectives then
    raise exception '0152 validation failed: operational view objective count mismatch (% vs %)', v_operational_objectives, v_count_objectives;
  end if;
end
$validation$;

-- migrate:down

revoke select on app.v_current_strategic_objectives from anon, authenticated;
revoke select on app.v_current_strategic_directions from anon, authenticated;
revoke select on app.v_current_strategic_challenges from anon, authenticated;
revoke select on app.v_strategy_object_operational_status from anon, authenticated;
revoke select on app.v_latest_strategy_object_assessments from anon, authenticated;
revoke select on app.v_current_strategy_objects from anon, authenticated;

drop view if exists app.v_current_strategic_objectives;
drop view if exists app.v_current_strategic_directions;
drop view if exists app.v_current_strategic_challenges;
drop view if exists app.v_strategy_object_operational_status;
drop view if exists app.v_latest_strategy_object_assessments;
drop view if exists app.v_current_strategy_objects;

drop trigger if exists trg_audit_strategy_object_migration_map on app.strategy_object_migration_map;
drop trigger if exists trg_strategy_object_migration_map_updated_at on app.strategy_object_migration_map;
drop trigger if exists trg_audit_strategy_object_relationships on app.strategy_object_relationships;
drop trigger if exists trg_strategy_object_relationships_updated_at on app.strategy_object_relationships;
drop trigger if exists trg_audit_strategy_object_review_assessments on app.strategy_object_review_assessments;
drop trigger if exists trg_strategy_object_review_assessments_updated_at on app.strategy_object_review_assessments;
drop trigger if exists trg_audit_strategy_object_revisions on app.strategy_object_revisions;
drop trigger if exists trg_strategy_object_revisions_updated_at on app.strategy_object_revisions;
drop trigger if exists trg_audit_strategy_object_identities on app.strategy_object_identities;
drop trigger if exists trg_strategy_object_identities_updated_at on app.strategy_object_identities;

drop policy if exists strategy_object_migration_map_select on app.strategy_object_migration_map;
drop policy if exists strategy_object_relationships_modify on app.strategy_object_relationships;
drop policy if exists strategy_object_relationships_select on app.strategy_object_relationships;
drop policy if exists strategy_object_review_assessments_modify on app.strategy_object_review_assessments;
drop policy if exists strategy_object_review_assessments_select on app.strategy_object_review_assessments;
drop policy if exists strategy_object_revisions_modify on app.strategy_object_revisions;
drop policy if exists strategy_object_revisions_select on app.strategy_object_revisions;
drop policy if exists strategy_object_identities_modify on app.strategy_object_identities;
drop policy if exists strategy_object_identities_select on app.strategy_object_identities;

drop table if exists app.strategy_object_migration_map;
drop table if exists app.strategy_object_relationships;
drop table if exists app.strategy_object_review_assessments;
drop table if exists app.strategy_object_revisions;
drop table if exists app.strategy_object_identities;

drop function if exists app.strategy_object_definition_hash(text, text, text, jsonb);
drop function if exists app.strategy_object_canonical_definition_text(text, text, text, jsonb);

