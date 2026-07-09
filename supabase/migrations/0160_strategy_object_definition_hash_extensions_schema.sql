-- 0160_strategy_object_definition_hash_extensions_schema.sql
-- digest() liegt auf Supabase im Schema extensions; RPC-search_path enthält es nicht.
-- migrate:up

create or replace function app.strategy_object_definition_hash(
  p_object_type text,
  p_title text,
  p_description text,
  p_payload jsonb
) returns text
language sql
immutable
set search_path = app, public, extensions
as $$
  select encode(
    extensions.digest(
      convert_to(
        app.strategy_object_canonical_definition_text(
          p_object_type,
          p_title,
          p_description,
          p_payload
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- migrate:down

create or replace function app.strategy_object_definition_hash(
  p_object_type text,
  p_title text,
  p_description text,
  p_payload jsonb
) returns text
language sql
immutable
as $$
  select encode(
    digest(
      convert_to(
        app.strategy_object_canonical_definition_text(
          p_object_type,
          p_title,
          p_description,
          p_payload
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;
