-- 0010_phase0_responsibles.sql
-- Phase 0 foundation: responsibles, assignments, and reporting hierarchy.
-- migrate:up
create table if not exists app.responsibles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  membership_id uuid references app.organization_memberships(id) on delete set null,
  full_name text not null,
  email text,
  role_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index if not exists idx_responsibles_org
  on app.responsibles (organization_id);

drop trigger if exists trg_responsibles_updated_at on app.responsibles;
create trigger trg_responsibles_updated_at
before update on app.responsibles
for each row
execute function app.set_updated_at();

create table if not exists app.responsible_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  responsible_id uuid not null references app.responsibles(id) on delete cascade,
  org_unit_id uuid not null references app.org_units(id) on delete cascade,
  assignment_type text not null default 'owner' check (assignment_type in ('owner', 'support', 'stakeholder')),
  created_at timestamptz not null default now(),
  unique (responsible_id, org_unit_id, assignment_type)
);

create index if not exists idx_responsible_assignments_org
  on app.responsible_assignments (organization_id);

create table if not exists app.responsible_hierarchy (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  manager_responsible_id uuid not null references app.responsibles(id) on delete cascade,
  report_responsible_id uuid not null references app.responsibles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (manager_responsible_id, report_responsible_id),
  check (manager_responsible_id <> report_responsible_id)
);

create index if not exists idx_responsible_hierarchy_org
  on app.responsible_hierarchy (organization_id);

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

drop trigger if exists trg_responsible_assignments_validate_org on app.responsible_assignments;
create trigger trg_responsible_assignments_validate_org
before insert or update on app.responsible_assignments
for each row
execute function app.validate_responsible_cross_org();

drop trigger if exists trg_responsible_hierarchy_validate_org on app.responsible_hierarchy;
create trigger trg_responsible_hierarchy_validate_org
before insert or update on app.responsible_hierarchy
for each row
execute function app.validate_responsible_cross_org();

-- migrate:down
drop trigger if exists trg_responsible_hierarchy_validate_org on app.responsible_hierarchy;
drop trigger if exists trg_responsible_assignments_validate_org on app.responsible_assignments;
drop function if exists app.validate_responsible_cross_org();
drop table if exists app.responsible_hierarchy;
drop table if exists app.responsible_assignments;
drop trigger if exists trg_responsibles_updated_at on app.responsibles;
drop table if exists app.responsibles;
