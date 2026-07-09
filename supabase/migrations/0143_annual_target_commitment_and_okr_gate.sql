-- 0143_annual_target_commitment_and_okr_gate.sql
-- Jahresziel-Commitment-Layer + OKR-Governance-Gate.
-- migrate:up

alter table app.organizations
  add column if not exists require_annual_targets_before_okrs boolean not null default false,
  add column if not exists annual_target_gate_enforcement_mode text not null default 'block_activation',
  add column if not exists annual_target_gate_scope text not null default 'all_employees',
  add column if not exists annual_target_gate_allow_exceptions boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_annual_target_gate_enforcement_mode_check'
  ) then
    alter table app.organizations
      add constraint organizations_annual_target_gate_enforcement_mode_check
      check (annual_target_gate_enforcement_mode in ('off', 'warn_only', 'block_activation', 'block_creation'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_annual_target_gate_scope_check'
  ) then
    alter table app.organizations
      add constraint organizations_annual_target_gate_scope_check
      check (annual_target_gate_scope in ('all_employees', 'selected_roles'));
  end if;
end $$;

comment on column app.organizations.require_annual_targets_before_okrs is
  'Globale Governance-Regel: Keine aktiven OKRs ohne aktive Jahresziele (je nach Scope).';
comment on column app.organizations.annual_target_gate_enforcement_mode is
  'Durchsetzung: off|warn_only|block_activation|block_creation.';
comment on column app.organizations.annual_target_gate_scope is
  'Scope der Regel: all_employees|selected_roles.';
comment on column app.organizations.annual_target_gate_allow_exceptions is
  'Ausnahmen für Gate-Regeln erlauben.';

alter table app.organization_memberships
  add column if not exists requires_annual_targets boolean not null default false;

comment on column app.organization_memberships.requires_annual_targets is
  'Mitglied ist jahreszielpflichtig für OKR-Aktivierungsgate.';

alter table app.annual_targets
  add column if not exists annual_target_type text not null default 'strategic_commitment',
  add column if not exists progress_calculation_mode text not null default 'manual',
  add column if not exists target_year integer,
  add column if not exists bonus_weight numeric(6,2),
  add column if not exists accountable_role_id uuid,
  add column if not exists owner_membership_id uuid references app.organization_memberships(id) on delete set null,
  add column if not exists derivation_note text,
  add column if not exists status text not null default 'draft';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'annual_targets_type_check') then
    alter table app.annual_targets
      add constraint annual_targets_type_check
      check (annual_target_type in ('bonus_relevant', 'strategic_commitment', 'operational_target', 'compliance_target', 'development_target'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'annual_targets_progress_calculation_mode_check') then
    alter table app.annual_targets
      add constraint annual_targets_progress_calculation_mode_check
      check (progress_calculation_mode in ('manual', 'key_result_based', 'initiative_based', 'hybrid'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'annual_targets_status_check') then
    alter table app.annual_targets
      add constraint annual_targets_status_check
      check (status in ('draft', 'active', 'completed', 'archived'));
  end if;
end $$;

create table if not exists app.annual_target_okr_objective_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  annual_target_id uuid not null references app.annual_targets(id) on delete cascade,
  okr_objective_id uuid not null references app.okr_objectives(id) on delete cascade,
  alignment_type text not null default 'direct',
  weight numeric(6,2),
  comment text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'annual_target_okr_objective_links_alignment_type_check') then
    alter table app.annual_target_okr_objective_links
      add constraint annual_target_okr_objective_links_alignment_type_check
      check (alignment_type in ('direct', 'indirect', 'exception', 'operational_necessity'));
  end if;
end $$;

create unique index if not exists uq_annual_target_okr_objective_links_cycle
  on app.annual_target_okr_objective_links (cycle_instance_id, annual_target_id, okr_objective_id);

create index if not exists idx_annual_target_okr_objective_links_org_cycle
  on app.annual_target_okr_objective_links (organization_id, cycle_instance_id);

drop trigger if exists trg_annual_target_okr_objective_links_updated_at on app.annual_target_okr_objective_links;
create trigger trg_annual_target_okr_objective_links_updated_at
before update on app.annual_target_okr_objective_links
for each row execute function app.set_updated_at();

drop trigger if exists trg_sync_cycles_annual_target_okr_objective_links on app.annual_target_okr_objective_links;
create trigger trg_sync_cycles_annual_target_okr_objective_links
before insert or update on app.annual_target_okr_objective_links
for each row execute function app.sync_legacy_cycle_columns();

create table if not exists app.annual_target_okr_objective_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  okr_objective_id uuid not null references app.okr_objectives(id) on delete cascade,
  annual_target_id uuid references app.annual_targets(id) on delete set null,
  exception_reason text not null,
  approval_status text not null default 'pending',
  approved_by uuid references app.organization_memberships(id) on delete set null,
  approved_at timestamptz,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'annual_target_okr_objective_exceptions_approval_status_check') then
    alter table app.annual_target_okr_objective_exceptions
      add constraint annual_target_okr_objective_exceptions_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists idx_annual_target_okr_objective_exceptions_org_cycle
  on app.annual_target_okr_objective_exceptions (organization_id, cycle_instance_id);

create index if not exists idx_annual_target_okr_objective_exceptions_objective
  on app.annual_target_okr_objective_exceptions (okr_objective_id);

drop trigger if exists trg_annual_target_okr_objective_exceptions_updated_at on app.annual_target_okr_objective_exceptions;
create trigger trg_annual_target_okr_objective_exceptions_updated_at
before update on app.annual_target_okr_objective_exceptions
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.annual_target_okr_objective_links to authenticated;
grant select on app.annual_target_okr_objective_links to anon;
grant select, insert, update, delete on app.annual_target_okr_objective_exceptions to authenticated;
grant select on app.annual_target_okr_objective_exceptions to anon;

alter table app.annual_target_okr_objective_links enable row level security;
alter table app.annual_target_okr_objective_exceptions enable row level security;

drop policy if exists annual_target_okr_objective_links_select on app.annual_target_okr_objective_links;
create policy annual_target_okr_objective_links_select on app.annual_target_okr_objective_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'review.read')
  or app.has_permission(organization_id, 'okr.read')
);

drop policy if exists annual_target_okr_objective_links_modify on app.annual_target_okr_objective_links;
create policy annual_target_okr_objective_links_modify on app.annual_target_okr_objective_links
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
);

drop policy if exists annual_target_okr_objective_exceptions_select on app.annual_target_okr_objective_exceptions;
create policy annual_target_okr_objective_exceptions_select on app.annual_target_okr_objective_exceptions
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'review.read')
  or app.has_permission(organization_id, 'okr.read')
);

drop policy if exists annual_target_okr_objective_exceptions_modify on app.annual_target_okr_objective_exceptions;
create policy annual_target_okr_objective_exceptions_modify on app.annual_target_okr_objective_exceptions
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
  or app.has_permission(organization_id, 'okr.write')
);

-- migrate:down

drop policy if exists annual_target_okr_objective_exceptions_modify on app.annual_target_okr_objective_exceptions;
drop policy if exists annual_target_okr_objective_exceptions_select on app.annual_target_okr_objective_exceptions;
drop policy if exists annual_target_okr_objective_links_modify on app.annual_target_okr_objective_links;
drop policy if exists annual_target_okr_objective_links_select on app.annual_target_okr_objective_links;

drop trigger if exists trg_sync_cycles_annual_target_okr_objective_links on app.annual_target_okr_objective_links;
drop trigger if exists trg_annual_target_okr_objective_links_updated_at on app.annual_target_okr_objective_links;
drop trigger if exists trg_annual_target_okr_objective_exceptions_updated_at on app.annual_target_okr_objective_exceptions;

drop table if exists app.annual_target_okr_objective_exceptions;
drop table if exists app.annual_target_okr_objective_links;

alter table app.annual_targets
  drop constraint if exists annual_targets_status_check,
  drop constraint if exists annual_targets_progress_calculation_mode_check,
  drop constraint if exists annual_targets_type_check,
  drop column if exists status,
  drop column if exists derivation_note,
  drop column if exists owner_membership_id,
  drop column if exists accountable_role_id,
  drop column if exists bonus_weight,
  drop column if exists target_year,
  drop column if exists progress_calculation_mode,
  drop column if exists annual_target_type;

alter table app.organization_memberships
  drop column if exists requires_annual_targets;

alter table app.organizations
  drop constraint if exists organizations_annual_target_gate_scope_check,
  drop constraint if exists organizations_annual_target_gate_enforcement_mode_check,
  drop column if exists annual_target_gate_allow_exceptions,
  drop column if exists annual_target_gate_scope,
  drop column if exists annual_target_gate_enforcement_mode,
  drop column if exists require_annual_targets_before_okrs;
