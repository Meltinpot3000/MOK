-- 0042_responsible_cross_org_dual_unit_support.sql
-- Make responsible assignment validation compatible with both org_unit_id and organization_unit_id.
-- migrate:up

create or replace function app.validate_responsible_cross_org()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
  v_assignment_unit_id uuid;
begin
  if tg_table_name = 'responsible_assignments' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'responsible assignment cross-organization mismatch';
    end if;

    -- Read unit id in a schema-tolerant way for both old/new column names.
    v_assignment_unit_id := nullif(
      coalesce(
        to_jsonb(new) ->> 'organization_unit_id',
        to_jsonb(new) ->> 'org_unit_id'
      ),
      ''
    )::uuid;

    if v_assignment_unit_id is null then
      raise exception 'responsible assignment missing organization unit reference';
    end if;

    select organization_id into v_org_id
    from app.organization_unit
    where id = v_assignment_unit_id;

    if v_org_id is null then
      select organization_id into v_org_id
      from app.org_units
      where id = v_assignment_unit_id;
    end if;

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

-- migrate:down
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

