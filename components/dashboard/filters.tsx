'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RotateCcw, Search, X } from 'lucide-react';
import type { PriorityTier, PriorityType } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Filter values type
// ---------------------------------------------------------------------------

export interface FilterValues {
  segment: string;
  region: string;
  owner: string;
  type: string;
  tier: string;
  search: string;
  confidence: string;
}

export function getFiltersFromParams(
  searchParams: URLSearchParams,
): FilterValues {
  return {
    segment: searchParams.get('segment') ?? 'all',
    region: searchParams.get('region') ?? 'all',
    owner: searchParams.get('owner') ?? 'all',
    type: searchParams.get('type') ?? 'all',
    tier: searchParams.get('tier') ?? 'all',
    search: searchParams.get('search') ?? '',
    confidence: searchParams.get('confidence') ?? 'all',
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FiltersProps {
  owners: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIONS = ['all', 'US', 'EU', 'UK'] as const;

const FILTER_LABELS: Record<string, Record<string, string>> = {
  segment: {
    Enterprise: 'Enterprise',
    'Mid-Market': 'Mid-Market',
    SMB: 'SMB',
  },
  tier: {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    monitor: 'Monitor',
  },
  type: {
    churn_risk: 'Churn Risk',
    renewal_urgent: 'Renewal Urgent',
    expansion_opportunity: 'Expansion',
    mixed_signals: 'Mixed Signals',
    stable: 'Stable',
  },
  confidence: { high: 'High', medium: 'Medium', low: 'Low' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Filters({ owners }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = getFiltersFromParams(searchParams);

  // Debounced search: local state for instant input, URL updates after 300ms
  const [searchLocal, setSearchLocal] = useState(filters.search);
  const isMount = useRef(true);

  // Sync local state when URL changes externally (e.g. reset click)
  useEffect(() => {
    setSearchLocal(filters.search);
  }, [filters.search]);

  // Debounce: push search to URL 300ms after last keystroke
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchLocal === '') {
        params.delete('search');
      } else {
        params.set('search', searchLocal);
      }
      const qs = params.toString();
      router.push(qs ? `/dashboard?${qs}` : '/dashboard');
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchLocal]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all' || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.push(qs ? `/dashboard?${qs}` : '/dashboard');
    },
    [router, searchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchLocal('');
    router.push('/dashboard');
  }, [router]);

  // Active column-filter chips (segment, tier, type, confidence are set via table headers)
  const activeChips: Array<{
    key: string;
    label: string;
    display: string;
  }> = [];
  for (const key of ['segment', 'tier', 'type', 'confidence'] as const) {
    const val = filters[key];
    if (val !== 'all') {
      const display = FILTER_LABELS[key]?.[val] ?? val;
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      activeChips.push({ key, label, display });
    }
  }

  const hasActiveFilters =
    filters.segment !== 'all' ||
    filters.region !== 'all' ||
    filters.owner !== 'all' ||
    filters.type !== 'all' ||
    filters.tier !== 'all' ||
    filters.confidence !== 'all' ||
    filters.search !== '';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search — debounced, searches account_name */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search accounts..."
            className="w-56 pl-8"
            value={searchLocal}
            onChange={(e) => setSearchLocal(e.target.value)}
          />
        </div>

        {/* Region (no table column for this, stays in top bar) */}
        <Select
          value={filters.region}
          onValueChange={(val) => updateParam('region', val ?? 'all')}
        >
          <SelectTrigger>
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((reg) => (
              <SelectItem key={reg} value={reg}>
                {reg === 'all' ? 'All Regions' : reg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Owner (no table column for this, stays in top bar) */}
        <Select
          value={filters.owner}
          onValueChange={(val) => updateParam('owner', val ?? 'all')}
        >
          <SelectTrigger>
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner} value={owner}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="mr-1 size-3" />
            Reset
          </Button>
        )}
      </div>

      {/* Active column-filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">
            Filtered by:
          </span>
          {activeChips.map(({ key, label, display }) => (
            <button
              key={key}
              type="button"
              onClick={() => updateParam(key, 'all')}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              {label}: {display}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Re-export types for use in other components
export type { PriorityTier, PriorityType };
