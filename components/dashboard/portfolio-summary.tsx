'use client';

import { useState } from 'react';
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
  ChevronRight,
} from 'lucide-react';
import { SummaryDrillDown } from './summary-drill-down';

type CardType = 'arrAtRisk' | 'expansion' | 'attention' | 'renewals' | null;

interface PortfolioSummaryProps {
  results: Array<{ account: Account; result: ScoringResult }>;
}

export function PortfolioSummary({ results }: PortfolioSummaryProps) {
  const [activeSheet, setActiveSheet] = useState<CardType>(null);

  // ARR at Risk: critical tier or churn_risk type
  const arrAtRiskAccounts = results.filter(
    ({ result }) =>
      result.priorityTier === 'critical' ||
      result.priorityType === 'churn_risk',
  );
  const arrAtRisk = arrAtRiskAccounts.reduce(
    (sum, { account }) => sum + account.arr_gbp,
    0,
  );

  // Expansion Pipeline: expansion_opportunity type
  const expansionAccounts = results.filter(
    ({ result }) => result.priorityType === 'expansion_opportunity',
  );
  const expansionPipeline = expansionAccounts.reduce(
    (sum, { account }) => sum + account.expansion_pipeline_gbp,
    0,
  );

  // Needs Attention: critical or high tier
  const attentionAccounts = results.filter(
    ({ result }) =>
      result.priorityTier === 'critical' || result.priorityTier === 'high',
  );

  // Renewals within 90 days
  const renewalAccounts = results.filter(
    ({ account }) => account.days_to_renewal <= 90,
  );

  const cards: Array<{
    key: CardType;
    title: string;
    icon: React.ElementType;
    iconColor: string;
    valueColor: string;
    value: string | number;
    subtitle: string;
    sheetTitle: string;
    sheetDescription: string;
    accounts: Array<{ account: Account; result: ScoringResult }>;
    valueAccessor?: (item: { account: Account; result: ScoringResult }) => string;
  }> = [
    {
      key: 'arrAtRisk',
      title: 'ARR at Risk',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      valueColor: 'text-red-600',
      value: formatCurrency(arrAtRisk),
      subtitle: 'Critical tier & churn risk accounts',
      sheetTitle: 'ARR at Risk',
      sheetDescription: `${formatCurrency(arrAtRisk)} across ${arrAtRiskAccounts.length} accounts in critical tier or flagged as churn risk.`,
      accounts: arrAtRiskAccounts,
    },
    {
      key: 'expansion',
      title: 'Expansion Pipeline',
      icon: TrendingUp,
      iconColor: 'text-emerald-500',
      valueColor: 'text-emerald-600',
      value: formatCurrency(expansionPipeline),
      subtitle: 'Expansion opportunity accounts',
      sheetTitle: 'Expansion Pipeline',
      sheetDescription: `${formatCurrency(expansionPipeline)} expansion pipeline across ${expansionAccounts.length} accounts.`,
      accounts: expansionAccounts,
      valueAccessor: ({ account }) => formatCurrency(account.expansion_pipeline_gbp),
    },
    {
      key: 'attention',
      title: 'Needs Attention',
      icon: Users,
      iconColor: 'text-orange-500',
      valueColor: 'text-orange-600',
      value: attentionAccounts.length,
      subtitle: 'Critical & high priority accounts',
      sheetTitle: 'Needs Attention',
      sheetDescription: `${attentionAccounts.length} accounts in critical or high priority tier.`,
      accounts: attentionAccounts,
    },
    {
      key: 'renewals',
      title: 'Renewals (90d)',
      icon: CalendarClock,
      iconColor: 'text-blue-500',
      valueColor: 'text-blue-600',
      value: renewalAccounts.length,
      subtitle: 'Accounts renewing within 90 days',
      sheetTitle: 'Upcoming Renewals (90 days)',
      sheetDescription: `${renewalAccounts.length} accounts renewing within the next 90 days.`,
      accounts: renewalAccounts,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setActiveSheet(card.key)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={`size-4 ${card.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.valueColor}`}>
                  {card.value}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {card.subtitle}
                  </p>
                  <ChevronRight className="size-3 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {cards.map((card) => (
        <SummaryDrillDown
          key={card.key}
          open={activeSheet === card.key}
          onOpenChange={(open) => {
            if (!open) setActiveSheet(null);
          }}
          title={card.sheetTitle}
          description={card.sheetDescription}
          accounts={card.accounts}
          valueAccessor={card.valueAccessor}
        />
      ))}
    </>
  );
}
