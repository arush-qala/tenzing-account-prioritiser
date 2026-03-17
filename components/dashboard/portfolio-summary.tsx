import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import type { Account, ScoringResult } from '@/lib/scoring/types';
import {
  AlertTriangle,
  TrendingUp,
  Users,
  CalendarClock,
} from 'lucide-react';

interface PortfolioSummaryProps {
  results: Array<{ account: Account; result: ScoringResult }>;
}

export function PortfolioSummary({ results }: PortfolioSummaryProps) {
  // ARR at Risk: sum of arr_gbp for critical tier or churn_risk type
  const arrAtRisk = results
    .filter(
      ({ result }) =>
        result.priorityTier === 'critical' ||
        result.priorityType === 'churn_risk',
    )
    .reduce((sum, { account }) => sum + account.arr_gbp, 0);

  // Expansion Pipeline: sum of expansion_pipeline_gbp for expansion_opportunity type
  const expansionPipeline = results
    .filter(({ result }) => result.priorityType === 'expansion_opportunity')
    .reduce((sum, { account }) => sum + account.expansion_pipeline_gbp, 0);

  // Needs Attention: count of critical or high tier
  const needsAttention = results.filter(
    ({ result }) =>
      result.priorityTier === 'critical' || result.priorityTier === 'high',
  ).length;

  // Renewals within 90 days
  const renewals90d = results.filter(
    ({ account }) => account.days_to_renewal <= 90,
  ).length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* ARR at Risk */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            ARR at Risk
          </CardTitle>
          <AlertTriangle className="size-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(arrAtRisk)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Critical tier &amp; churn risk accounts
          </p>
        </CardContent>
      </Card>

      {/* Expansion Pipeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Expansion Pipeline
          </CardTitle>
          <TrendingUp className="size-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">
            {formatCurrency(expansionPipeline)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Expansion opportunity accounts
          </p>
        </CardContent>
      </Card>

      {/* Needs Attention */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Needs Attention
          </CardTitle>
          <Users className="size-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {needsAttention}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Critical &amp; high priority accounts
          </p>
        </CardContent>
      </Card>

      {/* Renewals (90d) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Renewals (90d)
          </CardTitle>
          <CalendarClock className="size-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{renewals90d}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Accounts renewing within 90 days
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
