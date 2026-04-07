-- 011_seed_dashboard_demo_progress.sql
-- Demo: Fortschrittsdaten fuer Dashboards + mehrere Mitarbeiter (Rollen/Ebenen).
-- Voraussetzung: Tenant cabtecgroup (wie uebrige Seeds). Idempotent.
-- Login Demo-Passwort fuer neue User: TempDemo!2026
-- migrate:up

create extension if not exists pgcrypto;

do $$
declare
  v_org_id uuid;
  v_ci uuid;
  v_pc uuid;
  v_admin uuid;
  v_okr uuid;
  v_prog uuid;
  v_uid uuid;
  v_mid uuid;
  v_rid uuid;
  v_mem_exec uuid;
  v_mem_dept uuid;
  v_mem_team uuid;
  u record;
begin
  select id into v_org_id from app.organizations where slug = 'cabtecgroup' limit 1;
  if v_org_id is null then
    raise notice '011_seed: cabtecgroup nicht gefunden — Seed uebersprungen.';
    return;
  end if;

  select id into v_admin
  from app.organization_memberships
  where organization_id = v_org_id and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

  select ci.id, ci.legacy_planning_cycle_id
  into v_ci, v_pc
  from app.cycle_instances ci
  where ci.organization_id = v_org_id
  order by (ci.status = 'active') desc, ci.level_no desc, ci.starts_on desc
  limit 1;

  if v_pc is null then
    select id into v_pc
    from app.planning_cycles
    where organization_id = v_org_id
    order by start_date desc nulls last
    limit 1;
  end if;

  v_mem_exec := null;
  v_mem_dept := null;
  v_mem_team := null;

  for u in
    select * from (values
      ('demo.executive@cabtecgroup.demo'::text, 'executive'::text, 1::int, 'Geschaeftsfuehrung'::text, 'Alex Brenner'::text),
      ('demo.fachbereich@cabtecgroup.demo'::text, 'department_lead'::text, 2::int, 'Leitung Operations'::text, 'Samira Vogel'::text),
      ('demo.team@cabtecgroup.demo'::text, 'team_member'::text, 3::int, 'Senior Projektleitung'::text, 'Jonas Eicher'::text)
    ) as t(email, role_code, hl, job_title, display_name)
  loop
    v_uid := null;
    v_mid := null;
    v_rid := null;

    select id into v_uid from auth.users where lower(email) = lower(u.email) limit 1;
    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
      )
      values (
        v_uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        lower(u.email),
        crypt('TempDemo!2026', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', u.display_name),
        false,
        false
      );
      insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
      values (
        gen_random_uuid(),
        v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', lower(u.email)),
        'email',
        v_uid::text,
        now(),
        now()
      );
    end if;

    insert into app.organization_memberships (
      organization_id, user_id, status, hierarchy_level, title, display_name
    )
    values (
      v_org_id, v_uid, 'active',
      u.hl, u.job_title, u.display_name
    )
    on conflict (organization_id, user_id) do update
    set status = excluded.status,
        hierarchy_level = excluded.hierarchy_level,
        title = excluded.title,
        display_name = excluded.display_name
    returning id into v_mid;

    if v_mid is null then
      select id into v_mid
      from app.organization_memberships
      where organization_id = v_org_id and user_id = v_uid
      limit 1;
    end if;

    select id into v_rid from rbac.roles where organization_id = v_org_id and code = u.role_code limit 1;
    if v_rid is not null and v_mid is not null then
      insert into rbac.member_roles (membership_id, role_id)
      values (v_mid, v_rid)
      on conflict (membership_id, role_id) do nothing;
    end if;

    if u.role_code = 'executive' then
      v_mem_exec := v_mid;
    elsif u.role_code = 'department_lead' then
      v_mem_dept := v_mid;
    elsif u.role_code = 'team_member' then
      v_mem_team := v_mid;
    end if;
  end loop;

  if v_ci is null then
    raise notice '011_seed: keine cycle_instances — nur Demo-User angelegt.';
    return;
  end if;

  if v_admin is null then
    raise notice '011_seed: keine Admin-Membership — Fortschritt uebersprungen.';
    return;
  end if;

  select id into v_prog
  from app.strategy_programs
  where organization_id = v_org_id
    and cycle_instance_id = v_ci
  limit 1;

  if v_prog is null then
    insert into app.strategy_programs (
      organization_id,
      planning_cycle_id,
      cycle_instance_id,
      strategic_direction_id,
      title,
      description,
      status,
      owner_membership_id,
      created_by_membership_id,
      program_origin
    )
    select
      v_org_id,
      v_pc,
      v_ci,
      (select sd.id
       from app.strategic_directions sd
       where sd.organization_id = v_org_id
         and sd.cycle_instance_id = v_ci
       order by sd.updated_at desc nulls last
       limit 1),
      'Demo-Programm (Auto-Seed)',
      'Automatisch angelegt, um Initiativen und Review-Fortschritt zu demonstrieren.',
      'active',
      v_admin,
      v_admin,
      'manual'
    returning id into v_prog;
  end if;

  select okr_cycle_id into v_okr
  from app.okr_objectives
  where organization_id = v_org_id
    and cycle_instance_id = v_ci
    and okr_cycle_id is not null
  limit 1;

  if v_okr is null then
    select id into v_okr
    from app.okr_cycles
    where organization_id = v_org_id
    order by start_date desc
    limit 1;
  end if;

  delete from app.okr_updates u
  where u.organization_id = v_org_id
    and u.comment = 'auto-seed-dashboard-demo';

  delete from app.initiative_key_result_links l
  using app.initiatives i
  where l.initiative_id = i.id
    and i.organization_id = v_org_id
    and i.title like '[Auto-Seed] %';

  delete from app.initiatives
  where organization_id = v_org_id
    and title like '[Auto-Seed] %';

  update app.key_results kr
  set
    current_value = case coalesce(kr.metric_type, 'numeric')
      when 'boolean' then
        case when abs(hashtext(kr.id::text)) % 3 = 0 then 1::numeric else 0::numeric end
      when 'percent' then
        round((28 + (abs(hashtext(kr.id::text)) % 55))::numeric, 2)
      else
        coalesce(kr.start_value, 0)
        + (coalesce(kr.target_value, 100) - coalesce(kr.start_value, 0))
          * ((12 + (abs(hashtext(kr.id::text)) % 73))::numeric / 100.0)
    end,
    status = case
      when kr.status not in ('active', 'draft') then kr.status
      when abs(hashtext(kr.id::text)) % 9 = 0 then 'at_risk'
      else 'active'
    end,
    owner_membership_id = case abs(hashtext(kr.id::text)) % 3
      when 0 then coalesce(v_mem_exec, v_admin)
      when 1 then coalesce(v_mem_dept, v_admin)
      else coalesce(v_mem_team, v_admin)
    end,
    updated_at = now()
  from app.okr_objectives o
  where kr.okr_objective_id = o.id
    and o.organization_id = v_org_id
    and o.cycle_instance_id = v_ci;

  update app.okr_objectives o
  set
    progress_percent = round((22 + abs(hashtext(o.id::text)) % 58)::numeric, 2),
    status = case
      when o.status not in ('active', 'draft') then o.status
      when abs(hashtext(o.id::text)) % 8 = 0 then 'at_risk'
      else o.status
    end,
    updated_at = now()
  where o.organization_id = v_org_id
    and o.cycle_instance_id = v_ci
    and not exists (select 1 from app.key_results k where k.okr_objective_id = o.id);

  with calc as (
    select
      o.id as objective_id,
      round(avg(
        least(
          100::numeric,
          greatest(
            0::numeric,
            case coalesce(kr.metric_type, 'numeric')
              when 'boolean' then case when coalesce(kr.current_value, 0) >= 1 then 100::numeric else 0::numeric end
              when 'percent' then least(100::numeric, greatest(0::numeric, coalesce(kr.current_value, 0)))
              else
                case
                  when kr.target_value is null or kr.start_value is null then 0::numeric
                  when kr.target_value = kr.start_value then 100::numeric
                  else
                    (coalesce(kr.current_value, kr.start_value) - kr.start_value)
                    / nullif(kr.target_value - kr.start_value, 0) * 100
                end
            end
          )
        )
      ), 2) as pct
    from app.key_results kr
    join app.okr_objectives o on o.id = kr.okr_objective_id
    where o.organization_id = v_org_id
      and o.cycle_instance_id = v_ci
    group by o.id
  )
  update app.okr_objectives o
  set
    progress_percent = calc.pct,
    updated_at = now()
  from calc
  where o.id = calc.objective_id;

  insert into app.okr_updates (
    organization_id,
    planning_cycle_id,
    okr_cycle_id,
    key_result_id,
    progress_value,
    confidence_level,
    comment,
    created_by_membership_id,
    cycle_instance_id,
    created_at
  )
  select
    v_org_id,
    v_pc,
    coalesce(o.okr_cycle_id, v_okr),
    kr.id,
    x.pv,
    (6 + abs(hashtext(kr.id::text || x.seq::text)) % 4)::smallint,
    'auto-seed-dashboard-demo',
    v_admin,
    v_ci,
    now() - x.ago
  from app.key_results kr
  join app.okr_objectives o on o.id = kr.okr_objective_id
  cross join lateral (values
    (1, 22::numeric, interval '40 days'),
    (2, 48::numeric, interval '22 days'),
    (3, 71::numeric, interval '6 days')
  ) as x(seq, pv, ago)
  where o.organization_id = v_org_id
    and o.cycle_instance_id = v_ci
    and coalesce(o.okr_cycle_id, v_okr) is not null;

  if v_prog is not null then
    insert into app.initiatives (
      organization_id,
      planning_cycle_id,
      title,
      description,
      owner_membership_id,
      start_date,
      end_date,
      status,
      priority,
      created_by_membership_id,
      cycle_instance_id,
      program_id,
      progress_percent,
      last_review_update_at,
      weight
    )
    select
      v_org_id,
      v_pc,
      '[Auto-Seed] Umsetzung — ' || left(kr.title, 70),
      'Beispielinitiative fuer Dashboard und Verkettung zu Key Results.',
      case abs(hashtext(kr.id::text)) % 3
        when 0 then coalesce(v_mem_exec, v_admin)
        when 1 then coalesce(v_mem_dept, v_admin)
        else coalesce(v_mem_team, v_admin)
      end,
      current_date - 21,
      current_date + 75,
      'active',
      3,
      v_admin,
      v_ci,
      v_prog,
      (32 + abs(hashtext(kr.id::text)) % 48)::int,
      now() - interval '2 days',
      3
    from app.key_results kr
    join app.okr_objectives o on o.id = kr.okr_objective_id
    where o.organization_id = v_org_id
      and o.cycle_instance_id = v_ci
    order by kr.created_at
    limit 10;

    insert into app.initiative_key_result_links (
      organization_id,
      planning_cycle_id,
      cycle_instance_id,
      initiative_id,
      key_result_id,
      created_by_membership_id
    )
    select
      v_org_id,
      v_pc,
      v_ci,
      i.id,
      kr.id,
      v_admin
    from app.initiatives i
    join app.key_results kr
      on i.title = '[Auto-Seed] Umsetzung — ' || left(kr.title, 70)
    join app.okr_objectives o on o.id = kr.okr_objective_id
    where i.organization_id = v_org_id
      and o.organization_id = v_org_id
      and o.cycle_instance_id = v_ci
    on conflict (cycle_instance_id, initiative_id, key_result_id) do nothing;
  end if;

  raise notice '011_seed: fertig (cabtecgroup). Demo-Login z. B. demo.team@cabtecgroup.demo / TempDemo!2026';
end
$$;

-- migrate:down
select 1;
