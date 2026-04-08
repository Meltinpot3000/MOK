-- 0123_responsibles_membership_fk_cascade.sql
-- NOT NULL auf membership_id widerspricht ON DELETE SET NULL: Loeschen einer Mitgliedschaft
-- soll die zugehoerige Verantwortlichen-Zeile mit entfernen (CASCADE).
-- migrate:up

alter table app.responsibles drop constraint if exists responsibles_membership_id_fkey;

alter table app.responsibles
  add constraint responsibles_membership_id_fkey
  foreign key (membership_id) references app.organization_memberships(id) on delete cascade;

comment on table app.responsibles is
  'Verantwortliche Person je Mitgliedschaft. Stammdaten-Cache; Pflege nur via membership_id, '
  'nicht durch direkte Inserts ohne Mitgliedschaft (siehe ensureResponsibleForMembership / App UI).';

-- migrate:down

alter table app.responsibles drop constraint if exists responsibles_membership_id_fkey;

-- Kein ON DELETE SET NULL mehr (widerspricht NOT NULL membership_id); RESTRICT als Rollback-Default
alter table app.responsibles
  add constraint responsibles_membership_id_fkey
  foreign key (membership_id) references app.organization_memberships(id) on delete restrict;
