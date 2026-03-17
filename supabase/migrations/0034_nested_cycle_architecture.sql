begin;

create table if not exists app.cycle_schemes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  is_active boolean not null default false,
  starts_on date not null,
  top_level_duration_months integer not null check (top_level_duration_months between 1 and 600),
  max_levels integer not null default 3 check (max_levels between 1 and 3),
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create unique index if not exists ux_cycle_schemes_active_per_org
  on app.cycle_schemes(organization_id)
  where is_active = true;

create table if not exists app.cycle_scheme_levels (
  id uuid primary key default gen_random_uuid(),
  cycle_scheme_id uuid not null references app.cycle_schemes(id) on delete cascade,
  level_no integer not null check (level_no between 1 and 3),
  label text not null,
  duration_months integer not null check (duration_months > 0),
  divisor_of_parent integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_scheme_id, level_no),
  check (
    (level_no = 1 and divisor_of_parent is null)
    or (level_no > 1 and divisor_of_parent is not null and divisor_of_parent > 0)
  )
);

create table if not exists app.cycle_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_scheme_id uuid not null references app.cycle_schemes(id) on delete cascade,
  level_no integer not null check (level_no between 1 and 3),
  parent_instance_id uuid references app.cycle_instances(id) on delete cascade,
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  status text not null default 'planned' check (status in ('planned', 'active', 'closed', 'locked')),
  code text not null,
  name text not null,
  sequence_no integer not null default 1 check (sequence_no > 0),
  legacy_planning_cycle_id uuid references app.planning_cycles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_scheme_id, level_no, sequence_no),
  unique (organization_id, level_no, starts_on, ends_on),
  unique (legacy_planning_cycle_id)
);

create index if not exists idx_cycle_instances_org_level_dates
  on app.cycle_instances(organization_id, level_no, starts_on, ends_on);

create index if not exists idx_cycle_instances_parent
  on app.cycle_instances(parent_instance_id);

create table if not exists app.cycle_instance_lock (
  id uuid primary key default gen_random_uuid(),
  cycle_instance_id uuid not null unique references app.cycle_instances(id) on delete cascade,
  locked_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  reason text,
  locked_at timestamptz not null default now()
);

create or replace function app.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_cycle_schemes_updated_at on app.cycle_schemes;
create trigger trg_touch_cycle_schemes_updated_at
before update on app.cycle_schemes
for each row execute function app.tg_touch_updated_at();

drop trigger if exists trg_touch_cycle_scheme_levels_updated_at on app.cycle_scheme_levels;
create trigger trg_touch_cycle_scheme_levels_updated_at
before update on app.cycle_scheme_levels
for each row execute function app.tg_touch_updated_at();

drop trigger if exists trg_touch_cycle_instances_updated_at on app.cycle_instances;
create trigger trg_touch_cycle_instances_updated_at
before update on app.cycle_instances
for each row execute function app.tg_touch_updated_at();

create or replace function app.validate_cycle_scheme_levels(p_cycle_scheme_id uuid)
returns void
language plpgsql
as $$
declare
  v_top integer;
  v_level1 integer;
  v_level2 integer;
  v_level3 integer;
begin
  select top_level_duration_months into v_top
  from app.cycle_schemes
  where id = p_cycle_scheme_id;

  if v_top is null then
    raise exception 'Cycle scheme not found: %', p_cycle_scheme_id;
  end if;

  select duration_months into v_level1
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 1;

  if v_level1 is null then
    raise exception 'Cycle scheme % must define level 1', p_cycle_scheme_id;
  end if;

  if v_top % v_level1 <> 0 then
    raise exception 'Level 1 duration must divide top level duration (% %% % != 0)', v_top, v_level1;
  end if;

  select duration_months into v_level2
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 2;

  if v_level2 is not null and v_level1 % v_level2 <> 0 then
    raise exception 'Level 2 duration must divide level 1 duration (% %% % != 0)', v_level1, v_level2;
  end if;

  select duration_months into v_level3
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 3;

  if v_level3 is not null then
    if v_level2 is null then
      raise exception 'Level 3 requires level 2';
    end if;
    if v_level2 % v_level3 <> 0 then
      raise exception 'Level 3 duration must divide level 2 duration (% %% % != 0)', v_level2, v_level3;
    end if;
  end if;
end;
$$;

create or replace function app.tg_validate_cycle_scheme_levels()
returns trigger
language plpgsql
as $$
declare
  v_cycle_scheme_id uuid;
begin
  v_cycle_scheme_id := coalesce(new.cycle_scheme_id, old.cycle_scheme_id);
  perform app.validate_cycle_scheme_levels(v_cycle_scheme_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_validate_cycle_scheme_levels on app.cycle_scheme_levels;
create constraint trigger trg_validate_cycle_scheme_levels
after insert or update or delete on app.cycle_scheme_levels
deferrable initially deferred
for each row execute function app.tg_validate_cycle_scheme_levels();

create or replace function app.regenerate_cycle_instances(
  p_cycle_scheme_id uuid,
  p_horizon_months integer default null,
  p_actor_membership_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_scheme app.cycle_schemes%rowtype;
  v_horizon integer;
  v_top_months integer;
  v_level2_months integer;
  v_level3_months integer;
  v_top_count integer;
  v_top_idx integer;
  v_level2_count integer;
  v_level2_idx integer;
  v_level3_count integer;
  v_level3_idx integer;
  v_l1_start date;
  v_l1_end date;
  v_l2_start date;
  v_l2_end date;
  v_l3_start date;
  v_l3_end date;
  v_parent_l1 uuid;
  v_parent_l2 uuid;
  v_created integer := 0;
begin
  select * into v_scheme
  from app.cycle_schemes
  where id = p_cycle_scheme_id;

  if v_scheme.id is null then
    raise exception 'cycle scheme not found: %', p_cycle_scheme_id;
  end if;

  perform app.validate_cycle_scheme_levels(p_cycle_scheme_id);

  select duration_months into v_top_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 1;

  select duration_months into v_level2_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 2;

  select duration_months into v_level3_months
  from app.cycle_scheme_levels
  where cycle_scheme_id = p_cycle_scheme_id and level_no = 3;

  v_horizon := coalesce(p_horizon_months, greatest(v_top_months, 12));
  v_top_count := greatest(1, ceil(v_horizon::numeric / v_top_months::numeric)::integer);

  delete from app.cycle_instances
  where cycle_scheme_id = p_cycle_scheme_id
    and legacy_planning_cycle_id is null;

  for v_top_idx in 0..(v_top_count - 1) loop
    v_l1_start := (v_scheme.starts_on + make_interval(months => v_top_idx * v_top_months))::date;
    v_l1_end := (v_l1_start + make_interval(months => v_top_months))::date;

    insert into app.cycle_instances (
      organization_id, cycle_scheme_id, level_no, parent_instance_id,
      starts_on, ends_on, status, code, name, sequence_no
    )
    values (
      v_scheme.organization_id,
      p_cycle_scheme_id,
      1,
      null,
      v_l1_start,
      v_l1_end,
      'planned',
      format('%s-L1-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0')),
      format('%s / Ebene 1 #%s', v_scheme.name, v_top_idx + 1),
      v_top_idx + 1
    )
    returning id into v_parent_l1;

    v_created := v_created + 1;

    if v_level2_months is not null then
      v_level2_count := v_top_months / v_level2_months;
      for v_level2_idx in 0..(v_level2_count - 1) loop
        v_l2_start := (v_l1_start + make_interval(months => v_level2_idx * v_level2_months))::date;
        v_l2_end := (v_l2_start + make_interval(months => v_level2_months))::date;

        insert into app.cycle_instances (
          organization_id, cycle_scheme_id, level_no, parent_instance_id,
          starts_on, ends_on, status, code, name, sequence_no
        )
        values (
          v_scheme.organization_id,
          p_cycle_scheme_id,
          2,
          v_parent_l1,
          v_l2_start,
          v_l2_end,
          'planned',
          format('%s-L2-%s-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0'), lpad((v_level2_idx + 1)::text, 3, '0')),
          format('%s / Ebene 2 #%s.%s', v_scheme.name, v_top_idx + 1, v_level2_idx + 1),
          (v_top_idx * v_level2_count) + v_level2_idx + 1
        )
        returning id into v_parent_l2;

        v_created := v_created + 1;

        if v_level3_months is not null then
          v_level3_count := v_level2_months / v_level3_months;
          for v_level3_idx in 0..(v_level3_count - 1) loop
            v_l3_start := (v_l2_start + make_interval(months => v_level3_idx * v_level3_months))::date;
            v_l3_end := (v_l3_start + make_interval(months => v_level3_months))::date;

            insert into app.cycle_instances (
              organization_id, cycle_scheme_id, level_no, parent_instance_id,
              starts_on, ends_on, status, code, name, sequence_no
            )
            values (
              v_scheme.organization_id,
              p_cycle_scheme_id,
              3,
              v_parent_l2,
              v_l3_start,
              v_l3_end,
              'planned',
              format('%s-L3-%s-%s-%s', v_scheme.code, lpad((v_top_idx + 1)::text, 3, '0'), lpad((v_level2_idx + 1)::text, 3, '0'), lpad((v_level3_idx + 1)::text, 3, '0')),
              format('%s / Ebene 3 #%s.%s.%s', v_scheme.name, v_top_idx + 1, v_level2_idx + 1, v_level3_idx + 1),
              ((v_top_idx * v_level2_count * v_level3_count) + (v_level2_idx * v_level3_count) + v_level3_idx + 1)
            );

            v_created := v_created + 1;
          end loop;
        end if;
      end loop;
    end if;
  end loop;

  return v_created;
end;
$$;

create or replace function app.resolve_active_cycle_instance(
  p_organization_id uuid,
  p_level_no integer default null
)
returns uuid
language sql
stable
as $$
  with now_date as (
    select now()::date as d
  )
  select ci.id
  from app.cycle_instances ci
  join app.cycle_schemes cs on cs.id = ci.cycle_scheme_id
  join now_date n on true
  where ci.organization_id = p_organization_id
    and cs.is_active = true
    and (p_level_no is null or ci.level_no = p_level_no)
    and ci.starts_on <= n.d
    and ci.ends_on > n.d
  order by ci.level_no desc, ci.starts_on desc
  limit 1;
$$;

-- Bootstrap one active scheme per organization from legacy planning cycles.
insert into app.cycle_schemes (
  organization_id,
  name,
  code,
  is_active,
  starts_on,
  top_level_duration_months
)
select
  p.organization_id,
  'Legacy Migration Scheme',
  'LEGACY',
  true,
  min(p.start_date),
  greatest(
    1,
    round(avg(greatest(1, ((extract(epoch from (p.end_date::timestamp - p.start_date::timestamp)) / 86400) / 30.0)))::numeric)::integer
  )
from app.planning_cycles p
group by p.organization_id
on conflict (organization_id, code) do update
set is_active = excluded.is_active;

insert into app.cycle_scheme_levels (
  cycle_scheme_id,
  level_no,
  label,
  duration_months,
  divisor_of_parent
)
select
  cs.id,
  1,
  'Legacy Planning Cycle',
  cs.top_level_duration_months,
  null
from app.cycle_schemes cs
left join app.cycle_scheme_levels csl
  on csl.cycle_scheme_id = cs.id and csl.level_no = 1
where cs.code = 'LEGACY'
  and csl.id is null;

insert into app.cycle_instances (
  organization_id,
  cycle_scheme_id,
  level_no,
  parent_instance_id,
  starts_on,
  ends_on,
  status,
  code,
  name,
  sequence_no,
  legacy_planning_cycle_id
)
select
  p.organization_id,
  cs.id,
  1,
  null,
  p.start_date,
  p.end_date,
  case
    when p.status = 'active' then 'active'
    when p.status = 'completed' then 'closed'
    else 'planned'
  end,
  p.code,
  p.name,
  row_number() over (partition by p.organization_id order by p.start_date),
  p.id
from app.planning_cycles p
join app.cycle_schemes cs
  on cs.organization_id = p.organization_id
 and cs.code = 'LEGACY'
left join app.cycle_instances ci
  on ci.legacy_planning_cycle_id = p.id
where ci.id is null;

do $$
declare
  rec record;
begin
  for rec in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'app'
      and c.table_name not in ('planning_cycles', 'cycle_instances', 'cycle_schemes', 'cycle_scheme_levels', 'cycle_instance_lock')
      and c.column_name in ('planning_cycle_id', 'cycle_id')
  loop
    execute format(
      'alter table %I.%I add column if not exists cycle_instance_id uuid references app.cycle_instances(id) on delete cascade',
      rec.table_schema,
      rec.table_name
    );
  end loop;
end
$$;

do $$
declare
  rec record;
begin
  for rec in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'app'
      and c.column_name in ('planning_cycle_id', 'cycle_id')
      and c.is_nullable = 'NO'
      and c.table_name not in ('planning_cycles', 'cycle_instances')
  loop
    execute format(
      'alter table %I.%I alter column %I drop not null',
      rec.table_schema,
      rec.table_name,
      rec.column_name
    );
  end loop;
end
$$;

do $$
declare
  rec record;
begin
  for rec in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'app'
      and c.column_name = 'cycle_instance_id'
      and c.table_name not in ('cycle_instances')
      and exists (
        select 1
        from information_schema.columns c_org
        where c_org.table_schema = c.table_schema
          and c_org.table_name = c.table_name
          and c_org.column_name = 'organization_id'
      )
    group by c.table_schema, c.table_name
  loop
    begin
      execute format(
        'alter table %I.%I alter column cycle_instance_id set not null',
        rec.table_schema,
        rec.table_name
      );
    exception when others then
      -- Some tables may still contain nulls during transitional backfill.
      null;
    end;
  end loop;
end
$$;

create or replace function app.sync_legacy_cycle_columns()
returns trigger
language plpgsql
as $$
declare
  payload jsonb := to_jsonb(new);
  v_cycle_instance_id uuid := nullif(payload ->> 'cycle_instance_id', '')::uuid;
  v_planning_cycle_id uuid := nullif(payload ->> 'planning_cycle_id', '')::uuid;
  v_cycle_id uuid := nullif(payload ->> 'cycle_id', '')::uuid;
  v_legacy_cycle_id uuid;
begin
  if v_cycle_instance_id is null and payload ? 'planning_cycle_id' and v_planning_cycle_id is not null then
    select id into v_cycle_instance_id
    from app.cycle_instances
    where legacy_planning_cycle_id = v_planning_cycle_id
    limit 1;

    if v_cycle_instance_id is null then
      select id into v_cycle_instance_id
      from app.cycle_instances
      where id = v_planning_cycle_id
      limit 1;
    end if;
  end if;

  if v_cycle_instance_id is null and payload ? 'cycle_id' and v_cycle_id is not null then
    select id into v_cycle_instance_id
    from app.cycle_instances
    where legacy_planning_cycle_id = v_cycle_id
    limit 1;

    if v_cycle_instance_id is null then
      select id into v_cycle_instance_id
      from app.cycle_instances
      where id = v_cycle_id
      limit 1;
    end if;
  end if;

  if payload ? 'planning_cycle_id' and v_cycle_instance_id is not null then
    select coalesce(legacy_planning_cycle_id, id) into v_legacy_cycle_id
    from app.cycle_instances
    where id = v_cycle_instance_id
    limit 1;

    new := jsonb_populate_record(new, jsonb_build_object('planning_cycle_id', v_legacy_cycle_id));
  end if;

  if payload ? 'cycle_id' and v_cycle_instance_id is not null then
    select coalesce(legacy_planning_cycle_id, id) into v_legacy_cycle_id
    from app.cycle_instances
    where id = v_cycle_instance_id
    limit 1;

    new := jsonb_populate_record(new, jsonb_build_object('cycle_id', v_legacy_cycle_id));
  end if;

  if payload ? 'cycle_instance_id' then
    new := jsonb_populate_record(new, jsonb_build_object('cycle_instance_id', v_cycle_instance_id));
  end if;

  return new;
end;
$$;

do $$
declare
  rec record;
begin
  for rec in
    select con.conname as constraint_name,
           ns.nspname as schema_name,
           cls.relname as table_name
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where con.contype = 'f'
      and ns.nspname = 'app'
      and con.confrelid = 'app.planning_cycles'::regclass
      and cls.relname <> 'planning_cycles'
  loop
    execute format(
      'alter table %I.%I drop constraint if exists %I',
      rec.schema_name,
      rec.table_name,
      rec.constraint_name
    );
  end loop;
end
$$;

do $$
declare
  rec record;
begin
  for rec in
    select distinct c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'app'
      and c.table_name not in ('planning_cycles', 'cycle_instances', 'cycle_schemes', 'cycle_scheme_levels', 'cycle_instance_lock')
      and c.table_name in (
        select c2.table_name
        from information_schema.columns c2
        join information_schema.tables t2
          on t2.table_schema = c2.table_schema
         and t2.table_name = c2.table_name
         and t2.table_type = 'BASE TABLE'
        where c2.table_schema = 'app' and c2.column_name = 'cycle_instance_id'
      )
      and c.column_name in ('planning_cycle_id', 'cycle_id')
  loop
    execute format('drop trigger if exists trg_sync_cycles_%I on %I.%I', rec.table_name, rec.table_schema, rec.table_name);
    execute format(
      'create trigger trg_sync_cycles_%I before insert or update on %I.%I
       for each row execute function app.sync_legacy_cycle_columns()',
      rec.table_name,
      rec.table_schema,
      rec.table_name
    );
  end loop;
end
$$;

do $$
declare
  rec record;
begin
  for rec in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'app'
      and c.column_name = 'planning_cycle_id'
      and c.table_name not in ('planning_cycles', 'cycle_instances')
    group by c.table_schema, c.table_name
  loop
    execute format(
      'update %I.%I t
          set cycle_instance_id = ci.id
         from app.cycle_instances ci
        where t.planning_cycle_id = ci.legacy_planning_cycle_id
          and t.cycle_instance_id is null',
      rec.table_schema,
      rec.table_name
    );
  end loop;
end
$$;

do $$
declare
  rec record;
begin
  for rec in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'app'
      and c.column_name = 'cycle_id'
      and c.table_name not in ('planning_cycles', 'cycle_instances')
    group by c.table_schema, c.table_name
  loop
    execute format(
      'update %I.%I t
          set cycle_instance_id = ci.id
         from app.cycle_instances ci
        where t.cycle_id = ci.legacy_planning_cycle_id
          and t.cycle_instance_id is null',
      rec.table_schema,
      rec.table_name
    );
  end loop;
end
$$;

do $$
declare
  rec record;
begin
  for rec in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'app'
      and c.column_name = 'cycle_instance_id'
      and c.table_name not in ('cycle_instances')
      and exists (
        select 1
        from information_schema.columns c_org
        where c_org.table_schema = c.table_schema
          and c_org.table_name = c.table_name
          and c_org.column_name = 'organization_id'
      )
    group by c.table_schema, c.table_name
  loop
    execute format(
      'create index if not exists %I on %I.%I (organization_id, cycle_instance_id)',
      'idx_' || rec.table_name || '_org_cycle_instance',
      rec.table_schema,
      rec.table_name
    );
  end loop;
end
$$;

create or replace function app.generate_cycle_instances_for_scheme(
  p_cycle_scheme_id uuid,
  p_horizon_months integer default 36,
  p_actor_membership_id uuid default null
)
returns integer
language sql
security definer
set search_path = app, public
as $$
  select app.regenerate_cycle_instances(p_cycle_scheme_id, p_horizon_months, p_actor_membership_id);
$$;

drop function if exists public.clone_planning_cycle_full_snapshot(uuid, uuid, text, text, date, date, uuid);

commit;
