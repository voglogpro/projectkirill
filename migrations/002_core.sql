BEGIN;

-- Composite keys below make tenant ownership enforceable by PostgreSQL rather
-- than relying exclusively on application-level WHERE clauses.
ALTER TABLE pages
  ADD CONSTRAINT pages_id_project_unique UNIQUE (id, project_id);

ALTER TABLE page_versions
  ADD CONSTRAINT page_versions_page_id_id_unique UNIQUE (page_id, id);

ALTER TABLE pages DROP CONSTRAINT pages_published_version_fk;
ALTER TABLE pages
  ADD CONSTRAINT pages_published_version_fk
  FOREIGN KEY (id, published_version_id)
  REFERENCES page_versions(page_id, id)
  ON DELETE SET NULL (published_version_id);

ALTER TABLE form_submissions DROP CONSTRAINT form_submissions_page_id_fkey;
ALTER TABLE form_submissions
  ADD CONSTRAINT form_submissions_page_project_fk
  FOREIGN KEY (page_id, project_id)
  REFERENCES pages(id, project_id)
  ON DELETE RESTRICT;

ALTER TABLE projects ADD COLUMN entry_page_id uuid;
ALTER TABLE projects
  ADD CONSTRAINT projects_entry_page_fk
  FOREIGN KEY (entry_page_id, id)
  REFERENCES pages(id, project_id)
  ON DELETE SET NULL (entry_page_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  replaced_by_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);
CREATE INDEX sessions_user_active_idx ON sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX sessions_family_idx ON sessions(family_id);

CREATE TABLE releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  published_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version),
  UNIQUE (project_id, id)
);

CREATE TABLE release_pages (
  release_id uuid NOT NULL,
  project_id uuid NOT NULL,
  page_id uuid NOT NULL,
  page_version_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (release_id, page_id),
  UNIQUE (release_id, slug),
  UNIQUE (release_id, position),
  FOREIGN KEY (project_id, release_id)
    REFERENCES releases(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (page_id, project_id)
    REFERENCES pages(id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (page_id, page_version_id)
    REFERENCES page_versions(page_id, id) ON DELETE RESTRICT
);
CREATE INDEX release_pages_project_idx ON release_pages(project_id, release_id);

ALTER TABLE projects ADD COLUMN published_release_id uuid;
ALTER TABLE projects
  ADD CONSTRAINT projects_published_release_fk
  FOREIGN KEY (id, published_release_id)
  REFERENCES releases(project_id, id)
  ON DELETE SET NULL (published_release_id);

CREATE TABLE preview_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX preview_grants_active_idx ON preview_grants(project_id, expires_at)
  WHERE revoked_at IS NULL;

-- Keep audit timestamps reliable even when future writers forget to set them.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pages_set_updated_at BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
