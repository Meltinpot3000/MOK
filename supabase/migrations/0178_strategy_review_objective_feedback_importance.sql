-- 0178_strategy_review_objective_feedback_importance.sql
-- Ziel-Feedback: Bewertung der Wichtigkeit statt Handlungs-Optionen.

-- migrate:up

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_objective;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_objective check (
    subject_type <> 'objective'
    or rating is null
    or rating in (
      'less_important',
      'unchanged',
      'more_important',
      -- Legacy (bereits gespeicherte Einträge)
      'keep',
      'sharpen',
      'questionable'
    )
  );

-- migrate:down

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_objective;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_objective check (
    subject_type <> 'objective'
    or rating is null
    or rating in ('keep', 'sharpen', 'questionable')
  );
