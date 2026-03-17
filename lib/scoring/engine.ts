// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------
// The intellectual core of the prioritisation tool. Two exported functions:
//
//   scoreAccount(account)     — score a single account (deterministic)
//   scoreAllAccounts(accounts) — score all accounts with calibration
//
// This module is pure TypeScript: no AI, no DB, no side effects.
// ---------------------------------------------------------------------------

import type {
  Account,
  SubScores,
  ScoringResult,
  PriorityTier,
  PriorityType,
  Contradiction,
} from '@/lib/scoring/types';

import {
  REVENUE_HEALTH_WEIGHTS,
  ENGAGEMENT_WEIGHTS,
  SUPPORT_HEALTH_WEIGHTS,
  OPPORTUNITY_WEIGHTS,
  URGENCY_WEIGHTS,
  HEALTH_WEIGHTS,
  PRIORITY_MIX,
  TIER_BOUNDARIES,
} from '@/lib/scoring/weights';

import {
  scoreMrrTrend,
  scoreContractionRisk,
  scoreOverdue,
  scoreUsageCurrent,
  scoreUsageTrend,
  scoreSeatUtil,
  scoreNps,
  scoreUrgentTickets,
  scoreSlaBreach,
  scoreCsat,
  scoreTicketVolume,
  scorePipeline,
  scoreLifecycle,
  scoreLeadActivity,
  scoreRenewalUrgency,
  scoreQbrRecency,
  scoreNoteRecency,
  scorePausedStatus,
} from '@/lib/scoring/signals';

import { detectContradictions } from '@/lib/scoring/contradictions';
import { calculateArrFactor, getMedianArr } from '@/lib/utils/arr-weighting';
import { calibrateScores } from '@/lib/scoring/calibration';

// ---------------------------------------------------------------------------
// Step 1: Calculate sub-scores
// ---------------------------------------------------------------------------

function calculateSubScores(account: Account): SubScores {
  // Revenue Health
  const revenueHealth =
    REVENUE_HEALTH_WEIGHTS.mrr_trend * scoreMrrTrend(account) +
    REVENUE_HEALTH_WEIGHTS.contraction_risk * scoreContractionRisk(account) +
    REVENUE_HEALTH_WEIGHTS.overdue * scoreOverdue(account);

  // Engagement
  const engagement =
    ENGAGEMENT_WEIGHTS.usage_current * scoreUsageCurrent(account) +
    ENGAGEMENT_WEIGHTS.usage_trend * scoreUsageTrend(account) +
    ENGAGEMENT_WEIGHTS.seat_util * scoreSeatUtil(account) +
    ENGAGEMENT_WEIGHTS.nps * scoreNps(account);

  // Support Health
  const supportHealth =
    SUPPORT_HEALTH_WEIGHTS.urgent * scoreUrgentTickets(account) +
    SUPPORT_HEALTH_WEIGHTS.sla * scoreSlaBreach(account) +
    SUPPORT_HEALTH_WEIGHTS.csat * scoreCsat(account) +
    SUPPORT_HEALTH_WEIGHTS.volume * scoreTicketVolume(account);

  // Opportunity
  const opportunity =
    OPPORTUNITY_WEIGHTS.pipeline * scorePipeline(account) +
    OPPORTUNITY_WEIGHTS.lifecycle * scoreLifecycle(account) +
    OPPORTUNITY_WEIGHTS.leads * scoreLeadActivity(account);

  // Urgency
  const urgency =
    URGENCY_WEIGHTS.renewal * scoreRenewalUrgency(account) +
    URGENCY_WEIGHTS.qbr * scoreQbrRecency(account) +
    URGENCY_WEIGHTS.notes * scoreNoteRecency(account) +
    URGENCY_WEIGHTS.paused * scorePausedStatus(account);

  return {
    revenueHealth: Math.round(revenueHealth * 100) / 100,
    engagement: Math.round(engagement * 100) / 100,
    supportHealth: Math.round(supportHealth * 100) / 100,
    opportunity: Math.round(opportunity * 100) / 100,
    urgency: Math.round(urgency * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Step 2: Health composite
// ---------------------------------------------------------------------------

function calculateHealthComposite(subScores: SubScores): number {
  const health =
    HEALTH_WEIGHTS.revenueHealth * subScores.revenueHealth +
    HEALTH_WEIGHTS.engagement * subScores.engagement +
    HEALTH_WEIGHTS.supportHealth * subScores.supportHealth +
    HEALTH_WEIGHTS.opportunity * subScores.opportunity;

  return Math.round(health * 100) / 100;
}

// ---------------------------------------------------------------------------
// Step 3: Priority score (higher = needs more attention)
// ---------------------------------------------------------------------------

function calculatePriorityScore(health: number, urgency: number): number {
  const raw = (100 - health) * PRIORITY_MIX.health + urgency * PRIORITY_MIX.urgency;
  return Math.round(raw * 100) / 100;
}

// ---------------------------------------------------------------------------
// Step 4: Determine tier from raw score
// ---------------------------------------------------------------------------

function determineTier(score: number): PriorityTier {
  if (score >= TIER_BOUNDARIES.critical) return 'critical';
  if (score >= TIER_BOUNDARIES.high) return 'high';
  if (score >= TIER_BOUNDARIES.medium) return 'medium';
  if (score >= TIER_BOUNDARIES.low) return 'low';
  return 'monitor';
}

// ---------------------------------------------------------------------------
// Step 5: Override rules for Critical tier
// ---------------------------------------------------------------------------

function applyCriticalOverrides(
  account: Account,
  health: number,
  tier: PriorityTier,
): PriorityTier {
  // Override 1: renewal < 45 days AND health < 40
  if (account.days_to_renewal < 45 && health < 40) {
    return 'critical';
  }

  // Override 2: contraction > 30% ARR AND negative sentiment
  if (account.arr_gbp > 0) {
    const contractionRatio = (account.contraction_risk_gbp / account.arr_gbp) * 100;
    if (contractionRatio > 30 && account.note_sentiment_hint === 'Negative') {
      return 'critical';
    }
  }

  return tier;
}

// ---------------------------------------------------------------------------
// Step 6: Determine priority type
// ---------------------------------------------------------------------------

function determinePriorityType(
  account: Account,
  health: number,
  contradictions: Contradiction[],
): PriorityType {
  const sentiment = account.note_sentiment_hint;
  const contractionRatio =
    account.arr_gbp > 0
      ? (account.contraction_risk_gbp / account.arr_gbp) * 100
      : 0;
  const pipelineRatio =
    account.arr_gbp > 0
      ? (account.expansion_pipeline_gbp / account.arr_gbp) * 100
      : 0;

  // churn_risk: health < 40 AND (negative sentiment OR contraction > 15%)
  if (health < 40 && (sentiment === 'Negative' || contractionRatio > 15)) {
    return 'churn_risk';
  }

  // renewal_urgent: lifecycle = Renewal AND days < 90 AND health < 60
  if (
    account.lifecycle_stage === 'Renewal' &&
    account.days_to_renewal < 90 &&
    health < 60
  ) {
    return 'renewal_urgent';
  }

  // expansion_opportunity: pipeline > 15% AND (positive sentiment OR Expansion)
  if (
    pipelineRatio > 15 &&
    (sentiment === 'Positive' || account.lifecycle_stage === 'Expansion')
  ) {
    return 'expansion_opportunity';
  }

  // mixed_signals: sentiment contradicts health, OR 'Mixed' sentiment hint,
  // OR contradictions detected in scoring signals
  if (
    sentiment === 'Mixed' ||
    (sentiment === 'Positive' && health < 45) ||
    (sentiment === 'Negative' && health > 65) ||
    contradictions.length > 0
  ) {
    return 'mixed_signals';
  }

  return 'stable';
}

// ---------------------------------------------------------------------------
// Step 7: Apply tier floors from priority types
// ---------------------------------------------------------------------------

/** Priority type tier floors: certain types guarantee a minimum tier */
const TIER_FLOORS: Partial<Record<PriorityType, PriorityTier>> = {
  churn_risk: 'high',
  renewal_urgent: 'high',
  expansion_opportunity: 'high',
  mixed_signals: 'medium',
};

/** Tier rank for comparison (lower index = more severe) */
const TIER_RANK: PriorityTier[] = ['critical', 'high', 'medium', 'low', 'monitor'];

function applyTierFloor(tier: PriorityTier, priorityType: PriorityType): PriorityTier {
  const floor = TIER_FLOORS[priorityType];
  if (!floor) return tier;

  const currentRank = TIER_RANK.indexOf(tier);
  const floorRank = TIER_RANK.indexOf(floor);

  // If current tier is less severe than the floor, elevate to floor
  if (currentRank > floorRank) return floor;

  return tier;
}

// ---------------------------------------------------------------------------
// Main: Score a single account
// ---------------------------------------------------------------------------

export function scoreAccount(account: Account, medianArr?: number): ScoringResult {
  // Step 1: Sub-scores
  const subScores = calculateSubScores(account);

  // Step 2: Health composite
  const healthComposite = calculateHealthComposite(subScores);

  // Step 3: Priority score
  const priorityScore = calculatePriorityScore(healthComposite, subScores.urgency);

  // Step 4: Tier
  let priorityTier = determineTier(priorityScore);

  // Step 5: Critical overrides
  priorityTier = applyCriticalOverrides(account, healthComposite, priorityTier);

  // Step 6: Contradictions (moved before priority type so type can use them)
  const contradictions: Contradiction[] = detectContradictions(account, subScores);

  // Step 7: Priority type
  const priorityType = determinePriorityType(account, healthComposite, contradictions);

  // Step 8: Tier floors
  priorityTier = applyTierFloor(priorityTier, priorityType);

  // Step 9: ARR factor
  const arrFactor = medianArr
    ? calculateArrFactor(account.arr_gbp, medianArr)
    : 1;

  return {
    subScores,
    healthComposite,
    priorityScore,
    priorityTier,
    priorityType,
    contradictions,
    arrFactor,
    calibratedScore: priorityScore, // pre-calibration, will be overwritten
  };
}

// ---------------------------------------------------------------------------
// Batch: Score all accounts with calibration
// ---------------------------------------------------------------------------

export function scoreAllAccounts(
  accounts: Account[],
): { account: Account; result: ScoringResult }[] {
  if (accounts.length === 0) return [];

  // Compute median ARR across the portfolio
  const medianArr = getMedianArr(accounts);

  // Score each account
  const results = accounts.map((account) => ({
    account,
    result: scoreAccount(account, medianArr),
  }));

  // Apply min-max calibration (mutates calibratedScore + re-determines tiers)
  calibrateScores(results);

  // Re-apply critical overrides and tier floors after calibration
  // (calibration may have shifted tiers; overrides must still hold)
  for (const { account, result } of results) {
    result.priorityTier = applyCriticalOverrides(
      account,
      result.healthComposite,
      result.priorityTier,
    );
    result.priorityTier = applyTierFloor(result.priorityTier, result.priorityType);
  }

  return results;
}
