-- 0081_challenge_direction_links_rls_and_activation_trigger.sql
-- RLS angleichen; Trigger-Funktion SECURITY DEFINER.
-- migrate:up

drop policy if exists challenge_direction_links_select on app.challenge_direction_links;
create policy challenge_direction_links_select on app.challenge_direction_links
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
  or app.has_permission(organization_id, 'review.read')
);

drop policy if exists challenge_direction_links_modify on app.challenge_direction_links;
create policy challenge_direction_links_modify on app.challenge_direction_links
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

create or replace function app.enforce_direction_activation_links()
returns trigger
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  challenge_count integer;
begin
  if new.status = 'active' then
    select count(*) into challenge_count
    from app.challenge_direction_links
    where organization_id = new.organization_id
      and cycle_instance_id = new.cycle_instance_id
      and strategic_direction_id = new.id;
    if challenge_count < 1 then
      raise exception 'direction-needs-challenge-link';
    end if;
  end if;
  return new;
end;
$$;

comment on function app.enforce_direction_activation_links() is
  'Vor status=active: mindestens eine challenge_direction_links-Zeile. SECURITY DEFINER um RLS zu umgehen.';

-- migrate:down

drop policy if exists challenge_direction_links_select on app.challenge_direction_links;
create policy challenge_direction_links_select on app.challenge_direction_links
for select using (app.has_permission(organization_id, 'nav.strategy-matrix.read'));

drop policy if exists challenge_direction_links_modify on app.challenge_direction_links;
create policy challenge_direction_links_modify on app.challenge_direction_links
for all using (app.has_permission(organization_id, 'nav.strategy-matrix.write'))
with check (app.has_permission(organization_id, 'nav.strategy-matrix.write'));

create or replace function app.enforce_direction_activation_links()
returns trigger
language plpgsql
as $$
declare
  challenge_count integer;
begin
  if new.status = 'active' then
    select count(*) into challenge_count
    from app.challenge_direction_links
    where organization_id = new.organization_id
      and cycle_instance_id = new.cycle_instance_id
      and strategic_direction_id = new.id;
    if challenge_count < 1 then
      raise exception 'direction-needs-challenge-link';
    end if;
  end if;
  return new;
end;
$$;
