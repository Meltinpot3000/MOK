-- 0071_strategy_program_matrix_context.sql
-- Programme aus der Mapping-Matrix: Kontext zu Herausforderung, Score, unterstuetzte Objectives.
-- migrate:up

alter table app.strategy_programs
  add column if not exists strategic_challenge_id uuid
    references app.strategic_challenges(id) on delete set null,
  add column if not exists program_origin text not null default 'manual'
    check (program_origin in ('manual', 'matrix')),
  add column if not exists matrix_cell_score numeric(10,2),
  add column if not exists supported_objective_ids uuid[] not null default '{}'::uuid[];

create index if not exists idx_strategy_programs_challenge
  on app.strategy_programs (organization_id, cycle_instance_id, strategic_challenge_id)
  where strategic_challenge_id is not null;

comment on column app.strategy_programs.strategic_challenge_id is 'Optional: strategische Herausforderung (z. B. aus Mapping-Matrix).';
comment on column app.strategy_programs.program_origin is 'manual | matrix';
comment on column app.strategy_programs.matrix_cell_score is 'Snapshot des Matrix-Zellen-Scores bei Erzeugung aus der Matrix.';
comment on column app.strategy_programs.supported_objective_ids is 'Objectives, die das Programm laut Matrix-Kontext unterstuetzt.';

-- migrate:down

drop index if exists app.idx_strategy_programs_challenge;

alter table app.strategy_programs
  drop column if exists supported_objective_ids,
  drop column if exists matrix_cell_score,
  drop column if exists program_origin,
  drop column if exists strategic_challenge_id;
