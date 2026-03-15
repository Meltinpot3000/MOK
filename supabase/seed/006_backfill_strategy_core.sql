-- 006_backfill_strategy_core.sql
-- Backfill core strategy entities from legacy tables.
-- migrate:up

-- 1) strategic_goals -> strategic_directions
insert into app.strategic_directions (
  organization_id,
  planning_cycle_id,
  title,
  description,
  owner_membership_id,
  priority,
  status,
  grouping,
  created_by_membership_id
)
select
  g.organization_id,
  g.cycle_id,
  g.title,
  g.description,
  g.owner_membership_id,
  g.priority,
  case
    when g.status in ('draft', 'active', 'on_hold', 'completed', 'archived') then g.status
    else 'draft'
  end as status,
  'legacy_goal' as grouping,
  g.owner_membership_id
from app.strategic_goals g
where not exists (
  select 1
  from app.strategic_directions d
  where d.organization_id = g.organization_id
    and d.planning_cycle_id = g.cycle_id
    and lower(d.title) = lower(g.title)
);

-- 2) functional_strategies -> annual_targets
insert into app.annual_targets (
  organization_id,
  planning_cycle_id,
  strategic_direction_id,
  title,
  baseline,
  current_measure,
  progress_percent,
  comment,
  is_primary,
  created_by_membership_id
)
select
  f.organization_id,
  f.cycle_id,
  d.id as strategic_direction_id,
  f.title as title,
  null as baseline,
  null as current_measure,
  0 as progress_percent,
  'Backfilled from functional_strategies' as comment,
  false as is_primary,
  f.owner_membership_id
from app.functional_strategies f
join lateral (
  select d.id
  from app.strategic_directions d
  where d.organization_id = f.organization_id
    and d.planning_cycle_id = f.cycle_id
  order by
    case when lower(d.title) = lower(f.title) then 0 else 1 end,
    d.priority asc,
    d.created_at asc
  limit 1
) d on true
where not exists (
  select 1
  from app.annual_targets t
  where t.organization_id = f.organization_id
    and t.planning_cycle_id = f.cycle_id
    and lower(t.title) = lower(f.title)
);

-- 3) Ensure exactly one primary annual target per direction.
with ranked as (
  select
    t.id,
    t.strategic_direction_id,
    row_number() over (
      partition by t.organization_id, t.planning_cycle_id, t.strategic_direction_id
      order by t.is_primary desc, t.updated_at desc, t.created_at desc
    ) as rn
  from app.annual_targets t
)
update app.annual_targets t
set is_primary = (ranked.rn = 1)
from ranked
where ranked.id = t.id;

-- 4) Add initial dashboard row config for all directions.
insert into app.dashboard_row_config (
  organization_id,
  planning_cycle_id,
  direction_id,
  display_order
)
select
  d.organization_id,
  d.planning_cycle_id,
  d.id,
  row_number() over (
    partition by d.organization_id, d.planning_cycle_id
    order by d.priority asc, d.created_at asc
  ) as display_order
from app.strategic_directions d
where not exists (
  select 1
  from app.dashboard_row_config c
  where c.planning_cycle_id = d.planning_cycle_id
    and c.direction_id = d.id
);

-- migrate:down
select 1;
