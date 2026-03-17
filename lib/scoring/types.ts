// ---------------------------------------------------------------------------
// Scoring Engine Types
// ---------------------------------------------------------------------------

/** Priority tier — ordered from most to least urgent */
export type PriorityTier = 'critical' | 'high' | 'medium' | 'low' | 'monitor';

/** Priority type — the dominant pattern driving the score */
export type PriorityType =
  | 'churn_risk'
  | 'renewal_urgent'
  | 'expansion_opportunity'
  | 'mixed_signals'
  | 'stable';

// ---------------------------------------------------------------------------
// Account (matches CSV columns + derived + ML enrichment)
// ---------------------------------------------------------------------------

export interface Account {
  // --- Group 1: Identity ---
  account_id: string;
  external_account_ref: string;
  account_name: string;
  website: string;
  industry: string;
  segment: 'Enterprise' | 'Mid-Market' | 'SMB';
  region: 'US' | 'EU' | 'UK';

  // --- Group 2: Status ---
  account_status: 'Active' | 'Paused';
  lifecycle_stage: 'Customer' | 'Renewal' | 'Expansion';

  // --- Group 3: Ownership ---
  account_owner: string;
  csm_owner: string;
  support_tier: 'Standard' | 'Priority' | 'Enterprise';

  // --- Group 4: Contract & Billing ---
  contract_start_date: string;
  renewal_date: string;
  billing_frequency: 'Monthly' | 'Annual' | 'Quarterly';
  billing_currency: string;
  arr_gbp: number;

  // --- Group 5: Usage ---
  seats_purchased: number;
  seats_used: number;
  usage_score_3m_ago: number;
  usage_score_current: number;

  // --- Group 6: Sentiment ---
  latest_nps: number | null;
  avg_csat_90d: number | null;
  note_sentiment_hint: 'Positive' | 'Negative' | 'Mixed' | 'Neutral' | null;

  // --- Group 7: Lead Activity ---
  open_leads_count: number;
  avg_lead_score: number | null;
  last_lead_activity_date: string | null;

  // --- Group 8: Support ---
  open_tickets_count: number;
  urgent_open_tickets_count: number;
  sla_breaches_90d: number;

  // --- Group 9: Revenue Trends ---
  mrr_3m_ago_gbp: number;
  mrr_current_gbp: number;
  overdue_amount_gbp: number | null;
  expansion_pipeline_gbp: number;
  contraction_risk_gbp: number;

  // --- Group 10: Engagement Dates ---
  last_qbr_date: string | null;
  latest_note_date: string | null;

  // --- Group 11: Qualitative Notes ---
  recent_support_summary: string | null;
  recent_customer_note: string | null;
  recent_sales_note: string | null;

  // --- Derived fields (computed at ingestion) ---
  seat_utilisation_pct: number;
  mrr_trend_pct: number;
  usage_trend: number;
  days_to_renewal: number;
  data_completeness_score: number;

  // --- ML enrichment columns (from Python preprocessing) ---
  is_anomaly: number | null;
  anomaly_score: number | null;
  cluster_id: number | null;
  cluster_label: string | null;
  support_sentiment_vader: number | null;
  customer_sentiment_vader: number | null;
  sales_sentiment_vader: number | null;
  sentiment_disagreement: number | null;
}

// ---------------------------------------------------------------------------
// Sub-scores
// ---------------------------------------------------------------------------

export interface SubScores {
  revenueHealth: number;
  engagement: number;
  supportHealth: number;
  opportunity: number;
  urgency: number;
}

// ---------------------------------------------------------------------------
// Contradiction (conflicting signals within an account)
// ---------------------------------------------------------------------------

export interface Contradiction {
  signal1: string;
  signal2: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Scoring result for a single account
// ---------------------------------------------------------------------------

export interface ScoringResult {
  subScores: SubScores;
  healthComposite: number;
  priorityScore: number;
  priorityTier: PriorityTier;
  priorityType: PriorityType;
  contradictions: Contradiction[];
  arrFactor: number;
  calibratedScore: number;
}

// ---------------------------------------------------------------------------
// Counterfactual analysis ("what would move this account up/down a tier?")
// ---------------------------------------------------------------------------

export interface CounterfactualResult {
  subScore: string;
  currentValue: number;
  pointsToNextTier: number;
  direction: 'up' | 'down';
  description: string;
}
