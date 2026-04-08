-- 0122_responsibles_membership_hard_cleanup.sql
-- Dev-saubere Regeln: jede Zeile in app.responsibles gehoert genau einer Mitgliedschaft;
-- keine Dubletten; membership.responsible_id ist 1:1-Spiegel.
-- migrate:up

-- 1) membership_id auf responsibles aus Verweis membership -> responsible rueckverknuepfen (eine Membership pro Responsible)
update app.responsibles r
set membership_id = sub.mid
from (
  select m.responsible_id as rid, (array_agg(m.id order by m.created_at, m.id))[1] as mid
  from app.organization_memberships m
  where m.responsible_id is not null
  group by m.responsible_id
) sub
where r.id = sub.rid
  and r.membership_id is null;

-- 1b) Mitgliedschaftszeiger, die nicht zur canonic membership_id der Zeile passen, leeren
update app.organization_memberships m
set responsible_id = null
where m.responsible_id is not null
  and exists (
    select 1
    from app.responsibles r
    where r.id = m.responsible_id
      and r.membership_id is not null
      and r.membership_id <> m.id
  );

-- 2) Dubletten pro (organization_id, membership_id): eine Zeile behalten
do $$
declare
  grp record;
  v_keep uuid;
  r_dup record;
begin
  for grp in
    select organization_id, membership_id
    from app.responsibles
    where membership_id is not null
    group by organization_id, membership_id
    having count(*) > 1
  loop
    select coalesce(
      (
        select om.responsible_id
        from app.organization_memberships om
        where om.organization_id = grp.organization_id
          and om.id = grp.membership_id
          and om.responsible_id in (
            select r2.id
            from app.responsibles r2
            where r2.organization_id = grp.organization_id
              and r2.membership_id = grp.membership_id
          )
        limit 1
      ),
      (
        select r3.id
        from app.responsibles r3
        where r3.organization_id = grp.organization_id
          and r3.membership_id = grp.membership_id
        order by r3.created_at asc
        limit 1
      )
    ) into v_keep;

    if v_keep is null then
      continue;
    end if;

    for r_dup in
      select id as dup_id
      from app.responsibles
      where organization_id = grp.organization_id
        and membership_id = grp.membership_id
        and id <> v_keep
    loop
      delete from app.responsible_assignments ra
      where ra.responsible_id = r_dup.dup_id
        and exists (
          select 1
          from app.responsible_assignments x
          where x.responsible_id = v_keep
            and x.organization_id = ra.organization_id
            and x.organization_unit_id = ra.organization_unit_id
            and x.assignment_type = ra.assignment_type
        );

      update app.responsible_assignments
      set responsible_id = v_keep
      where responsible_id = r_dup.dup_id;

      update app.responsible_hierarchy
      set manager_responsible_id = v_keep
      where manager_responsible_id = r_dup.dup_id;

      update app.responsible_hierarchy
      set report_responsible_id = v_keep
      where report_responsible_id = r_dup.dup_id;

      update app.organization_memberships
      set responsible_id = v_keep
      where responsible_id = r_dup.dup_id;

      delete from app.responsibles where id = r_dup.dup_id;
    end loop;
  end loop;
end $$;

-- 3) Doppelte Hierarchie-Kanten entfernen
delete from app.responsible_hierarchy h
where h.id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by organization_id, manager_responsible_id, report_responsible_id
        order by created_at, id
      ) as rn
    from app.responsible_hierarchy
  ) z
  where z.rn > 1
);

-- 4) Self-Loops
delete from app.responsible_hierarchy
where manager_responsible_id = report_responsible_id;

-- 5) Verwaiste Verantwortliche ohne Mitgliedschaft (Dev: Datenverlust akzeptiert)
update app.organization_memberships m
set responsible_id = null
where m.responsible_id in (
  select id from app.responsibles where membership_id is null
);

delete from app.responsibles
where membership_id is null;

-- 6) membership.responsible_id mit Zeilen synchronisieren
update app.organization_memberships m
set responsible_id = r.id
from app.responsibles r
where r.membership_id = m.id
  and m.organization_id = r.organization_id
  and (m.responsible_id is distinct from r.id);

-- 7) Integritaet
alter table app.responsibles
  alter column membership_id set not null;

create unique index if not exists idx_responsibles_org_membership_unique
  on app.responsibles (organization_id, membership_id);

create unique index if not exists idx_org_memberships_responsible_unique
  on app.organization_memberships (responsible_id)
  where responsible_id is not null;

-- 8) Validierung ohne Legacy org_unit_id / org_units-Fallback
create or replace function app.validate_responsible_cross_org()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
begin
  if tg_table_name = 'responsible_assignments' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'responsible assignment cross-organization mismatch';
    end if;

    select organization_id into v_org_id
    from app.organization_unit
    where id = new.organization_unit_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'organization unit assignment cross-organization mismatch';
    end if;
  elsif tg_table_name = 'responsible_hierarchy' then
    select organization_id into v_org_id
    from app.responsibles
    where id = new.manager_responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'manager cross-organization mismatch';
    end if;

    select organization_id into v_org_id
    from app.responsibles
    where id = new.report_responsible_id;

    if v_org_id is null or v_org_id <> new.organization_id then
      raise exception 'report cross-organization mismatch';
    end if;
  end if;

  return new;
end;
$$;

-- migrate:down

drop index if exists app.idx_org_memberships_responsible_unique;
drop index if exists app.idx_responsibles_org_membership_unique;

alter table app.responsibles
  alter column membership_id drop not null;

-- validate-Funktion nicht vollstaendig zurueckdrehen (Legacy-Variante in 0042)
