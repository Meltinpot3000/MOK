-- 0039_cycle_cutover_snapshot_and_carry_forward.sql
-- migrate:up


create table if not exists app.cycle_cutover_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cutover_id uuid references app.cycle_cutovers(id) on delete cascade,
  from_cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  to_cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  snapshot_type text not null check (snapshot_type in ('analysis_carry_forward')),
  summary jsonb not null default '{}'::jsonb,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cutover_id, from_cycle_instance_id, to_cycle_instance_id, snapshot_type)
);

create index if not exists idx_cycle_cutover_snapshots_org_created
  on app.cycle_cutover_snapshots (organization_id, created_at desc);

create or replace function app.stable_md5_uuid(p_input text)
returns uuid
language sql
immutable
strict
as $$
  select (
    substr(md5(p_input), 1, 8) || '-' ||
    substr(md5(p_input), 9, 4) || '-' ||
    substr(md5(p_input), 13, 4) || '-' ||
    substr(md5(p_input), 17, 4) || '-' ||
    substr(md5(p_input), 21, 12)
  )::uuid;
$$;

create or replace function app.carry_forward_analysis_cycle_data(
  p_organization_id uuid,
  p_from_cycle_instance_id uuid,
  p_to_cycle_instance_id uuid,
  p_cutover_id uuid default null,
  p_actor_membership_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_from_exists boolean;
  v_to_exists boolean;
  v_to_legacy_id uuid;
  v_entries integer := 0;
  v_links_draft integer := 0;
  v_links integer := 0;
  v_clusters integer := 0;
  v_cluster_members integer := 0;
  v_gap_findings integer := 0;
  v_summary jsonb;
begin
  select exists(
    select 1
    from app.cycle_instances ci
    where ci.id = p_from_cycle_instance_id
      and ci.organization_id = p_organization_id
  ) into v_from_exists;

  select exists(
    select 1
    from app.cycle_instances ci
    where ci.id = p_to_cycle_instance_id
      and ci.organization_id = p_organization_id
  ) into v_to_exists;

  if not v_from_exists or not v_to_exists then
    raise exception 'invalid cycle instance pair for organization';
  end if;

  select legacy_planning_cycle_id
  into v_to_legacy_id
  from app.cycle_instances
  where id = p_to_cycle_instance_id;

  insert into app.analysis_entries (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    analysis_type,
    sub_type,
    title,
    description,
    impact_level,
    uncertainty_level,
    created_by_membership_id,
    created_at,
    updated_at
  )
  select
    app.stable_md5_uuid(format('analysis_entry:%s:%s', ae.id, p_to_cycle_instance_id)),
    ae.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    ae.analysis_type,
    ae.sub_type,
    ae.title,
    ae.description,
    ae.impact_level,
    ae.uncertainty_level,
    ae.created_by_membership_id,
    ae.created_at,
    now()
  from app.analysis_entries ae
  where ae.organization_id = p_organization_id
    and ae.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    analysis_type = excluded.analysis_type,
    sub_type = excluded.sub_type,
    title = excluded.title,
    description = excluded.description,
    impact_level = excluded.impact_level,
    uncertainty_level = excluded.uncertainty_level,
    updated_at = now();
  get diagnostics v_entries = row_count;

  insert into app.analysis_item_link_draft (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    source_analysis_item_id,
    target_analysis_item_id,
    link_type,
    strength,
    confidence,
    comment,
    origin,
    provider,
    model,
    prompt_version,
    status,
    created_by_membership_id,
    reviewed_by_membership_id,
    created_at,
    updated_at,
    reviewed_at,
    metadata
  )
  select
    app.stable_md5_uuid(format('analysis_item_link_draft:%s:%s', d.id, p_to_cycle_instance_id)),
    d.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    app.stable_md5_uuid(format('analysis_entry:%s:%s', d.source_analysis_item_id, p_to_cycle_instance_id)),
    app.stable_md5_uuid(format('analysis_entry:%s:%s', d.target_analysis_item_id, p_to_cycle_instance_id)),
    d.link_type,
    d.strength,
    d.confidence,
    d.comment,
    d.origin,
    d.provider,
    d.model,
    d.prompt_version,
    d.status,
    d.created_by_membership_id,
    d.reviewed_by_membership_id,
    d.created_at,
    now(),
    d.reviewed_at,
    coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
      'carried_forward_from_draft_id',
      d.id::text,
      'carried_forward_from_cycle_instance_id',
      p_from_cycle_instance_id::text
    )
  from app.analysis_item_link_draft d
  where d.organization_id = p_organization_id
    and d.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    link_type = excluded.link_type,
    strength = excluded.strength,
    confidence = excluded.confidence,
    comment = excluded.comment,
    status = excluded.status,
    reviewed_at = excluded.reviewed_at,
    metadata = excluded.metadata,
    updated_at = now();
  get diagnostics v_links_draft = row_count;

  insert into app.analysis_item_link (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    source_analysis_item_id,
    target_analysis_item_id,
    link_type,
    strength,
    confidence,
    comment,
    source_draft_id,
    activated_by_membership_id,
    created_at,
    updated_at,
    metadata
  )
  select
    app.stable_md5_uuid(format('analysis_item_link:%s:%s', l.id, p_to_cycle_instance_id)),
    l.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    app.stable_md5_uuid(format('analysis_entry:%s:%s', l.source_analysis_item_id, p_to_cycle_instance_id)),
    app.stable_md5_uuid(format('analysis_entry:%s:%s', l.target_analysis_item_id, p_to_cycle_instance_id)),
    l.link_type,
    l.strength,
    l.confidence,
    l.comment,
    case
      when l.source_draft_id is null then null
      else app.stable_md5_uuid(format('analysis_item_link_draft:%s:%s', l.source_draft_id, p_to_cycle_instance_id))
    end,
    l.activated_by_membership_id,
    l.created_at,
    now(),
    coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
      'carried_forward_from_link_id',
      l.id::text,
      'carried_forward_from_cycle_instance_id',
      p_from_cycle_instance_id::text
    )
  from app.analysis_item_link l
  where l.organization_id = p_organization_id
    and l.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    link_type = excluded.link_type,
    strength = excluded.strength,
    confidence = excluded.confidence,
    comment = excluded.comment,
    source_draft_id = excluded.source_draft_id,
    metadata = excluded.metadata,
    updated_at = now();
  get diagnostics v_links = row_count;

  insert into app.analysis_clusters (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    label,
    summary,
    cluster_score,
    method,
    created_by_membership_id,
    created_at,
    updated_at,
    metadata
  )
  select
    app.stable_md5_uuid(format('analysis_cluster:%s:%s', c.id, p_to_cycle_instance_id)),
    c.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    c.label,
    c.summary,
    c.cluster_score,
    c.method,
    c.created_by_membership_id,
    c.created_at,
    now(),
    coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'carried_forward_from_cluster_id',
      c.id::text,
      'carried_forward_from_cycle_instance_id',
      p_from_cycle_instance_id::text
    )
  from app.analysis_clusters c
  where c.organization_id = p_organization_id
    and c.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    label = excluded.label,
    summary = excluded.summary,
    cluster_score = excluded.cluster_score,
    method = excluded.method,
    metadata = excluded.metadata,
    updated_at = now();
  get diagnostics v_clusters = row_count;

  insert into app.analysis_cluster_members (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    cluster_id,
    entry_id,
    membership_strength,
    created_at
  )
  select
    app.stable_md5_uuid(format('analysis_cluster_member:%s:%s', m.id, p_to_cycle_instance_id)),
    m.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    app.stable_md5_uuid(format('analysis_cluster:%s:%s', m.cluster_id, p_to_cycle_instance_id)),
    app.stable_md5_uuid(format('analysis_entry:%s:%s', m.entry_id, p_to_cycle_instance_id)),
    m.membership_strength,
    m.created_at
  from app.analysis_cluster_members m
  where m.organization_id = p_organization_id
    and m.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set membership_strength = excluded.membership_strength;
  get diagnostics v_cluster_members = row_count;

  insert into app.analysis_gap_findings (
    id,
    organization_id,
    planning_cycle_id,
    cycle_instance_id,
    dimension,
    gap_type,
    severity,
    recommendation,
    status,
    related_cluster_id,
    created_by_membership_id,
    created_at,
    updated_at,
    metadata
  )
  select
    app.stable_md5_uuid(format('analysis_gap_finding:%s:%s', g.id, p_to_cycle_instance_id)),
    g.organization_id,
    coalesce(v_to_legacy_id, p_to_cycle_instance_id),
    p_to_cycle_instance_id,
    g.dimension,
    g.gap_type,
    g.severity,
    g.recommendation,
    g.status,
    case
      when g.related_cluster_id is null then null
      else app.stable_md5_uuid(format('analysis_cluster:%s:%s', g.related_cluster_id, p_to_cycle_instance_id))
    end,
    g.created_by_membership_id,
    g.created_at,
    now(),
    coalesce(g.metadata, '{}'::jsonb) || jsonb_build_object(
      'carried_forward_from_gap_finding_id',
      g.id::text,
      'carried_forward_from_cycle_instance_id',
      p_from_cycle_instance_id::text
    )
  from app.analysis_gap_findings g
  where g.organization_id = p_organization_id
    and g.cycle_instance_id = p_from_cycle_instance_id
  on conflict (id) do update
  set
    dimension = excluded.dimension,
    gap_type = excluded.gap_type,
    severity = excluded.severity,
    recommendation = excluded.recommendation,
    status = excluded.status,
    related_cluster_id = excluded.related_cluster_id,
    metadata = excluded.metadata,
    updated_at = now();
  get diagnostics v_gap_findings = row_count;

  v_summary := jsonb_build_object(
    'from_cycle_instance_id', p_from_cycle_instance_id,
    'to_cycle_instance_id', p_to_cycle_instance_id,
    'analysis_entries', v_entries,
    'analysis_item_link_draft', v_links_draft,
    'analysis_item_link', v_links,
    'analysis_clusters', v_clusters,
    'analysis_cluster_members', v_cluster_members,
    'analysis_gap_findings', v_gap_findings
  );

  insert into app.cycle_cutover_snapshots (
    organization_id,
    cutover_id,
    from_cycle_instance_id,
    to_cycle_instance_id,
    snapshot_type,
    summary,
    created_by_membership_id
  )
  values (
    p_organization_id,
    p_cutover_id,
    p_from_cycle_instance_id,
    p_to_cycle_instance_id,
    'analysis_carry_forward',
    v_summary,
    p_actor_membership_id
  )
  on conflict (cutover_id, from_cycle_instance_id, to_cycle_instance_id, snapshot_type) do update
  set
    summary = excluded.summary,
    created_by_membership_id = excluded.created_by_membership_id,
    created_at = now();

  return v_summary;
end;
$$;

create or replace function app.execute_due_cycle_cutovers()
returns integer
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_count integer := 0;
  rec record;
  v_horizon integer;
  v_from_instance_id uuid;
  v_to_instance_id uuid;
begin
  for rec in
    select
      c.id,
      c.organization_id,
      c.from_cycle_scheme_id,
      c.to_cycle_scheme_id,
      c.cutover_at,
      c.created_by_membership_id,
      s.top_level_duration_months
    from app.cycle_cutovers c
    join app.cycle_schemes s on s.id = c.to_cycle_scheme_id
    where c.status = 'scheduled'
      and c.cutover_at <= now()
    order by c.cutover_at asc
  loop
    begin
      update app.cycle_schemes
      set is_active = false
      where organization_id = rec.organization_id
        and id = rec.from_cycle_scheme_id;

      update app.cycle_schemes
      set is_active = true
      where organization_id = rec.organization_id
        and id = rec.to_cycle_scheme_id;

      v_horizon := greatest(1, rec.top_level_duration_months * 2);
      perform app.regenerate_cycle_instances(rec.to_cycle_scheme_id, v_horizon, rec.created_by_membership_id);

      select ci.id
      into v_from_instance_id
      from app.cycle_instances ci
      where ci.organization_id = rec.organization_id
        and ci.cycle_scheme_id = rec.from_cycle_scheme_id
        and ci.starts_on <= rec.cutover_at::date
        and ci.ends_on > rec.cutover_at::date
      order by ci.level_no desc, ci.starts_on desc
      limit 1;

      select ci.id
      into v_to_instance_id
      from app.cycle_instances ci
      where ci.organization_id = rec.organization_id
        and ci.cycle_scheme_id = rec.to_cycle_scheme_id
        and ci.starts_on <= rec.cutover_at::date
        and ci.ends_on > rec.cutover_at::date
      order by ci.level_no desc, ci.starts_on desc
      limit 1;

      if v_from_instance_id is not null and v_to_instance_id is not null then
        perform app.carry_forward_analysis_cycle_data(
          rec.organization_id,
          v_from_instance_id,
          v_to_instance_id,
          rec.id,
          rec.created_by_membership_id
        );
      end if;

      update app.cycle_cutovers
      set status = 'executed',
          executed_at = now()
      where id = rec.id;

      v_count := v_count + 1;
    exception when others then
      update app.cycle_cutovers
      set status = 'failed',
          notes = coalesce(notes, '') || case when notes is null or notes = '' then '' else E'\n' end || sqlerrm
      where id = rec.id;
    end;
  end loop;

  return v_count;
end;
$$;

grant select, insert, update, delete on app.cycle_cutover_snapshots to authenticated;
grant select on app.cycle_cutover_snapshots to anon;

grant execute on function app.stable_md5_uuid(text) to authenticated, anon;
grant execute on function app.carry_forward_analysis_cycle_data(uuid, uuid, uuid, uuid, uuid) to authenticated;

alter table app.cycle_cutover_snapshots enable row level security;

drop policy if exists cycle_cutover_snapshots_select on app.cycle_cutover_snapshots;
create policy cycle_cutover_snapshots_select on app.cycle_cutover_snapshots
for select using (app.has_permission(organization_id, 'cycle_scheme.read'));

drop policy if exists cycle_cutover_snapshots_modify on app.cycle_cutover_snapshots;
create policy cycle_cutover_snapshots_modify on app.cycle_cutover_snapshots
for all using (app.has_permission(organization_id, 'cycle_scheme.write'))
with check (app.has_permission(organization_id, 'cycle_scheme.write'));


-- migrate:down
-- irreversible migration (no-op)
