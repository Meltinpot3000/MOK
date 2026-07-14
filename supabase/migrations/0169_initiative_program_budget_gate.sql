-- 0169_initiative_program_budget_gate.sql
-- Initiative-Budget darf Programm-budget_total nicht überschreiten (wenn gesetzt).

-- migrate:up

create or replace function app.enforce_initiative_budget_within_program()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  prog_budget numeric;
  allocated numeric;
  new_budget numeric;
begin
  if new.program_id is null then
    return new;
  end if;

  select p.budget_total into prog_budget
  from app.strategy_programs p
  where p.id = new.program_id;

  if prog_budget is null then
    return new;
  end if;

  new_budget := coalesce(new.budget, 0);

  select coalesce(sum(coalesce(i.budget, 0)), 0) into allocated
  from app.initiatives i
  where i.program_id = new.program_id
    and i.id is distinct from new.id;

  if allocated + new_budget > prog_budget then
    raise exception 'initiative-budget-exceeds-program' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_initiative_budget_within_program on app.initiatives;
create trigger trg_initiative_budget_within_program
before insert or update of budget, program_id on app.initiatives
for each row execute function app.enforce_initiative_budget_within_program();

-- migrate:down

drop trigger if exists trg_initiative_budget_within_program on app.initiatives;
drop function if exists app.enforce_initiative_budget_within_program();
