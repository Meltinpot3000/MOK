-- 0167_program_change_run_gates.sql
-- Change/Run-Modell: Programm als Change-Hub mit weichem Gate (draft/planned vs active).

-- migrate:up

-- --- Entfernen: Programm active braucht Initiative (Henne-Ei) ----------------
drop trigger if exists trg_z_guard_program_activation on app.strategy_programs;
drop function if exists app.enforce_program_activation_has_active_initiative();

-- --- Programm active = freigegebener Change-Rahmen -----------------------------
create or replace function app.enforce_program_activation_requirements()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    if new.strategic_direction_id is null then
      raise exception 'program-active-needs-direction' using errcode = 'P0001';
    end if;
    if new.owner_membership_id is null then
      raise exception 'program-active-needs-owner' using errcode = 'P0001';
    end if;
    if new.budget_total is null then
      raise exception 'program-active-needs-budget' using errcode = 'P0001';
    end if;
    if new.start_date is null or new.end_date is null then
      raise exception 'program-active-needs-dates' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_program_activation_requirements on app.strategy_programs;
create trigger trg_program_activation_requirements
before insert or update on app.strategy_programs
for each row execute function app.enforce_program_activation_requirements();

-- --- Initiative ↔ Programm (weiches Gate) ------------------------------------
create or replace function app.enforce_initiative_program_change_gate()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  prog_status text;
begin
  if new.program_id is null then
    if new.status in ('archived', 'completed') then
      return new;
    end if;
    raise exception 'initiative-needs-program' using errcode = 'P0001';
  end if;

  select p.status into prog_status
  from app.strategy_programs p
  where p.id = new.program_id;

  if prog_status is null then
    raise exception 'initiative-program-not-found' using errcode = 'P0001';
  end if;

  if prog_status = 'closed' then
    raise exception 'initiative-program-closed' using errcode = 'P0001';
  end if;

  if new.status in ('active', 'at_risk') then
    if prog_status <> 'active' then
      raise exception 'active-initiative-needs-active-program' using errcode = 'P0001';
    end if;
  elsif new.status in ('draft', 'planned') then
    if prog_status not in ('draft', 'on_hold', 'active') then
      raise exception 'planned-initiative-needs-draft-or-active-program' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_initiative_program_change_gate on app.initiatives;
create trigger trg_initiative_program_change_gate
before insert or update on app.initiatives
for each row execute function app.enforce_initiative_program_change_gate();

-- --- Jahresziel Run vs Change ------------------------------------------------
create or replace function app.enforce_annual_target_change_run()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  prog_status text;
  prog_direction uuid;
begin
  if new.strategy_program_id is null then
    if new.strategic_direction_id is null then
      raise exception 'run-annual-target-needs-direction' using errcode = 'P0001';
    end if;
    return new;
  end if;

  select p.status, p.strategic_direction_id
    into prog_status, prog_direction
  from app.strategy_programs p
  where p.id = new.strategy_program_id;

  if prog_status is null then
    raise exception 'change-annual-target-program-not-found' using errcode = 'P0001';
  end if;

  if prog_status = 'closed' then
    raise exception 'change-annual-target-program-closed' using errcode = 'P0001';
  end if;

  if prog_direction is not null then
    if new.strategic_direction_id is null then
      new.strategic_direction_id := prog_direction;
    elsif new.strategic_direction_id is distinct from prog_direction then
      raise exception 'change-annual-target-direction-mismatch' using errcode = 'P0001';
    end if;
  end if;

  if new.status = 'active' then
    if prog_status <> 'active' then
      raise exception 'active-change-annual-target-needs-active-program' using errcode = 'P0001';
    end if;
  elsif new.status in (
    'draft', 'submitted_for_review', 'reviewed', 'approved',
    'sent_for_signature', 'signed', 'change_requested'
  ) then
    if prog_status not in ('draft', 'on_hold', 'active') then
      raise exception 'draft-change-annual-target-needs-draft-or-active-program' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_annual_target_change_run on app.annual_targets;
create trigger trg_annual_target_change_run
before insert or update on app.annual_targets
for each row execute function app.enforce_annual_target_change_run();

-- --- OKR-Links nur auf Change-JZ mit active Programm -------------------------
create or replace function app.enforce_annual_target_okr_change_only()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  at_program_id uuid;
  at_status text;
  prog_status text;
begin
  select t.strategy_program_id, t.status
    into at_program_id, at_status
  from app.annual_targets t
  where t.id = new.annual_target_id;

  if at_program_id is null then
    raise exception 'okr-link-run-annual-target-forbidden' using errcode = 'P0001';
  end if;

  select p.status into prog_status
  from app.strategy_programs p
  where p.id = at_program_id;

  if prog_status is null or prog_status <> 'active' then
    raise exception 'okr-link-needs-active-program' using errcode = 'P0001';
  end if;

  if at_status <> 'active' then
    raise exception 'okr-link-needs-active-change-annual-target' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_annual_target_okr_change_only on app.annual_target_okr_objective_links;
create trigger trg_annual_target_okr_change_only
before insert or update on app.annual_target_okr_objective_links
for each row execute function app.enforce_annual_target_okr_change_only();

-- --- initiative_target_links: schreibend deprecaten --------------------------
create or replace function app.block_initiative_target_links_write()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
begin
  raise exception 'initiative-target-links-deprecated' using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_block_initiative_target_links on app.initiative_target_links;
create trigger trg_block_initiative_target_links
before insert or update on app.initiative_target_links
for each row execute function app.block_initiative_target_links_write();

-- --- OKR: leading_strategic_direction_id nicht mehr neu setzen ---------------
create or replace function app.block_okr_direct_direction_set()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.leading_strategic_direction_id is not null then
      raise exception 'okr-direct-direction-deprecated' using errcode = 'P0001';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.leading_strategic_direction_id is distinct from old.leading_strategic_direction_id
       and new.leading_strategic_direction_id is not null then
      raise exception 'okr-direct-direction-deprecated' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_okr_direct_direction on app.okr_objectives;
create trigger trg_block_okr_direct_direction
before insert or update on app.okr_objectives
for each row execute function app.block_okr_direct_direction_set();

alter table app.annual_targets drop constraint if exists annual_targets_progress_calculation_mode_check;
alter table app.annual_targets
  add constraint annual_targets_progress_calculation_mode_check
  check (progress_calculation_mode in ('manual', 'key_result_based', 'program_based', 'hybrid'));

-- migrate:down

drop trigger if exists trg_block_okr_direct_direction on app.okr_objectives;
drop function if exists app.block_okr_direct_direction_set();

drop trigger if exists trg_block_initiative_target_links on app.initiative_target_links;
drop function if exists app.block_initiative_target_links_write();

drop trigger if exists trg_annual_target_okr_change_only on app.annual_target_okr_objective_links;
drop function if exists app.enforce_annual_target_okr_change_only();

drop trigger if exists trg_annual_target_change_run on app.annual_targets;
drop function if exists app.enforce_annual_target_change_run();

drop trigger if exists trg_initiative_program_change_gate on app.initiatives;
drop function if exists app.enforce_initiative_program_change_gate();

drop trigger if exists trg_program_activation_requirements on app.strategy_programs;
drop function if exists app.enforce_program_activation_requirements();

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
    where program_id = new.id and status = 'active';
    if active_count < 1 then
      raise exception 'program-needs-active-initiative' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_z_guard_program_activation
before insert or update on app.strategy_programs
for each row execute function app.enforce_program_activation_has_active_initiative();

update app.annual_targets
set progress_calculation_mode = 'initiative_based'
where progress_calculation_mode = 'program_based';

alter table app.annual_targets drop constraint if exists annual_targets_progress_calculation_mode_check;
alter table app.annual_targets
  add constraint annual_targets_progress_calculation_mode_check
  check (progress_calculation_mode in ('manual', 'key_result_based', 'initiative_based', 'hybrid'));
