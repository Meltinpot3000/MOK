-- 0094_resolve_auth_user_identities.sql
-- Batch-Auflösung von Auth-E-Mail und Anzeigename für Server-Kontexte (z. B. OKR-Owner-Labels).
-- Nur service_role darf ausführen — kein Leak für authenticated/anon.
-- migrate:up

create or replace function app.resolve_auth_user_identities(p_user_ids uuid[])
returns table (
  user_id uuid,
  email text,
  meta_full_name text
)
language sql
stable
security definer
set search_path to public, pg_temp
as $$
  select
    u.id as user_id,
    nullif(trim(u.email::text), '') as email,
    nullif(
      trim(
        coalesce(
          nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          nullif(trim(u.raw_user_meta_data->>'display_name'), '')
        )
      ),
      ''
    ) as meta_full_name
  from auth.users u
  where u.id = any (p_user_ids);
$$;

comment on function app.resolve_auth_user_identities(uuid[]) is
  'Service-role only: batch resolve auth email/display name (owner labels).';

revoke all on function app.resolve_auth_user_identities(uuid[]) from public;
grant execute on function app.resolve_auth_user_identities(uuid[]) to service_role;

-- migrate:down

drop function if exists app.resolve_auth_user_identities(uuid[]);
