ALTER TABLE form_submissions
  ADD COLUMN request_id uuid NOT NULL,
  ADD COLUMN schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  ADD CONSTRAINT form_submissions_project_request_unique UNIQUE (project_id, request_id);

