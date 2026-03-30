-- 0113_okr_review_session_task_due_at.sql
-- Meeting-To-Dos: verbindlicher Termin (Faelligkeit).
-- migrate:up

alter table app.okr_review_session_tasks
  add column if not exists due_at timestamptz;

update app.okr_review_session_tasks
set due_at = created_at + interval '7 days'
where due_at is null;

alter table app.okr_review_session_tasks
  alter column due_at set not null;

comment on column app.okr_review_session_tasks.due_at is
  'Faelligkeits-/Terminzeitpunkt der Meeting-Aufgabe (Pflicht ab Schema 0113).';

-- migrate:down

alter table app.okr_review_session_tasks drop column if exists due_at;
