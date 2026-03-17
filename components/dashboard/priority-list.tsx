'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { getFiltersFromParams } from '@/components/dashboard/filters';
import {
  SortableHeader,
  type SortState,
} from '@/components/dashboard/sortable-header';
import type {
  Account,
  ScoringResult,
  PriorityTier,
  PriorityType,
} from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Tier / Type colour mappings
// ---------------------------------------------------------------------------

const TIER_CLASSES: Record<PriorityTier, string> = {
  critical:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
  medium:
    'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  monitor:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400',
};

const TYPE_CLASSES: Record<PriorityType, string> = {
  churn_risk:
    'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400',
  renewal_urgent:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
  expansion_opportunity:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
  mixed_signals:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400',
  stable:
    'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400',
};

const TYPE_LABELS: Record<PriorityType, string> = {
  churn_risk: 'Churn Risk',
  renewal_urgent: 'Renewal Urgent',
  expansion_opportunity: 'Expansion',
  mixed_signals: 'Mixed Signals',
  stable: 'Stable',
};

// ---------------------------------------------------------------------------
// Ordinal sort maps
// ---------------------------------------------------------------------------

const TIER_ORDER: Record<PriorityTier, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  monitor: 4,
};

const TYPE_ORDER: Record<PriorityType, number> = {
  churn_risk: 0,
  renewal_urgent: 1,
  expansion_opportunity: 2,
  mixed_signals: 3,
  stable: 4,
};

const CONFIDENCE_ORDER: Record<string, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

// ---------------------------------------------------------------------------
// Column filter options
// ---------------------------------------------------------------------------

const SEGMENT_FILTER_OPTIONS = [
  { value: 'all', label: 'All Segments' },
  { value: 'Enterprise', label: 'Enterprise' },
  { value: 'Mid-Market', label: 'Mid-Market' },
  { value: 'SMB', label: 'SMB' },
];

const TIER_FILTER_OPTIONS = [
  { value: 'all', label: 'All Tiers' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'monitor', label: 'Monitor' },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'churn_risk', label: 'Churn Risk' },
  { value: 'renewal_urgent', label: 'Renewal Urgent' },
  { value: 'expansion_opportunity', label: 'Expansion' },
  { value: 'mixed_signals', label: 'Mixed Signals' },
  { value: 'stable', label: 'Stable' },
];

const CONFIDENCE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceLabel(score: number): { text: string; className: string } {
  if (score >= 0.75) {
    return { text: 'High', className: 'text-emerald-600' };
  }
  if (score >= 0.5) {
    return { text: 'Medium', className: 'text-amber-600' };
  }
  return { text: 'Low', className: 'text-red-500' };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PriorityListProps {
  results: Array<{ account: Account; result: ScoringResult }>;
  analyses: Record<string, { reasoning: string }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_SORT: SortState = {
  column: 'calibratedScore',
  direction: 'desc',
};

export function PriorityList({ results, analyses }: PriorityListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = getFiltersFromParams(searchParams);

  // Sort state (local, not persisted to URL)
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT);

  const handleSort = useCallback((column: string) => {
    setSortState((prev) => {
      if (prev.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      // Third click: reset to default sort
      return { ...DEFAULT_SORT };
    });
  }, []);

  // Column filter handler: updates URL params
  const handleColumnFilter = useCallback(
    (column: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        params.delete(column);
      } else {
        params.set(column, value);
      }
      const qs = params.toString();
      router.push(qs ? `/dashboard?${qs}` : '/dashboard');
    },
    [router, searchParams],
  );

  // ---------- Filter ----------

  const filtered = results.filter(({ account, result }) => {
    if (
      filters.segment !== 'all' &&
      account.segment !== filters.segment
    ) {
      return false;
    }
    if (filters.region !== 'all' && account.region !== filters.region) {
      return false;
    }
    if (
      filters.owner !== 'all' &&
      account.account_owner !== filters.owner
    ) {
      return false;
    }
    if (
      filters.type !== 'all' &&
      result.priorityType !== filters.type
    ) {
      return false;
    }
    if (
      filters.tier !== 'all' &&
      result.priorityTier !== filters.tier
    ) {
      return false;
    }
    if (filters.confidence !== 'all') {
      const conf = confidenceLabel(
        account.data_completeness_score,
      ).text.toLowerCase();
      if (conf !== filters.confidence) return false;
    }
    if (
      filters.search &&
      !account.account_name
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // ---------- Sort ----------

  const sorted = [...filtered].sort((a, b) => {
    const { column, direction } = sortState;
    if (!direction) return 0;

    let cmp = 0;
    switch (column) {
      case 'account_name':
        cmp = a.account.account_name.localeCompare(
          b.account.account_name,
        );
        break;
      case 'segment':
        cmp = a.account.segment.localeCompare(b.account.segment);
        break;
      case 'arr_gbp':
        cmp = a.account.arr_gbp - b.account.arr_gbp;
        break;
      case 'calibratedScore':
        cmp =
          a.result.calibratedScore - b.result.calibratedScore;
        break;
      case 'tier':
        cmp =
          TIER_ORDER[a.result.priorityTier] -
          TIER_ORDER[b.result.priorityTier];
        break;
      case 'type':
        cmp =
          TYPE_ORDER[a.result.priorityType] -
          TYPE_ORDER[b.result.priorityType];
        break;
      case 'confidence': {
        const aConf = confidenceLabel(
          a.account.data_completeness_score,
        ).text;
        const bConf = confidenceLabel(
          b.account.data_completeness_score,
        ).text;
        cmp =
          (CONFIDENCE_ORDER[aConf] ?? 3) -
          (CONFIDENCE_ORDER[bConf] ?? 3);
        break;
      }
      default:
        cmp = 0;
    }
    return direction === 'asc' ? cmp : -cmp;
  });

  if (sorted.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No accounts match the current filters.
      </div>
    );
  }

  return (
    <TooltipProvider>
      {/* Legend */}
      <details className="mb-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium hover:text-foreground">
          Legend: Tiers &amp; Types
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-3 rounded-md border bg-card p-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 font-semibold text-foreground">Priority Tiers</p>
            <ul className="space-y-0.5">
              <li><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5" />Critical: Immediate intervention needed (score 80+)</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1.5" />High: Requires proactive attention (score 65-79)</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1.5" />Medium: Monitor closely, act if signals worsen (score 50-64)</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5" />Low: Stable, routine check-ins (score 35-49)</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1.5" />Monitor: Healthy, no action needed (score &lt;35)</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-semibold text-foreground">Priority Types</p>
            <ul className="space-y-0.5">
              <li><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5" />Churn Risk: Declining health + negative signals</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1.5" />Renewal Urgent: Renewal soon + poor health</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />Expansion Opportunity: Strong pipeline + positive signals</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />Mixed Signals: Contradicting indicators need investigation</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1.5" />Stable: Healthy account, no immediate action</li>
            </ul>
          </div>
        </div>
      </details>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <SortableHeader
              column="account_name"
              label="Account"
              currentSort={sortState}
              onSort={handleSort}
            />
            <SortableHeader
              column="segment"
              label="Segment"
              currentSort={sortState}
              onSort={handleSort}
              filterOptions={SEGMENT_FILTER_OPTIONS}
              filterValue={filters.segment}
              onFilter={handleColumnFilter}
            />
            <SortableHeader
              column="arr_gbp"
              label="ARR"
              currentSort={sortState}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              column="calibratedScore"
              label="Score"
              currentSort={sortState}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              column="tier"
              label="Tier"
              currentSort={sortState}
              onSort={handleSort}
              filterOptions={TIER_FILTER_OPTIONS}
              filterValue={filters.tier}
              onFilter={handleColumnFilter}
            />
            <SortableHeader
              column="type"
              label="Type"
              currentSort={sortState}
              onSort={handleSort}
              filterOptions={TYPE_FILTER_OPTIONS}
              filterValue={filters.type}
              onFilter={handleColumnFilter}
            />
            <SortableHeader
              column="confidence"
              label="Confidence"
              currentSort={sortState}
              onSort={handleSort}
              filterOptions={CONFIDENCE_FILTER_OPTIONS}
              filterValue={filters.confidence}
              onFilter={handleColumnFilter}
            />
            <TableHead className="min-w-[200px]">AI Summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(({ account, result }, index) => {
            const analysis = analyses[account.account_id];
            const confidence = confidenceLabel(
              account.data_completeness_score,
            );
            const isAnomaly = account.is_anomaly === 1;

            return (
              <TableRow
                key={account.account_id}
                className="cursor-pointer"
                onClick={() =>
                  router.push(`/accounts/${account.account_id}`)
                }
              >
                <TableCell className="font-medium text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">
                      {account.account_name}
                    </span>
                    {isAnomaly && (
                      <AlertTriangle
                        className="size-3.5 text-amber-500"
                        aria-label="Anomaly detected"
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {account.segment}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(account.arr_gbp)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {result.calibratedScore.toFixed(1)}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`border text-xs ${TIER_CLASSES[result.priorityTier]}`}
                  >
                    {result.priorityTier.charAt(0).toUpperCase() +
                      result.priorityTier.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={`border text-xs ${TYPE_CLASSES[result.priorityType]}`}
                  >
                    {TYPE_LABELS[result.priorityType]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-xs font-medium ${confidence.className}`}
                  >
                    {confidence.text}
                  </span>
                </TableCell>
                <TableCell className="max-w-[300px] whitespace-normal">
                  {analysis?.reasoning ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={<span />}
                        className="line-clamp-2 block cursor-default text-left text-xs text-muted-foreground"
                      >
                        {analysis.reasoning}
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm">
                        <p className="text-xs">{analysis.reasoning}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">
                      Not analysed
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
