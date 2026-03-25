-- 0084_member_invitations_role_codes.sql
-- Mehrere Rollen pro Einladung (JSON-Array). role_code bleibt fuer Kompatibilitaet (erste Rolle).
-- migrate:up

alter table app.member_invitations
  add column if not exists role_codes jsonb not null default '[]'::jsonb;

update app.member_invitations
set role_codes = jsonb_build_array(role_code)
where jsonb_array_length(role_codes) = 0;

-- migrate:down

alter table app.member_invitations drop column if exists role_codes;
