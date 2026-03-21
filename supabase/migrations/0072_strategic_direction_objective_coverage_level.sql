-- 0072_strategic_direction_objective_coverage_level.sql
-- Abdeckungsstaerke fuer Direction-Objective-Links (wie challenge_direction_links).
-- migrate:up

alter table app.strategic_direction_objective_links
  add column if not exists contribution_level text default 'medium';

update app.strategic_direction_objective_links
set contribution_level = 'medium'
where contribution_level is null;

alter table app.strategic_direction_objective_links
  alter column contribution_level set default 'medium';

alter table app.strategic_direction_objective_links
  alter column contribution_level set not null;

alter table app.strategic_direction_objective_links
  drop constraint if exists strategic_direction_objective_links_contribution_level_check;

alter table app.strategic_direction_objective_links
  add constraint strategic_direction_objective_links_contribution_level_check
  check (contribution_level in ('low', 'medium', 'high'));

-- migrate:down

alter table app.strategic_direction_objective_links
  drop constraint if exists strategic_direction_objective_links_contribution_level_check;

alter table app.strategic_direction_objective_links
  drop column if exists contribution_level;
