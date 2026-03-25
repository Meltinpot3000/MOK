-- 0085_invited_display_name.sql
-- Optionaler Anzeigename bei Einladung; wird bei Annahme als membership.title gesetzt.
-- migrate:up

alter table app.member_invitations
  add column if not exists invited_display_name text;

-- migrate:down

alter table app.member_invitations drop column if exists invited_display_name;
