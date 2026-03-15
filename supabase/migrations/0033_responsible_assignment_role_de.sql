-- 0033_responsible_assignment_role_de.sql
-- Adds German role label for responsible assignments.
-- migrate:up

alter table app.responsible_assignments
  add column if not exists assignment_role_de text;

update app.responsible_assignments ra
set assignment_role_de = case ra.assignment_type
  when 'owner' then 'Hauptverantwortung'
  when 'support' then 'Unterstuetzung'
  when 'stakeholder' then 'Stakeholder'
  else ra.assignment_role_de
end
from app.organization_unit ou
where ra.assignment_role_de is null
  and ra.organization_unit_id = ou.id
  and ra.organization_id = ou.organization_id;

alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_assignment_role_de_chk;

alter table app.responsible_assignments
  add constraint responsible_assignments_assignment_role_de_chk
  check (
    assignment_role_de is null
    or assignment_role_de in ('Hauptverantwortung', 'Unterstuetzung', 'Stakeholder')
  );

-- migrate:down
alter table app.responsible_assignments
  drop constraint if exists responsible_assignments_assignment_role_de_chk;

alter table app.responsible_assignments
  drop column if exists assignment_role_de;
