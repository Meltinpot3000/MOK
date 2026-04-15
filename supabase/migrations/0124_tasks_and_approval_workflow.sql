-- 0124_tasks_and_approval_workflow.sql
-- MVP Meine Aufgaben: app.tasks, pending_approval, Audit- und Invalidierungsfelder,
-- RBAC tasks.read + nav.my-tasks.read, RLS, SECURITY DEFINER RPCs submit/decide.
-- migrate:up

-- ---------------------------------------------------------------------------
-- 1) Lifecycle: pending_approval (ohne key_results)
-- ---------------------------------------------------------------------------

alter table app.strategic_goals drop constraint if exists strategic_goals_status_check;
alter table app.strategic_goals
  add constraint strategic_goals_status_check check (
    status = any (
      array[
        'draft'::text,
        'pending_approval'::text,
        'active'::text,
        'on_hold'::text,
        'completed'::text,
        'archived'::text
      ]
    )
  );

alter table app.functional_strategies drop constraint if exists functional_strategies_status_check;
alter table app.functional_strategies
  add constraint functional_strategies_status_check check (
    status = any (
      array[
        'draft'::text,
        'pending_approval'::text,
        'active'::text,
        'on_hold'::text,
        'completed'::text,
        'archived'::text
      ]
    )
  );

alter table app.initiatives drop constraint if exists initiatives_status_check;
alter table app.initiatives
  add constraint initiatives_status_check check (
    status = any (
      array[
        'draft'::text,
        'pending_approval'::text,
        'planned'::text,
        'active'::text,
        'at_risk'::text,
        'on_hold'::text,
        'completed'::text,
        'archived'::text
      ]
    )
  );

alter table app.strategic_directions drop constraint if exists strategic_directions_status_check;
alter table app.strategic_directions
  add constraint strategic_directions_status_check check (
    status = any (
      array[
        'draft'::text,
        'pending_approval'::text,
        'approved'::text,
        'active'::text,
        'on_hold'::text,
        'closed'::text
      ]
    )
  );

alter table app.strategy_programs drop constraint if exists strategy_programs_status_check;
alter table app.strategy_programs
  add constraint strategy_programs_status_check check (
    status = any (
      array['draft'::text, 'pending_approval'::text, 'active'::text, 'on_hold'::text, 'closed'::text]
    )
  );

alter table app.strategy_objectives drop constraint if exists strategy_objectives_status_check;
alter table app.strategy_objectives
  add constraint strategy_objectives_status_check check (
    status = any (
      array[
        'draft'::text,
        'pending_approval'::text,
        'active'::text,
        'at_risk'::text,
        'completed'::text,
        'archived'::text
      ]
    )
  );

alter table app.okr_objectives drop constraint if exists okr_objectives_status_check;
alter table app.okr_objectives
  add constraint okr_objectives_status_check check (
    status = any (
      array[
        'draft'::text,
        'pending_approval'::text,
        'active'::text,
        'at_risk'::text,
        'completed'::text,
        'archived'::text,
        'shifted'::text
      ]
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Audit- und Invalidierungs-Spalten
-- ---------------------------------------------------------------------------

do $audit$
begin
  -- Approval-Audit Spalten
  alter table app.strategic_goals add column if not exists submitted_for_approval_at timestamptz;
  alter table app.strategic_goals add column if not exists submitted_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategic_goals add column if not exists approved_at timestamptz;
  alter table app.strategic_goals add column if not exists approved_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategic_goals add column if not exists rejected_at timestamptz;
  alter table app.strategic_goals add column if not exists rejected_by_membership_id uuid references app.organization_memberships (id) on delete set null;

  alter table app.functional_strategies add column if not exists submitted_for_approval_at timestamptz;
  alter table app.functional_strategies add column if not exists submitted_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.functional_strategies add column if not exists approved_at timestamptz;
  alter table app.functional_strategies add column if not exists approved_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.functional_strategies add column if not exists rejected_at timestamptz;
  alter table app.functional_strategies add column if not exists rejected_by_membership_id uuid references app.organization_memberships (id) on delete set null;

  alter table app.initiatives add column if not exists submitted_for_approval_at timestamptz;
  alter table app.initiatives add column if not exists submitted_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.initiatives add column if not exists approved_at timestamptz;
  alter table app.initiatives add column if not exists approved_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.initiatives add column if not exists rejected_at timestamptz;
  alter table app.initiatives add column if not exists rejected_by_membership_id uuid references app.organization_memberships (id) on delete set null;

  alter table app.strategic_directions add column if not exists submitted_for_approval_at timestamptz;
  alter table app.strategic_directions add column if not exists submitted_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategic_directions add column if not exists approved_at timestamptz;
  alter table app.strategic_directions add column if not exists approved_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategic_directions add column if not exists rejected_at timestamptz;
  alter table app.strategic_directions add column if not exists rejected_by_membership_id uuid references app.organization_memberships (id) on delete set null;

  alter table app.strategy_programs add column if not exists submitted_for_approval_at timestamptz;
  alter table app.strategy_programs add column if not exists submitted_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategy_programs add column if not exists approved_at timestamptz;
  alter table app.strategy_programs add column if not exists approved_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategy_programs add column if not exists rejected_at timestamptz;
  alter table app.strategy_programs add column if not exists rejected_by_membership_id uuid references app.organization_memberships (id) on delete set null;

  alter table app.strategy_objectives add column if not exists submitted_for_approval_at timestamptz;
  alter table app.strategy_objectives add column if not exists submitted_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategy_objectives add column if not exists approved_at timestamptz;
  alter table app.strategy_objectives add column if not exists approved_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategy_objectives add column if not exists rejected_at timestamptz;
  alter table app.strategy_objectives add column if not exists rejected_by_membership_id uuid references app.organization_memberships (id) on delete set null;

  alter table app.okr_objectives add column if not exists submitted_for_approval_at timestamptz;
  alter table app.okr_objectives add column if not exists submitted_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.okr_objectives add column if not exists approved_at timestamptz;
  alter table app.okr_objectives add column if not exists approved_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.okr_objectives add column if not exists rejected_at timestamptz;
  alter table app.okr_objectives add column if not exists rejected_by_membership_id uuid references app.organization_memberships (id) on delete set null;

  -- Re-Approval nur Objective-Familie
  alter table app.strategy_objectives add column if not exists approval_invalidated_at timestamptz;
  alter table app.strategy_objectives add column if not exists approval_invalidated_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.strategy_objectives add column if not exists approval_invalidation_reason text;

  alter table app.okr_objectives add column if not exists approval_invalidated_at timestamptz;
  alter table app.okr_objectives add column if not exists approval_invalidated_by_membership_id uuid references app.organization_memberships (id) on delete set null;
  alter table app.okr_objectives add column if not exists approval_invalidation_reason text;
end $audit$;

-- ---------------------------------------------------------------------------
-- 3) app.tasks
-- ---------------------------------------------------------------------------

create table if not exists app.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete cascade,
  task_type text not null,
  title text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_membership_id uuid not null references app.organization_memberships (id) on delete cascade,
  created_by_membership_id uuid not null references app.organization_memberships (id) on delete restrict,
  source_object_type text not null,
  source_object_id uuid not null,
  routing_mode text,
  routing_reason text,
  due_at timestamptz,
  completed_at timestamptz,
  completed_by_membership_id uuid references app.organization_memberships (id) on delete set null,
  decision_comment text,
  organization_unit_id uuid,
  task_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_task_type_check check (task_type = any (array['approval'::text])),
  constraint tasks_status_check check (status = any (array['open'::text, 'completed'::text, 'cancelled'::text])),
  constraint tasks_priority_check check (priority = any (array['normal'::text, 'high'::text])),
  constraint tasks_routing_mode_check check (
    routing_mode is null
    or routing_mode = any (
      array['direct_manager'::text, 'executive_fallback'::text, 'admin_fallback'::text]
    )
  )
);

create index if not exists idx_tasks_org_assignee_status on app.tasks (organization_id, assigned_membership_id, status);

create index if not exists idx_tasks_org_created_at on app.tasks (organization_id, created_at desc);

create unique index if not exists idx_tasks_one_open_approval_per_source
  on app.tasks (organization_id, source_object_type, source_object_id)
  where status = 'open' and task_type = 'approval';

drop trigger if exists trg_tasks_updated_at on app.tasks;
create trigger trg_tasks_updated_at
before update on app.tasks
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.tasks to authenticated;
grant select on app.tasks to anon;

-- ---------------------------------------------------------------------------
-- 4) RBAC
-- ---------------------------------------------------------------------------

insert into rbac.permissions (code, name, description)
values
  (
    'tasks.read',
    'Tasks Read',
    'Read own tasks and Meine Aufgaben workspace'
  ),
  (
    'nav.my-tasks.read',
    'Sidebar Meine Aufgaben Read',
    'Read access to Meine Aufgaben sidebar item'
  )
on conflict (code) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('tasks.read', 'nav.my-tasks.read')
where r.code = 'org_admin'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('tasks.read', 'nav.my-tasks.read')
where r.code = 'executive'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('tasks.read', 'nav.my-tasks.read')
where r.code = 'department_lead'
on conflict (role_id, permission_id) do nothing;

insert into rbac.role_permissions (role_id, permission_id)
select r.id, p.id
from rbac.roles r
join rbac.permissions p on p.code in ('tasks.read', 'nav.my-tasks.read')
where r.code = 'team_member'
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5) RLS tasks
-- ---------------------------------------------------------------------------

alter table app.tasks enable row level security;

drop policy if exists tasks_select on app.tasks;
create policy tasks_select on app.tasks
for select using (
  app.has_permission(organization_id, 'tasks.read')
  and assigned_membership_id = app.current_membership_id(organization_id)
);

drop policy if exists tasks_insert on app.tasks;
create policy tasks_insert on app.tasks
for insert with check (false);

drop policy if exists tasks_update on app.tasks;
create policy tasks_update on app.tasks
for update using (false);

drop policy if exists tasks_delete on app.tasks;
create policy tasks_delete on app.tasks
for delete using (false);

-- ---------------------------------------------------------------------------
-- 6) Hilfsfunktion: Darf Akteur Objekt-Typ schreiben (aligned mit RLS)
-- ---------------------------------------------------------------------------

create or replace function app.approval_actor_can_submit(
  p_organization_id uuid,
  p_source_object_type text,
  p_owner_membership_id uuid,
  p_deputy_membership_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = app, public, rbac
as $fn$
begin
  case p_source_object_type
    when 'strategic_goal' then
      return app.has_permission(p_organization_id, 'goal.write');
    when 'functional_strategy' then
      return app.has_permission(p_organization_id, 'strategy.write');
    when 'initiative' then
      return app.has_permission(p_organization_id, 'initiative.write');
    when 'strategic_direction' then
      return app.has_permission(p_organization_id, 'nav.strategy-matrix.write');
    when 'strategy_program' then
      return app.has_permission(p_organization_id, 'nav.strategy-cycle.write')
        or app.has_permission(p_organization_id, 'nav.strategy-matrix.write');
    when 'strategy_objective' then
      return app.has_permission(p_organization_id, 'nav.strategy-cycle.write')
        or app.has_permission(p_organization_id, 'nav.strategy-matrix.write')
        or app.has_permission(p_organization_id, 'okr.write');
    when 'okr_objective' then
      return app.has_permission(p_organization_id, 'nav.strategy-cycle.write')
        or app.has_permission(p_organization_id, 'nav.strategy-matrix.write')
        or (
          app.has_permission(p_organization_id, 'okr.write')
          and app.okr_can_modify_objective(p_organization_id, p_owner_membership_id, p_deputy_membership_id)
        );
    else
      return false;
  end case;
end;
$fn$;

revoke all on function app.approval_actor_can_submit(uuid, text, uuid, uuid) from public;
grant execute on function app.approval_actor_can_submit(uuid, text, uuid, uuid) to authenticated;

-- Post-Approval-Zielstatus (kein Client-Trust)
create or replace function app.approval_post_approval_status(p_source_object_type text) returns text
language sql
immutable
parallel safe
set search_path = app, public
as $$
  select case p_source_object_type
    when 'strategic_direction' then 'approved'
    when 'initiative' then 'planned'
    else 'active'
  end;
$$;

revoke all on function app.approval_post_approval_status(text) from public;
grant execute on function app.approval_post_approval_status(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) RPC: Submit (ein Task + pending_approval)
-- ---------------------------------------------------------------------------

create or replace function app.approval_submit_for_review(
  p_source_object_type text,
  p_source_object_id uuid,
  p_assigned_membership_id uuid,
  p_routing_mode text,
  p_routing_reason text,
  p_title text,
  p_description text
) returns uuid
language plpgsql
security definer
set search_path = app, public, rbac
as $submit$
declare
  v_org uuid;
  v_actor uuid;
  v_status text;
  v_owner uuid;
  v_deputy uuid;
  v_task_id uuid;
begin
  if p_source_object_type not in (
    'strategic_goal',
    'functional_strategy',
    'initiative',
    'strategic_direction',
    'strategy_program',
    'strategy_objective',
    'okr_objective'
  ) then
    raise exception 'approval-invalid-object-type';
  end if;

  case p_source_object_type
    when 'strategic_goal' then
      select g.organization_id, g.status, null::uuid, null::uuid
        into v_org, v_status, v_owner, v_deputy
      from app.strategic_goals g
      where g.id = p_source_object_id;
    when 'functional_strategy' then
      select f.organization_id, f.status, null::uuid, null::uuid
        into v_org, v_status, v_owner, v_deputy
      from app.functional_strategies f
      where f.id = p_source_object_id;
    when 'initiative' then
      select i.organization_id, i.status, null::uuid, null::uuid
        into v_org, v_status, v_owner, v_deputy
      from app.initiatives i
      where i.id = p_source_object_id;
    when 'strategic_direction' then
      select d.organization_id, d.status, null::uuid, null::uuid
        into v_org, v_status, v_owner, v_deputy
      from app.strategic_directions d
      where d.id = p_source_object_id;
    when 'strategy_program' then
      select p.organization_id, p.status, null::uuid, null::uuid
        into v_org, v_status, v_owner, v_deputy
      from app.strategy_programs p
      where p.id = p_source_object_id;
    when 'strategy_objective' then
      select s.organization_id, s.status, s.owner_membership_id, s.deputy_membership_id
        into v_org, v_status, v_owner, v_deputy
      from app.strategy_objectives s
      where s.id = p_source_object_id;
    when 'okr_objective' then
      select o.organization_id, o.status, o.owner_membership_id, o.deputy_membership_id
        into v_org, v_status, v_owner, v_deputy
      from app.okr_objectives o
      where o.id = p_source_object_id;
    else
      raise exception 'approval-invalid-object-type';
  end case;

  if v_org is null then
    raise exception 'approval-object-not-found';
  end if;

  v_actor := app.current_membership_id(v_org);
  if v_actor is null then
    raise exception 'approval-not-organization-member';
  end if;

  if not app.approval_actor_can_submit(v_org, p_source_object_type, v_owner, v_deputy) then
    raise exception 'approval-forbidden';
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'approval-not-draft';
  end if;

  if not exists (
    select 1 from app.organization_memberships m
    where m.id = p_assigned_membership_id
      and m.organization_id = v_org
      and m.status = 'active'
  ) then
    raise exception 'approval-invalid-assignee';
  end if;

  update app.tasks t
  set status = 'cancelled', updated_at = now()
  where t.organization_id = v_org
    and t.source_object_type = p_source_object_type
    and t.source_object_id = p_source_object_id
    and t.task_type = 'approval'
    and t.status = 'open';

  insert into app.tasks (
    organization_id,
    task_type,
    title,
    description,
    status,
    priority,
    assigned_membership_id,
    created_by_membership_id,
    source_object_type,
    source_object_id,
    routing_mode,
    routing_reason
  ) values (
    v_org,
    'approval',
    coalesce(nullif(trim(p_title), ''), 'Approval'),
    p_description,
    'open',
    'normal',
    p_assigned_membership_id,
    v_actor,
    p_source_object_type,
    p_source_object_id,
    p_routing_mode,
    p_routing_reason
  )
  returning id into v_task_id;

  case p_source_object_type
    when 'strategic_goal' then
      update app.strategic_goals g set
        status = 'pending_approval',
        submitted_for_approval_at = now(),
        submitted_by_membership_id = v_actor,
        updated_at = now()
      where g.id = p_source_object_id;
    when 'functional_strategy' then
      update app.functional_strategies f set
        status = 'pending_approval',
        submitted_for_approval_at = now(),
        submitted_by_membership_id = v_actor,
        updated_at = now()
      where f.id = p_source_object_id;
    when 'initiative' then
      update app.initiatives i set
        status = 'pending_approval',
        submitted_for_approval_at = now(),
        submitted_by_membership_id = v_actor,
        updated_at = now()
      where i.id = p_source_object_id;
    when 'strategic_direction' then
      update app.strategic_directions d set
        status = 'pending_approval',
        submitted_for_approval_at = now(),
        submitted_by_membership_id = v_actor,
        updated_at = now()
      where d.id = p_source_object_id;
    when 'strategy_program' then
      update app.strategy_programs p set
        status = 'pending_approval',
        submitted_for_approval_at = now(),
        submitted_by_membership_id = v_actor,
        updated_at = now()
      where p.id = p_source_object_id;
    when 'strategy_objective' then
      update app.strategy_objectives s set
        status = 'pending_approval',
        submitted_for_approval_at = now(),
        submitted_by_membership_id = v_actor,
        updated_at = now()
      where s.id = p_source_object_id;
    when 'okr_objective' then
      update app.okr_objectives o set
        status = 'pending_approval',
        submitted_for_approval_at = now(),
        submitted_by_membership_id = v_actor,
        updated_at = now()
      where o.id = p_source_object_id;
    else
      raise exception 'approval-invalid-object-type';
  end case;

  return v_task_id;
end;
$submit$;

revoke all on function app.approval_submit_for_review(text, uuid, uuid, text, text, text, text) from public;
grant execute on function app.approval_submit_for_review(text, uuid, uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) RPC: Entscheid (nur Assignee)
-- ---------------------------------------------------------------------------

create or replace function app.approval_decide_task(
  p_task_id uuid,
  p_decision text,
  p_comment text
) returns void
language plpgsql
security definer
set search_path = app, public, rbac
as $decide$
declare
  trec app.tasks%rowtype;
  v_actor uuid;
  v_next text;
begin
  if p_decision not in ('approve', 'reject', 'request_changes') then
    raise exception 'approval-invalid-decision';
  end if;

  select * into strict trec from app.tasks where id = p_task_id;

  if trec.status is distinct from 'open' then
    raise exception 'approval-task-not-open';
  end if;

  if trec.task_type is distinct from 'approval' then
    raise exception 'approval-task-wrong-type';
  end if;

  v_actor := app.current_membership_id(trec.organization_id);
  if v_actor is null or v_actor is distinct from trec.assigned_membership_id then
    raise exception 'approval-decide-not-assignee';
  end if;

  v_next := app.approval_post_approval_status(trec.source_object_type);

  if p_decision = 'approve' then
    update app.tasks tk set
      status = 'completed',
      completed_at = now(),
      completed_by_membership_id = v_actor,
      decision_comment = p_comment,
      updated_at = now()
    where tk.id = p_task_id;

    case trec.source_object_type
      when 'strategic_goal' then
        update app.strategic_goals g set
          status = v_next,
          approved_at = now(),
          approved_by_membership_id = v_actor,
          rejected_at = null,
          rejected_by_membership_id = null,
          updated_at = now()
        where g.id = trec.source_object_id;
      when 'functional_strategy' then
        update app.functional_strategies f set
          status = v_next,
          approved_at = now(),
          approved_by_membership_id = v_actor,
          rejected_at = null,
          rejected_by_membership_id = null,
          updated_at = now()
        where f.id = trec.source_object_id;
      when 'initiative' then
        update app.initiatives i set
          status = v_next,
          approved_at = now(),
          approved_by_membership_id = v_actor,
          rejected_at = null,
          rejected_by_membership_id = null,
          updated_at = now()
        where i.id = trec.source_object_id;
      when 'strategic_direction' then
        update app.strategic_directions d set
          status = v_next,
          approved_at = now(),
          approved_by_membership_id = v_actor,
          rejected_at = null,
          rejected_by_membership_id = null,
          updated_at = now()
        where d.id = trec.source_object_id;
      when 'strategy_program' then
        update app.strategy_programs p set
          status = v_next,
          approved_at = now(),
          approved_by_membership_id = v_actor,
          rejected_at = null,
          rejected_by_membership_id = null,
          updated_at = now()
        where p.id = trec.source_object_id;
      when 'strategy_objective' then
        update app.strategy_objectives s set
          status = v_next,
          approved_at = now(),
          approved_by_membership_id = v_actor,
          rejected_at = null,
          rejected_by_membership_id = null,
          updated_at = now()
        where s.id = trec.source_object_id;
      when 'okr_objective' then
        update app.okr_objectives o set
          status = v_next,
          approved_at = now(),
          approved_by_membership_id = v_actor,
          rejected_at = null,
          rejected_by_membership_id = null,
          updated_at = now()
        where o.id = trec.source_object_id;
      else
        raise exception 'approval-invalid-object-type';
    end case;

  else
    -- reject oder request_changes
    update app.tasks tk set
      status = 'completed',
      completed_at = now(),
      completed_by_membership_id = v_actor,
      decision_comment = p_comment,
      updated_at = now()
    where tk.id = p_task_id;

    case trec.source_object_type
      when 'strategic_goal' then
        update app.strategic_goals g set
          status = 'draft',
          rejected_at = now(),
          rejected_by_membership_id = v_actor,
          updated_at = now()
        where g.id = trec.source_object_id;
      when 'functional_strategy' then
        update app.functional_strategies f set
          status = 'draft',
          rejected_at = now(),
          rejected_by_membership_id = v_actor,
          updated_at = now()
        where f.id = trec.source_object_id;
      when 'initiative' then
        update app.initiatives i set
          status = 'draft',
          rejected_at = now(),
          rejected_by_membership_id = v_actor,
          updated_at = now()
        where i.id = trec.source_object_id;
      when 'strategic_direction' then
        update app.strategic_directions d set
          status = 'draft',
          rejected_at = now(),
          rejected_by_membership_id = v_actor,
          updated_at = now()
        where d.id = trec.source_object_id;
      when 'strategy_program' then
        update app.strategy_programs p set
          status = 'draft',
          rejected_at = now(),
          rejected_by_membership_id = v_actor,
          updated_at = now()
        where p.id = trec.source_object_id;
      when 'strategy_objective' then
        update app.strategy_objectives s set
          status = 'draft',
          rejected_at = now(),
          rejected_by_membership_id = v_actor,
          updated_at = now()
        where s.id = trec.source_object_id;
      when 'okr_objective' then
        update app.okr_objectives o set
          status = 'draft',
          rejected_at = now(),
          rejected_by_membership_id = v_actor,
          updated_at = now()
        where o.id = trec.source_object_id;
      else
        raise exception 'approval-invalid-object-type';
    end case;
  end if;
end;
$decide$;

revoke all on function app.approval_decide_task(uuid, text, text) from public;
grant execute on function app.approval_decide_task(uuid, text, text) to authenticated;

-- migrate:down

drop function if exists app.approval_decide_task(uuid, text, text);
drop function if exists app.approval_submit_for_review(text, uuid, uuid, text, text, text, text);
drop function if exists app.approval_post_approval_status(text);
drop function if exists app.approval_actor_can_submit(uuid, text, uuid, uuid);

drop trigger if exists trg_tasks_updated_at on app.tasks;
drop table if exists app.tasks;

delete from rbac.role_permissions
where permission_id in (select id from rbac.permissions where code in ('tasks.read', 'nav.my-tasks.read'));
delete from rbac.permissions where code in ('tasks.read', 'nav.my-tasks.read');

-- Revert columns (keep if other deps; down is best-effort)
alter table app.okr_objectives drop column if exists approval_invalidation_reason;
alter table app.okr_objectives drop column if exists approval_invalidated_by_membership_id;
alter table app.okr_objectives drop column if exists approval_invalidated_at;
alter table app.strategy_objectives drop column if exists approval_invalidation_reason;
alter table app.strategy_objectives drop column if exists approval_invalidated_by_membership_id;
alter table app.strategy_objectives drop column if exists approval_invalidated_at;

alter table app.okr_objectives drop column if exists rejected_by_membership_id;
alter table app.okr_objectives drop column if exists rejected_at;
alter table app.okr_objectives drop column if exists approved_by_membership_id;
alter table app.okr_objectives drop column if exists approved_at;
alter table app.okr_objectives drop column if exists submitted_by_membership_id;
alter table app.okr_objectives drop column if exists submitted_for_approval_at;
