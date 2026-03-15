-- 007_backfill_traceability_links.sql
-- Backfill traceability links from legacy objects and relationships.
-- migrate:up

-- 1) objectives -> objective_direction_links
insert into app.objective_direction_links (
  organization_id,
  planning_cycle_id,
  objective_id,
  strategic_direction_id,
  contribution_level,
  comment
)
select
  o.organization_id,
  o.cycle_id as planning_cycle_id,
  o.id as objective_id,
  d.id as strategic_direction_id,
  'medium' as contribution_level,
  'Backfilled objective-direction relation' as comment
from app.objectives o
join lateral (
  select d.id
  from app.strategic_directions d
  where d.organization_id = o.organization_id
    and d.planning_cycle_id = o.cycle_id
  order by d.priority asc, d.created_at asc
  limit 1
) d on true
where not exists (
  select 1
  from app.objective_direction_links l
  where l.organization_id = o.organization_id
    and l.planning_cycle_id = o.cycle_id
    and l.objective_id = o.id
);

-- 2) objectives -> objective_target_links via direction primary target
insert into app.objective_target_links (
  organization_id,
  planning_cycle_id,
  objective_id,
  annual_target_id,
  contribution_level,
  comment
)
select
  o.organization_id,
  o.cycle_id as planning_cycle_id,
  o.id as objective_id,
  t.id as annual_target_id,
  'medium' as contribution_level,
  'Backfilled objective-target relation' as comment
from app.objectives o
join app.objective_direction_links odl
  on odl.organization_id = o.organization_id
  and odl.planning_cycle_id = o.cycle_id
  and odl.objective_id = o.id
join lateral (
  select t.id
  from app.annual_targets t
  where t.organization_id = o.organization_id
    and t.planning_cycle_id = o.cycle_id
    and t.strategic_direction_id = odl.strategic_direction_id
  order by t.is_primary desc, t.updated_at desc, t.created_at desc
  limit 1
) t on true
where not exists (
  select 1
  from app.objective_target_links l
  where l.organization_id = o.organization_id
    and l.planning_cycle_id = o.cycle_id
    and l.objective_id = o.id
);

-- 3) key_results -> key_result_target_links via objective_target_links
insert into app.key_result_target_links (
  organization_id,
  planning_cycle_id,
  key_result_id,
  annual_target_id,
  contribution_level,
  comment
)
select
  k.organization_id,
  o.cycle_id as planning_cycle_id,
  k.id as key_result_id,
  otl.annual_target_id,
  'medium' as contribution_level,
  'Backfilled key-result target relation' as comment
from app.key_results k
join app.objectives o on o.id = k.objective_id
join app.objective_target_links otl
  on otl.organization_id = o.organization_id
  and otl.planning_cycle_id = o.cycle_id
  and otl.objective_id = o.id
where not exists (
  select 1
  from app.key_result_target_links l
  where l.organization_id = k.organization_id
    and l.planning_cycle_id = o.cycle_id
    and l.key_result_id = k.id
);

-- 4) Legacy entity_links strategic_goal -> objective  ==> challenge_direction_links heuristic
insert into app.challenge_direction_links (
  organization_id,
  planning_cycle_id,
  strategic_direction_id,
  strategic_challenge_id,
  contribution_level,
  note,
  created_by_membership_id
)
select
  g.organization_id,
  g.cycle_id as planning_cycle_id,
  d.id as strategic_direction_id,
  c.id as strategic_challenge_id,
  'medium' as contribution_level,
  'Backfilled from entity_links strategic_goal->objective',
  g.owner_membership_id
from app.entity_links l
join app.strategic_goals g
  on g.id = l.from_id
  and l.from_type = 'strategic_goal'
join app.objectives o
  on o.id = l.to_id
  and l.to_type = 'objective'
join lateral (
  select d.id
  from app.strategic_directions d
  where d.organization_id = g.organization_id
    and d.planning_cycle_id = g.cycle_id
    and lower(d.title) = lower(g.title)
  limit 1
) d on true
join lateral (
  select c.id
  from app.strategic_challenges c
  where c.organization_id = g.organization_id
    and c.planning_cycle_id = g.cycle_id
  order by c.priority asc, c.created_at asc
  limit 1
) c on true
where l.organization_id = g.organization_id
  and not exists (
    select 1
    from app.challenge_direction_links x
    where x.organization_id = g.organization_id
      and x.planning_cycle_id = g.cycle_id
      and x.strategic_direction_id = d.id
      and x.strategic_challenge_id = c.id
  );

-- migrate:down
select 1;
