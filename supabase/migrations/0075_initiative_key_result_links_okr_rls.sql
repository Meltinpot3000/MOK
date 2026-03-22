-- 0075_initiative_key_result_links_okr_rls.sql
-- Allow okr.read / okr.write in addition to traceability.* for initiative_key_result_links.
-- migrate:up

drop policy if exists initiative_key_result_links_select on app.initiative_key_result_links;
create policy initiative_key_result_links_select on app.initiative_key_result_links
  for select using (
    app.has_permission(organization_id, 'traceability.read')
    or app.has_permission(organization_id, 'okr.read')
  );

drop policy if exists initiative_key_result_links_modify on app.initiative_key_result_links;
create policy initiative_key_result_links_modify on app.initiative_key_result_links
  for all using (
    app.has_permission(organization_id, 'traceability.write')
    or app.has_permission(organization_id, 'okr.write')
  )
  with check (
    app.has_permission(organization_id, 'traceability.write')
    or app.has_permission(organization_id, 'okr.write')
  );

-- migrate:down

drop policy if exists initiative_key_result_links_modify on app.initiative_key_result_links;
drop policy if exists initiative_key_result_links_select on app.initiative_key_result_links;

create policy initiative_key_result_links_select on app.initiative_key_result_links
  for select using (app.has_permission(organization_id, 'traceability.read'));

create policy initiative_key_result_links_modify on app.initiative_key_result_links
  for all using (app.has_permission(organization_id, 'traceability.write'))
  with check (app.has_permission(organization_id, 'traceability.write'));
