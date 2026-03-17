begin;

insert into rbac.permissions (code, name, description)
values
  ('cycle_scheme.read', 'Cycle Scheme Read', 'Read cycle scheme and instance configuration'),
  ('cycle_scheme.write', 'Cycle Scheme Write', 'Create and maintain cycle schemes and instances')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('cycle_scheme.read', 'cycle_scheme.write')
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('cycle_scheme.read')
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

grant select, insert, update, delete on app.cycle_schemes to authenticated;
grant select, insert, update, delete on app.cycle_scheme_levels to authenticated;
grant select, insert, update, delete on app.cycle_instances to authenticated;
grant select, insert, update, delete on app.cycle_instance_lock to authenticated;

grant select on app.cycle_schemes to anon;
grant select on app.cycle_scheme_levels to anon;
grant select on app.cycle_instances to anon;
grant select on app.cycle_instance_lock to anon;

alter table app.cycle_schemes enable row level security;
alter table app.cycle_scheme_levels enable row level security;
alter table app.cycle_instances enable row level security;
alter table app.cycle_instance_lock enable row level security;

drop policy if exists cycle_schemes_select on app.cycle_schemes;
create policy cycle_schemes_select on app.cycle_schemes
for select using (app.has_permission(organization_id, 'cycle_scheme.read'));

drop policy if exists cycle_schemes_modify on app.cycle_schemes;
create policy cycle_schemes_modify on app.cycle_schemes
for all using (app.has_permission(organization_id, 'cycle_scheme.write'))
with check (app.has_permission(organization_id, 'cycle_scheme.write'));

drop policy if exists cycle_scheme_levels_select on app.cycle_scheme_levels;
create policy cycle_scheme_levels_select on app.cycle_scheme_levels
for select using (
  exists (
    select 1
    from app.cycle_schemes s
    where s.id = cycle_scheme_levels.cycle_scheme_id
      and app.has_permission(s.organization_id, 'cycle_scheme.read')
  )
);

drop policy if exists cycle_scheme_levels_modify on app.cycle_scheme_levels;
create policy cycle_scheme_levels_modify on app.cycle_scheme_levels
for all using (
  exists (
    select 1
    from app.cycle_schemes s
    where s.id = cycle_scheme_levels.cycle_scheme_id
      and app.has_permission(s.organization_id, 'cycle_scheme.write')
  )
)
with check (
  exists (
    select 1
    from app.cycle_schemes s
    where s.id = cycle_scheme_levels.cycle_scheme_id
      and app.has_permission(s.organization_id, 'cycle_scheme.write')
  )
);

drop policy if exists cycle_instances_select on app.cycle_instances;
create policy cycle_instances_select on app.cycle_instances
for select using (app.has_permission(organization_id, 'cycle_scheme.read'));

drop policy if exists cycle_instances_modify on app.cycle_instances;
create policy cycle_instances_modify on app.cycle_instances
for all using (app.has_permission(organization_id, 'cycle_scheme.write'))
with check (app.has_permission(organization_id, 'cycle_scheme.write'));

drop policy if exists cycle_instance_lock_select on app.cycle_instance_lock;
create policy cycle_instance_lock_select on app.cycle_instance_lock
for select using (
  exists (
    select 1
    from app.cycle_instances i
    where i.id = cycle_instance_lock.cycle_instance_id
      and app.has_permission(i.organization_id, 'cycle_scheme.read')
  )
);

drop policy if exists cycle_instance_lock_modify on app.cycle_instance_lock;
create policy cycle_instance_lock_modify on app.cycle_instance_lock
for all using (
  exists (
    select 1
    from app.cycle_instances i
    where i.id = cycle_instance_lock.cycle_instance_id
      and app.has_permission(i.organization_id, 'cycle_scheme.write')
  )
)
with check (
  exists (
    select 1
    from app.cycle_instances i
    where i.id = cycle_instance_lock.cycle_instance_id
      and app.has_permission(i.organization_id, 'cycle_scheme.write')
  )
);

commit;
