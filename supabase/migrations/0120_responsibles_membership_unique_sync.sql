-- 0120_responsibles_membership_unique_sync.sql
-- Denormalisierte Felder full_name / email / role_title in app.responsibles bleiben als Cache
-- und werden bei Aenderungen an der Mitgliedschaft aus Auth + membership nachgezogen.
-- Integritaetsregeln (NOT NULL membership_id, Unique): Migration 0122.
-- migrate:up

create or replace function app.trg_sync_responsibles_from_membership_row()
returns trigger
language plpgsql
security definer
set search_path = app, auth, public
as $$
declare
  uemail text;
  dname text;
begin
  select email into uemail from auth.users where id = new.user_id;

  dname := coalesce(
    nullif(trim(new.display_name), ''),
    nullif(split_part(coalesce(uemail, ''), '@', 1), ''),
    'Nutzer'
  );

  update app.responsibles r
  set
    full_name = dname,
    email = lower(uemail),
    role_title = new.title,
    updated_at = now()
  where r.organization_id = new.organization_id
    and (r.membership_id = new.id or r.id = new.responsible_id);

  return new;
end;
$$;

drop trigger if exists trg_org_membership_sync_responsible_denorm on app.organization_memberships;

create trigger trg_org_membership_sync_responsible_denorm
after update of display_name, title, user_id, responsible_id on app.organization_memberships
for each row
when (
  old.display_name is distinct from new.display_name
  or old.title is distinct from new.title
  or old.user_id is distinct from new.user_id
  or old.responsible_id is distinct from new.responsible_id
)
execute function app.trg_sync_responsibles_from_membership_row();

-- migrate:down

drop trigger if exists trg_org_membership_sync_responsible_denorm on app.organization_memberships;
drop function if exists app.trg_sync_responsibles_from_membership_row();
