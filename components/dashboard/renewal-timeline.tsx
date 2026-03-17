'use client';

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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<PriorityTier, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  monitor: '#9ca3af',
};

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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom dot renderer for consistent colouring
// ---------------------------------------------------------------------------

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ScatterDatum;
}

function RenderDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return null;
  // Scale radius by ARR: min 6px, max 18px
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
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RenewalTimeline({ results }: RenewalTimelineProps) {
  // Filter to accounts renewing within 90 days
  const upcoming = results.filter(
    ({ account }) => account.days_to_renewal >= 0 && account.days_to_renewal <= 90,
  );

  // Sort by days_to_renewal ascending
  const sorted = [...upcoming].sort(
    (a, b) => a.account.days_to_renewal - b.account.days_to_renewal,
  );

  // Build scatter data — use a fixed y=1 to show dots on a single horizontal line
  const chartData: ScatterDatum[] = sorted.map(({ account, result }) => ({
    x: account.days_to_renewal,
    y: 1,
    z: account.arr_gbp,
    name: account.account_name,
    arr: account.arr_gbp,
    tier: result.priorityTier,
    fill: TIER_COLORS[result.priorityTier],
  }));

  // Summary stats
  const renewals30d = upcoming.filter(
    ({ account }) => account.days_to_renewal <= 30,
  );
  const arr30d = renewals30d.reduce(
    (sum, { account }) => sum + account.arr_gbp,
    0,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-blue-500" />
          <CardTitle className="text-sm font-medium">
            Renewal Timeline (Next 90 Days)
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No renewals in the next 90 days
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Scatter chart */}
            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 90]}
                    ticks={[0, 15, 30, 45, 60, 75, 90]}
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
                    domain={[0, 2]}
                    hide
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
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Scatter
                    data={chartData}
                    shape={<RenderDot />}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Tier legend */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              {(
                ['critical', 'high', 'medium', 'low', 'monitor'] as PriorityTier[]
              ).map((tier) => (
                <div key={tier} className="flex items-center gap-1">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[tier] }}
                  />
                  <span className="text-[10px] capitalize text-muted-foreground">
                    {tier}
                  </span>
                </div>
              ))}
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
