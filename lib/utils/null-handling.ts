// ---------------------------------------------------------------------------
// Null / Missing-Value Utilities
// ---------------------------------------------------------------------------

import type { Account } from '@/lib/scoring/types';

/**
 * Safely coerce an unknown value to a number.
 * Returns `null` for NaN, undefined, null, and empty strings.
 * Accepts an optional fallback that is returned instead of null.
 */
export function safeNumber(val: unknown, fallback?: number): number | null {
  if (val === null || val === undefined || val === '') return fallback ?? null;

  const n = typeof val === 'number' ? val : Number(val);

  if (Number.isNaN(n)) return fallback ?? null;

  return n;
}

// ---------------------------------------------------------------------------
// Data Completeness
// ---------------------------------------------------------------------------

/**
 * Key nullable fields that affect scoring confidence.
 * A non-null value counts as 1; null/undefined counts as 0.
 */
const KEY_NULLABLE_FIELDS: (keyof Account)[] = [
  'latest_nps',
  'avg_csat_90d',
  'note_sentiment_hint',
  'last_qbr_date',
  'latest_note_date',
  'recent_customer_note',
  'recent_sales_note',
  'overdue_amount_gbp',
];

/**
 * Compute data completeness as a percentage (0-100).
 * Measures how many of the key nullable fields are present.
 */
export function computeDataCompleteness(account: Account): number {
  let present = 0;

  for (const field of KEY_NULLABLE_FIELDS) {
    const val = account[field];
    if (val !== null && val !== undefined && val !== '') {
      present++;
    }
  }

  return Math.round((present / KEY_NULLABLE_FIELDS.length) * 100);
}
