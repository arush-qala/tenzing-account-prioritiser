import type { PriorityTier, PriorityType } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// TIER styles (severity scale) — solid filled badges
// ---------------------------------------------------------------------------

export const TIER_BADGE_CLASSES: Record<PriorityTier, string> = {
  critical:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
  medium:
    'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  monitor:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400',
};

export const TIER_HEX: Record<PriorityTier, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  monitor: '#9ca3af',
};

export const TIER_LABELS: Record<PriorityTier, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  monitor: 'Monitor',
};

// ---------------------------------------------------------------------------
// TYPE styles (categorical) — outlined badges, distinct colour palette
// ---------------------------------------------------------------------------

export const TYPE_BADGE_CLASSES: Record<PriorityType, string> = {
  churn_risk:
    'bg-transparent text-rose-700 border-2 border-rose-300 dark:text-rose-400 dark:border-rose-500/50',
  renewal_urgent:
    'bg-transparent text-violet-700 border-2 border-violet-300 dark:text-violet-400 dark:border-violet-500/50',
  expansion_opportunity:
    'bg-transparent text-teal-700 border-2 border-teal-300 dark:text-teal-400 dark:border-teal-500/50',
  mixed_signals:
    'bg-transparent text-amber-700 border-2 border-amber-300 dark:text-amber-400 dark:border-amber-500/50',
  stable:
    'bg-transparent text-emerald-700 border-2 border-emerald-300 dark:text-emerald-400 dark:border-emerald-500/50',
};

export const TYPE_LABELS: Record<PriorityType, string> = {
  churn_risk: 'Churn Risk',
  renewal_urgent: 'Renewal Urgent',
  expansion_opportunity: 'Expansion',
  mixed_signals: 'Mixed Signals',
  stable: 'Stable',
};
