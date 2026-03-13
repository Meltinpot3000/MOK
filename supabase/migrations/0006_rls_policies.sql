-- 0006_rls_policies.sql
-- Tenant-aware RLS and permission helper functions.
-- migrate:up

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function app.is_member_of_org(p_organization_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from app.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = app.current_user_id()
      and m.status = 'active'
  );
$$;

create or replace function app.has_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from app.organization_memberships m
    join rbac.member_roles mr on mr.membership_id = m.id
    join rbac.role_permissions rp on rp.role_id = mr.role_id
    join rbac.permissions p on p.id = rp.permission_id
    where m.organization_id = p_organization_id
      and m.user_id = app.current_user_id()
      and m.status = 'active'
      and p.code = p_permission_code
  );
$$;

alter table app.organizations enable row level security;
alter table app.organization_memberships enable row level security;
alter table rbac.roles enable row level security;
alter table rbac.permissions enable row level security;
alter table rbac.role_permissions enable row level security;
alter table rbac.member_roles enable row level security;
alter table app.planning_cycles enable row level security;
alter table app.strategic_goals enable row level security;
alter table app.functional_strategies enable row level security;
alter table app.objectives enable row level security;
alter table app.key_results enable row level security;
alter table app.entity_links enable row level security;
alter table app.tenant_branding enable row level security;
alter table audit.revisions enable row level security;
alter table audit.revision_events enable row level security;

drop policy if exists organizations_select on app.organizations;
create policy organizations_select on app.organizations
for select using (app.is_member_of_org(id));

drop policy if exists organizations_insert on app.organizations;
create policy organizations_insert on app.organizations
for insert to authenticated with check (true);

drop policy if exists organizations_update on app.organizations;
create policy organizations_update on app.organizations
for update using (app.has_permission(id, 'org.manage'))
with check (app.has_permission(id, 'org.manage'));

drop policy if exists memberships_select on app.organization_memberships;
create policy memberships_select on app.organization_memberships
for select using (app.is_member_of_org(organization_id));

drop policy if exists memberships_insert on app.organization_memberships;
create policy memberships_insert on app.organization_memberships
for insert with check (app.has_permission(organization_id, 'membership.manage'));

drop policy if exists memberships_update on app.organization_memberships;
create policy memberships_update on app.organization_memberships
for update using (app.has_permission(organization_id, 'membership.manage'))
with check (app.has_permission(organization_id, 'membership.manage'));

drop policy if exists memberships_delete on app.organization_memberships;
create policy memberships_delete on app.organization_memberships
for delete using (app.has_permission(organization_id, 'membership.manage'));

drop policy if exists roles_select on rbac.roles;
create policy roles_select on rbac.roles
for select using (app.is_member_of_org(organization_id));

drop policy if exists roles_insert on rbac.roles;
create policy roles_insert on rbac.roles
for insert with check (app.has_permission(organization_id, 'admin.manage_roles'));

drop policy if exists roles_update on rbac.roles;
create policy roles_update on rbac.roles
for update using (app.has_permission(organization_id, 'admin.manage_roles'))
with check (app.has_permission(organization_id, 'admin.manage_roles'));

drop policy if exists roles_delete on rbac.roles;
create policy roles_delete on rbac.roles
for delete using (app.has_permission(organization_id, 'admin.manage_roles'));

drop policy if exists permissions_select on rbac.permissions;
create policy permissions_select on rbac.permissions
for select to authenticated using (true);

drop policy if exists role_permissions_select on rbac.role_permissions;
create policy role_permissions_select on rbac.role_permissions
for select using (
  exists (
    select 1
    from rbac.roles r
    where r.id = role_permissions.role_id
      and app.is_member_of_org(r.organization_id)
  )
);

drop policy if exists role_permissions_insert on rbac.role_permissions;
create policy role_permissions_insert on rbac.role_permissions
for insert with check (
  exists (
    select 1
    from rbac.roles r
    where r.id = role_permissions.role_id
      and app.has_permission(r.organization_id, 'admin.manage_roles')
  )
);

drop policy if exists role_permissions_delete on rbac.role_permissions;
create policy role_permissions_delete on rbac.role_permissions
for delete using (
  exists (
    select 1
    from rbac.roles r
    where r.id = role_permissions.role_id
      and app.has_permission(r.organization_id, 'admin.manage_roles')
  )
);

drop policy if exists member_roles_select on rbac.member_roles;
create policy member_roles_select on rbac.member_roles
for select using (
  exists (
    select 1
    from app.organization_memberships m
    where m.id = member_roles.membership_id
      and app.is_member_of_org(m.organization_id)
  )
);

drop policy if exists member_roles_insert on rbac.member_roles;
create policy member_roles_insert on rbac.member_roles
for insert with check (
  exists (
    select 1
    from app.organization_memberships m
    where m.id = member_roles.membership_id
      and app.has_permission(m.organization_id, 'admin.manage_roles')
  )
);

drop policy if exists member_roles_delete on rbac.member_roles;
create policy member_roles_delete on rbac.member_roles
for delete using (
  exists (
    select 1
    from app.organization_memberships m
    where m.id = member_roles.membership_id
      and app.has_permission(m.organization_id, 'admin.manage_roles')
  )
);

drop policy if exists planning_cycles_select on app.planning_cycles;
create policy planning_cycles_select on app.planning_cycles
for select using (app.is_member_of_org(organization_id));

drop policy if exists planning_cycles_modify on app.planning_cycles;
create policy planning_cycles_modify on app.planning_cycles
for all using (app.has_permission(organization_id, 'cycle.write'))
with check (app.has_permission(organization_id, 'cycle.write'));

drop policy if exists strategic_goals_select on app.strategic_goals;
create policy strategic_goals_select on app.strategic_goals
for select using (app.is_member_of_org(organization_id));

drop policy if exists strategic_goals_modify on app.strategic_goals;
create policy strategic_goals_modify on app.strategic_goals
for all using (app.has_permission(organization_id, 'goal.write'))
with check (app.has_permission(organization_id, 'goal.write'));

drop policy if exists functional_strategies_select on app.functional_strategies;
create policy functional_strategies_select on app.functional_strategies
for select using (app.is_member_of_org(organization_id));

drop policy if exists functional_strategies_modify on app.functional_strategies;
create policy functional_strategies_modify on app.functional_strategies
for all using (app.has_permission(organization_id, 'strategy.write'))
with check (app.has_permission(organization_id, 'strategy.write'));

drop policy if exists objectives_select on app.objectives;
create policy objectives_select on app.objectives
for select using (app.is_member_of_org(organization_id));

drop policy if exists objectives_modify on app.objectives;
create policy objectives_modify on app.objectives
for all using (app.has_permission(organization_id, 'okr.write'))
with check (app.has_permission(organization_id, 'okr.write'));

drop policy if exists key_results_select on app.key_results;
create policy key_results_select on app.key_results
for select using (app.is_member_of_org(organization_id));

drop policy if exists key_results_modify on app.key_results;
create policy key_results_modify on app.key_results
for all using (app.has_permission(organization_id, 'okr.write'))
with check (app.has_permission(organization_id, 'okr.write'));

drop policy if exists entity_links_select on app.entity_links;
create policy entity_links_select on app.entity_links
for select using (app.is_member_of_org(organization_id));

drop policy if exists entity_links_modify on app.entity_links;
create policy entity_links_modify on app.entity_links
for all using (app.has_permission(organization_id, 'link.write'))
with check (app.has_permission(organization_id, 'link.write'));

drop policy if exists tenant_branding_select on app.tenant_branding;
create policy tenant_branding_select on app.tenant_branding
for select using (app.is_member_of_org(organization_id));

drop policy if exists tenant_branding_modify on app.tenant_branding;
create policy tenant_branding_modify on app.tenant_branding
for all using (app.has_permission(organization_id, 'admin.manage_branding'))
with check (app.has_permission(organization_id, 'admin.manage_branding'));

drop policy if exists revisions_select on audit.revisions;
create policy revisions_select on audit.revisions
for select using (
  organization_id is not null
  and app.is_member_of_org(organization_id)
  and app.has_permission(organization_id, 'audit.read')
);

drop policy if exists revisions_insert on audit.revisions;
create policy revisions_insert on audit.revisions
for insert with check (true);

drop policy if exists revision_events_select on audit.revision_events;
create policy revision_events_select on audit.revision_events
for select using (
  organization_id is not null
  and app.is_member_of_org(organization_id)
  and app.has_permission(organization_id, 'audit.read')
);

drop policy if exists revision_events_insert on audit.revision_events;
create policy revision_events_insert on audit.revision_events
for insert with check (true);

-- migrate:down
drop policy if exists revision_events_insert on audit.revision_events;
drop policy if exists revision_events_select on audit.revision_events;
drop policy if exists revisions_insert on audit.revisions;
drop policy if exists revisions_select on audit.revisions;
drop policy if exists tenant_branding_modify on app.tenant_branding;
drop policy if exists tenant_branding_select on app.tenant_branding;
drop policy if exists entity_links_modify on app.entity_links;
drop policy if exists entity_links_select on app.entity_links;
drop policy if exists key_results_modify on app.key_results;
drop policy if exists key_results_select on app.key_results;
drop policy if exists objectives_modify on app.objectives;
drop policy if exists objectives_select on app.objectives;
drop policy if exists functional_strategies_modify on app.functional_strategies;
drop policy if exists functional_strategies_select on app.functional_strategies;
drop policy if exists strategic_goals_modify on app.strategic_goals;
drop policy if exists strategic_goals_select on app.strategic_goals;
drop policy if exists planning_cycles_modify on app.planning_cycles;
drop policy if exists planning_cycles_select on app.planning_cycles;
drop policy if exists member_roles_delete on rbac.member_roles;
drop policy if exists member_roles_insert on rbac.member_roles;
drop policy if exists member_roles_select on rbac.member_roles;
drop policy if exists role_permissions_delete on rbac.role_permissions;
drop policy if exists role_permissions_insert on rbac.role_permissions;
drop policy if exists role_permissions_select on rbac.role_permissions;
drop policy if exists permissions_select on rbac.permissions;
drop policy if exists roles_delete on rbac.roles;
drop policy if exists roles_update on rbac.roles;
drop policy if exists roles_insert on rbac.roles;
drop policy if exists roles_select on rbac.roles;
drop policy if exists memberships_delete on app.organization_memberships;
drop policy if exists memberships_update on app.organization_memberships;
drop policy if exists memberships_insert on app.organization_memberships;
drop policy if exists memberships_select on app.organization_memberships;
drop policy if exists organizations_update on app.organizations;
drop policy if exists organizations_insert on app.organizations;
drop policy if exists organizations_select on app.organizations;
alter table audit.revision_events disable row level security;
alter table audit.revisions disable row level security;
alter table app.tenant_branding disable row level security;
alter table app.entity_links disable row level security;
alter table app.key_results disable row level security;
alter table app.objectives disable row level security;
alter table app.functional_strategies disable row level security;
alter table app.strategic_goals disable row level security;
alter table app.planning_cycles disable row level security;
alter table rbac.member_roles disable row level security;
alter table rbac.role_permissions disable row level security;
alter table rbac.permissions disable row level security;
alter table rbac.roles disable row level security;
alter table app.organization_memberships disable row level security;
alter table app.organizations disable row level security;
drop function if exists app.has_permission(uuid, text);
drop function if exists app.is_member_of_org(uuid);
drop function if exists app.current_user_id();
