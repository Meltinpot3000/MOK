-- 0032_org_unit_dimension_links.sql
-- Link industries/business models to organization units for graph overlays.
-- migrate:up

create table if not exists app.organization_unit_industries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  organization_unit_id uuid not null references app.organization_unit(id) on delete cascade,
  industry_id uuid not null references app.industries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, organization_unit_id, industry_id)
);

create table if not exists app.organization_unit_business_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  organization_unit_id uuid not null references app.organization_unit(id) on delete cascade,
  business_model_id uuid not null references app.business_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (planning_cycle_id, organization_unit_id, business_model_id)
);

create index if not exists idx_org_unit_industries_org_cycle
  on app.organization_unit_industries (organization_id, planning_cycle_id);
create index if not exists idx_org_unit_industries_unit
  on app.organization_unit_industries (organization_unit_id);
create index if not exists idx_org_unit_business_models_org_cycle
  on app.organization_unit_business_models (organization_id, planning_cycle_id);
create index if not exists idx_org_unit_business_models_unit
  on app.organization_unit_business_models (organization_unit_id);

create or replace function app.validate_org_unit_dimension_link_cross_org()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
  v_cycle_id uuid;
begin
  select organization_id into v_org_id
  from app.organization_unit
  where id = new.organization_unit_id;

  if v_org_id is null or v_org_id <> new.organization_id then
    raise exception 'organization unit cross-organization mismatch';
  end if;

  if tg_table_name = 'organization_unit_industries' then
    select organization_id, planning_cycle_id into v_org_id, v_cycle_id
    from app.industries
    where id = new.industry_id;
  elsif tg_table_name = 'organization_unit_business_models' then
    select organization_id, planning_cycle_id into v_org_id, v_cycle_id
    from app.business_models
    where id = new.business_model_id;
  else
    raise exception 'unsupported link table %', tg_table_name;
  end if;

  if v_org_id is null or v_org_id <> new.organization_id then
    raise exception 'dimension link cross-organization mismatch';
  end if;

  if v_cycle_id is null or v_cycle_id <> new.planning_cycle_id then
    raise exception 'dimension link planning cycle mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_org_unit_industries_validate_org on app.organization_unit_industries;
create trigger trg_org_unit_industries_validate_org
before insert or update on app.organization_unit_industries
for each row execute function app.validate_org_unit_dimension_link_cross_org();

drop trigger if exists trg_org_unit_business_models_validate_org on app.organization_unit_business_models;
create trigger trg_org_unit_business_models_validate_org
before insert or update on app.organization_unit_business_models
for each row execute function app.validate_org_unit_dimension_link_cross_org();

grant select, insert, update, delete on app.organization_unit_industries to authenticated;
grant select, insert, update, delete on app.organization_unit_business_models to authenticated;
grant select on app.organization_unit_industries to anon;
grant select on app.organization_unit_business_models to anon;

alter table app.organization_unit_industries enable row level security;
alter table app.organization_unit_business_models enable row level security;

drop policy if exists organization_unit_industries_select on app.organization_unit_industries;
create policy organization_unit_industries_select on app.organization_unit_industries
for select using (app.has_permission(organization_id, 'dimension.read'));

drop policy if exists organization_unit_industries_modify on app.organization_unit_industries;
create policy organization_unit_industries_modify on app.organization_unit_industries
for all using (app.has_permission(organization_id, 'dimension.write'))
with check (app.has_permission(organization_id, 'dimension.write'));

drop policy if exists organization_unit_business_models_select on app.organization_unit_business_models;
create policy organization_unit_business_models_select on app.organization_unit_business_models
for select using (app.has_permission(organization_id, 'dimension.read'));

drop policy if exists organization_unit_business_models_modify on app.organization_unit_business_models;
create policy organization_unit_business_models_modify on app.organization_unit_business_models
for all using (app.has_permission(organization_id, 'dimension.write'))
with check (app.has_permission(organization_id, 'dimension.write'));

drop trigger if exists trg_audit_org_unit_industries on app.organization_unit_industries;
create trigger trg_audit_org_unit_industries
after insert or update or delete on app.organization_unit_industries
for each row execute function audit.log_row_change();

drop trigger if exists trg_audit_org_unit_business_models on app.organization_unit_business_models;
create trigger trg_audit_org_unit_business_models
after insert or update or delete on app.organization_unit_business_models
for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_org_unit_business_models on app.organization_unit_business_models;
drop trigger if exists trg_audit_org_unit_industries on app.organization_unit_industries;
drop policy if exists organization_unit_business_models_modify on app.organization_unit_business_models;
drop policy if exists organization_unit_business_models_select on app.organization_unit_business_models;
drop policy if exists organization_unit_industries_modify on app.organization_unit_industries;
drop policy if exists organization_unit_industries_select on app.organization_unit_industries;
alter table app.organization_unit_business_models disable row level security;
alter table app.organization_unit_industries disable row level security;
drop trigger if exists trg_org_unit_business_models_validate_org on app.organization_unit_business_models;
drop trigger if exists trg_org_unit_industries_validate_org on app.organization_unit_industries;
drop function if exists app.validate_org_unit_dimension_link_cross_org();
drop table if exists app.organization_unit_business_models;
drop table if exists app.organization_unit_industries;
