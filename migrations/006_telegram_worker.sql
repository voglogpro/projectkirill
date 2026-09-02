ALTER TABLE telegram_updates
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN lease_id uuid,
  ADD COLUMN dead_lettered_at timestamptz;

CREATE INDEX telegram_updates_ready_idx
  ON telegram_updates(next_attempt_at, received_at)
  WHERE processed_at IS NULL AND dead_lettered_at IS NULL;
