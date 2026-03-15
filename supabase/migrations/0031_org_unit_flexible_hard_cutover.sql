-- 0031_org_unit_flexible_hard_cutover.sql
-- Hard cutover from fixed org_units (level-based) to flexible organization units.
-- migrate:up

create table if not exists app.organization_unit_type (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists app.organization_unit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  organization_unit_type_id uuid not null references app.organization_unit_type(id),
  parent_id uuid references app.organization_unit(id) on delete cascade,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_organization_unit_org
  on app.organization_unit (organization_id);
create index if not exists idx_organization_unit_parent
  on app.organization_unit (parent_id);
create index if not exists idx_organization_unit_type
  on app.organization_unit (organization_unit_type_id);
create index if not exists idx_organization_unit_status_sort
  on app.organization_unit (status, sort_order, name);

insert into app.organization_unit_type (code, name, description, is_active, sort_order)
values
  ('organization', 'Organisation', 'Top-level organizational root', true, 10),
  ('division', 'Division', 'Major division or segment', true, 20),
  ('business_unit', 'Business Unit', 'Business unit across products or markets', true, 30),
  ('function', 'Function', 'Cross-functional capability area', true, 40),
  ('department', 'Department', 'Department within a division or function', true, 50),
  ('team', 'Team', 'Execution team', true, 60),
  ('program', 'Program', 'Program-level coordination entity', true, 70),
  ('region', 'Region', 'Geographic entity', true, 80),
  ('legal_entity', 'Legal Entity', 'Legal company entity', true, 90)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

create or replace function app.validate_organization_unit_hierarchy()
returns trigger
language plpgsql
as $$
declare
  v_parent_id uuid;
  v_parent_org uuid;
  v_type_exists boolean;
begin
  if new.parent_id is not null and new.parent_id = new.id then
    raise exception 'organization unit cannot be its own parent';
  end if;

  select exists (
    select 1
    from app.organization_unit_type t
    where t.id = new.organization_unit_type_id
      and t.is_active = true
  ) into v_type_exists;
  if not v_type_exists then
    raise exception 'organization unit type does not exist or is inactive';
  end if;

  if new.parent_id is not null then
    select u.id, u.organization_id
      into v_parent_id, v_parent_org
    from app.organization_unit u
    where u.id = new.parent_id;

    if v_parent_id is null then
      raise exception 'parent organization unit not found';
    end if;

    if v_parent_org <> new.organization_id then
      raise exception 'parent must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;

create or replace function app.validate_organization_unit_cycle()
returns trigger
language plpgsql
as $$
declare
  v_loop_detected boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  with recursive parent_chain as (
    select u.id, u.parent_id
    from app.organization_unit u
    where u.id = new.parent_id
    union all
    select p.id, p.parent_id
    from app.organization_unit p
    join parent_chain c on c.parent_id = p.id
  )
  select exists(select 1 from parent_chain where id = new.id)
    into v_loop_detected;

  if v_loop_detected then
    raise exception 'circular parent relationship is not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_organization_unit_validate_hierarchy on app.organization_unit;
create trigger trg_organization_unit_validate_hierarchy
before insert or update on app.organization_unit
for each row
execute function app.validate_organization_unit_hierarchy();

drop trigger if exists trg_organization_unit_validate_cycle on app.organization_unit;
create trigger trg_organization_unit_validate_cycle
before insert or update on app.organization_unit
for each row
execute function app.validate_organization_unit_cycle();

drop trigger if exists trg_organization_unit_updated_at on app.organization_unit;
create trigger trg_organization_unit_updated_at
before update on app.organization_unit
for each row
execute function app.set_updated_at();

insert into app.organization_unit (
  id,
  organization_id,
  name,
  code,
  organization_unit_type_id,
  parent_id,
  description,
  status,
  sort_order,
  created_at,
  updated_at
)
select
  ou.id,
  ou.organization_id,
  ou.name,
  ou.code,
  out.id,
  ou.parent_unit_id,
  ou.description,
  'active',
  case ou.level_no
    when 1 then 10
    when 2 then 20
    else 30
  end,
  ou.created_at,
  ou.updated_at
from app.org_units ou
join app.organization_unit_type out on out.code = ou.unit_type
on conflict (id) do nothing;

alter table app.responsible_assignments
  add column if not exists organization_unit_id uuid;

update app.responsible_assignments
set organization_unit_id = org_unit_id
where organization_unit_id is null
  and org_unit_id is not null;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_org_unit_id_fkey;

alter table app.responsible_assignments
  add constraint responsible_assignments_organization_unit_id_fkey
  foreign key (organization_unit_id)
  references app.organization_unit(id)
  on delete cascade;

alter table app.responsible_assignments
  alter column organization_unit_id set not null;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_responsible_id_org_unit_id_assignment_type_key;

alter table app.responsible_assignments
  add constraint responsible_assignments_responsible_id_org_unit_id_assignment_type_key
  unique (responsible_id, organization_unit_id, assignment_type);

alter table app.responsible_assignments
  drop column if exists org_unit_id;

create or replace function app.validate_responsible_cross_org()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
begin
  if tg_table_name = 'responsible_assignments' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'responsible assignment cross-organization mismatch';
    end if;

    select organization_id into v_org_id
    from app.organization_unit
    where id = new.organization_unit_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'organization unit assignment cross-organization mismatch';
    end if;
  elsif tg_table_name = 'responsible_hierarchy' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.manager_responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'manager cross-organization mismatch';
    end if;

    select organization_id into v_org_id
    from app.responsibles
    where id = new.report_responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'report cross-organization mismatch';
    end if;
  end if;

  return new;
end;
$$;

grant select on app.organization_unit_type to authenticated, anon;
grant select, insert, update, delete on app.organization_unit to authenticated;
grant select on app.organization_unit to anon;

alter table app.organization_unit enable row level security;

drop policy if exists organization_unit_select on app.organization_unit;
create policy organization_unit_select on app.organization_unit
for select using (app.is_member_of_org(organization_id));

drop policy if exists organization_unit_modify on app.organization_unit;
create policy organization_unit_modify on app.organization_unit
for all using (app.has_permission(organization_id, 'org_unit.manage'))
with check (app.has_permission(organization_id, 'org_unit.manage'));

drop trigger if exists trg_audit_organization_unit on app.organization_unit;
create trigger trg_audit_organization_unit
after insert or update or delete on app.organization_unit
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_org_units on app.org_units;
drop trigger if exists trg_org_units_updated_at on app.org_units;
drop trigger if exists trg_org_units_validate_hierarchy on app.org_units;
drop function if exists app.validate_org_unit_hierarchy();
drop table if exists app.org_units;

-- migrate:down

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
for each row execute function app.validate_org_unit_hierarchy();

drop trigger if exists trg_org_units_updated_at on app.org_units;
create trigger trg_org_units_updated_at
before update on app.org_units
for each row execute function app.set_updated_at();

alter table app.responsible_assignments
  add column if not exists org_unit_id uuid;

update app.responsible_assignments ra
set org_unit_id = ou.id
from app.organization_unit ou
where ra.organization_unit_id = ou.id
  and ra.org_unit_id is null;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_organization_unit_id_fkey;

alter table app.responsible_assignments
  add constraint responsible_assignments_org_unit_id_fkey
  foreign key (org_unit_id)
  references app.org_units(id)
  on delete cascade;

alter table app.responsible_assignments
  alter column org_unit_id set not null;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_responsible_id_org_unit_id_assignment_type_key;

alter table app.responsible_assignments
  add constraint responsible_assignments_responsible_id_org_unit_id_assignment_type_key
  unique (responsible_id, org_unit_id, assignment_type);

alter table app.responsible_assignments
  drop column if exists organization_unit_id;

create or replace function app.validate_responsible_cross_org()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
begin
  if tg_table_name = 'responsible_assignments' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.responsible_id;
    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'responsible assignment cross-organization mismatch';
    end if;
    select organization_id into v_org_id
    from app.org_units
    where id = new.org_unit_id;
    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'org unit assignment cross-organization mismatch';
    end if;
  elsif tg_table_name = 'responsible_hierarchy' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.manager_responsible_id;
    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'manager cross-organization mismatch';
    end if;
    select organization_id into v_org_id
    from app.responsibles
    where id = new.report_responsible_id;
    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'report cross-organization mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_organization_unit on app.organization_unit;
drop policy if exists organization_unit_modify on app.organization_unit;
drop policy if exists organization_unit_select on app.organization_unit;
alter table app.organization_unit disable row level security;
drop trigger if exists trg_organization_unit_updated_at on app.organization_unit;
drop trigger if exists trg_organization_unit_validate_cycle on app.organization_unit;
drop trigger if exists trg_organization_unit_validate_hierarchy on app.organization_unit;
drop function if exists app.validate_organization_unit_cycle();
drop function if exists app.validate_organization_unit_hierarchy();
drop table if exists app.organization_unit;
drop table if exists app.organization_unit_type;
