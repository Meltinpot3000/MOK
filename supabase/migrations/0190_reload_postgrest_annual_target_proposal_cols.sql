-- 0190_reload_postgrest_annual_target_proposal_cols.sql
-- PostgREST-Schema neu laden, damit smart_proposal/anchor_fit in der API sichtbar sind.

-- migrate:up

notify pgrst, 'reload schema';

-- migrate:down

notify pgrst, 'reload schema';
