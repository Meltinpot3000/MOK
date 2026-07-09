-- 0145_annual_targets_workspace_lifecycle.sql
-- Jahresziel-Lifecycle, Signatur, AI-Metadaten, granular RBAC, RLS-Scope.
-- migrate:up

-- A) Organization governance (Signatur)
alter table app.organizations
  add column if not exists annual_targets_require_signature boolean not null default false,
  add column if not exists annual_targets_signature_provider text,
  add column if not exists annual_targets_signature_mode text not null default 'none',
  add column if not exists annual_targets_activation_requires_signed_status boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_annual_targets_signature_mode_check'
  ) then
    alter table app.organizations
      add constraint organizations_annual_targets_signature_mode_check
      check (annual_targets_signature_mode in ('none', 'internal_acknowledgement', 'external_signature'));
  end if;
end $$;

comment on column app.organizations.annual_targets_require_signature is
  'Wenn true: Aktivierung erfordert Signaturstatus signed (sofern activation_requires_signed_status).';
comment on column app.organizations.annual_targets_signature_mode is
  'none|internal_acknowledgement|external_signature — Provider-Auswahl über annual_targets_signature_provider.';
comment on column app.organizations.annual_targets_activation_requires_signed_status is
  'Wenn true und Signaturpflicht: Lifecycle active nur nach signature_status=signed.';

-- B) annual_targets Erweiterungen
alter table app.annual_targets
  add column if not exists description text,
  add column if not exists measurement_logic text not null default '',
  add column if not exists strategy_program_id uuid references app.strategy_programs(id) on delete set null,
  add column if not exists signature_status text not null default 'not_required',
  add column if not exists ai_assisted boolean not null default false,
  add column if not exists ai_model_provider text,
  add column if not exists ai_generated_at timestamptz,
  add column if not exists ai_reviewed_by uuid references app.organization_memberships(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  add column if not exists signed_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists activated_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  add column if not exists archived_at timestamptz;

-- Legacy status mapping
update app.annual_targets set status = 'archived' where status = 'completed';

alter table app.annual_targets drop constraint if exists annual_targets_status_check;

alter table app.annual_targets
  add constraint annual_targets_status_check
  check (status in (
    'draft',
    'submitted_for_review',
    'reviewed',
    'approved',
    'sent_for_signature',
    'signed',
    'active',
    'change_requested',
    'superseded',
    'archived'
  ));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'annual_targets_signature_status_check') then
    alter table app.annual_targets
      add constraint annual_targets_signature_status_check
      check (signature_status in (
        'not_required',
        'pending',
        'sent',
        'partially_signed',
        'signed',
        'rejected',
        'cancelled',
        'expired',
        'failed'
      ));
  end if;
end $$;

create index if not exists idx_annual_targets_org_owner_year_status
  on app.annual_targets (organization_id, owner_membership_id, target_year, status);

create index if not exists idx_annual_targets_org_status
  on app.annual_targets (organization_id, status);

-- C) Signatur-Tabellen
create table if not exists app.annual_target_signature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  provider text not null default 'internal_acknowledgement',
  provider_request_id text,
  status text not null default 'pending',
  requested_by uuid references app.organization_memberships(id) on delete set null,
  requested_at timestamptz not null default now(),
  signed_at timestamptz,
  cancelled_at timestamptz,
  signed_document_url text,
  signed_document_storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'annual_target_signature_requests_status_check') then
    alter table app.annual_target_signature_requests
      add constraint annual_target_signature_requests_status_check
      check (status in (
        'pending', 'sent', 'partially_signed', 'signed', 'rejected', 'cancelled', 'expired', 'failed'
      ));
  end if;
end $$;

create index if not exists idx_annual_target_signature_requests_target
  on app.annual_target_signature_requests (annual_target_id);

create table if not exists app.annual_target_signers (
  id uuid primary key default gen_random_uuid(),
  signature_request_id uuid not null references app.annual_target_signature_requests(id) on delete cascade,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  membership_id uuid not null references app.organization_memberships(id) on delete cascade,
  signer_role text not null default 'employee',
  signing_order integer not null default 1,
  status text not null default 'pending',
  signed_at timestamptz,
  provider_signer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'annual_target_signers_signer_role_check') then
    alter table app.annual_target_signers
      add constraint annual_target_signers_signer_role_check
      check (signer_role in ('employee', 'manager', 'hr', 'executive', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'annual_target_signers_status_check') then
    alter table app.annual_target_signers
      add constraint annual_target_signers_status_check
      check (status in ('pending', 'sent', 'signed', 'rejected', 'cancelled'));
  end if;
end $$;

create index if not exists idx_annual_target_signers_request
  on app.annual_target_signers (signature_request_id);

drop trigger if exists trg_annual_target_signature_requests_updated_at on app.annual_target_signature_requests;
create trigger trg_annual_target_signature_requests_updated_at
before update on app.annual_target_signature_requests
for each row execute function app.set_updated_at();

drop trigger if exists trg_annual_target_signers_updated_at on app.annual_target_signers;
create trigger trg_annual_target_signers_updated_at
before update on app.annual_target_signers
for each row execute function app.set_updated_at();

-- D) RBAC permissions
insert into rbac.permissions (code, name, description)
values
  ('annual_targets.read.all', 'Annual Targets Read (all)', 'Read all annual targets in org'),
  ('annual_targets.read.own', 'Annual Targets Read (own)', 'Read annual targets where user is owner'),
  ('annual_targets.read.department', 'Annual Targets Read (department)', 'Read annual targets of direct reports'),
  ('annual_targets.write.all', 'Annual Targets Write (all)', 'Create/update all annual targets in org'),
  ('annual_targets.write.own', 'Annual Targets Write (own)', 'Create/update own annual targets'),
  ('annual_targets.write.department', 'Annual Targets Write (department)', 'Create/update annual targets for direct reports')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'annual_targets.read.all',
  'annual_targets.write.all'
)
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'annual_targets.read.all'
)
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'annual_targets.read.department',
  'annual_targets.write.department'
)
where r.code = 'department_lead'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'annual_targets.read.own',
  'annual_targets.write.own'
)
where r.code = 'team_member'
on conflict (role_id, permission_id) do nothing;

-- Legacy nav: orgs with strategy-matrix also get annual_targets via nav — granular perms above for row scope

-- E) RLS helper functions
create or replace function app.annual_target_can_read(
  p_org uuid,
  p_owner_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select
    app.has_permission(p_org, 'nav.annual-targets.read')
    or app.has_permission(p_org, 'nav.strategy-matrix.read')
    or app.has_permission(p_org, 'annual_targets.read.all')
    or (
      p_owner_membership_id is not null
      and p_owner_membership_id = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'annual_targets.read.own')
    )
    or (
      p_owner_membership_id is not null
      and app.okr_is_direct_manager_of(app.current_membership_id(p_org), p_owner_membership_id)
      and app.has_permission(p_org, 'annual_targets.read.department')
    );
$$;

create or replace function app.annual_target_can_modify(
  p_org uuid,
  p_owner_membership_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, app, rbac, auth
as $$
  select
    app.has_permission(p_org, 'nav.annual-targets.write')
    or app.has_permission(p_org, 'nav.strategy-matrix.write')
    or app.has_permission(p_org, 'annual_targets.write.all')
    or (
      p_owner_membership_id is not null
      and p_owner_membership_id = app.current_membership_id(p_org)
      and app.has_permission(p_org, 'annual_targets.write.own')
    )
    or (
      p_owner_membership_id is not null
      and app.okr_is_direct_manager_of(app.current_membership_id(p_org), p_owner_membership_id)
      and app.has_permission(p_org, 'annual_targets.write.department')
    );
$$;

drop policy if exists annual_targets_select on app.annual_targets;
create policy annual_targets_select on app.annual_targets
for select using (
  app.annual_target_can_read(organization_id, owner_membership_id)
);

drop policy if exists annual_targets_modify on app.annual_targets;
create policy annual_targets_modify on app.annual_targets
for all using (
  app.annual_target_can_modify(organization_id, owner_membership_id)
)
with check (
  app.annual_target_can_modify(organization_id, owner_membership_id)
);

alter table app.annual_target_signature_requests enable row level security;
alter table app.annual_target_signers enable row level security;

drop policy if exists annual_target_signature_requests_select on app.annual_target_signature_requests;
create policy annual_target_signature_requests_select on app.annual_target_signature_requests
for select using (
  app.has_permission(organization_id, 'nav.annual-targets.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'annual_targets.read.all')
  or exists (
    select 1 from app.annual_targets t
    where t.id = annual_target_id
      and app.annual_target_can_read(t.organization_id, t.owner_membership_id)
  )
);

drop policy if exists annual_target_signature_requests_modify on app.annual_target_signature_requests;
create policy annual_target_signature_requests_modify on app.annual_target_signature_requests
for all using (
  app.has_permission(organization_id, 'nav.annual-targets.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'annual_targets.write.all')
)
with check (
  app.has_permission(organization_id, 'nav.annual-targets.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'annual_targets.write.all')
);

drop policy if exists annual_target_signers_select on app.annual_target_signers;
create policy annual_target_signers_select on app.annual_target_signers
for select using (
  app.has_permission(organization_id, 'nav.annual-targets.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or membership_id = app.current_membership_id(organization_id)
  or app.has_permission(organization_id, 'annual_targets.read.all')
);

drop policy if exists annual_target_signers_modify on app.annual_target_signers;
create policy annual_target_signers_modify on app.annual_target_signers
for all using (
  app.has_permission(organization_id, 'nav.annual-targets.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'annual_targets.write.all')
  or membership_id = app.current_membership_id(organization_id)
)
with check (
  app.has_permission(organization_id, 'nav.annual-targets.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'annual_targets.write.all')
  or membership_id = app.current_membership_id(organization_id)
);

-- migrate:down
drop policy if exists annual_target_signers_modify on app.annual_target_signers;
drop policy if exists annual_target_signers_select on app.annual_target_signers;
drop policy if exists annual_target_signature_requests_modify on app.annual_target_signature_requests;
drop policy if exists annual_target_signature_requests_select on app.annual_target_signature_requests;

drop policy if exists annual_targets_modify on app.annual_targets;
drop policy if exists annual_targets_select on app.annual_targets;

create policy annual_targets_select on app.annual_targets
for select using (app.has_permission(organization_id, 'nav.strategy-matrix.read'));

create policy annual_targets_modify on app.annual_targets
for all using (app.has_permission(organization_id, 'nav.strategy-matrix.write'))
with check (app.has_permission(organization_id, 'nav.strategy-matrix.write'));

drop function if exists app.annual_target_can_modify(uuid, uuid);
drop function if exists app.annual_target_can_read(uuid, uuid);

drop table if exists app.annual_target_signers;
drop table if exists app.annual_target_signature_requests;

alter table app.annual_targets drop constraint if exists annual_targets_signature_status_check;
alter table app.annual_targets drop constraint if exists annual_targets_status_check;
alter table app.annual_targets
  add constraint annual_targets_status_check
  check (status in ('draft', 'active', 'completed', 'archived'));

alter table app.organizations
  drop column if exists annual_targets_activation_requires_signed_status,
  drop column if exists annual_targets_signature_mode,
  drop column if exists annual_targets_signature_provider,
  drop column if exists annual_targets_require_signature;

alter table app.annual_targets
  drop column if exists archived_at,
  drop column if exists activated_by_membership_id,
  drop column if exists activated_at,
  drop column if exists signed_at,
  drop column if exists approved_by_membership_id,
  drop column if exists approved_at,
  drop column if exists reviewed_at,
  drop column if exists submitted_by_membership_id,
  drop column if exists submitted_at,
  drop column if exists ai_reviewed_by,
  drop column if exists ai_generated_at,
  drop column if exists ai_model_provider,
  drop column if exists ai_assisted,
  drop column if exists signature_status,
  drop column if exists strategy_program_id,
  drop column if exists measurement_logic,
  drop column if exists description;

delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions where code like 'annual_targets.%'
);
delete from rbac.permissions where code like 'annual_targets.%';
