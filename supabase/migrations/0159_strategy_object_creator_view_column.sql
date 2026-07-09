-- 0159_strategy_object_creator_view_column.sql
-- View-Spalte created_by_membership_id (am Ende — CREATE OR REPLACE erlaubt kein Einfügen).
-- migrate:up

drop view if exists app.v_current_strategic_objectives;
drop view if exists app.v_current_strategic_directions;
drop view if exists app.v_current_strategic_challenges;
drop view if exists app.v_strategy_object_operational_status;
drop view if exists app.v_latest_strategy_object_assessments;
drop view if exists app.v_current_strategy_objects;

create view app.v_current_strategy_objects as
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
  r.updated_at,
  coalesce(r.created_by_membership_id, i.created_by_membership_id) as created_by_membership_id
from app.strategy_object_identities i
join app.strategy_object_revisions r
  on r.object_identity_id = i.id
where r.revision_state = 'current';

create view app.v_latest_strategy_object_assessments as
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

create view app.v_strategy_object_operational_status as
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

create view app.v_current_strategic_challenges as
select * from app.v_current_strategy_objects where object_type = 'strategic_challenge';

create view app.v_current_strategic_directions as
select * from app.v_current_strategy_objects where object_type = 'strategic_direction';

create view app.v_current_strategic_objectives as
select * from app.v_current_strategy_objects where object_type = 'strategic_objective';

grant select on app.v_current_strategy_objects to authenticated, anon;
grant select on app.v_latest_strategy_object_assessments to authenticated, anon;
grant select on app.v_strategy_object_operational_status to authenticated, anon;
grant select on app.v_current_strategic_challenges to authenticated, anon;
grant select on app.v_current_strategic_directions to authenticated, anon;
grant select on app.v_current_strategic_objectives to authenticated, anon;

update app.strategy_object_revisions r
set definition_payload =
  r.definition_payload
  || jsonb_build_object(
    'created_by_membership_id',
    coalesce(
      nullif(r.definition_payload ->> 'created_by_membership_id', ''),
      r.created_by_membership_id::text
    )
  )
where r.created_by_membership_id is not null
  and coalesce(r.definition_payload ->> 'created_by_membership_id', '') = '';

update app.strategy_object_revisions r
set definition_payload = r.definition_payload || jsonb_build_object('created_by_source', o.created_by_source)
from app.strategy_object_migration_map m
join app.strategy_objectives o on o.id = m.legacy_id
where m.legacy_table = 'strategy_objectives'
  and m.revision_id = r.id
  and o.created_by_source is not null
  and coalesce(r.definition_payload ->> 'created_by_source', '') = '';

-- migrate:down

drop view if exists app.v_current_strategic_objectives;
drop view if exists app.v_current_strategic_directions;
drop view if exists app.v_current_strategic_challenges;
drop view if exists app.v_strategy_object_operational_status;
drop view if exists app.v_current_strategy_objects;

-- View ohne created_by_membership_id (wie 0152) — nur bei echtem Rollback manuell nachziehen.
