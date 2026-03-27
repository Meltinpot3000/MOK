-- 0101_member_invitations_sync_accepted_provisioned.sql
-- Backfill: Einladungen waren «pending», obwohl bereits eine aktive Mitgliedschaft
-- zur Auth-E-Mail existierte (Provisionierung ohne Aufruf von /invite/accept).
-- Setzt Status auf «accepted» und verknuepft accepted_by_user_id mit der Membership.
-- migrate:up

update app.member_invitations i
set
  status = 'accepted',
  accepted_by_user_id = m.user_id,
  accepted_at = coalesce(i.accepted_at, timezone('utc'::text, now()))
from app.organization_memberships m
inner join auth.users u on u.id = m.user_id
where i.organization_id = m.organization_id
  and i.status = 'pending'
  and m.status in ('active', 'invited')
  and u.email is not null
  and lower(btrim(i.invited_email)) = lower(btrim(u.email));

-- migrate:down
-- Daten-Backfill nicht automatisch rueckgaengig (Status manuell pruefen).
select 1;
