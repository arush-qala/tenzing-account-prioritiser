-- ============================================================
-- 001_create_tables.sql
-- Tenzing AI Account Prioritisation Tool — Database Schema
-- ============================================================

-- =========================
-- 1. accounts
-- =========================
CREATE TABLE IF NOT EXISTS accounts (
  -- Primary key
  account_id           TEXT PRIMARY KEY,

  -- Identifiers & metadata
  external_account_ref TEXT,
  account_name         TEXT NOT NULL,
  website              TEXT,
  industry             TEXT,
  segment              TEXT,
  region               TEXT,
  account_status       TEXT,
  lifecycle_stage      TEXT,

  -- Ownership
  account_owner        TEXT,
  csm_owner            TEXT,
  support_tier         TEXT,

  -- Contract & billing
  contract_start_date  DATE,
  renewal_date         DATE,
  billing_frequency    TEXT,
  billing_currency     TEXT,
  arr_gbp              NUMERIC,

  -- Seats
  seats_purchased      INTEGER,
  seats_used           INTEGER,

  -- Satisfaction
  latest_nps           NUMERIC,

  -- Leads
  open_leads_count     INTEGER,
  avg_lead_score       NUMERIC,
  last_lead_activity_date DATE,

  -- Support
  open_tickets_count   INTEGER,
  urgent_open_tickets_count INTEGER,
  sla_breaches_90d     INTEGER,
  avg_csat_90d         NUMERIC,

  -- Revenue trends
  mrr_3m_ago_gbp       NUMERIC,
  mrr_current_gbp      NUMERIC,

  -- Usage
  usage_score_3m_ago   INTEGER,
  usage_score_current  INTEGER,

  -- Financial risk
  overdue_amount_gbp   NUMERIC,
  expansion_pipeline_gbp NUMERIC,
  contraction_risk_gbp NUMERIC,

  -- Engagement dates
  last_qbr_date        DATE,
  latest_note_date     DATE,

  -- Free-text / qualitative
  note_sentiment_hint  TEXT,
  recent_support_summary TEXT,
  recent_customer_note TEXT,
  recent_sales_note    TEXT,

  -- ---- Derived fields (computed at seed time) ----
  seat_utilisation_pct     FLOAT,
  mrr_trend_pct            FLOAT,
  usage_trend              INTEGER,
  days_to_renewal          INTEGER,
  data_completeness_score  FLOAT,

  -- ---- ML enrichment columns (populated later) ----
  is_anomaly               BOOLEAN,
  anomaly_score            FLOAT,
  cluster_id               INTEGER,
  cluster_label            TEXT,
  support_sentiment_vader  FLOAT,
  customer_sentiment_vader FLOAT,
  sales_sentiment_vader    FLOAT,
  sentiment_disagreement   BOOLEAN
);

-- =========================
-- 2. ai_analyses
-- =========================
CREATE TABLE IF NOT EXISTS ai_analyses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,

  -- Scoring
  priority_score      FLOAT,
  priority_tier       TEXT,
  priority_type       TEXT,

  -- AI output
  reasoning           TEXT,
  recommended_actions JSONB,
  key_signals         JSONB,
  risk_factors        JSONB,
  opportunity_factors JSONB,

  -- Counterfactuals
  counterfactual_up   TEXT,
  counterfactual_down TEXT,

  -- Confidence & adjustments
  confidence_level    TEXT,
  adjusted_tier       TEXT,
  adjustment_reason   TEXT,

  -- Metadata
  analysed_at         TIMESTAMPTZ DEFAULT NOW(),
  model_version       TEXT
);

-- =========================
-- 3. actions
-- =========================
CREATE TABLE IF NOT EXISTS actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  action_type         TEXT,
  description         TEXT,
  ai_accuracy_rating  TEXT CHECK (ai_accuracy_rating IN ('wrong', 'partially_right', 'mostly_right', 'spot_on')),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- 4. portfolio_insights
-- =========================
CREATE TABLE IF NOT EXISTS portfolio_insights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insights            JSONB,
  generated_at        TIMESTAMPTZ DEFAULT NOW(),
  model_version       TEXT
);

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_ai_analyses_account_id ON ai_analyses(account_id);
CREATE INDEX IF NOT EXISTS idx_actions_account_id ON actions(account_id);

-- =========================
-- Row-Level Security
-- =========================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_insights ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users get full CRUD
CREATE POLICY "Authenticated users can read accounts"
  ON accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert accounts"
  ON accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update accounts"
  ON accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete accounts"
  ON accounts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read ai_analyses"
  ON ai_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ai_analyses"
  ON ai_analyses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ai_analyses"
  ON ai_analyses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete ai_analyses"
  ON ai_analyses FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read actions"
  ON actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert actions"
  ON actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update actions"
  ON actions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete actions"
  ON actions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read portfolio_insights"
  ON portfolio_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert portfolio_insights"
  ON portfolio_insights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update portfolio_insights"
  ON portfolio_insights FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete portfolio_insights"
  ON portfolio_insights FOR DELETE TO authenticated USING (true);
