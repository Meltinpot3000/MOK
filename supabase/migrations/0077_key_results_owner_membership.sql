-- 0077_key_results_owner_membership.sql
-- KR-Owner optional; OKR-Review RLS für okr.read/okr.write; Unique für Review-Upsert.
-- migrate:up

ALTER TABLE app.key_results
  ADD COLUMN IF NOT EXISTS owner_membership_id uuid REFERENCES app.organization_memberships(id) ON DELETE SET NULL;

COMMENT ON COLUMN app.key_results.owner_membership_id IS 'Optional KR owner; UI falls back to objectives.owner_membership_id when null.';

CREATE INDEX IF NOT EXISTS idx_key_results_owner_membership
  ON app.key_results (organization_id, owner_membership_id)
  WHERE owner_membership_id IS NOT NULL;

CREATE POLICY okr_reviews_modify_okr_write ON app.okr_reviews
  USING (app.has_permission(organization_id, 'okr.write'::text))
  WITH CHECK (app.has_permission(organization_id, 'okr.write'::text));

CREATE POLICY okr_reviews_select_okr_read ON app.okr_reviews
  FOR SELECT
  USING (app.has_permission(organization_id, 'okr.read'::text));

CREATE UNIQUE INDEX IF NOT EXISTS okr_reviews_one_per_okr_session
  ON app.okr_reviews (organization_id, okr_cycle_id, cycle_instance_id, review_type)
  WHERE okr_cycle_id IS NOT NULL;

-- migrate:down

DROP INDEX IF EXISTS app.okr_reviews_one_per_okr_session;

DROP POLICY IF EXISTS okr_reviews_select_okr_read ON app.okr_reviews;
DROP POLICY IF EXISTS okr_reviews_modify_okr_write ON app.okr_reviews;

DROP INDEX IF EXISTS app.idx_key_results_owner_membership;

ALTER TABLE app.key_results DROP COLUMN IF EXISTS owner_membership_id;
