-- migrate:up
-- Objectives aus dem Strategiezyklus hatten okr_cycle_id NULL und erschienen nicht in der OKR-Planung.
-- Zuordnung zum Default-OKR-Zeitraum derselben cycle_instance (wie pickDefaultOkrCycleId: active, sonst juengstes start_date).

update app.objectives o
set okr_cycle_id = sub.id
from (
  select distinct on (o2.id)
    o2.id as objective_id,
    oc.id
  from app.objectives o2
  join app.okr_cycles oc
    on oc.organization_id = o2.organization_id
   and oc.cycle_instance_id = o2.cycle_instance_id
  where o2.okr_cycle_id is null
  order by
    o2.id,
    (oc.status = 'active') desc,
    oc.start_date desc
) sub
where o.id = sub.objective_id;

-- migrate:down
select 1;
