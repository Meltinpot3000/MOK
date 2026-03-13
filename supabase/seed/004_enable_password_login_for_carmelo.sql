-- 004_enable_password_login_for_carmelo.sql
-- Ensure email/password login works for carmelo.messina@cabtecgroup.com.
-- migrate:up
do $$
declare
  v_email text := lower('carmelo.messina@cabtecgroup.com');
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'Auth user % not found. Run 003_create_carmelo_admin.sql first.', v_email;
  end if;

  update auth.users
  set
    encrypted_password = crypt('TempAdmin!2026', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now(),
    is_sso_user = false
  where id = v_user_id;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_email,
    now(),
    now()
  where not exists (
    select 1
    from auth.identities
    where user_id = v_user_id
      and provider = 'email'
  );
end
$$;

-- migrate:down
select 1;
