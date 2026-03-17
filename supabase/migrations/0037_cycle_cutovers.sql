-- 0037_cycle_cutovers.sql
-- migrate:up


create table if not exists app.cycle_cutovers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  from_cycle_scheme_id uuid not null references app.cycle_schemes(id) on delete cascade,
  to_cycle_scheme_id uuid not null references app.cycle_schemes(id) on delete cascade,
  cutover_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'executed', 'cancelled', 'failed')),
  notes text,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  unique (organization_id, to_cycle_scheme_id, cutover_at),
  check (from_cycle_scheme_id <> to_cycle_scheme_id)
);

create index if not exists idx_cycle_cutovers_org_status_cutover
  on app.cycle_cutovers (organization_id, status, cutover_at);

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
begin
  for rec in
    select c.id, c.organization_id, c.from_cycle_scheme_id, c.to_cycle_scheme_id, s.top_level_duration_months
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
      perform app.regenerate_cycle_instances(rec.to_cycle_scheme_id, v_horizon, null);

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

grant select, insert, update, delete on app.cycle_cutovers to authenticated;
grant select on app.cycle_cutovers to anon;

alter table app.cycle_cutovers enable row level security;

drop policy if exists cycle_cutovers_select on app.cycle_cutovers;
create policy cycle_cutovers_select on app.cycle_cutovers
for select using (app.has_permission(organization_id, 'cycle_scheme.read'));

drop policy if exists cycle_cutovers_modify on app.cycle_cutovers;
create policy cycle_cutovers_modify on app.cycle_cutovers
for all using (app.has_permission(organization_id, 'cycle_scheme.write'))
with check (app.has_permission(organization_id, 'cycle_scheme.write'));


-- migrate:down
-- irreversible migration (no-op)
