// ---------------------------------------------------------------------------
// Signal Extraction Functions
// ---------------------------------------------------------------------------
// Each function takes an Account and returns a normalised 0-100 score.
// Higher = healthier / better for health signals.
// Higher = more urgent for urgency signals.
// All functions are pure with no side effects.
// ---------------------------------------------------------------------------

import type { Account } from '@/lib/scoring/types';

/** Reference date for all date-based calculations */
const REFERENCE_DATE = new Date('2026-03-17T00:00:00Z');

/** Helper: days between reference date and a date string. Positive = past. */
function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  const diffMs = REFERENCE_DATE.getTime() - d.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ===== REVENUE HEALTH SIGNALS ==============================================

/**
 * MRR Trend: how fast is revenue growing or shrinking?
 * Uses the pre-computed mrr_trend_pct field.
 */
export function scoreMrrTrend(account: Account): number {
  const pct = account.mrr_trend_pct;

  if (pct >= 5) return 95;
  if (pct >= 2) return 80;
  if (pct >= -2) return 55;
  if (pct >= -5) return 30;
  return 10;
}

/**
 * Contraction Risk: how much ARR is at risk of contraction?
 * contraction_ratio = contraction_risk_gbp / arr_gbp * 100
 */
export function scoreContractionRisk(account: Account): number {
  if (account.arr_gbp <= 0) return 50;

  const ratio = (account.contraction_risk_gbp / account.arr_gbp) * 100;

  if (ratio < 5) return 90;
  if (ratio < 15) return 60;
  if (ratio < 30) return 30;
  return 10;
}

/**
 * Overdue Ratio: overdue amount as a % of monthly revenue.
 * Null overdue = unknown, scored at 85 (benefit of doubt, not rewarded).
 */
export function scoreOverdue(account: Account): number {
  if (account.overdue_amount_gbp === null || account.overdue_amount_gbp === undefined) {
    return 85;
  }
  if (account.overdue_amount_gbp === 0) return 85;

  const monthlyRevenue = account.arr_gbp / 12;
  if (monthlyRevenue <= 0) return 50;

  const ratio = (account.overdue_amount_gbp / monthlyRevenue) * 100;

  if (ratio < 50) return 70;
  if (ratio <= 100) return 45;
  return 15;
}

// ===== ENGAGEMENT SIGNALS ===================================================

/**
 * Current Usage Score: direct passthrough (already 0-100 in the data).
 */
export function scoreUsageCurrent(account: Account): number {
  return account.usage_score_current;
}

/**
 * Usage Trend: change in usage score over 3 months.
 * Uses the pre-computed usage_trend field.
 */
export function scoreUsageTrend(account: Account): number {
  const change = account.usage_trend;

  if (change >= 15) return 95;
  if (change >= 5) return 75;
  if (change >= -5) return 50;
  if (change >= -15) return 25;
  return 10;
}

/**
 * Seat Utilisation: what % of purchased seats are in use?
 * Uses the pre-computed seat_utilisation_pct field (0-1 range).
 */
export function scoreSeatUtil(account: Account): number {
  const pct = account.seat_utilisation_pct * 100;

  if (pct > 85) return 95;
  if (pct >= 70) return 75;
  if (pct >= 50) return 45;
  return 15;
}

/**
 * NPS Score.
 * Null NPS returns midpoint 50 (neutral assumption, flagged as low confidence).
 */
export function scoreNps(account: Account): number {
  if (account.latest_nps === null || account.latest_nps === undefined) {
    return 50;
  }

  const nps = account.latest_nps;

  if (nps > 50) return 95;
  if (nps >= 20) return 70;
  if (nps >= 0) return 40;
  return 15;
}

// ===== SUPPORT HEALTH SIGNALS ===============================================

/**
 * Urgent Open Tickets: fewer = healthier.
 */
export function scoreUrgentTickets(account: Account): number {
  const count = account.urgent_open_tickets_count;

  if (count === 0) return 100;
  if (count === 1) return 60;
  if (count === 2) return 30;
  return 10;
}

/**
 * SLA Breaches in last 90 days.
 */
export function scoreSlaBreach(account: Account): number {
  const count = account.sla_breaches_90d;

  if (count === 0) return 100;
  if (count === 1) return 70;
  if (count <= 3) return 40;
  return 10;
}

/**
 * Average CSAT (90-day).
 * Null returns midpoint 50.
 */
export function scoreCsat(account: Account): number {
  if (account.avg_csat_90d === null || account.avg_csat_90d === undefined) {
    return 50;
  }

  const csat = account.avg_csat_90d;

  if (csat > 4.5) return 95;
  if (csat >= 4.0) return 75;
  if (csat >= 3.5) return 50;
  if (csat >= 3.0) return 25;
  return 10;
}

/**
 * Ticket Volume normalised by segment.
 * Enterprise has higher thresholds (more tickets expected at scale).
 */
export function scoreTicketVolume(account: Account): number {
  const count = account.open_tickets_count;
  const segment = account.segment;

  if (segment === 'Enterprise') {
    if (count <= 2) return 90;
    if (count <= 4) return 60;
    if (count <= 6) return 35;
    return 15;
  }

  if (segment === 'Mid-Market') {
    if (count <= 1) return 90;
    if (count <= 3) return 60;
    if (count <= 5) return 35;
    return 15;
  }

  // SMB
  if (count === 0) return 90;
  if (count === 1) return 60;
  if (count <= 3) return 35;
  return 15;
}

// ===== OPPORTUNITY SIGNALS ==================================================

/**
 * Expansion Pipeline as % of ARR.
 */
export function scorePipeline(account: Account): number {
  if (account.arr_gbp <= 0) return 10;

  const ratio = (account.expansion_pipeline_gbp / account.arr_gbp) * 100;

  if (ratio > 25) return 95;
  if (ratio >= 15) return 75;
  if (ratio >= 5) return 50;
  if (ratio >= 1) return 30;
  return 10;
}

/**
 * Lifecycle Stage: Expansion accounts have the most opportunity.
 */
export function scoreLifecycle(account: Account): number {
  switch (account.lifecycle_stage) {
    case 'Expansion':
      return 85;
    case 'Renewal':
      return 50;
    case 'Customer':
      return 40;
    default:
      return 40;
  }
}

/**
 * Lead Activity: composite of lead count, quality, and recency.
 */
export function scoreLeadActivity(account: Account): number {
  if (account.open_leads_count === 0) return 20;

  const avgScore = account.avg_lead_score;
  const lastActivity = account.last_lead_activity_date;

  // Check recency: activity within last 14 days
  let isRecent = false;
  if (lastActivity) {
    const daysAgo = daysSince(lastActivity);
    if (daysAgo !== null && daysAgo < 14) {
      isRecent = true;
    }
  }

  if (avgScore !== null && avgScore > 70 && isRecent) return 90;
  if (avgScore !== null && avgScore > 50) return 65;
  return 40;
}

// ===== URGENCY SIGNALS ======================================================

/**
 * Renewal Urgency: days until renewal, weighted by lifecycle stage.
 * Non-renewal accounts get a flat low score.
 */
export function scoreRenewalUrgency(account: Account): number {
  if (account.lifecycle_stage !== 'Renewal') return 20;

  const days = account.days_to_renewal;

  if (days < 30) return 100;
  if (days < 60) return 80;
  if (days < 90) return 60;
  if (days < 180) return 40;
  return 20;
}

/**
 * QBR Recency: longer since last QBR = more urgent (needs attention).
 * Null = no QBR on record, treated as high urgency.
 */
export function scoreQbrRecency(account: Account): number {
  if (!account.last_qbr_date) return 80;

  const days = daysSince(account.last_qbr_date);
  if (days === null) return 80;

  if (days < 45) return 20;
  if (days < 90) return 40;
  if (days < 180) return 70;
  return 90;
}

/**
 * Note Recency: longer since last note = more urgent (account going dark).
 * Null = no notes, treated as high urgency.
 */
export function scoreNoteRecency(account: Account): number {
  if (!account.latest_note_date) return 80;

  const days = daysSince(account.latest_note_date);
  if (days === null) return 80;

  if (days < 14) return 20;
  if (days < 30) return 40;
  if (days < 60) return 65;
  return 85;
}

/**
 * Paused Status: paused accounts need immediate attention.
 */
export function scorePausedStatus(account: Account): number {
  return account.account_status === 'Paused' ? 90 : 20;
}
