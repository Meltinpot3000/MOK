-- 0168_change_run_okr_anchor_migration.sql
-- OKR: Change-Anker über Change-Jahresziele verknüpfen; Report für verbleibende Legacy-Fälle.

-- migrate:up

-- OKR mit leading_strategic_direction_id → passendes aktives Change-JZ verknüpfen
insert into app.annual_target_okr_objective_links (
  organization_id,
  cycle_instance_id,
  annual_target_id,
  okr_objective_id,
  alignment_type
)
select distinct on (o.id)
  o.organization_id,
  o.cycle_instance_id,
  t.id as annual_target_id,
  o.id as okr_objective_id,
  'direct' as alignment_type
from app.okr_objectives o
join app.okr_cycles oc on oc.id = o.okr_cycle_id
join app.annual_targets t
  on t.organization_id = o.organization_id
 and t.cycle_instance_id = o.cycle_instance_id
 and t.strategic_direction_id = o.leading_strategic_direction_id
 and t.owner_membership_id = o.owner_membership_id
 and t.strategy_program_id is not null
 and t.status = 'active'
 and t.target_year = extract(year from oc.start_date)::integer
join app.strategy_programs p
  on p.id = t.strategy_program_id
 and p.status = 'active'
where o.leading_strategic_direction_id is not null
  and not exists (
    select 1
    from app.annual_target_okr_objective_links l
    where l.okr_objective_id = o.id
      and l.organization_id = o.organization_id
  )
order by o.id, t.updated_at desc nulls last;

-- Report: OKR ohne Change-Anker (weder Link noch Initiative-KR-Pfad)
insert into app.change_run_migration_issues (
  organization_id, cycle_instance_id, entity_type, entity_id, issue_code, detail
)
select
  o.organization_id,
  o.cycle_instance_id,
  'okr_objective',
  o.id,
  'no_change_anchor',
  coalesce(o.title, 'OKR ohne Change-Anker')
from app.okr_objectives o
where o.status not in ('archived', 'completed')
  and not exists (
    select 1
    from app.annual_target_okr_objective_links l
    join app.annual_targets t on t.id = l.annual_target_id
    where l.okr_objective_id = o.id
      and t.strategy_program_id is not null
  )
  and not exists (
    select 1
    from app.key_results kr
    join app.initiative_key_result_links ikl on ikl.key_result_id = kr.id
    join app.initiatives i on i.id = ikl.initiative_id
    where kr.okr_objective_id = o.id
      and i.program_id is not null
  );

-- migrate:down

delete from app.change_run_migration_issues
where issue_code = 'no_change_anchor'
  and entity_type = 'okr_objective';

-- Eingefügte Links nicht automatisch rückgängig (Bestandsdaten).
