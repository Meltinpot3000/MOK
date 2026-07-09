-- 0144_fix_annual_target_accountable_role_fk.sql
-- Korrigiert annual_targets.accountable_role_id ohne FK auf nicht existente Tabelle.
-- migrate:up

alter table app.annual_targets
  add column if not exists accountable_role_id uuid;

alter table app.annual_targets
  drop constraint if exists annual_targets_accountable_role_id_fkey;

-- migrate:down

-- no-op (column bleibt bestehen, um Datenverlust zu vermeiden)
