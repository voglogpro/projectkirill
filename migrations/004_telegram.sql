-- Public webhook identifiers avoid exposing internal integration identifiers.
-- Only a digest of Telegram's webhook secret is retained at rest.
ALTER TABLE bot_integrations
  ADD COLUMN public_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN webhook_secret_hash bytea,
  ADD COLUMN webhook_configured_at timestamptz,
  ADD CONSTRAINT bot_integrations_webhook_secret_hash_length
    CHECK (webhook_secret_hash IS NULL OR octet_length(webhook_secret_hash) = 32);

CREATE UNIQUE INDEX bot_integrations_public_id_uidx
  ON bot_integrations(public_id);

-- Durable inbox: accepting an update means it is safely persisted. A worker can
-- process pending rows and retry independently of Telegram's delivery window.
CREATE TABLE telegram_updates (
  integration_id uuid NOT NULL REFERENCES bot_integrations(id) ON DELETE CASCADE,
  update_id bigint NOT NULL CHECK (update_id >= 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  PRIMARY KEY (integration_id, update_id)
);

CREATE INDEX telegram_updates_pending_idx
  ON telegram_updates(received_at)
  WHERE processed_at IS NULL;
