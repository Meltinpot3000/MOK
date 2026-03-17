-- 0044_drop_legacy_org_unit_path.sql
-- Development cleanup: remove legacy org_unit_id assignment path.
-- migrate:up

alter table app.responsible_assignments
  add column if not exists assignment_role_de text;

alter table app.responsible_assignments
  add column if not exists organization_unit_id uuid;

alter table app.responsible_assignments
  disable trigger trg_responsible_assignments_validate_org;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'app'
      and table_name = 'responsible_assignments'
      and column_name = 'org_unit_id'
  ) then
    execute $sql$
      update app.responsible_assignments
      set organization_unit_id = org_unit_id
      where organization_unit_id is null
        and org_unit_id is not null
    $sql$;

    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'app'
        and table_name = 'org_units'
    ) then
      execute $sql$
        update app.responsible_assignments ra
        set organization_unit_id = nou.id
        from app.org_units lou
        join app.organization_unit nou
          on nou.organization_id = lou.organization_id
         and nou.code = lou.code
        where ra.organization_unit_id is null
          and ra.org_unit_id = lou.id
      $sql$;
    end if;
  end if;
end
$$;

update app.responsible_assignments ra
set organization_unit_id = null
where organization_unit_id is not null
  and not exists (
    select 1
    from app.organization_unit ou
    where ou.id = ra.organization_unit_id
  );

delete from app.responsible_assignments ra
where ra.organization_unit_id is null;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_org_unit_id_fkey;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_responsible_id_org_unit_id_assignment_type_key;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_organization_unit_id_fkey;

alter table app.responsible_assignments
  add constraint responsible_assignments_organization_unit_id_fkey
  foreign key (organization_unit_id)
  references app.organization_unit(id)
  on delete cascade;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_responsible_id_organization_unit_id_assignment_type_key;

alter table app.responsible_assignments
  add constraint responsible_assignments_responsible_id_organization_unit_id_assignment_type_key
  unique (responsible_id, organization_unit_id, assignment_type);

alter table app.responsible_assignments
  alter column organization_unit_id set not null;

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

alter table app.responsible_assignments
  enable trigger trg_responsible_assignments_validate_org;

-- migrate:down

alter table app.responsible_assignments
  add column if not exists org_unit_id uuid;

update app.responsible_assignments
set org_unit_id = organization_unit_id
where org_unit_id is null;

alter table app.responsible_assignments
  alter column org_unit_id set not null;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_organization_unit_id_fkey;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_responsible_id_organization_unit_id_assignment_type_key;

alter table app.responsible_assignments
  add constraint responsible_assignments_org_unit_id_fkey
  foreign key (org_unit_id)
  references app.org_units(id)
  on delete cascade;

alter table app.responsible_assignments
  add constraint responsible_assignments_responsible_id_org_unit_id_assignment_type_key
  unique (responsible_id, org_unit_id, assignment_type);
