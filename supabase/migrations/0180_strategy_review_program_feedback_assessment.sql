-- 0180_strategy_review_program_feedback_assessment.sql
-- Programm-Feedback: Tragfähigkeits-Bewertung (zielführend / Anpassung / keine Grundlage).

-- migrate:up

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_program;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_program check (
    subject_type <> 'program'
    or rating is null
    or rating in (
      'on_track',
      'needs_adjustment',
      'no_foundation',
      -- Legacy
      'continue',
      'adjust',
      'stop',
      'escalate'
    )
  );

-- migrate:down

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_program;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_program check (
    subject_type <> 'program'
    or rating is null
    or rating in ('continue', 'adjust', 'stop', 'escalate')
  );
