BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  location text NOT NULL,
  region text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  phase text NOT NULL CHECK (phase IN ('Mobilisation', 'Structure', 'MEP', 'Finishes', 'Handover')),
  status text NOT NULL DEFAULT 'on-track' CHECK (status IN ('on-track', 'watch', 'at-risk')),
  progress numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  planned_progress numeric(5,2) NOT NULL DEFAULT 0 CHECK (planned_progress BETWEEN 0 AND 100),
  manager_name text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  contractor_name text NOT NULL DEFAULT '',
  contract_value text NOT NULL DEFAULT '',
  start_date date,
  target_date date,
  working_days_total integer NOT NULL DEFAULT 0,
  next_milestone text NOT NULL DEFAULT '',
  next_milestone_date date,
  report_recipients text[] NOT NULL DEFAULT '{}',
  accent text NOT NULL DEFAULT '#315c4c',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  phone_e164 text,
  preferred_language text NOT NULL DEFAULT 'en-hi' CHECK (preferred_language IN ('en', 'hi', 'en-hi')),
  call_time time NOT NULL DEFAULT '18:00',
  call_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  call_enabled boolean NOT NULL DEFAULT true,
  priority smallint NOT NULL DEFAULT 50,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  planned_date date NOT NULL,
  forecast_date date NOT NULL,
  progress numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'on-track' CHECK (status IN ('complete', 'on-track', 'watch')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN ('material', 'design', 'safety', 'labour', 'equipment', 'approval')),
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'resolved')),
  owner_name text NOT NULL DEFAULT 'Unassigned',
  raised_by text NOT NULL DEFAULT 'Voice agent',
  impacted_activity text NOT NULL DEFAULT '',
  due_date date,
  source_conversation_id text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES project_contacts(id) ON DELETE CASCADE,
  conversation_id text UNIQUE,
  provider_call_id text,
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('scheduled', 'in-progress', 'completed', 'missed', 'failed')),
  attempt smallint NOT NULL DEFAULT 1,
  duration_seconds integer NOT NULL DEFAULT 0,
  language text,
  sentiment text,
  summary text NOT NULL DEFAULT '',
  transcript jsonb NOT NULL DEFAULT '[]',
  answers jsonb NOT NULL DEFAULT '{}',
  analysis jsonb NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS voice_calls_daily_contact_attempt
  ON voice_calls (project_id, contact_id, ((scheduled_for AT TIME ZONE 'Asia/Kolkata')::date), attempt);
CREATE INDEX IF NOT EXISTS voice_calls_project_date ON voice_calls (project_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS voice_calls_status ON voice_calls (status, scheduled_for);

CREATE TABLE IF NOT EXISTS daily_reports (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sent', 'failed')),
  executive_summary text NOT NULL DEFAULT '',
  work_completed jsonb NOT NULL DEFAULT '[]',
  planned_tomorrow jsonb NOT NULL DEFAULT '[]',
  blockers jsonb NOT NULL DEFAULT '[]',
  safety_notes jsonb NOT NULL DEFAULT '[]',
  manpower integer NOT NULL DEFAULT 0,
  weather text NOT NULL DEFAULT '',
  calls_included integer NOT NULL DEFAULT 0,
  calls_expected integer NOT NULL DEFAULT 0,
  recipients text[] NOT NULL DEFAULT '{}',
  source_conversation_ids text[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  email_provider_id text,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (project_id, report_date)
);

CREATE TABLE IF NOT EXISTS project_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memory_key text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'superseded')),
  importance smallint NOT NULL DEFAULT 50 CHECK (importance BETWEEN 0 AND 100),
  source_conversation_id text,
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE (project_id, memory_key)
);

-- The company brain keeps immutable source evidence separate from evolving facts.
-- A fact can be resolved or superseded without deleting the original WhatsApp/call evidence.
CREATE TABLE IF NOT EXISTS source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('voice', 'whatsapp', 'dpr', 'manual')),
  external_id text,
  filename text,
  content_hash text NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  entry_count integer NOT NULL DEFAULT 0,
  imported_by text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, source_type, content_hash)
);

CREATE TABLE IF NOT EXISTS source_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  author text,
  occurred_at timestamptz NOT NULL,
  content text NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE (document_id, ordinal)
);
CREATE INDEX IF NOT EXISTS source_entries_project_time ON source_entries (project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS source_entries_search ON source_entries USING gin (search_vector);

CREATE TABLE IF NOT EXISTS memory_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('progress', 'issue', 'decision', 'commitment', 'risk', 'safety', 'material', 'milestone')),
  statement text NOT NULL,
  subject text,
  owner_name text,
  due_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'superseded')),
  confidence numeric(4,3) NOT NULL DEFAULT 0.7 CHECK (confidence BETWEEN 0 AND 1),
  importance smallint NOT NULL DEFAULT 50 CHECK (importance BETWEEN 0 AND 100),
  fingerprint text NOT NULL,
  first_observed_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  resolved_at timestamptz,
  supersedes_id uuid REFERENCES memory_facts(id),
  evidence_count integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS memory_facts_active ON memory_facts (project_id, status, importance DESC, last_observed_at DESC);
CREATE INDEX IF NOT EXISTS memory_facts_due ON memory_facts (project_id, due_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS memory_facts_statement_trgm ON memory_facts USING gin (statement gin_trgm_ops);

CREATE TABLE IF NOT EXISTS memory_fact_evidence (
  fact_id uuid NOT NULL REFERENCES memory_facts(id) ON DELETE CASCADE,
  source_entry_id uuid REFERENCES source_entries(id) ON DELETE CASCADE,
  conversation_id text,
  excerpt text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_entry_id IS NOT NULL OR conversation_id IS NOT NULL),
  UNIQUE NULLS NOT DISTINCT (fact_id, source_entry_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS brain_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  narrative text NOT NULL,
  current_state jsonb NOT NULL DEFAULT '{}',
  active_fact_ids uuid[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_key text NOT NULL,
  event_type text NOT NULL,
  payload_sha256 text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  UNIQUE (provider, event_key)
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS contacts_updated_at ON project_contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON project_contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS issues_updated_at ON issues;
CREATE TRIGGER issues_updated_at BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS calls_updated_at ON voice_calls;
CREATE TRIGGER calls_updated_at BEFORE UPDATE ON voice_calls FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
