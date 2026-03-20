'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarClock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import type { Account, ScoringResult, PriorityTier } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenewalTimelineProps {
  results: Array<{ account: Account; result: ScoringResult }>;
}

interface ScatterDatum {
  x: number;
  y: number;
  z: number;
  name: string;
  arr: number;
  tier: PriorityTier;
  fill: string;
  accountId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

import { TIER_HEX } from '@/lib/ui/tier-type-styles';

// Y-axis mapping: Critical at top (4), Monitor at bottom (0)
const TIER_Y: Record<PriorityTier, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  monitor: 0,
};

const TIER_LABELS: Record<number, string> = {
  0: 'Monitor',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical',
};

const RANGE_OPTIONS = [30, 60, 90, 180] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  payload: ScatterDatum;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-semibold">{item.name}</p>
      <p className="text-xs text-muted-foreground">
        Renewal in {item.x} day{item.x !== 1 ? 's' : ''}
      </p>
      <p className="text-xs text-muted-foreground">
        ARR: {formatCurrency(item.arr)}
      </p>
      <p className="text-xs capitalize text-muted-foreground">
        Tier: {item.tier}
      </p>
      <p className="mt-1 text-[10px] text-blue-600">Click to view account</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom dot renderer
// ---------------------------------------------------------------------------

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ScatterDatum;
}

function RenderDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return null;
  const minR = 6;
  const maxR = 18;
  const arrClamped = Math.max(5000, Math.min(payload.arr, 500000));
  const ratio = (arrClamped - 5000) / (500000 - 5000);
  const r = minR + ratio * (maxR - minR);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={payload.fill}
      fillOpacity={0.7}
      stroke={payload.fill}
      strokeWidth={1.5}
      className="cursor-pointer"
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RenewalTimeline({ results }: RenewalTimelineProps) {
  const router = useRouter();
  const [range, setRange] = useState<RangeOption>(90);

  // Filter to accounts renewing within selected range
  const upcoming = results.filter(
    ({ account }) => account.days_to_renewal >= 0 && account.days_to_renewal <= range,
  );

  // Build scatter data with tier swim lanes
  const chartData: ScatterDatum[] = upcoming.map(({ account, result }) => ({
    x: account.days_to_renewal,
    y: TIER_Y[result.priorityTier],
    z: account.arr_gbp,
    name: account.account_name,
    arr: account.arr_gbp,
    tier: result.priorityTier,
    fill: TIER_HEX[result.priorityTier],
    accountId: account.account_id,
  }));

  // Summary stats
  const renewals30d = upcoming.filter(
    ({ account }) => account.days_to_renewal <= 30,
  );
  const arr30d = renewals30d.reduce(
    (sum, { account }) => sum + account.arr_gbp,
    0,
  );

  // Generate tick values based on range
  const xTicks: number[] = [];
  for (let i = 0; i <= range; i += range <= 60 ? 15 : 30) {
    xTicks.push(i);
  }
  if (xTicks[xTicks.length - 1] !== range) xTicks.push(range);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-blue-500" />
          <CardTitle className="text-sm font-medium">
            Renewal Timeline
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {upcoming.length} account{upcoming.length !== 1 ? 's' : ''}
          </span>
        </div>
        {/* Time range toggle */}
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt}
              variant={range === opt ? 'secondary' : 'ghost'}
              size="xs"
              className="text-xs px-2"
              onClick={() => setRange(opt)}
            >
              {opt}d
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No renewals in the next {range} days
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Scatter chart with tier swim lanes */}
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 10, right: 20, bottom: 10, left: 60 }}
                  onClick={(e: unknown) => {
                    const event = e as { activePayload?: Array<{ payload?: ScatterDatum }> } | null;
                    if (event?.activePayload?.[0]?.payload?.accountId) {
                      router.push(`/accounts/${event.activePayload[0].payload.accountId}`);
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    strokeOpacity={0.3}
                  />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, range]}
                    ticks={xTicks}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: 'Days to Renewal',
                      position: 'insideBottom',
                      offset: -5,
                      fontSize: 10,
                      fill: '#9ca3af',
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[-0.5, 4.5]}
                    ticks={[0, 1, 2, 3, 4]}
                    tickFormatter={(val: number) => TIER_LABELS[val] ?? ''}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                  />
                  <ZAxis
                    type="number"
                    dataKey="z"
                    range={[100, 800]}
                  />
                  <ReferenceLine
                    x={30}
                    stroke="#d1d5db"
                    strokeDasharray="4 4"
                    label={{
                      value: '30d',
                      position: 'top',
                      fontSize: 10,
                      fill: '#9ca3af',
                    }}
                  />
                  {range >= 60 && (
                    <ReferenceLine
                      x={60}
                      stroke="#d1d5db"
                      strokeDasharray="4 4"
                      label={{
                        value: '60d',
                        position: 'top',
                        fontSize: 10,
                        fill: '#9ca3af',
                      }}
                    />
                  )}
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Scatter
                    data={chartData}
                    shape={<RenderDot />}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Tier legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              {(
                ['critical', 'high', 'medium', 'low', 'monitor'] as PriorityTier[]
              ).map((tier) => (
                <div key={tier} className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: TIER_HEX[tier] }}
                  />
                  <span className="text-[10px] capitalize text-muted-foreground">
                    {tier}
                  </span>
                </div>
              ))}
              <span className="text-[10px] text-muted-foreground ml-2">
                Bubble size = ARR
              </span>
            </div>

            {/* Summary */}
            <p className="text-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {renewals30d.length}
              </span>{' '}
              renewal{renewals30d.length !== 1 ? 's' : ''} in next 30 days (
              <span className="font-medium text-foreground">
                {formatCurrency(arr30d)}
              </span>{' '}
              ARR)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
