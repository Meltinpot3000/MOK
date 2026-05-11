-- migrate:up
-- Tasks: SELECT erlauben, wenn eine beliebige aktive Membership des Users (auth.uid())
-- zur gleichen organization_id passt und assigned | created_by | completed_by ist.
-- Behebt falsch-negative Reads, weil app.current_membership_id() nur eine Membership liefert.

drop policy if exists tasks_select on app.tasks;

create policy tasks_select on app.tasks
for select using (
  app.has_permission(organization_id, 'tasks.read')
  and exists (
    select 1
    from app.organization_memberships m
    where m.organization_id = tasks.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.id = tasks.assigned_membership_id
        or m.id = tasks.created_by_membership_id
        or (
          tasks.completed_by_membership_id is not null
          and m.id = tasks.completed_by_membership_id
        )
      )
  )
);

comment on policy tasks_select on app.tasks is
  'tasks.read + Zeile sichtbar wenn User ueber eine aktive Membership Assignee/Ersteller/Abschluss ist (multi-membership).';

-- migrate:down

drop policy if exists tasks_select on app.tasks;

create policy tasks_select on app.tasks
for select using (
  app.has_permission(organization_id, 'tasks.read')
  and assigned_membership_id = app.current_membership_id(organization_id)
);
