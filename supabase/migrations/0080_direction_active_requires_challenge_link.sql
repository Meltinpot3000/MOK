-- 0080_direction_active_requires_challenge_link.sql
-- Aktivierung: mindestens eine challenge_direction_links-Zeile (kein Cluster mehr).
-- migrate:up

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

comment on function app.enforce_direction_activation_links() is
  'Vor status=active: mindestens eine Verknuepfung zu einer strategischen Herausforderung.';

-- migrate:down

create or replace function app.enforce_direction_activation_links()
returns trigger
language plpgsql
as $$
declare
  cluster_count integer;
  objective_count integer;
begin
  if new.status = 'active' then
    select count(*) into cluster_count
    from app.strategic_direction_cluster_links
    where organization_id = new.organization_id
      and cycle_instance_id = new.cycle_instance_id
      and strategic_direction_id = new.id;
    select count(*) into objective_count
    from app.strategic_direction_objective_links
    where organization_id = new.organization_id
      and cycle_instance_id = new.cycle_instance_id
      and strategic_direction_id = new.id;
    if cluster_count < 1 or objective_count < 1 then
      raise exception 'direction-needs-cluster-and-objective';
    end if;
  end if;
  return new;
end;
$$;
