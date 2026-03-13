-- 0009_phase0_org_units.sql
-- Phase 0 foundation: fixed three-level organization structure.
-- migrate:up
create table if not exists app.org_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  parent_unit_id uuid references app.org_units(id) on delete cascade,
  level_no integer not null check (level_no between 1 and 3),
  unit_type text not null check (unit_type in ('organization', 'division', 'team')),
  code text not null,
  name text not null,
  description text,
  owner_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_org_units_org_level
  on app.org_units (organization_id, level_no);

create index if not exists idx_org_units_parent
  on app.org_units (parent_unit_id);

create or replace function app.validate_org_unit_hierarchy()
returns trigger
language plpgsql
as $$
declare
  v_parent_level integer;
  v_parent_org uuid;
begin
  if new.level_no = 1 then
    if new.parent_unit_id is not null then
      raise exception 'level 1 unit cannot have a parent';
    end if;
    if new.unit_type <> 'organization' then
      raise exception 'level 1 unit must use unit_type organization';
    end if;
  else
    if new.parent_unit_id is null then
      raise exception 'levels 2 and 3 require a parent_unit_id';
    end if;

    select level_no, organization_id
      into v_parent_level, v_parent_org
    from app.org_units
    where id = new.parent_unit_id;

    if v_parent_level is null then
      raise exception 'parent unit not found';
    end if;

    if v_parent_org <> new.organization_id then
      raise exception 'parent must belong to the same organization';
    end if;

    if v_parent_level <> new.level_no - 1 then
      raise exception 'parent level must be exactly one level above child';
    end if;

    if new.level_no = 2 and new.unit_type <> 'division' then
      raise exception 'level 2 must use unit_type division';
    end if;

    if new.level_no = 3 and new.unit_type <> 'team' then
      raise exception 'level 3 must use unit_type team';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_org_units_validate_hierarchy on app.org_units;
create trigger trg_org_units_validate_hierarchy
before insert or update on app.org_units
for each row
execute function app.validate_org_unit_hierarchy();

drop trigger if exists trg_org_units_updated_at on app.org_units;
create trigger trg_org_units_updated_at
before update on app.org_units
for each row
execute function app.set_updated_at();

-- migrate:down
drop trigger if exists trg_org_units_updated_at on app.org_units;
drop trigger if exists trg_org_units_validate_hierarchy on app.org_units;
drop function if exists app.validate_org_unit_hierarchy();
drop table if exists app.org_units;
