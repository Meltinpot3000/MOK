-- 0138_okr_read_initiatives_select.sql
-- OKR-Planung: Initiativen-Pills und KR-Verknüpfung brauchen SELECT auf app.initiatives.
-- Links dürfen bereits mit okr.read/okr.write (0075); die Initiativen-Zeilen selbst waren nur
-- mit initiative.read / review.read sichtbar → leere Liste „Keine Initiativen im Zyklus“.
-- migrate:up

drop policy if exists initiatives_select on app.initiatives;
create policy initiatives_select on app.initiatives
for select using (
  app.has_permission(organization_id, 'initiative.read')
  or app.has_permission(organization_id, 'review.read')
  or app.has_permission(organization_id, 'okr.read')
);

-- migrate:down

drop policy if exists initiatives_select on app.initiatives;
create policy initiatives_select on app.initiatives
for select using (
  app.has_permission(organization_id, 'initiative.read')
  or app.has_permission(organization_id, 'review.read')
);
