-- 0133_okr_approval_direct_manager_only.sql
-- OKR-Freigabe: Assignee muss direkter Vorgesetzter des Einreichers sein (kein Executive/Admin-Fallback).
-- migrate:up

create or replace function app.approval_direct_manager_membership_id(
  p_organization_id uuid,
  p_submitter_membership_id uuid
) returns uuid
language plpgsql
stable
security definer
set search_path = app, public
as $fn$
declare
  v_responsible_id uuid;
  v_manager_responsible_id uuid;
  v_membership_id uuid;
begin
  select m.responsible_id into v_responsible_id
  from app.organization_memberships m
  where m.id = p_submitter_membership_id
    and m.organization_id = p_organization_id
    and m.status = 'active';

  if v_responsible_id is null then
    return null;
  end if;

  select h.manager_responsible_id into v_manager_responsible_id
  from app.responsible_hierarchy h
  where h.report_responsible_id = v_responsible_id;

  if v_manager_responsible_id is null then
    return null;
  end if;

  select r.membership_id into v_membership_id
  from app.responsibles r
  where r.id = v_manager_responsible_id
    and r.organization_id = p_organization_id;

  if v_membership_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from app.organization_memberships m
    where m.id = v_membership_id
      and m.organization_id = p_organization_id
      and m.status = 'active'
  ) then
    return null;
  end if;

  return v_membership_id;
end;
$fn$;

revoke all on function app.approval_direct_manager_membership_id (uuid, uuid) from public;
grant execute on function app.approval_direct_manager_membership_id (uuid, uuid) to authenticated;

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
  v_expected_manager uuid;
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

  if p_source_object_type = 'okr_objective' then
    v_expected_manager := app.approval_direct_manager_membership_id(v_org, v_actor);
    if v_expected_manager is null then
      raise exception 'approval-no-direct-manager';
    end if;
    if p_assigned_membership_id is distinct from v_expected_manager then
      raise exception 'approval-invalid-assignee';
    end if;
    if p_routing_mode is distinct from 'direct_manager' then
      raise exception 'approval-invalid-routing';
    end if;
    if p_routing_reason is not null then
      raise exception 'approval-invalid-routing';
    end if;
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

revoke all on function app.approval_submit_for_review (text, uuid, uuid, text, text, text, text) from public;
grant execute on function app.approval_submit_for_review (text, uuid, uuid, text, text, text, text) to authenticated;

-- migrate:down
-- Nicht automatisch rückgängig: vorherige approval_submit_for_review-Version manuell wiederherstellen.
