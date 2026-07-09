-- 0150_okr_objectives_leading_strategic_direction.sql
-- OKR-Objectives tragen die führende Stoßrichtung direkt (ohne Umweg über strategy_objectives).
-- migrate:up

alter table app.okr_objectives
  add column if not exists leading_strategic_direction_id uuid references app.strategic_directions (id) on delete set null;

comment on column app.okr_objectives.leading_strategic_direction_id is
  'Führende Stoßrichtung des OKR-Objectives — direkte Verknüpfung für OKR-Planung und Contribution Assessment.';

create index if not exists idx_okr_objectives_leading_direction
  on app.okr_objectives (leading_strategic_direction_id)
  where leading_strategic_direction_id is not null;

-- Bestehende Daten: Stoßrichtung aus bisherigem Junction-Pfad übernehmen.
update app.okr_objectives o
set leading_strategic_direction_id = x.strategic_direction_id
from (
  select distinct on (o2.id)
    o2.id as okr_objective_id,
    sdol.strategic_direction_id
  from app.okr_objectives o2
  join app.okr_objective_strategy_objectives j on j.okr_objective_id = o2.id
  join app.strategic_direction_objective_links sdol
    on sdol.strategy_objective_id = j.strategy_objective_id
   and sdol.organization_id = o2.organization_id
   and sdol.cycle_instance_id = o2.cycle_instance_id
  order by o2.id, sdol.created_at asc
) x
where o.id = x.okr_objective_id
  and o.leading_strategic_direction_id is null;

-- migrate:down

drop index if exists app.idx_okr_objectives_leading_direction;

alter table app.okr_objectives
  drop column if exists leading_strategic_direction_id;
