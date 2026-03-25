-- 0086_membership_responsible_many_members.sql
-- Mehrere Mitgliedschaften duerfen dieselbe Verantwortlichen-Person haben (Teamzuordnung).
-- migrate:up

drop index if exists app.idx_org_memberships_responsible_unique;

-- migrate:down

create unique index if not exists idx_org_memberships_responsible_unique
  on app.organization_memberships (responsible_id)
  where responsible_id is not null;
