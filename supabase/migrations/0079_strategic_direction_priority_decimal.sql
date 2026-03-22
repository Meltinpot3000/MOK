-- 0079_strategic_direction_priority_decimal.sql
-- Prioritaet = gewichteter Bewertungsscore (numeric 6,2); Spalte direction_score entfaellt.
-- migrate:up

ALTER TABLE app.strategic_directions
  DROP CONSTRAINT IF EXISTS strategic_directions_priority_check;

ALTER TABLE app.strategic_directions
  ALTER COLUMN priority TYPE numeric(6,2)
  USING (round(direction_score::numeric, 2));

ALTER TABLE app.strategic_directions
  ALTER COLUMN priority SET DEFAULT 3.00;

ALTER TABLE app.strategic_directions
  ADD CONSTRAINT strategic_directions_priority_check
  CHECK (priority >= 1.00 AND priority <= 5.00);

ALTER TABLE app.strategic_directions
  DROP COLUMN IF EXISTS direction_score;

COMMENT ON COLUMN app.strategic_directions.priority IS
  'Gewichteter Score aus strategischem Wert, Passung, Machbarkeit und Risiko (1–5, zwei Nachkommastellen).';

-- migrate:down

ALTER TABLE app.strategic_directions
  ADD COLUMN IF NOT EXISTS direction_score numeric(6,2) NOT NULL DEFAULT 3.00;

UPDATE app.strategic_directions
SET direction_score = priority;

ALTER TABLE app.strategic_directions
  DROP CONSTRAINT IF EXISTS strategic_directions_priority_check;

ALTER TABLE app.strategic_directions
  ALTER COLUMN priority TYPE smallint
  USING (round(priority)::smallint);

ALTER TABLE app.strategic_directions
  ALTER COLUMN priority SET DEFAULT 3;

ALTER TABLE app.strategic_directions
  ADD CONSTRAINT strategic_directions_priority_check
  CHECK (priority >= 1 AND priority <= 5);
