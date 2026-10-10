-- CivicLens demo rewards schema (PostgreSQL / Neon)
-- Run once against the same database configured in DATABASE_URL.
-- The API also lazily applies these CREATE TABLE statements on first use.

CREATE TABLE IF NOT EXISTS civiclens_demo_reward_accounts (
  account_id text PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civiclens_demo_reward_reports (
  report_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES civiclens_demo_reward_accounts(account_id),
  title text NOT NULL,
  category text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','verified','duplicate','rejected','reset')),
  quality_ok boolean NOT NULL DEFAULT true,
  quality_reason text,
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  origin text NOT NULL CHECK (origin IN ('submitted-report','sample')),
  server_duplicate boolean NOT NULL DEFAULT false,
  duplicate_of text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE civiclens_demo_reward_reports ADD COLUMN IF NOT EXISTS quality_ok boolean NOT NULL DEFAULT true;
ALTER TABLE civiclens_demo_reward_reports ADD COLUMN IF NOT EXISTS quality_reason text;

CREATE INDEX IF NOT EXISTS civiclens_demo_reports_fingerprint_idx
  ON civiclens_demo_reward_reports(fingerprint, status);
CREATE INDEX IF NOT EXISTS civiclens_demo_reports_account_idx
  ON civiclens_demo_reward_reports(account_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS civiclens_demo_reward_report_tokens (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES civiclens_demo_reward_accounts(account_id),
  report_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS civiclens_demo_report_tokens_lookup_idx
  ON civiclens_demo_reward_report_tokens(report_id, account_id, expires_at);

CREATE TABLE IF NOT EXISTS civiclens_demo_reward_claims (
  claim_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES civiclens_demo_reward_accounts(account_id),
  reward_id text NOT NULL,
  reward_title text NOT NULL,
  coupon_code text NOT NULL UNIQUE,
  points_cost integer NOT NULL CHECK (points_cost >= 0),
  status text NOT NULL CHECK (status IN ('claimed','redeemed','expired','void')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS civiclens_demo_claim_once_idx
  ON civiclens_demo_reward_claims(account_id, reward_id) WHERE status <> 'void';
CREATE INDEX IF NOT EXISTS civiclens_demo_claims_account_idx
  ON civiclens_demo_reward_claims(account_id, claimed_at DESC);

CREATE TABLE IF NOT EXISTS civiclens_demo_reward_ledger (
  id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  account_id text NOT NULL REFERENCES civiclens_demo_reward_accounts(account_id),
  event_type text NOT NULL CHECK (event_type IN ('starter_credit','report_submitted','report_verified','report_rejected','duplicate_blocked','reward_claimed','reward_redeemed','reward_expired','demo_reset')),
  title text NOT NULL,
  details text NOT NULL,
  points_delta integer NOT NULL DEFAULT 0,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS civiclens_demo_ledger_account_idx
  ON civiclens_demo_reward_ledger(account_id, created_at DESC);
