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
  lifecycle: string;
  renewalRange: string;
  arrRange: string;
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
    lifecycle: searchParams.get('lifecycle') ?? 'all',
    renewalRange: searchParams.get('renewalRange') ?? 'all',
    arrRange: searchParams.get('arrRange') ?? 'all',
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

const SEGMENT_OPTIONS = [
  { value: 'all', label: 'Segment' },
  { value: 'Enterprise', label: 'Enterprise' },
  { value: 'Mid-Market', label: 'Mid-Market' },
  { value: 'SMB', label: 'SMB' },
];

const TIER_OPTIONS = [
  { value: 'all', label: 'Tier' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'monitor', label: 'Monitor' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'Type' },
  { value: 'churn_risk', label: 'Churn Risk' },
  { value: 'renewal_urgent', label: 'Renewal Urgent' },
  { value: 'expansion_opportunity', label: 'Expansion' },
  { value: 'mixed_signals', label: 'Mixed Signals' },
  { value: 'stable', label: 'Stable' },
];

const CONFIDENCE_OPTIONS = [
  { value: 'all', label: 'Confidence' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const REGIONS = ['all', 'US', 'EU', 'UK'] as const;

const LIFECYCLE_OPTIONS = [
  { value: 'all', label: 'Lifecycle Stage' },
  { value: 'New', label: 'New' },
  { value: 'Onboarding', label: 'Onboarding' },
  { value: 'Growing', label: 'Growing' },
  { value: 'Mature', label: 'Mature' },
  { value: 'At Risk', label: 'At Risk' },
  { value: 'Churning', label: 'Churning' },
];

const RENEWAL_RANGE_OPTIONS = [
  { value: 'all', label: 'Renewal' },
  { value: '0-30', label: '< 30 days' },
  { value: '30-60', label: '30-60 days' },
  { value: '60-90', label: '60-90 days' },
  { value: '90+', label: '> 90 days' },
];

const ARR_RANGE_OPTIONS = [
  { value: 'all', label: 'ARR' },
  { value: '0-50000', label: '< £50K' },
  { value: '50000-150000', label: '£50K-£150K' },
  { value: '150000+', label: '> £150K' },
];

// Quick filter presets
const PRESETS: Array<{ label: string; params: Record<string, string> }> = [
  {
    label: 'Critical Only',
    params: { tier: 'critical' },
  },
  {
    label: 'Renewals < 30d',
    params: { renewalRange: '0-30' },
  },
  {
    label: 'Churn Risks',
    params: { type: 'churn_risk' },
  },
  {
    label: 'Expansion',
    params: { type: 'expansion_opportunity' },
  },
];

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
  lifecycle: {
    New: 'New',
    Onboarding: 'Onboarding',
    Growing: 'Growing',
    Mature: 'Mature',
    'At Risk': 'At Risk',
    Churning: 'Churning',
  },
  renewalRange: {
    '0-30': '< 30d',
    '30-60': '30-60d',
    '60-90': '60-90d',
    '90+': '> 90d',
  },
  arrRange: {
    '0-50000': '< £50K',
    '50000-150000': '£50K-£150K',
    '150000+': '> £150K',
  },
};

// ---------------------------------------------------------------------------
// Helper: show filter label when value is "all" (base-ui renders raw value)
// ---------------------------------------------------------------------------

function FilterSelectValue({ value, label }: { value: string; label: string }) {
  if (value === 'all') {
    return <span className="flex flex-1 text-left text-muted-foreground">{label}</span>;
  }
  return <SelectValue />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Filters({ owners }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = getFiltersFromParams(searchParams);

  // Debounced search
  const [searchLocal, setSearchLocal] = useState(filters.search);
  const isMount = useRef(true);

  useEffect(() => {
    setSearchLocal(filters.search);
  }, [filters.search]);

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
      router.push(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false });
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
      router.push(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false });
    },
    [router, searchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchLocal('');
    router.push('/dashboard', { scroll: false });
  }, [router]);

  const applyPreset = useCallback(
    (preset: { params: Record<string, string> }) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(preset.params)) {
        params.set(key, value);
      }
      const qs = params.toString();
      router.push(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false });
    },
    [router],
  );

  // Active filter chips
  const chipKeys = ['segment', 'tier', 'type', 'confidence', 'lifecycle', 'renewalRange', 'arrRange'] as const;
  const activeChips: Array<{ key: string; label: string; display: string }> = [];
  for (const key of chipKeys) {
    const val = filters[key];
    if (val !== 'all') {
      const display = FILTER_LABELS[key]?.[val] ?? val;
      const label = key === 'renewalRange' ? 'Renewal' : key === 'arrRange' ? 'ARR' : key.charAt(0).toUpperCase() + key.slice(1);
      activeChips.push({ key, label, display });
    }
  }

  const hasActiveFilters = Object.entries(filters).some(
    ([key, val]) => key !== 'search' ? val !== 'all' : val !== '',
  );

  const activeFilterCount = activeChips.length + (filters.region !== 'all' ? 1 : 0) + (filters.owner !== 'all' ? 1 : 0) + (filters.search !== '' ? 1 : 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Quick filter presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Quick filters:
        </span>
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="xs"
            className="text-xs h-6 px-2"
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Main filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
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

        {/* Segment */}
        <Select
          value={filters.segment}
          onValueChange={(val) => updateParam('segment', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.segment} label="Segment" />
          </SelectTrigger>
          <SelectContent>
            {SEGMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tier */}
        <Select
          value={filters.tier}
          onValueChange={(val) => updateParam('tier', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.tier} label="Tier" />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type */}
        <Select
          value={filters.type}
          onValueChange={(val) => updateParam('type', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.type} label="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Confidence */}
        <Select
          value={filters.confidence}
          onValueChange={(val) => updateParam('confidence', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.confidence} label="Confidence" />
          </SelectTrigger>
          <SelectContent>
            {CONFIDENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Region */}
        <Select
          value={filters.region}
          onValueChange={(val) => updateParam('region', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.region} label="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Region</SelectItem>
            {REGIONS.filter((r) => r !== 'all').map((reg) => (
              <SelectItem key={reg} value={reg}>
                {reg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Owner */}
        <Select
          value={filters.owner}
          onValueChange={(val) => updateParam('owner', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.owner} label="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Owner</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner} value={owner}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Lifecycle Stage */}
        <Select
          value={filters.lifecycle}
          onValueChange={(val) => updateParam('lifecycle', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.lifecycle} label="Lifecycle Stage" />
          </SelectTrigger>
          <SelectContent>
            {LIFECYCLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Days to Renewal */}
        <Select
          value={filters.renewalRange}
          onValueChange={(val) => updateParam('renewalRange', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.renewalRange} label="Renewal" />
          </SelectTrigger>
          <SelectContent>
            {RENEWAL_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* ARR Range */}
        <Select
          value={filters.arrRange}
          onValueChange={(val) => updateParam('arrRange', val ?? 'all')}
        >
          <SelectTrigger>
            <FilterSelectValue value={filters.arrRange} label="ARR" />
          </SelectTrigger>
          <SelectContent>
            {ARR_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset + count */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="mr-1 size-3" />
            Reset
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-medium">
                {activeFilterCount}
              </span>
            )}
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
