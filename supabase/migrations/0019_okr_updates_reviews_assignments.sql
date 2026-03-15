-- 0019_okr_updates_reviews_assignments.sql
-- Review and operational tracking objects.
-- migrate:up

create table if not exists app.responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  object_type text not null check (
    object_type in (
      'strategic_challenge',
      'strategic_direction',
      'annual_target',
      'initiative',
      'okr_cycle',
      'objective',
      'key_result'
    )
  ),
  object_id uuid not null,
  membership_id uuid not null references app.organization_memberships(id) on delete cascade,
  role_type text not null check (role_type in ('owner', 'contributor', 'reviewer', 'sponsor')),
  created_at timestamptz not null default now(),
  unique (organization_id, object_type, object_id, membership_id, role_type)
);

create index if not exists idx_responsibility_assignments_org_obj
  on app.responsibility_assignments (organization_id, object_type, object_id);

create table if not exists app.okr_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  okr_cycle_id uuid references app.okr_cycles(id) on delete set null,
  key_result_id uuid not null references app.key_results(id) on delete cascade,
  progress_value numeric(18,4),
  confidence_level smallint check (confidence_level between 1 and 10),
  comment text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_okr_updates_org_cycle_kr
  on app.okr_updates (organization_id, planning_cycle_id, key_result_id, created_at desc);

create table if not exists app.okr_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid not null references app.planning_cycles(id) on delete cascade,
  okr_cycle_id uuid references app.okr_cycles(id) on delete set null,
  review_type text not null default 'quarterly_review' check (
    review_type in ('quarterly_review', 'retrospective', 'annual_review')
  ),
  summary text,
  successes text,
  problems text,
  lessons_learned text,
  next_actions text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_okr_reviews_org_cycle
  on app.okr_reviews (organization_id, planning_cycle_id, okr_cycle_id);

drop trigger if exists trg_okr_reviews_updated_at on app.okr_reviews;
create trigger trg_okr_reviews_updated_at
before update on app.okr_reviews
for each row execute function app.set_updated_at();

-- migrate:down
drop trigger if exists trg_okr_reviews_updated_at on app.okr_reviews;
drop table if exists app.okr_reviews;
drop table if exists app.okr_updates;
drop table if exists app.responsibility_assignments;
