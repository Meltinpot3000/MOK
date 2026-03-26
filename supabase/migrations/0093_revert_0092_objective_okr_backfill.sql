-- migrate:up
-- Rollback von 0092 (automatische okr_cycle_id): nur Zeilen, die exakt den
-- gleichen Default-Zeitraum wie in 0092 haetten und noch keine Key Results tragen.
-- Hinweis: Ein frisch in der OKR-Planung angelegtes Objective ohne KR koennte
-- betroffen sein — in dem Fall okr_cycle_id dort erneut setzen.

with default_okr as (
  select distinct on (o2.id)
    o2.id as objective_id,
    oc.id as okr_id
  from app.objectives o2
  join app.okr_cycles oc
    on oc.organization_id = o2.organization_id
   and oc.cycle_instance_id = o2.cycle_instance_id
  order by
    o2.id,
    (oc.status = 'active') desc,
    oc.start_date desc
)
update app.objectives o
set okr_cycle_id = null
from default_okr d
where o.id = d.objective_id
  and o.okr_cycle_id = d.okr_id
  and not exists (
    select 1 from app.key_results kr where kr.objective_id = o.id
  );

-- migrate:down
select 1;
