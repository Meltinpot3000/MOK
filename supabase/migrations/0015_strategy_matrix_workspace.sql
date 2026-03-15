-- 0015_strategy_matrix_workspace.sql
-- Editable strategic matrix workspace entities.
-- migrate:up

create table if not exists app.strategic_challenges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  title text not null,
  priority smallint not null default 3 check (priority between 1 and 5),
  visibility text not null default 'internal' check (visibility in ('internal', 'private', 'public')),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategic_challenges_org_cycle
  on app.strategic_challenges (organization_id, planning_cycle_id);

drop trigger if exists trg_strategic_challenges_updated_at on app.strategic_challenges;
create trigger trg_strategic_challenges_updated_at
before update on app.strategic_challenges
for each row execute function app.set_updated_at();

create table if not exists app.strategic_directions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  title text not null,
  description text,
  owner_membership_id uuid references app.organization_memberships(id) on delete set null,
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'draft' check (status in ('draft', 'active', 'on_hold', 'completed', 'archived')),
  grouping text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategic_directions_org_cycle
  on app.strategic_directions (organization_id, planning_cycle_id);

drop trigger if exists trg_strategic_directions_updated_at on app.strategic_directions;
create trigger trg_strategic_directions_updated_at
before update on app.strategic_directions
for each row execute function app.set_updated_at();

create table if not exists app.dashboard_column_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  challenge_id uuid not null references app.strategic_challenges(id) on delete cascade,
  display_order integer not null default 0,
  unique (planning_cycle_id, challenge_id)
);

create index if not exists idx_dashboard_column_config_org_cycle
  on app.dashboard_column_config (organization_id, planning_cycle_id, display_order);

create table if not exists app.dashboard_row_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  display_order integer not null default 0,
  unique (planning_cycle_id, direction_id)
);

create index if not exists idx_dashboard_row_config_org_cycle
  on app.dashboard_row_config (organization_id, planning_cycle_id, display_order);

create table if not exists app.challenge_direction_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  strategic_challenge_id uuid not null references app.strategic_challenges(id) on delete cascade,
  contribution_level text not null default 'medium' check (contribution_level in ('low', 'medium', 'high')),
  note text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_cycle_id, strategic_direction_id, strategic_challenge_id)
);

create index if not exists idx_challenge_direction_links_org_cycle
  on app.challenge_direction_links (organization_id, planning_cycle_id);

drop trigger if exists trg_challenge_direction_links_updated_at on app.challenge_direction_links;
create trigger trg_challenge_direction_links_updated_at
before update on app.challenge_direction_links
for each row execute function app.set_updated_at();

create table if not exists app.annual_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  title text not null,
  baseline numeric(18,4),
  current_measure numeric(18,4),
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  comment text,
  is_primary boolean not null default false,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_annual_targets_org_cycle_direction
  on app.annual_targets (organization_id, planning_cycle_id, strategic_direction_id);

drop trigger if exists trg_annual_targets_updated_at on app.annual_targets;
create trigger trg_annual_targets_updated_at
before update on app.annual_targets
for each row execute function app.set_updated_at();

create table if not exists app.dashboard_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  object_type text not null check (object_type in ('direction', 'challenge', 'cell', 'annual_target')),
  object_id uuid not null,
  comment_text text not null,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dashboard_comments_org_cycle_object
  on app.dashboard_comments (organization_id, planning_cycle_id, object_type, object_id, created_at desc);

grant select, insert, update, delete on app.strategic_challenges to authenticated;
grant select, insert, update, delete on app.strategic_directions to authenticated;
grant select, insert, update, delete on app.dashboard_column_config to authenticated;
grant select, insert, update, delete on app.dashboard_row_config to authenticated;
grant select, insert, update, delete on app.challenge_direction_links to authenticated;
grant select, insert, update, delete on app.annual_targets to authenticated;
grant select, insert, update, delete on app.dashboard_comments to authenticated;

grant select on app.strategic_challenges to anon;
grant select on app.strategic_directions to anon;
grant select on app.dashboard_column_config to anon;
grant select on app.dashboard_row_config to anon;
grant select on app.challenge_direction_links to anon;
grant select on app.annual_targets to anon;
grant select on app.dashboard_comments to anon;

alter table app.strategic_challenges enable row level security;
alter table app.strategic_directions enable row level security;
alter table app.dashboard_column_config enable row level security;
alter table app.dashboard_row_config enable row level security;
alter table app.challenge_direction_links enable row level security;
alter table app.annual_targets enable row level security;
alter table app.dashboard_comments enable row level security;

drop policy if exists strategic_challenges_select on app.strategic_challenges;
create policy strategic_challenges_select on app.strategic_challenges
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategic_challenges_modify on app.strategic_challenges;
create policy strategic_challenges_modify on app.strategic_challenges
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists strategic_directions_select on app.strategic_directions;
create policy strategic_directions_select on app.strategic_directions
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategic_directions_modify on app.strategic_directions;
create policy strategic_directions_modify on app.strategic_directions
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists dashboard_column_config_select on app.dashboard_column_config;
create policy dashboard_column_config_select on app.dashboard_column_config
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists dashboard_column_config_modify on app.dashboard_column_config;
create policy dashboard_column_config_modify on app.dashboard_column_config
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists dashboard_row_config_select on app.dashboard_row_config;
create policy dashboard_row_config_select on app.dashboard_row_config
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists dashboard_row_config_modify on app.dashboard_row_config;
create policy dashboard_row_config_modify on app.dashboard_row_config
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists challenge_direction_links_select on app.challenge_direction_links;
create policy challenge_direction_links_select on app.challenge_direction_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists challenge_direction_links_modify on app.challenge_direction_links;
create policy challenge_direction_links_modify on app.challenge_direction_links
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists annual_targets_select on app.annual_targets;
create policy annual_targets_select on app.annual_targets
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists annual_targets_modify on app.annual_targets;
create policy annual_targets_modify on app.annual_targets
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

drop policy if exists dashboard_comments_select on app.dashboard_comments;
create policy dashboard_comments_select on app.dashboard_comments
for select using (
  app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists dashboard_comments_modify on app.dashboard_comments;
create policy dashboard_comments_modify on app.dashboard_comments
for all using (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

-- migrate:down
drop policy if exists dashboard_comments_modify on app.dashboard_comments;
drop policy if exists dashboard_comments_select on app.dashboard_comments;
drop policy if exists annual_targets_modify on app.annual_targets;
drop policy if exists annual_targets_select on app.annual_targets;
drop policy if exists challenge_direction_links_modify on app.challenge_direction_links;
drop policy if exists challenge_direction_links_select on app.challenge_direction_links;
drop policy if exists dashboard_row_config_modify on app.dashboard_row_config;
drop policy if exists dashboard_row_config_select on app.dashboard_row_config;
drop policy if exists dashboard_column_config_modify on app.dashboard_column_config;
drop policy if exists dashboard_column_config_select on app.dashboard_column_config;
drop policy if exists strategic_directions_modify on app.strategic_directions;
drop policy if exists strategic_directions_select on app.strategic_directions;
drop policy if exists strategic_challenges_modify on app.strategic_challenges;
drop policy if exists strategic_challenges_select on app.strategic_challenges;

drop trigger if exists trg_annual_targets_updated_at on app.annual_targets;
drop trigger if exists trg_challenge_direction_links_updated_at on app.challenge_direction_links;
drop trigger if exists trg_strategic_directions_updated_at on app.strategic_directions;
drop trigger if exists trg_strategic_challenges_updated_at on app.strategic_challenges;

drop table if exists app.dashboard_comments;
drop table if exists app.annual_targets;
drop table if exists app.challenge_direction_links;
drop table if exists app.dashboard_row_config;
drop table if exists app.dashboard_column_config;
drop table if exists app.strategic_directions;
drop table if exists app.strategic_challenges;
