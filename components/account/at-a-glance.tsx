'use client';

import type { Account, ScoringResult } from '@/lib/scoring/types';
import { formatCurrency } from '@/lib/utils/format';
import { Badge } from '@/components/ui/badge';

interface AtAGlanceProps {
  account: Account;
  result: ScoringResult;
}

const TIER_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
  monitor: 'bg-slate-100 text-slate-700',
};

export function AtAGlance({ account, result }: AtAGlanceProps) {
  const metrics = [
    {
      label: 'ARR',
      value: formatCurrency(account.arr_gbp),
      alert: false,
    },
    {
      label: 'Renewal',
      value: `${account.days_to_renewal}d`,
      alert: account.days_to_renewal <= 30,
    },
    {
      label: 'Usage',
      value: `${account.usage_score_current ?? 'N/A'}`,
      alert: (account.usage_score_current ?? 100) < 50,
    },
    {
      label: 'NPS',
      value: account.latest_nps != null ? `${account.latest_nps}` : 'N/A',
      alert: account.latest_nps != null && account.latest_nps < 0,
    },
    {
      label: 'MRR Trend',
      value: `${((account.mrr_trend_pct ?? 0) * 100).toFixed(1)}%`,
      alert: (account.mrr_trend_pct ?? 0) < -0.05,
    },
    {
      label: 'Score',
      value: result.calibratedScore.toFixed(1),
      badge: result.priorityTier,
    },
  ];

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {metric.label}
            </p>
            <div className="mt-0.5 flex items-center justify-center gap-1.5">
              <span
                className={`text-lg font-semibold tabular-nums ${
                  metric.alert ? 'text-red-600' : ''
                }`}
              >
                {metric.value}
              </span>
              {'badge' in metric && metric.badge && (
                <Badge
                  variant="secondary"
                  className={`text-[9px] px-1 py-0 ${TIER_COLORS[metric.badge] || ''}`}
                >
                  {metric.badge}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
