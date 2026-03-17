// ---------------------------------------------------------------------------
// Scoring Weight Configuration
// ---------------------------------------------------------------------------
// All weights are separated from logic so they are auditable in one place.
// Every weight set sums to 1.0 within its group.
// ---------------------------------------------------------------------------

/** Top-level sub-score weights (sum = 1.0) */
export const SUB_SCORE_WEIGHTS = {
  revenueHealth: 0.25,
  engagement: 0.25,
  supportHealth: 0.15,
  opportunity: 0.20,
  urgency: 0.15,
} as const;

/**
 * Health composite weights (first 4 sub-scores, rescaled to 1.0).
 * Urgency is excluded because it feeds into priority separately.
 */
export const HEALTH_WEIGHTS = {
  revenueHealth: 0.29,
  engagement: 0.29,
  supportHealth: 0.18,
  opportunity: 0.24,
} as const;

/** Priority score mix: how much weight health vs urgency gets */
export const PRIORITY_MIX = {
  health: 0.6,
  urgency: 0.4,
} as const;

/** Priority tier lower boundaries (score >= boundary = that tier) */
export const TIER_BOUNDARIES = {
  critical: 80,
  high: 65,
  medium: 50,
  low: 35,
} as const;

// ---------------------------------------------------------------------------
// Internal signal weights within each sub-score
// ---------------------------------------------------------------------------

export const REVENUE_HEALTH_WEIGHTS = {
  mrr_trend: 0.45,
  contraction_risk: 0.30,
  overdue: 0.25,
} as const;

export const ENGAGEMENT_WEIGHTS = {
  usage_current: 0.30,
  usage_trend: 0.25,
  seat_util: 0.25,
  nps: 0.20,
} as const;

export const SUPPORT_HEALTH_WEIGHTS = {
  urgent: 0.30,
  sla: 0.30,
  csat: 0.25,
  volume: 0.15,
} as const;

export const OPPORTUNITY_WEIGHTS = {
  pipeline: 0.50,
  lifecycle: 0.25,
  leads: 0.25,
} as const;

export const URGENCY_WEIGHTS = {
  renewal: 0.40,
  qbr: 0.25,
  notes: 0.20,
  paused: 0.15,
} as const;
