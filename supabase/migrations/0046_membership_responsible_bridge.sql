-- 0046_membership_responsible_bridge.sql
-- Optional 1:1 bridge between user membership and responsible.
-- migrate:up

alter table app.organization_memberships
  add column if not exists responsible_id uuid references app.responsibles(id) on delete set null;

create unique index if not exists idx_org_memberships_responsible_unique
  on app.organization_memberships (responsible_id)
  where responsible_id is not null;

create or replace function app.validate_membership_responsible_org()
returns trigger
language plpgsql
as $$
declare
  v_responsible_org_id uuid;
begin
  if new.responsible_id is null then
    return new;
  end if;

  select organization_id
  into v_responsible_org_id
  from app.responsibles
  where id = new.responsible_id;

  if v_responsible_org_id is null then
    raise exception 'membership responsible does not exist';
  end if;

  if v_responsible_org_id <> new.organization_id then
    raise exception 'membership responsible cross-organization mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_org_memberships_validate_responsible on app.organization_memberships;
create trigger trg_org_memberships_validate_responsible
before insert or update on app.organization_memberships
for each row
execute function app.validate_membership_responsible_org();

-- migrate:down
drop trigger if exists trg_org_memberships_validate_responsible on app.organization_memberships;
drop function if exists app.validate_membership_responsible_org();
drop index if exists idx_org_memberships_responsible_unique;
alter table app.organization_memberships
  drop column if exists responsible_id;
