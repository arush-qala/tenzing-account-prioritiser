// ---------------------------------------------------------------------------
// Score Calibration (Min-Max Normalisation)
// ---------------------------------------------------------------------------
// After all accounts are scored independently, calibration rescales the raw
// priority scores to a 0-100 range so the distribution uses the full spectrum.
// Tiers are then re-determined from the calibrated scores.
// ---------------------------------------------------------------------------

import type { Account, ScoringResult, PriorityTier } from '@/lib/scoring/types';
import { TIER_BOUNDARIES } from '@/lib/scoring/weights';

/** Determine tier from a score using the standard boundaries */
function tierFromScore(score: number): PriorityTier {
  if (score >= TIER_BOUNDARIES.critical) return 'critical';
  if (score >= TIER_BOUNDARIES.high) return 'high';
  if (score >= TIER_BOUNDARIES.medium) return 'medium';
  if (score >= TIER_BOUNDARIES.low) return 'low';
  return 'monitor';
}

/**
 * Apply min-max normalisation across all scored accounts.
 *
 * Mutates the `calibratedScore` and `priorityTier` fields in-place.
 * If all raw scores are identical, calibrated scores default to 50.
 */
export function calibrateScores(
  results: { account: Account; result: ScoringResult }[],
): void {
  if (results.length === 0) return;

  // Find the raw score range
  let min = Infinity;
  let max = -Infinity;

  for (const { result } of results) {
    if (result.priorityScore < min) min = result.priorityScore;
    if (result.priorityScore > max) max = result.priorityScore;
  }

  const range = max - min;

  for (const { result } of results) {
    if (range === 0) {
      // All scores identical: place at midpoint
      result.calibratedScore = 50;
    } else {
      result.calibratedScore =
        ((result.priorityScore - min) / range) * 100;
    }

    // Re-determine tier from the calibrated score
    result.priorityTier = tierFromScore(result.calibratedScore);
  }
}
