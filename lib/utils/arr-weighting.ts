// ---------------------------------------------------------------------------
// ARR-Based Weighting
// ---------------------------------------------------------------------------
// Larger accounts get a modest uplift so they surface higher in the priority
// list all else being equal. The factor is intentionally gentle (log-scaled,
// clamped) so it nudges rather than dominates.
// ---------------------------------------------------------------------------

/**
 * Calculate the ARR multiplier for a single account.
 *
 * Formula: 1 + log10(arr / medianArr) * 0.3
 * Clamped to [0.7, 1.5] so no account is crushed or inflated.
 */
export function calculateArrFactor(arr: number, medianArr: number): number {
  if (medianArr <= 0 || arr <= 0) return 1;

  const raw = 1 + Math.log10(arr / medianArr) * 0.3;

  return Math.min(1.5, Math.max(0.7, raw));
}

/**
 * Get the median ARR across a set of accounts.
 * Expects an array of objects that each have an `arr_gbp` number field.
 */
export function getMedianArr(accounts: { arr_gbp: number }[]): number {
  if (accounts.length === 0) return 0;

  const sorted = accounts.map((a) => a.arr_gbp).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}
