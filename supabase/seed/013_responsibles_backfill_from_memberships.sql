-- 013_responsibles_backfill_from_memberships.sql
-- Dev/Reset: fuer jede Mitgliedschaft (active/invited) ohne Zeile in app.responsibles
-- eine Zeile anlegen und organization_memberships.responsible_id setzen.
-- Ausfuehrung z. B.: node scripts/run-sql-seed.mjs supabase/seed/013_responsibles_backfill_from_memberships.sql
-- Voraussetzung: auth.users existiert fuer user_id (lokale Seeds).

insert into app.responsibles (
  organization_id,
  membership_id,
  full_name,
  email,
  role_title
)
select
  m.organization_id,
  m.id,
  coalesce(
    nullif(trim(m.display_name), ''),
    nullif(
      trim(
        coalesce(
          u.raw_user_meta_data ->> 'full_name',
          u.raw_user_meta_data ->> 'name',
          u.raw_user_meta_data ->> 'display_name'
        )
      ),
      ''
    ),
    nullif(split_part(coalesce(lower(u.email), ''), '@', 1), ''),
    'Nutzer'
  ),
  nullif(lower(trim(u.email)), ''),
  nullif(trim(m.title), '')
from app.organization_memberships m
join auth.users u on u.id = m.user_id
where m.status in ('active', 'invited')
  and not exists (
    select 1
    from app.responsibles r
    where r.organization_id = m.organization_id
      and r.membership_id = m.id
  );

update app.organization_memberships m
set responsible_id = r.id
from app.responsibles r
where r.membership_id = m.id
  and r.organization_id = m.organization_id
  and m.responsible_id is distinct from r.id;
