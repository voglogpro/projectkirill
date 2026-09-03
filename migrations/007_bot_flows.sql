BEGIN;

-- A project owns one bot scenario, mirroring how pages own their draft and
-- immutable versions: the draft is edited freely, publishing freezes a copy,
-- and the worker only ever reads the frozen one.
CREATE TABLE bot_flows (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  published_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bot_flow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES bot_flows(project_id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  document jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version),
  UNIQUE (project_id, id)
);

ALTER TABLE bot_flows
  ADD CONSTRAINT bot_flows_published_version_fk
  FOREIGN KEY (project_id, published_version_id)
  REFERENCES bot_flow_versions(project_id, id)
  ON DELETE SET NULL (published_version_id);

-- Where each subscriber's conversation is parked between updates. Rows are
-- disposable: losing one restarts that dialogue, it never corrupts a project.
CREATE TABLE bot_dialog_states (
  integration_id uuid NOT NULL REFERENCES bot_integrations(id) ON DELETE CASCADE,
  chat_id text NOT NULL CHECK (chat_id ~ '^-?[0-9]{1,20}$'),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (integration_id, chat_id)
);

-- Abandoned conversations are swept by age, so the index leads with time.
CREATE INDEX bot_dialog_states_stale_idx ON bot_dialog_states(updated_at);

COMMIT;
