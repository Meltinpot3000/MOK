-- 0087_invitee_accept_membership_rls.sql
-- Einladende haben noch keine membership.manage-/admin.manage_roles-Rechte:
-- ohne zusaetzliche Policies scheitert /invite/accept an RLS (Mitgliedschaft + Rollen).
-- migrate:up

-- Mitgliedschaft: Selbst anlegen, solange eine passende Einladung pending ist
drop policy if exists memberships_invitee_accept_insert on app.organization_memberships;
create policy memberships_invitee_accept_insert on app.organization_memberships
for insert
with check (
  user_id = auth.uid()
  and status = 'active'
  and exists (
    select 1
    from app.member_invitations i
    where i.organization_id = organization_id
      and lower(i.invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and i.status = 'pending'
  )
);

-- Upsert/Retry: bestehende Zeile auf active setzen, solange die Einladung noch pending ist
drop policy if exists memberships_invitee_accept_update on app.organization_memberships;
create policy memberships_invitee_accept_update on app.organization_memberships
for update
using (
  user_id = auth.uid()
  and exists (
    select 1
    from app.member_invitations i
    where i.organization_id = organization_id
      and lower(i.invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and i.status = 'pending'
  )
)
with check (
  user_id = auth.uid()
  and status = 'active'
);

-- Rollen aus der Einladung zuweisen (nur Codes aus role_codes bzw. fallback role_code)
drop policy if exists member_roles_invitee_accept_insert on rbac.member_roles;
create policy member_roles_invitee_accept_insert on rbac.member_roles
for insert
with check (
  exists (
    select 1
    from app.organization_memberships m
    join app.member_invitations i
      on i.organization_id = m.organization_id
     and lower(i.invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and i.status = 'pending'
    join rbac.roles r
      on r.id = member_roles.role_id
     and r.organization_id = m.organization_id
    where m.id = member_roles.membership_id
      and m.user_id = auth.uid()
      and (
        i.role_codes @> jsonb_build_array(r.code)
        or (
          (i.role_codes = '[]'::jsonb or jsonb_array_length(i.role_codes) = 0)
          and r.code = i.role_code
        )
      )
  )
);

-- migrate:down

drop policy if exists member_roles_invitee_accept_insert on rbac.member_roles;
drop policy if exists memberships_invitee_accept_update on app.organization_memberships;
drop policy if exists memberships_invitee_accept_insert on app.organization_memberships;
