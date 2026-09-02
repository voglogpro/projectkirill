CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE project_status AS ENUM ('draft', 'active', 'suspended');
CREATE TYPE bot_connection_status AS ENUM ('configuring', 'active', 'error', 'revoked');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  slug text NOT NULL CHECK (slug ~ '^[a-z][a-z0-9-]{1,62}[a-z0-9]$'),
  status project_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, slug)
);
CREATE INDEX projects_owner_idx ON projects(owner_user_id, updated_at DESC);

CREATE TABLE bot_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  telegram_bot_id bigint NOT NULL UNIQUE,
  bot_username text,
  bot_first_name text NOT NULL,
  encrypted_token jsonb NOT NULL,
  menu_button_text text NOT NULL CHECK (char_length(menu_button_text) BETWEEN 1 AND 64),
  mini_app_url text NOT NULL CHECK (mini_app_url LIKE 'https://%'),
  status bot_connection_status NOT NULL DEFAULT 'configuring',
  last_error text,
  configured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(encrypted_token) = 'object')
);

CREATE TABLE pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  draft_document jsonb NOT NULL,
  draft_revision integer NOT NULL DEFAULT 1 CHECK (draft_revision > 0),
  published_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug),
  CHECK (jsonb_typeof(draft_document) = 'object')
);
CREATE INDEX pages_project_idx ON pages(project_id, updated_at DESC);

CREATE TABLE page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  document jsonb NOT NULL,
  content_hash text NOT NULL,
  published_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version),
  CHECK (jsonb_typeof(document) = 'object')
);
ALTER TABLE pages
  ADD CONSTRAINT pages_published_version_fk
  FOREIGN KEY (published_version_id) REFERENCES page_versions(id) ON DELETE SET NULL;

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE RESTRICT,
  form_key text NOT NULL,
  telegram_user_id bigint,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX form_submissions_lookup_idx
  ON form_submissions(project_id, form_key, created_at DESC);

-- Transactional outbox is used by async bot/webhook jobs in later stages.
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON outbox_events(available_at)
  WHERE processed_at IS NULL;
