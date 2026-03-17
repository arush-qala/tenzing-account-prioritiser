// ---------------------------------------------------------------------------
// Display Formatting Utilities
// ---------------------------------------------------------------------------

import type { PriorityTier, PriorityType } from '@/lib/scoring/types';

/**
 * Format a GBP amount as a short readable string.
 * Examples: 1234 -> "£1.2K", 1500000 -> "£1.5M"
 */
export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    // Show 1 decimal place; drop .0
    const formatted =
      millions % 1 === 0
        ? millions.toFixed(0)
        : millions.toFixed(1);
    return `${sign}£${formatted}M`;
  }

  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    const formatted =
      thousands % 1 === 0
        ? thousands.toFixed(0)
        : thousands.toFixed(1);
    return `${sign}£${formatted}K`;
  }

  return `${sign}£${abs.toFixed(0)}`;
}

/**
 * Format a numeric value as a percentage string.
 * @param value  The value to format (e.g. 12.345)
 * @param decimals  Decimal places (default 1)
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a date string (or null) as a human-readable "X ago" string.
 * Uses the reference date 2026-03-17 for consistency.
 */
export function formatDaysAgo(date: string | null): string {
  if (!date) return 'No data';

  const REFERENCE_DATE = new Date('2026-03-17T00:00:00Z');
  const target = new Date(date + 'T00:00:00Z');
  const diffMs = REFERENCE_DATE.getTime() - target.getTime();

  if (diffMs < 0) {
    // Future date
    const days = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    if (days === 1) return 'in 1 day';
    if (days < 30) return `in ${days} days`;
    const months = Math.floor(days / 30);
    if (months === 1) return 'in 1 month';
    return `in ${months} months`;
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;

  const years = Math.floor(months / 12);
  if (years === 1) return '1 year ago';
  return `${years} years ago`;
}

/** Capitalize a priority tier label for display */
export function formatTier(tier: PriorityTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** Human-readable priority type labels */
const TYPE_LABELS: Record<PriorityType, string> = {
  churn_risk: 'Churn Risk',
  renewal_urgent: 'Renewal Urgent',
  expansion_opportunity: 'Expansion Opportunity',
  mixed_signals: 'Mixed Signals',
  stable: 'Stable',
};

export function formatType(type: PriorityType): string {
  return TYPE_LABELS[type];
}
