-- 0151_cleanup_okr_shadow_strategy_objectives.sql
-- Entfernt fälschlich als OKR-Schatten angelegte strategy_objectives (gleicher Titel wie verknüpftes OKR-Objective).
-- migrate:up

create temporary table _okr_shadow_strategy_objective_ids on commit drop as
select distinct s.id
from app.strategy_objectives s
inner join app.okr_objective_strategy_objectives j on j.strategy_objective_id = s.id
inner join app.okr_objectives o on o.id = j.okr_objective_id
where btrim(s.title) = btrim(o.title)
  and s.organization_id = o.organization_id;

delete from app.strategy_design_assist_feedback f
where f.strategy_objective_id in (select id from _okr_shadow_strategy_objective_ids);

delete from app.strategy_objectives s
where s.id in (select id from _okr_shadow_strategy_objective_ids);

-- migrate:down
-- Irreversible Datenbereinigung.
