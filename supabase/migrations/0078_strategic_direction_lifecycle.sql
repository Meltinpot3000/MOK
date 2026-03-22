-- 0078_strategic_direction_lifecycle.sql
-- Stoßrichtungen: Draft → Approved → Active → On Hold → Closed (DB: snake_case)
-- migrate:up

UPDATE app.strategic_directions
SET status = 'closed'
WHERE status IN ('completed', 'archived');

ALTER TABLE app.strategic_directions
  DROP CONSTRAINT IF EXISTS strategic_directions_status_check;

ALTER TABLE app.strategic_directions
  ADD CONSTRAINT strategic_directions_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'active'::text, 'on_hold'::text, 'closed'::text]));

COMMENT ON COLUMN app.strategic_directions.status IS 'Lifecycle: draft, approved, active, on_hold, closed.';

-- migrate:down

ALTER TABLE app.strategic_directions
  DROP CONSTRAINT IF EXISTS strategic_directions_status_check;

UPDATE app.strategic_directions SET status = 'draft' WHERE status = 'approved';
UPDATE app.strategic_directions SET status = 'completed' WHERE status = 'closed';

ALTER TABLE app.strategic_directions
  ADD CONSTRAINT strategic_directions_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'on_hold'::text, 'completed'::text, 'archived'::text]));
