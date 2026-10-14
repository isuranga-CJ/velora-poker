-- Apply only to the new Velora database. Private runtime schema is never exposed through the Data API.
BEGIN;
CREATE SCHEMA IF NOT EXISTS poker_private;
REVOKE ALL ON SCHEMA poker_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS poker_private.runtime_state (
  id integer PRIMARY KEY CHECK(id=1),
  owner_id uuid NOT NULL,
  revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  data jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS poker_private.wallet_audit (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  delta bigint NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_audit_user_time ON poker_private.wallet_audit(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS poker_private.completed_hands (
  id uuid PRIMARY KEY,
  table_id text NOT NULL,
  result jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS completed_hands_table_time ON poker_private.completed_hands(table_id,completed_at DESC);
ALTER TABLE poker_private.runtime_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_private.wallet_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_private.completed_hands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA poker_private FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON SCHEMA poker_private FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA poker_private FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON SCHEMA poker_private FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA poker_private FROM authenticated;
  END IF;
END $$;
COMMIT;
