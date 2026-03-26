-- 0089_membership_display_name.sql
-- Anzeigename (Mitgliedschaft) getrennt vom Funktions-Titel; Einladung speichert beides separat.
-- migrate:up

alter table app.organization_memberships
  add column if not exists display_name text;

alter table app.member_invitations
  add column if not exists invited_membership_title text;

-- migrate:down

alter table app.member_invitations drop column if exists invited_membership_title;

alter table app.organization_memberships drop column if exists display_name;
