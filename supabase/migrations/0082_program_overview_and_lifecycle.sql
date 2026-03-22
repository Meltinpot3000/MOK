-- 0082_program_overview_and_lifecycle.sql
-- Programme: Lifecycle (draft/active/on_hold/closed), Zeitraum, budget_total; View; Aktivierungsregel.
-- Initiativen: Status on_hold ergaenzt.
-- migrate:up

-- --- strategy_programs: Status-Migration ------------------------------------
update app.strategy_programs
set status = 'closed'
where status in ('completed', 'archived');

alter table app.strategy_programs
  drop constraint if exists strategy_programs_status_check;

alter table app.strategy_programs
  add constraint strategy_programs_status_check
  check (status in ('draft', 'active', 'on_hold', 'closed'));

alter table app.strategy_programs
  add column if not exists start_date date null,
  add column if not exists end_date date null;

alter table app.strategy_programs drop constraint if exists strategy_programs_date_range_check;
alter table app.strategy_programs
  add constraint strategy_programs_date_range_check
  check (start_date is null or end_date is null or start_date <= end_date);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'app' and table_name = 'strategy_programs' and column_name = 'budget'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'app' and table_name = 'strategy_programs' and column_name = 'budget_total'
  ) then
    alter table app.strategy_programs rename column budget to budget_total;
  end if;
end $$;

-- --- initiatives: on_hold im Status-Check -----------------------------------
alter table app.initiatives drop constraint if exists initiatives_status_check;
alter table app.initiatives
  add constraint initiatives_status_check
  check (
    status in (
      'draft',
      'planned',
      'active',
      'at_risk',
      'on_hold',
      'completed',
      'archived'
    )
  );

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'initiatives_progress_percent_review_check'
      and conrelid = 'app.initiatives'::regclass
  ) then
    alter table app.initiatives
      rename constraint initiatives_progress_percent_review_check to initiatives_progress_check;
  end if;
end $$;

-- --- Aggregations-View ------------------------------------------------------
create or replace view app.v_program_overview as
select
  p.id,
  p.title,
  p.status,
  p.owner_membership_id,
  p.start_date,
  p.end_date,
  p.budget_total,
  count(i.id) as initiative_count,
  count(i.id) filter (where i.status = 'active') as initiative_active_count,
  count(i.id) filter (where i.status in ('completed', 'archived')) as initiative_done_count,
  coalesce(avg(i.progress_percent::numeric), 0)::numeric as progress_percent
from app.strategy_programs p
left join app.initiatives i on i.program_id = p.id
group by p.id;

grant select on app.v_program_overview to authenticated;
grant select on app.v_program_overview to anon;

-- --- Regel 1: active nur mit mindestens einer aktiven Initiative ------------
create or replace function app.enforce_program_activation_has_active_initiative()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  active_count integer;
begin
  if new.status = 'active' then
    select count(*)::integer into active_count
    from app.initiatives
    where program_id = new.id
      and status = 'active';
    if active_count < 1 then
      raise exception 'program-needs-active-initiative'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

comment on function app.enforce_program_activation_has_active_initiative() is
  'Vor status=active: mindestens eine Initiative mit status=active. SECURITY DEFINER um RLS zu umgehen.';

drop trigger if exists trg_z_guard_program_activation on app.strategy_programs;
create trigger trg_z_guard_program_activation
before insert or update on app.strategy_programs
for each row execute function app.enforce_program_activation_has_active_initiative();

-- migrate:down

drop trigger if exists trg_z_guard_program_activation on app.strategy_programs;
drop function if exists app.enforce_program_activation_has_active_initiative();

revoke select on app.v_program_overview from anon;
revoke select on app.v_program_overview from authenticated;
drop view if exists app.v_program_overview;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'initiatives_progress_check'
      and conrelid = 'app.initiatives'::regclass
  ) then
    alter table app.initiatives
      rename constraint initiatives_progress_check to initiatives_progress_percent_review_check;
  end if;
end $$;

update app.initiatives set status = 'at_risk' where status = 'on_hold';

alter table app.initiatives drop constraint if exists initiatives_status_check;
alter table app.initiatives
  add constraint initiatives_status_check
  check (status in ('draft', 'planned', 'active', 'at_risk', 'completed', 'archived'));

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'app' and table_name = 'strategy_programs' and column_name = 'budget_total'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'app' and table_name = 'strategy_programs' and column_name = 'budget'
  ) then
    alter table app.strategy_programs rename column budget_total to budget;
  end if;
end $$;

alter table app.strategy_programs drop constraint if exists strategy_programs_date_range_check;
alter table app.strategy_programs drop column if exists start_date;
alter table app.strategy_programs drop column if exists end_date;

update app.strategy_programs set status = 'draft' where status = 'on_hold';

update app.strategy_programs
set status = 'completed'
where status = 'closed';

alter table app.strategy_programs
  drop constraint if exists strategy_programs_status_check;

alter table app.strategy_programs
  add constraint strategy_programs_status_check
  check (status in ('draft', 'active', 'completed', 'archived'));
