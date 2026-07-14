-- 0179_strategy_review_direction_feedback_relevance.sql
-- Stoßrichtungs-Feedback: Relevanz-Bewertung statt Fortsetzen/Anpassen/Stoppen.

-- migrate:up

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_focus;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_focus check (
    subject_type <> 'focus_area'
    or rating is null
    or rating in (
      'decreasing_relevance',
      'unchanged_relevance',
      'increasing_relevance',
      -- Legacy
      'high_impact',
      'medium_impact',
      'low_impact',
      'negative_impact',
      'continue',
      'adjust',
      'stop',
      'escalate',
      'revisit_direction',
      'revisit_objective'
    )
  );

-- migrate:down

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_rating_focus;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_rating_focus check (
    subject_type <> 'focus_area'
    or rating is null
    or rating in (
      'high_impact',
      'medium_impact',
      'low_impact',
      'negative_impact',
      'continue',
      'adjust',
      'stop',
      'escalate',
      'revisit_direction',
      'revisit_objective'
    )
  );
