-- 0109_okr_review_sessions_facilitator_delete.sql
-- Facilitator darf Session löschen, solange nicht in_progress / completed (wie UI sessionIsDeletable).

-- migrate:up

drop policy if exists okr_review_sessions_delete on app.okr_review_sessions;

create policy okr_review_sessions_delete on app.okr_review_sessions
for delete using (
  app.has_permission(organization_id, 'okr.review.session.manage'::text)
  or (
    facilitator_membership_id = app._strategy_review_current_membership(organization_id)
    and status = any (array['draft'::text, 'scheduled'::text, 'cancelled'::text])
  )
);

-- migrate:down

drop policy if exists okr_review_sessions_delete on app.okr_review_sessions;

create policy okr_review_sessions_delete on app.okr_review_sessions
for delete using (app.has_permission(organization_id, 'okr.review.session.manage'::text));
