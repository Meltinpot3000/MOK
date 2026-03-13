-- 003_create_carmelo_admin.sql
-- Create/ensure admin user and assign org_admin role.
-- migrate:up
do $$
declare
  v_email text := lower('carmelo.messina@cabtecgroup.com');
  v_user_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
  v_role_id uuid;
begin
  -- Ensure a tenant exists.
  insert into app.organizations (slug, name)
  values ('cabtecgroup', 'CabTec Group')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  if v_org_id is null then
    select id into v_org_id
    from app.organizations
    where slug = 'cabtecgroup'
    limit 1;
  end if;

  -- Ensure auth user exists (temporary password: TempAdmin!2026).
  select id into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      is_anonymous
    )
    values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt('TempAdmin!2026', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now()
    );
  end if;

  -- Ensure org_admin role exists for tenant.
  insert into rbac.roles (organization_id, code, name, description, is_system)
  values (v_org_id, 'org_admin', 'Organization Admin', 'Full access for tenant administration', true)
  on conflict (organization_id, code) do update
  set name = excluded.name,
      description = excluded.description
  returning id into v_role_id;

  if v_role_id is null then
    select id into v_role_id
    from rbac.roles
    where organization_id = v_org_id and code = 'org_admin'
    limit 1;
  end if;

  -- Ensure org_admin has all defined permissions.
  insert into rbac.role_permissions (role_id, permission_id)
  select v_role_id, p.id
  from rbac.permissions p
  on conflict (role_id, permission_id) do nothing;

  -- Ensure membership.
  insert into app.organization_memberships (
    organization_id,
    user_id,
    status,
    hierarchy_level,
    title
  )
  values (
    v_org_id,
    v_user_id,
    'active',
    1,
    'CEO'
  )
  on conflict (organization_id, user_id) do update
  set status = excluded.status,
      hierarchy_level = excluded.hierarchy_level,
      title = excluded.title
  returning id into v_membership_id;

  if v_membership_id is null then
    select id into v_membership_id
    from app.organization_memberships
    where organization_id = v_org_id and user_id = v_user_id
    limit 1;
  end if;

  -- Ensure member role assignment.
  insert into rbac.member_roles (membership_id, role_id)
  values (v_membership_id, v_role_id)
  on conflict (membership_id, role_id) do nothing;
end
$$;

-- migrate:down
-- Intentional no-op to avoid destructive user deletion.
select 1;
