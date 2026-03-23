-- 0083_strategy_review_procedure.sql
-- Strategy Review Procedure Mode: schema, RLS, RPCs (state machine + decision-driven release).
-- migrate:up

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into rbac.permissions (code, name, description)
values
  ('strategy_review.feedback', 'Strategy review feedback', 'Submit pre-read / stakeholder feedback for strategy reviews'),
  ('strategy_review.moderate', 'Strategy review moderate', 'Run announcement, pre-read prep, meeting start, decision capture'),
  ('strategy_review.release', 'Strategy review release', 'Execute strategy review release into next cycle instance'),
  ('strategy_review.force_ready', 'Strategy review force ready', 'Override readiness gates for strategy review')
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'strategy_review.feedback', 'strategy_review.moderate', 'strategy_review.release', 'strategy_review.force_ready'
)
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in (
  'strategy_review.feedback', 'strategy_review.moderate', 'strategy_review.release', 'strategy_review.force_ready'
)
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code = 'strategy_review.feedback'
where r.code = 'department_lead'
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- okr_reviews extensions
-- ---------------------------------------------------------------------------
alter table app.okr_reviews
  add column if not exists review_mode text not null default 'okr_execution'
    check (review_mode in ('okr_execution', 'strategy_review')),
  add column if not exists procedure_status text not null default 'not_started'
    check (procedure_status in (
      'not_started', 'announcement_sent', 'pre_read_open', 'ready_for_review',
      'review_in_progress', 'decision_captured', 'released', 'cancelled'
    )),
  add column if not exists review_lead_time_days integer not null default 90
    check (review_lead_time_days >= 1 and review_lead_time_days <= 730),
  add column if not exists pre_read_payload jsonb not null default '{}'::jsonb,
  add column if not exists stakeholder_feedback_payload jsonb not null default '{}'::jsonb,
  add column if not exists decision_payload jsonb not null default '{}'::jsonb,
  add column if not exists release_summary jsonb not null default '{}'::jsonb,
  add column if not exists readiness_status text not null default 'not_ready'
    check (readiness_status in ('not_ready', 'partially_ready', 'ready')),
  add column if not exists override_forced boolean not null default false,
  add column if not exists override_reason text,
  add column if not exists override_forced_by uuid references app.organization_memberships(id) on delete set null,
  add column if not exists override_forced_at timestamptz,
  add column if not exists released_to_cycle_instance_id uuid references app.cycle_instances(id) on delete set null,
  add column if not exists released_at timestamptz,
  add column if not exists announcement_sent_at timestamptz,
  add column if not exists announcement_payload jsonb not null default '{}'::jsonb;

create unique index if not exists okr_reviews_one_strategy_per_instance
  on app.okr_reviews (organization_id, cycle_instance_id)
  where review_mode = 'strategy_review';

-- ---------------------------------------------------------------------------
-- Lineage on strategic entities
-- ---------------------------------------------------------------------------
alter table app.strategic_challenges
  add column if not exists strategy_carry_source_id uuid,
  add column if not exists strategy_carry_metadata jsonb not null default '{}'::jsonb;

alter table app.strategic_directions
  add column if not exists strategy_carry_source_id uuid,
  add column if not exists strategy_carry_metadata jsonb not null default '{}'::jsonb;

alter table app.objectives
  add column if not exists strategy_carry_source_id uuid,
  add column if not exists strategy_carry_metadata jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- cycle_cutover_snapshots: strategy_review_release
-- ---------------------------------------------------------------------------
alter table app.cycle_cutover_snapshots drop constraint if exists cycle_cutover_snapshots_snapshot_type_check;
alter table app.cycle_cutover_snapshots
  add constraint cycle_cutover_snapshots_snapshot_type_check
  check (snapshot_type in ('analysis_carry_forward', 'strategy_review_release'));

alter table app.cycle_cutover_snapshots
  add column if not exists review_id uuid references app.okr_reviews(id) on delete set null;

create index if not exists idx_cycle_cutover_snapshots_review
  on app.cycle_cutover_snapshots (review_id)
  where review_id is not null;

-- ---------------------------------------------------------------------------
-- strategy_review_feedback_entries
-- ---------------------------------------------------------------------------
create table if not exists app.strategy_review_feedback_entries (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references app.okr_reviews(id) on delete cascade,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  subject_type text not null
    check (subject_type in ('challenge', 'focus_area', 'objective')),
  subject_id uuid not null,
  actor_id uuid not null references app.organization_memberships(id) on delete cascade,
  rating text,
  comment text,
  is_required_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_review_feedback_rating_challenge check (
    subject_type <> 'challenge' or rating is null or rating in ('improved', 'unchanged', 'worsened')
  ),
  constraint strategy_review_feedback_rating_focus check (
    subject_type <> 'focus_area' or rating is null or rating in (
      'high_impact', 'medium_impact', 'low_impact', 'negative_impact'
    )
  ),
  constraint strategy_review_feedback_rating_objective check (
    subject_type <> 'objective' or rating is null or rating in ('keep', 'sharpen', 'questionable')
  )
);

create index if not exists idx_strategy_review_feedback_review
  on app.strategy_review_feedback_entries (review_id, created_at desc);
create index if not exists idx_strategy_review_feedback_subject
  on app.strategy_review_feedback_entries (subject_type, subject_id);

create or replace function app.tg_strategy_review_feedback_sync()
returns trigger language plpgsql as $$
declare
  v_org uuid;
  v_ci uuid;
begin
  select r.organization_id, r.cycle_instance_id
  into v_org, v_ci
  from app.okr_reviews r
  where r.id = new.review_id;

  if v_org is null then
    raise exception 'strategy_review_feedback: invalid review_id';
  end if;

  new.organization_id := v_org;
  new.cycle_instance_id := v_ci;
  return new;
end;
$$;

drop trigger if exists trg_strategy_review_feedback_sync on app.strategy_review_feedback_entries;
create trigger trg_strategy_review_feedback_sync
  before insert or update of review_id on app.strategy_review_feedback_entries
  for each row execute function app.tg_strategy_review_feedback_sync();

drop trigger if exists trg_audit_strategy_review_feedback on app.strategy_review_feedback_entries;
create trigger trg_audit_strategy_review_feedback
  after insert or update or delete on app.strategy_review_feedback_entries
  for each row execute function audit.log_row_change();

create trigger trg_strategy_review_feedback_updated_at
  before update on app.strategy_review_feedback_entries
  for each row execute function app.set_updated_at();

alter table app.strategy_review_feedback_entries enable row level security;

drop policy if exists strategy_review_feedback_select on app.strategy_review_feedback_entries;
create policy strategy_review_feedback_select on app.strategy_review_feedback_entries
  for select using (app.has_permission(organization_id, 'review.read'));

drop policy if exists strategy_review_feedback_insert on app.strategy_review_feedback_entries;
create policy strategy_review_feedback_insert on app.strategy_review_feedback_entries
  for insert with check (
    app.has_permission(organization_id, 'strategy_review.feedback')
    and actor_id in (
      select m.id from app.organization_memberships m
      where m.organization_id = strategy_review_feedback_entries.organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists strategy_review_feedback_update on app.strategy_review_feedback_entries;
create policy strategy_review_feedback_update on app.strategy_review_feedback_entries
  for update using (
    app.has_permission(organization_id, 'strategy_review.feedback')
    and actor_id in (
      select m.id from app.organization_memberships m
      where m.organization_id = strategy_review_feedback_entries.organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists strategy_review_feedback_delete on app.strategy_review_feedback_entries;
create policy strategy_review_feedback_delete on app.strategy_review_feedback_entries
  for delete using (app.has_permission(organization_id, 'strategy_review.moderate'));

grant select, insert, update, delete on app.strategy_review_feedback_entries to authenticated;
grant select on app.strategy_review_feedback_entries to anon;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function app._strategy_review_current_membership(p_organization_id uuid)
returns uuid
language sql stable security definer
set search_path to 'public', 'app', 'rbac', 'auth'
as $$
  select m.id
  from app.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function app.resolve_successor_cycle_instance(p_from_instance_id uuid)
returns uuid
language sql stable security definer
set search_path to 'app', 'public'
as $$
  select c2.id
  from app.cycle_instances c1
  join app.cycle_instances c2
    on c2.organization_id = c1.organization_id
   and c2.cycle_scheme_id = c1.cycle_scheme_id
   and c2.level_no = c1.level_no
   and c2.parent_instance_id is not distinct from c1.parent_instance_id
   and c2.starts_on = c1.ends_on + 1
  where c1.id = p_from_instance_id
  limit 1;
$$;

create or replace function app._remap_uuid_array_from_map(p_arr uuid[], p_map jsonb)
returns uuid[]
language sql immutable
as $$
  select coalesce(
    array_agg((p_map ->> x::text)::uuid) filter (where p_map ? x::text),
    array[]::uuid[]
  )
  from unnest(coalesce(p_arr, array[]::uuid[])) as x;
$$;

-- ---------------------------------------------------------------------------
-- validate_strategy_decision_payload
-- ---------------------------------------------------------------------------
create or replace function app.validate_strategy_decision_payload(
  p_decisions jsonb,
  p_pre_read jsonb
)
returns jsonb
language plpgsql stable security definer
set search_path to 'app', 'public'
as $$
declare
  v_scope_challenges uuid[] := array[]::uuid[];
  v_scope_focus uuid[] := array[]::uuid[];
  v_scope_objectives uuid[] := array[]::uuid[];
  v_errors text[] := array[]::text[];
  v_elem jsonb;
  v_id uuid;
  v_dec text;
  v_n int;
begin
  if p_pre_read is null or p_pre_read = '{}'::jsonb then
    return jsonb_build_object('valid', false, 'errors', jsonb_build_array('pre_read_payload missing'));
  end if;

  select coalesce(array_agg(x::uuid), array[]::uuid[])
  into v_scope_challenges
  from jsonb_array_elements_text(coalesce(p_pre_read #> '{scope,challenge_ids}', '[]'::jsonb)) x;

  if cardinality(v_scope_challenges) = 0 then
    select coalesce(array_agg((x->>'id')::uuid), array[]::uuid[])
    into v_scope_challenges
    from jsonb_array_elements(coalesce(p_pre_read -> 'challenges', '[]'::jsonb)) x
    where x ? 'id';
  end if;

  select coalesce(array_agg(x::uuid), array[]::uuid[])
  into v_scope_focus
  from jsonb_array_elements_text(coalesce(p_pre_read #> '{scope,focus_area_ids}', '[]'::jsonb)) x;

  if cardinality(v_scope_focus) = 0 then
    select coalesce(array_agg((x->>'id')::uuid), array[]::uuid[])
    into v_scope_focus
    from jsonb_array_elements(coalesce(p_pre_read -> 'focus_areas', '[]'::jsonb)) x
    where x ? 'id';
  end if;

  select coalesce(array_agg(x::uuid), array[]::uuid[])
  into v_scope_objectives
  from jsonb_array_elements_text(coalesce(p_pre_read #> '{scope,objective_ids}', '[]'::jsonb)) x;

  if cardinality(v_scope_objectives) = 0 then
    select coalesce(array_agg((x->>'id')::uuid), array[]::uuid[])
    into v_scope_objectives
    from jsonb_array_elements(coalesce(p_pre_read -> 'objectives', '[]'::jsonb)) x
    where x ? 'id';
  end if;

  if cardinality(v_scope_challenges) + cardinality(v_scope_focus) + cardinality(v_scope_objectives) = 0 then
    v_errors := array_append(v_errors, 'pre_read scope empty');
  end if;

  for v_elem in select * from jsonb_array_elements(coalesce(p_decisions -> 'challenges', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_dec := v_elem ->> 'decision';
    if v_id is null then
      v_errors := array_append(v_errors, 'challenge entry missing id');
      continue;
    end if;
    if not (v_id = any (v_scope_challenges)) then
      v_errors := array_append(v_errors, format('challenge %s not in scope', v_id));
    end if;
    if v_dec is null or v_dec not in ('keep', 'adjust', 'replace') then
      v_errors := array_append(v_errors, format('challenge %s invalid decision', v_id));
    end if;
    if v_dec in ('adjust', 'replace') and (v_elem ->> 'comment') is null then
      v_errors := array_append(v_errors, format('challenge %s requires comment', v_id));
    end if;
    if v_dec = 'adjust' and not (v_elem ? 'proposed_changes') then
      v_errors := array_append(v_errors, format('challenge %s adjust needs proposed_changes', v_id));
    end if;
    if v_dec = 'replace' and not (v_elem ? 'replacement') then
      v_errors := array_append(v_errors, format('challenge %s replace needs replacement', v_id));
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(p_decisions -> 'focus_areas', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_dec := v_elem ->> 'decision';
    if v_id is null then
      v_errors := array_append(v_errors, 'focus_area entry missing id');
      continue;
    end if;
    if not (v_id = any (v_scope_focus)) then
      v_errors := array_append(v_errors, format('focus_area %s not in scope', v_id));
    end if;
    if v_dec is null or v_dec not in ('double_down', 'adjust', 'stop') then
      v_errors := array_append(v_errors, format('focus_area %s invalid decision', v_id));
    end if;
    if v_dec in ('adjust', 'stop') and (v_elem ->> 'comment') is null then
      v_errors := array_append(v_errors, format('focus_area %s requires comment', v_id));
    end if;
    if v_dec = 'adjust' and not (v_elem ? 'proposed_changes') then
      v_errors := array_append(v_errors, format('focus_area %s adjust needs proposed_changes', v_id));
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(p_decisions -> 'objectives', '[]'::jsonb))
  loop
    v_id := nullif(v_elem ->> 'id', '')::uuid;
    v_dec := v_elem ->> 'decision';
    if v_id is null then
      v_errors := array_append(v_errors, 'objective entry missing id');
      continue;
    end if;
    if not (v_id = any (v_scope_objectives)) then
      v_errors := array_append(v_errors, format('objective %s not in scope', v_id));
    end if;
    if v_dec is null or v_dec not in ('keep', 'change', 'remove') then
      v_errors := array_append(v_errors, format('objective %s invalid decision', v_id));
    end if;
    if v_dec in ('change', 'remove') and (v_elem ->> 'comment') is null then
      v_errors := array_append(v_errors, format('objective %s requires comment', v_id));
    end if;
    if v_dec = 'change' and not (v_elem ? 'proposed_changes') then
      v_errors := array_append(v_errors, format('objective %s change needs proposed_changes', v_id));
    end if;
  end loop;

  if cardinality(v_errors) = 0 then
    select count(*) into v_n from jsonb_array_elements(coalesce(p_decisions -> 'challenges', '[]'::jsonb));
    if v_n <> coalesce(cardinality(v_scope_challenges), 0) then
      v_errors := array_append(v_errors, 'challenges: decision count must match scope');
    end if;
    select count(*) into v_n from jsonb_array_elements(coalesce(p_decisions -> 'focus_areas', '[]'::jsonb));
    if v_n <> coalesce(cardinality(v_scope_focus), 0) then
      v_errors := array_append(v_errors, 'focus_areas: decision count must match scope');
    end if;
    select count(*) into v_n from jsonb_array_elements(coalesce(p_decisions -> 'objectives', '[]'::jsonb));
    if v_n <> coalesce(cardinality(v_scope_objectives), 0) then
      v_errors := array_append(v_errors, 'objectives: decision count must match scope');
    end if;
  end if;

  if cardinality(v_errors) > 0 then
    return jsonb_build_object('valid', false, 'errors', to_jsonb(v_errors));
  end if;

  return jsonb_build_object('valid', true, 'errors', '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- compute_review_readiness
-- ---------------------------------------------------------------------------
create or replace function app.compute_review_readiness(p_review_id uuid)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_pre jsonb;
  v_org uuid;
  v_ci uuid;
  v_ids uuid[] := array[]::uuid[];
  v_total int;
  v_with_feedback int;
  v_proc text;
begin
  select pre_read_payload, organization_id, cycle_instance_id, procedure_status
  into v_pre, v_org, v_ci, v_proc
  from app.okr_reviews
  where id = p_review_id;

  if v_pre is null then
    return;
  end if;

  select coalesce(array_agg(distinct u), array[]::uuid[])
  into v_ids
  from (
    select (x->>'id')::uuid as u
    from jsonb_array_elements(coalesce(v_pre -> 'challenges', '[]'::jsonb)) x
    where x ? 'id'
    union
    select (x->>'id')::uuid
    from jsonb_array_elements(coalesce(v_pre -> 'focus_areas', '[]'::jsonb)) x
    where x ? 'id'
    union
    select (x->>'id')::uuid
    from jsonb_array_elements(coalesce(v_pre -> 'objectives', '[]'::jsonb)) x
    where x ? 'id'
  ) s
  where u is not null;

  v_total := cardinality(v_ids);

  if v_total = 0 then
    update app.okr_reviews
    set readiness_status = 'not_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
    return;
  end if;

  select count(distinct f.subject_id)
  into v_with_feedback
  from app.strategy_review_feedback_entries f
  where f.review_id = p_review_id
    and f.subject_id = any (v_ids)
    and f.rating is not null;

  if v_with_feedback = 0 then
    update app.okr_reviews
    set readiness_status = 'not_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
  elsif v_with_feedback < v_total then
    update app.okr_reviews
    set readiness_status = 'partially_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
  else
    update app.okr_reviews
    set readiness_status = 'ready',
        procedure_status = case
          when procedure_status = 'pre_read_open' then 'ready_for_review'
          else procedure_status
        end
    where id = p_review_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_review_trigger_state (read-only)
-- ---------------------------------------------------------------------------
create or replace function app.get_review_trigger_state(p_cycle_instance_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to 'app', 'public'
as $$
declare
  v_ci record;
  v_rev record;
  v_days int;
  v_lead int;
  v_visible boolean := false;
  v_state text := 'hidden';
  v_label text := '';
  v_override boolean := false;
begin
  select * into v_ci
  from app.cycle_instances
  where id = p_cycle_instance_id;

  if v_ci.id is null then
    return jsonb_build_object(
      'visible', false,
      'state', 'invalid_instance',
      'label', '',
      'days_to_end', null,
      'is_override', false
    );
  end if;

  select * into v_rev
  from app.okr_reviews
  where cycle_instance_id = p_cycle_instance_id
    and review_mode = 'strategy_review'
  limit 1;

  v_days := (v_ci.ends_on - current_date);

  if v_rev.id is null then
    return jsonb_build_object(
      'visible', false,
      'state', 'no_review',
      'label', 'Strategy Review anlegen',
      'days_to_end', v_days,
      'is_override', false
    );
  end if;

  v_lead := v_rev.review_lead_time_days;
  v_override := coalesce(v_rev.override_forced, false);

  if v_days > v_lead then
    return jsonb_build_object(
      'visible', false,
      'state', 'outside_lead_time',
      'label', '',
      'days_to_end', v_days,
      'is_override', v_override
    );
  end if;

  v_visible := true;

  if v_rev.procedure_status in ('released', 'cancelled') then
    v_state := 'completed';
    v_label := case when v_rev.procedure_status = 'released' then 'Review abgeschlossen' else 'Review abgebrochen' end;
  elsif v_rev.procedure_status = 'review_in_progress' then
    v_state := 'in_progress';
    v_label := 'Review läuft';
  elsif v_rev.procedure_status = 'decision_captured' then
    v_state := 'decision_captured';
    v_label := 'Entscheidungen erfasst – Release möglich';
  elsif v_rev.procedure_status = 'ready_for_review' or (v_rev.readiness_status = 'ready' and v_rev.procedure_status = 'pre_read_open') then
    v_state := 'ready_for_review';
    v_label := case when v_override then 'Review abhalten (Override)' else 'Review abhalten' end;
  elsif v_rev.procedure_status in ('not_started', 'announcement_sent', 'pre_read_open') then
    v_state := 'preparation';
    v_label := format('Review vorbereiten (noch %s Tage)', v_days);
  else
    v_state := 'preparation';
    v_label := 'Review vorbereiten';
  end if;

  return jsonb_build_object(
    'visible', v_visible,
    'state', v_state,
    'label', v_label,
    'days_to_end', v_days,
    'is_override', v_override,
    'procedure_status', v_rev.procedure_status,
    'readiness_status', v_rev.readiness_status,
    'review_id', v_rev.id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- ensure_strategy_review
-- ---------------------------------------------------------------------------
create or replace function app.ensure_strategy_review(p_cycle_instance_id uuid)
returns uuid
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_existing uuid;
  v_new uuid;
begin
  select organization_id into v_org
  from app.cycle_instances
  where id = p_cycle_instance_id;

  if v_org is null then
    raise exception 'ensure_strategy_review: invalid cycle_instance_id';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate')
     and not app.has_permission(v_org, 'review.write') then
    raise exception 'ensure_strategy_review: forbidden';
  end if;

  select id into v_existing
  from app.okr_reviews
  where organization_id = v_org
    and cycle_instance_id = p_cycle_instance_id
    and review_mode = 'strategy_review'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into app.okr_reviews (
    organization_id,
    cycle_instance_id,
    review_type,
    review_mode,
    procedure_status,
    summary
  )
  values (
    v_org,
    p_cycle_instance_id,
    'annual_review',
    'strategy_review',
    'not_started',
    'Strategy Review'
  )
  returning id into v_new;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- force_review_ready
-- ---------------------------------------------------------------------------
create or replace function app.force_review_ready(p_review_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_mid uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'force_review_ready: reason required';
  end if;

  select organization_id into v_org
  from app.okr_reviews
  where id = p_review_id;

  if v_org is null then
    raise exception 'force_review_ready: review not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.force_ready') then
    raise exception 'force_review_ready: forbidden';
  end if;

  v_mid := app._strategy_review_current_membership(v_org);
  if v_mid is null then
    raise exception 'force_review_ready: no active membership';
  end if;

  update app.okr_reviews
  set override_forced = true,
      override_reason = p_reason,
      override_forced_by = v_mid,
      override_forced_at = now()
  where id = p_review_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_strategy_review_announcement
-- ---------------------------------------------------------------------------
create or replace function app.record_strategy_review_announcement(
  p_review_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from app.okr_reviews where id = p_review_id;
  if v_org is null then
    raise exception 'record_strategy_review_announcement: not found';
  end if;
  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'record_strategy_review_announcement: forbidden';
  end if;

  update app.okr_reviews
  set announcement_payload = coalesce(p_payload, '{}'::jsonb),
      announcement_sent_at = now(),
      procedure_status = 'announcement_sent'
  where id = p_review_id
    and review_mode = 'strategy_review'
    and procedure_status = 'not_started';

  if not found then
    raise exception 'record_strategy_review_announcement: invalid state or not strategy review';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- prepare_strategy_review
-- ---------------------------------------------------------------------------
create or replace function app.prepare_strategy_review(p_review_id uuid)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_ci uuid;
  v_payload jsonb;
  v_challenge_ids uuid[];
  v_focus_ids uuid[];
  v_obj_ids uuid[];
begin
  select organization_id, cycle_instance_id into v_org, v_ci
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_ci is null then
    raise exception 'prepare_strategy_review: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'prepare_strategy_review: forbidden';
  end if;

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_challenge_ids
  from app.strategic_challenges
  where organization_id = v_org and cycle_instance_id = v_ci;

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_focus_ids
  from app.strategic_directions
  where organization_id = v_org and cycle_instance_id = v_ci;

  select coalesce(array_agg(id order by title), array[]::uuid[])
  into v_obj_ids
  from app.objectives
  where organization_id = v_org and cycle_instance_id = v_ci;

  v_payload := jsonb_build_object(
    'generated_at', to_jsonb(now()),
    'scope', jsonb_build_object(
      'challenge_ids', coalesce(to_jsonb(v_challenge_ids), '[]'::jsonb),
      'focus_area_ids', coalesce(to_jsonb(v_focus_ids), '[]'::jsonb),
      'objective_ids', coalesce(to_jsonb(v_obj_ids), '[]'::jsonb)
    ),
    'challenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'description', c.description,
          'priority', c.priority,
          'visibility', c.visibility
        ) order by c.title
      )
      from app.strategic_challenges c
      where c.organization_id = v_org and c.cycle_instance_id = v_ci
    ), '[]'::jsonb),
    'focus_areas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'title', d.title,
          'description', d.description,
          'status', d.status,
          'priority', d.priority
        ) order by d.title
      )
      from app.strategic_directions d
      where d.organization_id = v_org and d.cycle_instance_id = v_ci
    ), '[]'::jsonb),
    'objectives', coalesce((
      select jsonb_agg(x.obj order by x.sort_title)
      from (
        select o.title as sort_title,
          jsonb_build_object(
            'id', o.id,
            'title', o.title,
            'description', o.description,
            'status', o.status,
            'progress_percent', o.progress_percent,
            'key_results', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', kr.id,
                  'title', kr.title,
                  'metric_type', kr.metric_type,
                  'target_value', kr.target_value,
                  'current_value', kr.current_value
                ) order by kr.title
              )
              from app.key_results kr
              where kr.objective_id = o.id
            ), '[]'::jsonb)
          ) as obj
        from app.objectives o
        where o.organization_id = v_org and o.cycle_instance_id = v_ci
      ) x
    ), '[]'::jsonb)
  );

  update app.okr_reviews
  set pre_read_payload = v_payload,
      procedure_status = 'pre_read_open'
  where id = p_review_id
    and procedure_status = 'announcement_sent';

  if not found then
    raise exception 'prepare_strategy_review: expected procedure_status announcement_sent';
  end if;

  perform app.compute_review_readiness(p_review_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- save_strategy_review_feedback
-- ---------------------------------------------------------------------------
create or replace function app.save_strategy_review_feedback(
  p_review_id uuid,
  p_actor_membership_id uuid,
  p_feedback jsonb
)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_elem jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_rating text;
  v_comment text;
begin
  select organization_id into v_org from app.okr_reviews where id = p_review_id;
  if v_org is null then
    raise exception 'save_strategy_review_feedback: review not found';
  end if;

  if p_actor_membership_id is distinct from app._strategy_review_current_membership(v_org) then
    raise exception 'save_strategy_review_feedback: actor must be current user membership';
  end if;

  if not app.has_permission(v_org, 'strategy_review.feedback') then
    raise exception 'save_strategy_review_feedback: forbidden';
  end if;

  for v_elem in select * from jsonb_array_elements(coalesce(p_feedback -> 'entries', '[]'::jsonb))
  loop
    v_subject_type := v_elem ->> 'subject_type';
    v_subject_id := nullif(v_elem ->> 'subject_id', '')::uuid;
    v_rating := v_elem ->> 'rating';
    v_comment := v_elem ->> 'comment';

    insert into app.strategy_review_feedback_entries (
      review_id, subject_type, subject_id, actor_id, rating, comment
    ) values (
      p_review_id, v_subject_type, v_subject_id, p_actor_membership_id, v_rating, v_comment
    );
  end loop;

  update app.okr_reviews r
  set stakeholder_feedback_payload = jsonb_build_object(
    'updated_at', to_jsonb(now()),
    'entry_count', (select count(*)::int from app.strategy_review_feedback_entries f where f.review_id = p_review_id)
  )
  where r.id = p_review_id;

  perform app.compute_review_readiness(p_review_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- capture_strategy_review_decisions + start_strategy_review_meeting
-- ---------------------------------------------------------------------------
create or replace function app.capture_strategy_review_decisions(p_review_id uuid, p_decisions jsonb)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_pre jsonb;
  v_val jsonb;
begin
  select organization_id, pre_read_payload into v_org, v_pre
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'capture_strategy_review_decisions: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'capture_strategy_review_decisions: forbidden';
  end if;

  v_val := app.validate_strategy_decision_payload(p_decisions, v_pre);
  if coalesce((v_val ->> 'valid')::boolean, false) is not true then
    raise exception 'capture_strategy_review_decisions: validation failed %', v_val -> 'errors';
  end if;

  update app.okr_reviews
  set decision_payload = p_decisions,
      procedure_status = 'decision_captured'
  where id = p_review_id
    and procedure_status = 'review_in_progress';

  if not found then
    raise exception 'capture_strategy_review_decisions: expected review_in_progress';
  end if;
end;
$$;

create or replace function app.start_strategy_review_meeting(p_review_id uuid)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_ready text;
  v_proc text;
  v_override boolean;
begin
  select organization_id, readiness_status, procedure_status, override_forced
  into v_org, v_ready, v_proc, v_override
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'start_strategy_review_meeting: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'start_strategy_review_meeting: forbidden';
  end if;

  if not (
    (v_ready = 'ready' and v_proc = 'ready_for_review')
    or (v_override and v_proc in ('pre_read_open', 'ready_for_review'))
  ) then
    raise exception 'start_strategy_review_meeting: readiness / state guard failed';
  end if;

  update app.okr_reviews
  set procedure_status = 'review_in_progress'
  where id = p_review_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_strategy_review_decisions (core carry; always copy into target instance)
-- ---------------------------------------------------------------------------
create or replace function app.apply_strategy_review_decisions(
  p_review_id uuid,
  p_from_cycle_instance_id uuid,
  p_to_cycle_instance_id uuid
)
returns jsonb
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_planning_to uuid;
  v_dec jsonb;
  v_challenge_map jsonb := '{}'::jsonb;
  v_direction_map jsonb := '{}'::jsonb;
  v_objective_map jsonb := '{}'::jsonb;
  v_kr_map jsonb := '{}'::jsonb;
  v_program_map jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_old uuid;
  v_new_obj uuid;
  v_new_kr uuid;
  v_decision text;
  v_rec record;
  v_summary jsonb := '{}'::jsonb;
  v_programs_skipped jsonb := '[]'::jsonb;
  v_inits_skipped jsonb := '[]'::jsonb;
  v_kr record;
  v_prog record;
  v_init record;
  v_new_prog uuid;
  v_new_init uuid;
  v_supported uuid[];
  v_mapped uuid[];
  v_dir_ok boolean;
  v_ch_ok boolean;
begin
  select organization_id, decision_payload
  into v_org, v_dec
  from app.okr_reviews
  where id = p_review_id;

  if v_org is null or v_dec is null or v_dec = '{}'::jsonb then
    raise exception 'apply_strategy_review_decisions: missing review or decisions';
  end if;

  select legacy_planning_cycle_id into v_planning_to
  from app.cycle_instances
  where id = p_to_cycle_instance_id and organization_id = v_org;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'challenges', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('keep', 'adjust') then
      select * into v_rec from app.strategic_challenges where id = v_old and organization_id = v_org;
      if not found then
        raise exception 'challenge % not found', v_old;
      end if;
      insert into app.strategic_challenges (
        organization_id, planning_cycle_id, title, priority, visibility,
        created_by_membership_id, source_analysis_entry_id, cycle_instance_id,
        relevance_level, risk_level, description, impact_score, urgency_score,
        scope_score, root_cause_score, challenge_score, created_by_source, source_cluster_id,
        strategy_carry_source_id, strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title) else v_rec.title end,
        v_rec.priority,
        v_rec.visibility,
        v_rec.created_by_membership_id,
        v_rec.source_analysis_entry_id,
        p_to_cycle_instance_id,
        v_rec.relevance_level,
        v_rec.risk_level,
        case when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description) else v_rec.description end,
        v_rec.impact_score,
        v_rec.urgency_score,
        v_rec.scope_score,
        v_rec.root_cause_score,
        v_rec.challenge_score,
        v_rec.created_by_source,
        v_rec.source_cluster_id,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object('strategy_review_carry', true, 'decision', v_decision)
      )
      returning id into v_new_obj;
      v_challenge_map := v_challenge_map || jsonb_build_object(v_old::text, v_new_obj);
    elsif v_decision = 'replace' then
      insert into app.strategic_challenges (
        organization_id, planning_cycle_id, title, priority, visibility,
        cycle_instance_id, relevance_level, risk_level, description,
        impact_score, urgency_score, scope_score, root_cause_score, challenge_score,
        created_by_source, strategy_carry_metadata
      )
      values (
        v_org,
        v_planning_to,
        coalesce(v_elem #>> '{replacement,title}', 'Challenge'),
        3,
        'internal',
        p_to_cycle_instance_id,
        3, 3,
        v_elem #>> '{replacement,description}',
        3, 3, 3, 3, 3,
        'user',
        jsonb_build_object('strategy_review_replace_of', v_old::text)
      )
      returning id into v_new_obj;
      v_challenge_map := v_challenge_map || jsonb_build_object(v_old::text, v_new_obj);
    end if;
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'focus_areas', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('double_down', 'adjust') then
      select * into v_rec from app.strategic_directions where id = v_old and organization_id = v_org;
      if not found then
        raise exception 'direction % not found', v_old;
      end if;
      insert into app.strategic_directions (
        organization_id, planning_cycle_id, title, description, owner_membership_id,
        priority, status, grouping, created_by_membership_id, cycle_instance_id,
        relevance_level, risk_level, strategic_value_score, capability_fit_score,
        feasibility_score, created_by_source, review_comment,
        strategy_carry_source_id, strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title) else v_rec.title end,
        case when v_decision = 'adjust' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description) else v_rec.description end,
        v_rec.owner_membership_id,
        v_rec.priority,
        v_rec.status,
        v_rec.grouping,
        v_rec.created_by_membership_id,
        p_to_cycle_instance_id,
        v_rec.relevance_level,
        v_rec.risk_level,
        v_rec.strategic_value_score,
        v_rec.capability_fit_score,
        v_rec.feasibility_score,
        v_rec.created_by_source,
        v_rec.review_comment,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object('strategy_review_carry', true, 'decision', v_decision)
      )
      returning id into v_new_obj;
      v_direction_map := v_direction_map || jsonb_build_object(v_old::text, v_new_obj);
    end if;
  end loop;

  select decision_payload into v_dec from app.okr_reviews where id = p_review_id;

  for v_elem in select * from jsonb_array_elements(coalesce(v_dec -> 'objectives', '[]'::jsonb))
  loop
    v_old := (v_elem ->> 'id')::uuid;
    v_decision := v_elem ->> 'decision';
    if v_decision in ('keep', 'change') then
      select * into v_rec from app.objectives where id = v_old and organization_id = v_org;
      if not found then
        raise exception 'objective % not found', v_old;
      end if;
      insert into app.objectives (
        organization_id, cycle_id, title, description, status, owner_membership_id,
        progress_percent, okr_cycle_id, confidence_level, cycle_instance_id,
        time_horizon, importance_score,
        ai_clarity_score, ai_strategic_relevance_score, ai_feasibility_score,
        ai_fit_to_company_score, ai_confidence_score,
        ai_external_internal_classification, ai_short_long_term_classification,
        ai_exploit_explore_classification, ai_issues_json, ai_improvement_suggestion,
        ai_summary, ai_objective_score, ai_evaluation_status, ai_evaluated_at,
        ai_evaluation_version, ai_manual_override, ai_manual_comment,
        created_by_membership_id, created_by_source,
        objective_health_override, objective_health_override_by_membership_id,
        objective_health_override_at, objective_review_comment,
        strategy_carry_source_id, strategy_carry_metadata
      )
      values (
        v_rec.organization_id,
        v_planning_to,
        case when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,title}', v_rec.title) else v_rec.title end,
        case when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,description}', v_rec.description) else v_rec.description end,
        v_rec.status,
        v_rec.owner_membership_id,
        v_rec.progress_percent,
        v_rec.okr_cycle_id,
        v_rec.confidence_level,
        p_to_cycle_instance_id,
        case when v_decision = 'change' then coalesce(v_elem #>> '{proposed_changes,time_horizon}', v_rec.time_horizon) else v_rec.time_horizon end,
        v_rec.importance_score,
        v_rec.ai_clarity_score, v_rec.ai_strategic_relevance_score, v_rec.ai_feasibility_score,
        v_rec.ai_fit_to_company_score, v_rec.ai_confidence_score,
        v_rec.ai_external_internal_classification, v_rec.ai_short_long_term_classification,
        v_rec.ai_exploit_explore_classification, v_rec.ai_issues_json, v_rec.ai_improvement_suggestion,
        v_rec.ai_summary, v_rec.ai_objective_score, v_rec.ai_evaluation_status, v_rec.ai_evaluated_at,
        v_rec.ai_evaluation_version, v_rec.ai_manual_override, v_rec.ai_manual_comment,
        v_rec.created_by_membership_id, v_rec.created_by_source,
        v_rec.objective_health_override, v_rec.objective_health_override_by_membership_id,
        v_rec.objective_health_override_at, v_rec.objective_review_comment,
        v_old,
        coalesce(v_rec.strategy_carry_metadata, '{}'::jsonb) || jsonb_build_object('strategy_review_carry', true, 'decision', v_decision)
      )
      returning id into v_new_obj;
      v_objective_map := v_objective_map || jsonb_build_object(v_old::text, v_new_obj);

      for v_kr in select * from app.key_results where objective_id = v_old
      loop
        insert into app.key_results (
          organization_id, objective_id, title, metric_type, start_value, target_value,
          current_value, status, due_date, measurement_unit, created_by_membership_id,
          created_by_source, owner_membership_id
        )
        values (
          v_kr.organization_id,
          v_new_obj,
          v_kr.title,
          v_kr.metric_type,
          v_kr.start_value,
          v_kr.target_value,
          v_kr.current_value,
          v_kr.status,
          v_kr.due_date,
          v_kr.measurement_unit,
          v_kr.created_by_membership_id,
          v_kr.created_by_source,
          v_kr.owner_membership_id
        )
        returning id into v_new_kr;
        v_kr_map := v_kr_map || jsonb_build_object(v_kr.id::text, v_new_kr);
      end loop;
    end if;
  end loop;

  insert into app.objective_direction_links (
    organization_id, planning_cycle_id, objective_id, strategic_direction_id,
    contribution_level, comment, cycle_instance_id
  )
  select
    l.organization_id,
    v_planning_to,
    (v_objective_map ->> l.objective_id::text)::uuid,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    l.contribution_level,
    l.comment,
    p_to_cycle_instance_id
  from app.objective_direction_links l
  where l.cycle_instance_id = p_from_cycle_instance_id
    and v_objective_map ? l.objective_id::text
    and v_direction_map ? l.strategic_direction_id::text;

  insert into app.strategic_direction_objective_links (
    organization_id, planning_cycle_id, cycle_instance_id, strategic_direction_id,
    objective_id, created_by_membership_id, contribution_level
  )
  select
    l.organization_id,
    v_planning_to,
    p_to_cycle_instance_id,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    (v_objective_map ->> l.objective_id::text)::uuid,
    l.created_by_membership_id,
    l.contribution_level
  from app.strategic_direction_objective_links l
  where l.cycle_instance_id = p_from_cycle_instance_id
    and v_objective_map ? l.objective_id::text
    and v_direction_map ? l.strategic_direction_id::text;

  insert into app.challenge_direction_links (
    organization_id, planning_cycle_id, strategic_direction_id, strategic_challenge_id,
    contribution_level, note, created_by_membership_id, cycle_instance_id
  )
  select
    l.organization_id,
    v_planning_to,
    (v_direction_map ->> l.strategic_direction_id::text)::uuid,
    (v_challenge_map ->> l.strategic_challenge_id::text)::uuid,
    l.contribution_level,
    l.note,
    l.created_by_membership_id,
    p_to_cycle_instance_id
  from app.challenge_direction_links l
  where l.cycle_instance_id = p_from_cycle_instance_id
    and v_direction_map ? l.strategic_direction_id::text
    and v_challenge_map ? l.strategic_challenge_id::text;

  for v_prog in
    select * from app.strategy_programs
    where organization_id = v_org and cycle_instance_id = p_from_cycle_instance_id
  loop
    v_ch_ok := v_prog.strategic_challenge_id is null
      or v_challenge_map ? v_prog.strategic_challenge_id::text;
    v_dir_ok := v_prog.strategic_direction_id is null
      or v_direction_map ? v_prog.strategic_direction_id::text;
    v_supported := v_prog.supported_objective_ids;
    v_mapped := app._remap_uuid_array_from_map(v_supported, v_objective_map);
    if v_ch_ok and v_dir_ok
       and (cardinality(v_supported) = 0 or cardinality(v_mapped) > 0) then
      insert into app.strategy_programs (
        organization_id, planning_cycle_id, cycle_instance_id, strategic_direction_id,
        title, description, owner_membership_id, budget_total, timeline,
        created_by_membership_id, status, review_comment, strategic_challenge_id,
        program_origin, matrix_cell_score, supported_objective_ids, start_date, end_date
      )
      values (
        v_prog.organization_id,
        v_planning_to,
        p_to_cycle_instance_id,
        case when v_prog.strategic_direction_id is not null
          then (v_direction_map ->> v_prog.strategic_direction_id::text)::uuid end,
        v_prog.title,
        v_prog.description,
        v_prog.owner_membership_id,
        v_prog.budget_total,
        v_prog.timeline,
        v_prog.created_by_membership_id,
        v_prog.status,
        v_prog.review_comment,
        case when v_prog.strategic_challenge_id is not null
          then (v_challenge_map ->> v_prog.strategic_challenge_id::text)::uuid end,
        v_prog.program_origin,
        v_prog.matrix_cell_score,
        case when cardinality(v_supported) = 0 then v_supported else v_mapped end,
        v_prog.start_date,
        v_prog.end_date
      )
      returning id into v_new_prog;
      v_program_map := v_program_map || jsonb_build_object(v_prog.id::text, v_new_prog);
    else
      v_programs_skipped := v_programs_skipped || jsonb_build_object(
        'program_id', v_prog.id,
        'reason', 'references_not_carried'
      );
    end if;
  end loop;

  for v_init in
    select * from app.initiatives
    where organization_id = v_org and cycle_instance_id = p_from_cycle_instance_id
  loop
    if not (v_program_map ? v_init.program_id::text) then
      v_inits_skipped := v_inits_skipped || jsonb_build_object('initiative_id', v_init.id, 'reason', 'program_not_carried');
      continue;
    end if;
    if not exists (
      select 1 from app.initiative_key_result_links l
      where l.initiative_id = v_init.id
        and l.cycle_instance_id = p_from_cycle_instance_id
        and v_kr_map ? l.key_result_id::text
    ) then
      v_inits_skipped := v_inits_skipped || jsonb_build_object('initiative_id', v_init.id, 'reason', 'no_carried_kr_link');
      continue;
    end if;

    insert into app.initiatives (
      organization_id, planning_cycle_id, title, description, owner_membership_id,
      start_date, end_date, status, priority, budget, created_by_membership_id,
      cycle_instance_id, program_id, linked_okrs, deliverables, created_by_source,
      execution_health_override, execution_health_override_by_membership_id,
      execution_health_override_at, review_comment,
      weight, progress_percent, last_review_update_at
    )
    values (
      v_init.organization_id,
      v_planning_to,
      v_init.title,
      v_init.description,
      v_init.owner_membership_id,
      v_init.start_date,
      v_init.end_date,
      v_init.status,
      v_init.priority,
      v_init.budget,
      v_init.created_by_membership_id,
      p_to_cycle_instance_id,
      (v_program_map ->> v_init.program_id::text)::uuid,
      v_init.linked_okrs,
      v_init.deliverables,
      v_init.created_by_source,
      v_init.execution_health_override,
      v_init.execution_health_override_by_membership_id,
      v_init.execution_health_override_at,
      v_init.review_comment,
      v_init.weight,
      v_init.progress_percent,
      v_init.last_review_update_at
    )
    returning id into v_new_init;

    insert into app.initiative_key_result_links (
      organization_id, cycle_instance_id, initiative_id, key_result_id
    )
    select
      v_init.organization_id,
      p_to_cycle_instance_id,
      v_new_init,
      (v_kr_map ->> l.key_result_id::text)::uuid
    from app.initiative_key_result_links l
    where l.initiative_id = v_init.id
      and l.cycle_instance_id = p_from_cycle_instance_id
      and v_kr_map ? l.key_result_id::text;
  end loop;

  v_summary := jsonb_build_object(
    'challenge_map', v_challenge_map,
    'direction_map', v_direction_map,
    'objective_map', v_objective_map,
    'key_result_map', v_kr_map,
    'program_map', v_program_map,
    'programs_skipped', v_programs_skipped,
    'initiatives_skipped', v_inits_skipped
  );

  return v_summary;
end;
$$;

-- ---------------------------------------------------------------------------
-- execute_strategy_review_release
-- ---------------------------------------------------------------------------
create or replace function app.execute_strategy_review_release(p_review_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_rev record;
  v_to uuid;
  v_actor uuid;
  v_cf jsonb;
  v_apply jsonb;
  v_final jsonb;
begin
  select * into v_rev
  from app.okr_reviews
  where id = p_review_id
  for update;

  if v_rev.id is null then
    raise exception 'execute_strategy_review_release: not found';
  end if;

  if v_rev.review_mode <> 'strategy_review' then
    raise exception 'execute_strategy_review_release: not strategy review';
  end if;

  if v_rev.procedure_status <> 'decision_captured' then
    raise exception 'execute_strategy_review_release: expected decision_captured';
  end if;

  if v_rev.released_at is not null then
    raise exception 'execute_strategy_review_release: already released';
  end if;

  if not app.has_permission(v_rev.organization_id, 'strategy_review.release') then
    raise exception 'execute_strategy_review_release: forbidden';
  end if;

  v_actor := app._strategy_review_current_membership(v_rev.organization_id);

  v_to := app.resolve_successor_cycle_instance(v_rev.cycle_instance_id);
  if v_to is null then
    raise exception 'execute_strategy_review_release: no successor cycle_instance (materialize calendar first)';
  end if;

  v_cf := app.carry_forward_analysis_cycle_data(
    v_rev.organization_id,
    v_rev.cycle_instance_id,
    v_to,
    null,
    v_actor
  );

  v_apply := app.apply_strategy_review_decisions(
    p_review_id,
    v_rev.cycle_instance_id,
    v_to
  );

  v_final := jsonb_build_object(
    'analysis_carry_forward', v_cf,
    'apply', v_apply,
    'from_cycle_instance_id', v_rev.cycle_instance_id,
    'to_cycle_instance_id', v_to,
    'override_forced', v_rev.override_forced,
    'released_at', to_jsonb(now())
  );

  update app.okr_reviews
  set release_summary = v_final,
      released_to_cycle_instance_id = v_to,
      released_at = now(),
      procedure_status = 'released'
  where id = p_review_id;

  insert into app.cycle_cutover_snapshots (
    organization_id,
    cutover_id,
    from_cycle_instance_id,
    to_cycle_instance_id,
    snapshot_type,
    summary,
    created_by_membership_id,
    review_id
  )
  values (
    v_rev.organization_id,
    null,
    v_rev.cycle_instance_id,
    v_to,
    'strategy_review_release',
    v_final,
    v_actor,
    p_review_id
  );

  return v_final;
end;
$$;

-- Grants
grant execute on function app.resolve_successor_cycle_instance(uuid) to authenticated;
grant execute on function app.validate_strategy_decision_payload(jsonb, jsonb) to authenticated;
grant execute on function app.compute_review_readiness(uuid) to authenticated;
grant execute on function app.get_review_trigger_state(uuid) to authenticated;
grant execute on function app.ensure_strategy_review(uuid) to authenticated;
grant execute on function app.force_review_ready(uuid, text) to authenticated;
grant execute on function app.record_strategy_review_announcement(uuid, jsonb) to authenticated;
grant execute on function app.prepare_strategy_review(uuid) to authenticated;
grant execute on function app.save_strategy_review_feedback(uuid, uuid, jsonb) to authenticated;
grant execute on function app.capture_strategy_review_decisions(uuid, jsonb) to authenticated;
grant execute on function app.start_strategy_review_meeting(uuid) to authenticated;
grant execute on function app.apply_strategy_review_decisions(uuid, uuid, uuid) to authenticated;
grant execute on function app.execute_strategy_review_release(uuid) to authenticated;

grant execute on function app.resolve_successor_cycle_instance(uuid) to service_role;
grant execute on function app.validate_strategy_decision_payload(jsonb, jsonb) to service_role;
grant execute on function app.compute_review_readiness(uuid) to service_role;
grant execute on function app.get_review_trigger_state(uuid) to service_role;
grant execute on function app.ensure_strategy_review(uuid) to service_role;
grant execute on function app.force_review_ready(uuid, text) to service_role;
grant execute on function app.record_strategy_review_announcement(uuid, jsonb) to service_role;
grant execute on function app.prepare_strategy_review(uuid) to service_role;
grant execute on function app.save_strategy_review_feedback(uuid, uuid, jsonb) to service_role;
grant execute on function app.capture_strategy_review_decisions(uuid, jsonb) to service_role;
grant execute on function app.start_strategy_review_meeting(uuid) to service_role;
grant execute on function app.apply_strategy_review_decisions(uuid, uuid, uuid) to service_role;
grant execute on function app.execute_strategy_review_release(uuid) to service_role;

-- migrate:down

revoke all on function app.execute_strategy_review_release(uuid) from service_role;
revoke all on function app.apply_strategy_review_decisions(uuid, uuid, uuid) from service_role;
revoke all on function app.start_strategy_review_meeting(uuid) from service_role;
revoke all on function app.capture_strategy_review_decisions(uuid, jsonb) from service_role;
revoke all on function app.save_strategy_review_feedback(uuid, uuid, jsonb) from service_role;
revoke all on function app.prepare_strategy_review(uuid) from service_role;
revoke all on function app.record_strategy_review_announcement(uuid, jsonb) from service_role;
revoke all on function app.force_review_ready(uuid, text) from service_role;
revoke all on function app.ensure_strategy_review(uuid) from service_role;
revoke all on function app.get_review_trigger_state(uuid) from service_role;
revoke all on function app.compute_review_readiness(uuid) from service_role;
revoke all on function app.validate_strategy_decision_payload(jsonb, jsonb) from service_role;
revoke all on function app.resolve_successor_cycle_instance(uuid) from service_role;

revoke all on function app.execute_strategy_review_release(uuid) from authenticated;
revoke all on function app.apply_strategy_review_decisions(uuid, uuid, uuid) from authenticated;
revoke all on function app.start_strategy_review_meeting(uuid) from authenticated;
revoke all on function app.capture_strategy_review_decisions(uuid, jsonb) from authenticated;
revoke all on function app.save_strategy_review_feedback(uuid, uuid, jsonb) from authenticated;
revoke all on function app.prepare_strategy_review(uuid) from authenticated;
revoke all on function app.record_strategy_review_announcement(uuid, jsonb) from authenticated;
revoke all on function app.force_review_ready(uuid, text) from authenticated;
revoke all on function app.ensure_strategy_review(uuid) from authenticated;
revoke all on function app.get_review_trigger_state(uuid) from authenticated;
revoke all on function app.compute_review_readiness(uuid) from authenticated;
revoke all on function app.validate_strategy_decision_payload(jsonb, jsonb) from authenticated;
revoke all on function app.resolve_successor_cycle_instance(uuid) from authenticated;

drop function if exists app.execute_strategy_review_release(uuid);
drop function if exists app.apply_strategy_review_decisions(uuid, uuid, uuid);
drop function if exists app.start_strategy_review_meeting(uuid);
drop function if exists app.capture_strategy_review_decisions(uuid, jsonb);
drop function if exists app.save_strategy_review_feedback(uuid, uuid, jsonb);
drop function if exists app.prepare_strategy_review(uuid);
drop function if exists app.record_strategy_review_announcement(uuid, jsonb);
drop function if exists app.force_review_ready(uuid, text);
drop function if exists app.ensure_strategy_review(uuid);
drop function if exists app.get_review_trigger_state(uuid);
drop function if exists app.compute_review_readiness(uuid);
drop function if exists app.validate_strategy_decision_payload(jsonb, jsonb);
drop function if exists app._remap_uuid_array_from_map(uuid[], jsonb);
drop function if exists app.resolve_successor_cycle_instance(uuid);
drop function if exists app._strategy_review_current_membership(uuid);

drop trigger if exists trg_strategy_review_feedback_updated_at on app.strategy_review_feedback_entries;
drop trigger if exists trg_audit_strategy_review_feedback on app.strategy_review_feedback_entries;
drop trigger if exists trg_strategy_review_feedback_sync on app.strategy_review_feedback_entries;
drop table if exists app.strategy_review_feedback_entries;

drop index if exists idx_cycle_cutover_snapshots_review;
alter table app.cycle_cutover_snapshots drop column if exists review_id;
alter table app.cycle_cutover_snapshots drop constraint if exists cycle_cutover_snapshots_snapshot_type_check;
alter table app.cycle_cutover_snapshots
  add constraint cycle_cutover_snapshots_snapshot_type_check
  check (snapshot_type = 'analysis_carry_forward');

alter table app.objectives drop column if exists strategy_carry_metadata;
alter table app.objectives drop column if exists strategy_carry_source_id;
alter table app.strategic_directions drop column if exists strategy_carry_metadata;
alter table app.strategic_directions drop column if exists strategy_carry_source_id;
alter table app.strategic_challenges drop column if exists strategy_carry_metadata;
alter table app.strategic_challenges drop column if exists strategy_carry_source_id;

drop index if exists okr_reviews_one_strategy_per_instance;
alter table app.okr_reviews drop column if exists announcement_payload;
alter table app.okr_reviews drop column if exists announcement_sent_at;
alter table app.okr_reviews drop column if exists released_at;
alter table app.okr_reviews drop column if exists released_to_cycle_instance_id;
alter table app.okr_reviews drop column if exists override_forced_at;
alter table app.okr_reviews drop column if exists override_forced_by;
alter table app.okr_reviews drop column if exists override_reason;
alter table app.okr_reviews drop column if exists override_forced;
alter table app.okr_reviews drop column if exists readiness_status;
alter table app.okr_reviews drop column if exists release_summary;
alter table app.okr_reviews drop column if exists decision_payload;
alter table app.okr_reviews drop column if exists stakeholder_feedback_payload;
alter table app.okr_reviews drop column if exists pre_read_payload;
alter table app.okr_reviews drop column if exists review_lead_time_days;
alter table app.okr_reviews drop column if exists procedure_status;
alter table app.okr_reviews drop column if exists review_mode;

delete from rbac.role_permissions
where permission_id in (
  select id from rbac.permissions
  where code in (
    'strategy_review.feedback', 'strategy_review.moderate',
    'strategy_review.release', 'strategy_review.force_ready'
  )
);
delete from rbac.permissions
where code in (
  'strategy_review.feedback', 'strategy_review.moderate',
  'strategy_review.release', 'strategy_review.force_ready'
);
