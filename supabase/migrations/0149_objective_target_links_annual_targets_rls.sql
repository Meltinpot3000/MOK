-- migrate:up
-- Jahresziel-Alignment: objective_target_links lesen/schreiben, wenn annual_targets-Rechte es erlauben
-- (nicht nur traceability.* — sonst scheitert das Speichern des strategischen Ziels am Entwurf).

drop policy if exists objective_target_links_select on app.objective_target_links;
create policy objective_target_links_select on app.objective_target_links
for select using (
  app.has_permission(organization_id, 'traceability.read')
  or exists (
    select 1
    from app.annual_targets t
    where t.id = objective_target_links.annual_target_id
      and app.annual_target_can_read(t.organization_id, t.owner_membership_id)
  )
);

drop policy if exists objective_target_links_modify on app.objective_target_links;
create policy objective_target_links_modify on app.objective_target_links
for all using (
  app.has_permission(organization_id, 'traceability.write')
  or exists (
    select 1
    from app.annual_targets t
    where t.id = objective_target_links.annual_target_id
      and app.annual_target_can_modify(t.organization_id, t.owner_membership_id)
  )
)
with check (
  app.has_permission(organization_id, 'traceability.write')
  or exists (
    select 1
    from app.annual_targets t
    where t.id = objective_target_links.annual_target_id
      and app.annual_target_can_modify(t.organization_id, t.owner_membership_id)
  )
);

-- migrate:down
drop policy if exists objective_target_links_modify on app.objective_target_links;
create policy objective_target_links_modify on app.objective_target_links
for all using (app.has_permission(organization_id, 'traceability.write'))
with check (app.has_permission(organization_id, 'traceability.write'));

drop policy if exists objective_target_links_select on app.objective_target_links;
create policy objective_target_links_select on app.objective_target_links
for select using (app.has_permission(organization_id, 'traceability.read'));
