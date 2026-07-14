-- 0166_change_run_data_migration.sql
-- Datenmigration vor Change/Run-Gates: Initiativen program_id, Report für Nachpflege.

-- migrate:up

create table if not exists app.change_run_migration_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid references app.cycle_instances(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  issue_code text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_change_run_migration_issues_org
  on app.change_run_migration_issues (organization_id, created_at desc);

alter table app.change_run_migration_issues enable row level security;

drop policy if exists change_run_migration_issues_select on app.change_run_migration_issues;
create policy change_run_migration_issues_select on app.change_run_migration_issues
  for select using (
    app.has_permission(organization_id, 'nav.reviews.read')
    or app.has_permission(organization_id, 'nav.strategy-cycle.read')
  );

grant select on app.change_run_migration_issues to authenticated;

-- Fortschrittsmodus umbenennen (vor Constraint-Änderung in 0167)
update app.annual_targets
set progress_calculation_mode = 'program_based'
where progress_calculation_mode = 'initiative_based';

-- OKR-Links von Run-Jahreszielen entfernen (werden durch Gate blockiert)
delete from app.annual_target_okr_objective_links l
using app.annual_targets t
where l.annual_target_id = t.id
  and t.strategy_program_id is null;

-- Initiativen ohne program_id: über Change-JZ-Link migrieren
with candidate as (
  select distinct on (i.id)
    i.id as initiative_id,
    i.organization_id,
    i.cycle_instance_id,
    t.strategy_program_id as program_id
  from app.initiatives i
  join app.initiative_target_links itl on itl.initiative_id = i.id
  join app.annual_targets t on t.id = itl.annual_target_id
  where i.program_id is null
    and t.strategy_program_id is not null
  order by i.id, t.status = 'active' desc, t.updated_at desc nulls last
)
update app.initiatives i
set program_id = c.program_id
from candidate c
where i.id = c.initiative_id;

-- Fallback: einziges nicht-closed Programm derselben Richtung (über JZ-Link)
with direction_program as (
  select distinct on (i.id)
    i.id as initiative_id,
    p.id as program_id
  from app.initiatives i
  join app.initiative_target_links itl on itl.initiative_id = i.id
  join app.annual_targets t on t.id = itl.annual_target_id
  join app.strategy_programs p
    on p.cycle_instance_id = i.cycle_instance_id
   and p.strategic_direction_id = t.strategic_direction_id
   and p.status in ('draft', 'on_hold', 'active')
  where i.program_id is null
  order by i.id, p.status = 'active' desc, p.updated_at desc nulls last
)
update app.initiatives i
set program_id = dp.program_id
from direction_program dp
where i.id = dp.initiative_id
  and i.program_id is null;

-- Report: Initiativen ohne program_id
insert into app.change_run_migration_issues (
  organization_id, cycle_instance_id, entity_type, entity_id, issue_code, detail
)
select
  i.organization_id,
  i.cycle_instance_id,
  'initiative',
  i.id,
  'missing_program_id',
  coalesce(i.title, 'Initiative ohne Programm')
from app.initiatives i
where i.program_id is null
  and i.status not in ('archived', 'completed');

-- Report: Change-JZ mit inaktivem Programm bei active Status
insert into app.change_run_migration_issues (
  organization_id, cycle_instance_id, entity_type, entity_id, issue_code, detail
)
select
  t.organization_id,
  t.cycle_instance_id,
  'annual_target',
  t.id,
  'active_change_target_inactive_program',
  coalesce(t.title, 'Change-Jahresziel')
from app.annual_targets t
join app.strategy_programs p on p.id = t.strategy_program_id
where t.strategy_program_id is not null
  and t.status = 'active'
  and p.status <> 'active';

-- Report: active Initiativen an nicht-active Programm
insert into app.change_run_migration_issues (
  organization_id, cycle_instance_id, entity_type, entity_id, issue_code, detail
)
select
  i.organization_id,
  i.cycle_instance_id,
  'initiative',
  i.id,
  'active_initiative_inactive_program',
  coalesce(i.title, 'Initiative')
from app.initiatives i
join app.strategy_programs p on p.id = i.program_id
where i.status in ('active', 'at_risk')
  and p.status <> 'active';

-- migrate:down

delete from app.change_run_migration_issues;

update app.annual_targets
set progress_calculation_mode = 'initiative_based'
where progress_calculation_mode = 'program_based';

drop policy if exists change_run_migration_issues_select on app.change_run_migration_issues;
drop table if exists app.change_run_migration_issues;
