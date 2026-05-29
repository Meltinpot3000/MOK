-- 0135_restore_authenticator_pgrst_db_schemas.sql
-- PostgREST (Supabase REST) exposes schemas via authenticator.pgrst.db_schemas.
-- If only a new project schema was set yesterday, app/rbac fall out → PGRST106 / HTTP 406 on .schema("app").
-- This migration merges the current list with required CITADEL + Supabase defaults (no removals).
-- migrate:up

do $$
declare
  v_current text;
  v_parts text[];
  v_required text[] := array[
    'public',
    'graphql_public',
    'storage',
    'app',
    'rbac'
  ];
  v_schema text;
  v_merged text[];
  v_final text;
  v_cfg text;
begin
  v_current := null;
  foreach v_cfg in array coalesce(
    (select rolconfig from pg_roles where rolname = 'authenticator'),
    array[]::text[]
  )
  loop
    if v_cfg like 'pgrst.db_schemas=%' then
      v_current := substring(v_cfg from 'pgrst.db_schemas=(.*)');
      exit;
    end if;
  end loop;

  if v_current is null or btrim(v_current) = '' then
    v_parts := array['public']::text[];
  else
    select coalesce(array_agg(btrim(s)), array[]::text[])
    into v_parts
    from unnest(string_to_array(v_current, ',')) as s
    where btrim(s) <> '';
  end if;

  v_merged := coalesce(v_parts, array[]::text[]);

  foreach v_schema in array v_required
  loop
    if not v_schema = any (v_merged) then
      v_merged := array_append(v_merged, v_schema);
    end if;
  end loop;

  v_final := array_to_string(v_merged, ',');
  execute format('alter role authenticator set pgrst.db_schemas = %L', v_final);

  raise notice 'authenticator.pgrst.db_schemas set to: %', v_final;
end;
$$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- migrate:down
-- No-op: reverting could drop schemas added for other projects. Re-run up if app/rbac are missing again.
