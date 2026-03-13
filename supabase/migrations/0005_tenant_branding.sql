-- 0005_tenant_branding.sql
-- Tenant-level branding configuration.
-- migrate:up

create table if not exists app.tenant_branding (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references app.organizations(id) on delete cascade,
  primary_color text not null default '#1D4ED8' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#0F172A' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#14B8A6' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  updated_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_tenant_branding_updated_at
before update on app.tenant_branding
for each row
execute function app.set_updated_at();

drop trigger if exists trg_audit_tenant_branding on app.tenant_branding;
create trigger trg_audit_tenant_branding
after insert or update or delete on app.tenant_branding
for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_tenant_branding on app.tenant_branding;
drop trigger if exists trg_tenant_branding_updated_at on app.tenant_branding;
drop table if exists app.tenant_branding;
