-- 0174_strategy_review_program_feedback.sql
-- Feedback auch für Programme (Change-Anschluss) im Strategy Review.

-- migrate:up

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_entries_subject_type_check;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_entries_subject_type_check
  check (subject_type in ('challenge', 'focus_area', 'objective', 'program'));

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_program;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_program check (
    subject_type <> 'program'
    or rating is null
    or rating in ('continue', 'adjust', 'stop', 'escalate')
  );

-- migrate:down

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_program;

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_entries_subject_type_check;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_entries_subject_type_check
  check (subject_type in ('challenge', 'focus_area', 'objective'));
