-- 0164_strategy_path_link_reviews.sql
-- Review-Persistenz für Wirkpfad-Vorschlagskanten.
-- migrate:up

create table if not exists app.strategy_path_link_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  edge_kind text not null check (edge_kind in (
    'analysis_to_challenge',
    'challenge_to_direction',
    'direction_to_objective'
  )),
  source_id uuid not null,
  target_id uuid not null,
  status text not null check (status in (
    'accepted',
    'rejected',
    'deferred'
  )),
  suggestion_score smallint check (suggestion_score between 0 and 100),
  note text,
  reviewed_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  unique (cycle_instance_id, edge_kind, source_id, target_id)
);

create index if not exists idx_strategy_path_link_reviews_lookup
  on app.strategy_path_link_reviews (cycle_instance_id, edge_kind, status);

grant select, insert, update, delete on app.strategy_path_link_reviews to authenticated;
grant select on app.strategy_path_link_reviews to anon;

alter table app.strategy_path_link_reviews enable row level security;

drop policy if exists strategy_path_link_reviews_select on app.strategy_path_link_reviews;
create policy strategy_path_link_reviews_select on app.strategy_path_link_reviews
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategy_path_link_reviews_modify on app.strategy_path_link_reviews;
create policy strategy_path_link_reviews_modify on app.strategy_path_link_reviews
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

-- migrate:down
drop policy if exists strategy_path_link_reviews_modify on app.strategy_path_link_reviews;
drop policy if exists strategy_path_link_reviews_select on app.strategy_path_link_reviews;
drop index if exists app.idx_strategy_path_link_reviews_lookup;
drop table if exists app.strategy_path_link_reviews;
