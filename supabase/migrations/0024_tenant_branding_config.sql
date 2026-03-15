-- 0024_tenant_branding_config.sql
-- Adds tenant-level JSON config for scoring and other settings.
-- migrate:up

alter table app.tenant_branding
  add column if not exists branding_config jsonb not null default '{}'::jsonb;

-- migrate:down
alter table app.tenant_branding
  drop column if exists branding_config;
