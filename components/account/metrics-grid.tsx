import { Card, CardContent } from '@/components/ui/card';
import { TrendArrow } from '@/components/ui/trend-arrow';
import { HealthIndicator } from '@/components/ui/health-indicator';
import { formatCurrency, formatPercent } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import type { Account } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricsGridProps {
  account: Account;
}

// ---------------------------------------------------------------------------
// Metric cell helper
// ---------------------------------------------------------------------------

interface MetricCellProps {
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}

function MetricCell({ label, children, danger }: MetricCellProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1.5 py-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div
          className={cn(
            'text-sm font-semibold',
            danger && 'text-red-600',
          )}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricsGrid({ account }: MetricsGridProps) {
  const seatUtil = Math.round(account.seat_utilisation_pct * 10) / 10;
  const mrrTrend = Math.round(account.mrr_trend_pct * 10) / 10;
  const usageTrend = Math.round(account.usage_trend * 10) / 10;
  const usageCurrent = Math.round(account.usage_score_current * 10) / 10;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {/* 1. ARR */}
      <MetricCell label="ARR">
        {formatCurrency(account.arr_gbp)}
      </MetricCell>

      {/* 2. MRR Trend */}
      <MetricCell label="MRR Trend">
        <TrendArrow value={mrrTrend} suffix="%" />
      </MetricCell>

      {/* 3. Seat Utilisation */}
      <MetricCell label="Seat Utilisation">
        <div className="space-y-1">
          <span>{formatPercent(seatUtil)}</span>
          <HealthIndicator value={seatUtil} />
        </div>
      </MetricCell>

      {/* 4. Usage Score */}
      <MetricCell label="Usage Score">
        <div className="space-y-1">
          <span>{usageCurrent}</span>
          <HealthIndicator value={usageCurrent} />
        </div>
      </MetricCell>

      {/* 5. Usage Trend */}
      <MetricCell label="Usage Trend">
        <TrendArrow value={usageTrend} suffix="%" />
      </MetricCell>

      {/* 6. NPS */}
      <MetricCell label="NPS">
        {account.latest_nps != null ? account.latest_nps : 'N/A'}
      </MetricCell>

      {/* 7. CSAT */}
      <MetricCell label="CSAT">
        {account.avg_csat_90d != null
          ? account.avg_csat_90d.toFixed(1)
          : 'N/A'}
      </MetricCell>

      {/* 8. Open Tickets */}
      <MetricCell label="Open Tickets">
        {account.open_tickets_count}
      </MetricCell>

      {/* 9. Urgent Tickets */}
      <MetricCell
        label="Urgent Tickets"
        danger={account.urgent_open_tickets_count > 0}
      >
        {account.urgent_open_tickets_count}
      </MetricCell>

      {/* 10. SLA Breaches */}
      <MetricCell
        label="SLA Breaches (90d)"
        danger={account.sla_breaches_90d > 0}
      >
        {account.sla_breaches_90d}
      </MetricCell>

      {/* 11. Expansion Pipeline */}
      <MetricCell label="Expansion Pipeline">
        {formatCurrency(account.expansion_pipeline_gbp)}
      </MetricCell>

      {/* 12. Contraction Risk */}
      <MetricCell
        label="Contraction Risk"
        danger={account.contraction_risk_gbp > 0}
      >
        {formatCurrency(account.contraction_risk_gbp)}
      </MetricCell>

      {/* 13. Days to Renewal */}
      <MetricCell
        label="Days to Renewal"
        danger={account.days_to_renewal < 30}
      >
        {account.days_to_renewal}
      </MetricCell>
    </div>
  );
}
