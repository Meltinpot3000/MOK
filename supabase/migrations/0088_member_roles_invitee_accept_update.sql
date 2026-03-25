-- 0088_member_roles_invitee_accept_update.sql
-- PostgREST-Upsert auf rbac.member_roles kann bei Konflikt UPDATE ausloesen;
-- ohne Policy scheitert ein erneuter Aufruf von /invite/accept solange die Einladung noch pending ist.
-- migrate:up

drop policy if exists member_roles_invitee_accept_update on rbac.member_roles;
create policy member_roles_invitee_accept_update on rbac.member_roles
for update
using (
  exists (
    select 1
    from app.organization_memberships m
    join app.member_invitations i
      on i.organization_id = m.organization_id
     and lower(i.invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and i.status = 'pending'
    where m.id = member_roles.membership_id
      and m.user_id = auth.uid()
  )
)
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

drop policy if exists member_roles_invitee_accept_update on rbac.member_roles;
