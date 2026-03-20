'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { TypeBadge } from '@/components/ui/type-badge';
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

export function PriorityList({ results, analyses: initialAnalyses }: PriorityListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = getFiltersFromParams(searchParams);

  // Sort state (local, not persisted to URL)
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT);

  // Local analyses state so we can update after per-row analysis
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [analysingId, setAnalysingId] = useState<string | null>(null);

  // Sync when server props change (e.g. after Analyse All + router.refresh)
  useEffect(() => {
    setAnalyses(initialAnalyses);
  }, [initialAnalyses]);

  async function handleAnalyse(e: React.MouseEvent, accountId: string) {
    e.stopPropagation();
    setAnalysingId(accountId);
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyses((prev) => ({
          ...prev,
          [accountId]: { reasoning: data.reasoning },
        }));
      }
    } finally {
      setAnalysingId(null);
    }
  }

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
      router.push(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false });
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
      filters.lifecycle !== 'all' &&
      account.lifecycle_stage !== filters.lifecycle
    ) {
      return false;
    }
    if (filters.renewalRange !== 'all') {
      const days = account.days_to_renewal;
      switch (filters.renewalRange) {
        case '0-30': if (days > 30) return false; break;
        case '30-60': if (days <= 30 || days > 60) return false; break;
        case '60-90': if (days <= 60 || days > 90) return false; break;
        case '90+': if (days <= 90) return false; break;
      }
    }
    if (filters.arrRange !== 'all') {
      const arr = account.arr_gbp;
      switch (filters.arrRange) {
        case '0-50000': if (arr >= 50000) return false; break;
        case '50000-150000': if (arr < 50000 || arr >= 150000) return false; break;
        case '150000+': if (arr < 150000) return false; break;
      }
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
      {/* Legend — always visible, uses real badge components */}
      <div className="mb-3 flex flex-wrap items-start gap-x-6 gap-y-2 rounded-md border bg-card/50 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
            Tiers
          </span>
          {(['critical', 'high', 'medium', 'low', 'monitor'] as PriorityTier[]).map((tier) => (
            <TierBadge key={tier} tier={tier} size="sm" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
            Types
          </span>
          {(['churn_risk', 'renewal_urgent', 'expansion_opportunity', 'mixed_signals', 'stable'] as PriorityType[]).map((type) => (
            <TypeBadge key={type} type={type} size="sm" />
          ))}
        </div>
      </div>
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
            <TableHead className="w-[90px]">Actions</TableHead>
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
                  <TierBadge tier={result.priorityTier} size="sm" />
                </TableCell>
                <TableCell>
                  <TypeBadge type={result.priorityType} size="sm" />
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
                <TableCell>
                  <Button
                    size="sm"
                    variant={analysis?.reasoning ? 'ghost' : 'outline'}
                    className="h-7 text-xs"
                    disabled={analysingId === account.account_id}
                    onClick={(e) => handleAnalyse(e, account.account_id)}
                  >
                    {analysingId === account.account_id ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 size-3" />
                    )}
                    {analysingId === account.account_id
                      ? 'Analysing'
                      : analysis?.reasoning
                        ? 'Redo'
                        : 'Analyse'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
