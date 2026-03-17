'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TierBadge } from '@/components/ui/tier-badge';
import { BarChart3 } from 'lucide-react';
import type { SubScores, PriorityTier } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WaterfallChartProps {
  subScores: SubScores;
  calibratedScore: number;
  priorityTier: PriorityTier;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ChartDatum {
  name: string;
  value: number;
  weight: string;
  fill: string;
}

function getBarColor(value: number): string {
  if (value >= 70) return '#22c55e'; // green-500
  if (value >= 50) return '#eab308'; // yellow-500
  if (value >= 30) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

function buildChartData(subScores: SubScores): ChartDatum[] {
  return [
    {
      name: 'Revenue Health',
      value: Math.round(subScores.revenueHealth * 10) / 10,
      weight: '25%',
      fill: getBarColor(subScores.revenueHealth),
    },
    {
      name: 'Engagement & Usage',
      value: Math.round(subScores.engagement * 10) / 10,
      weight: '25%',
      fill: getBarColor(subScores.engagement),
    },
    {
      name: 'Support Health',
      value: Math.round(subScores.supportHealth * 10) / 10,
      weight: '15%',
      fill: getBarColor(subScores.supportHealth),
    },
    {
      name: 'Strategic Opportunity',
      value: Math.round(subScores.opportunity * 10) / 10,
      weight: '20%',
      fill: getBarColor(subScores.opportunity),
    },
    {
      name: 'Time Urgency',
      value: Math.round(subScores.urgency * 10) / 10,
      weight: '15%',
      fill: getBarColor(subScores.urgency),
    },
  ];
}

// ---------------------------------------------------------------------------
// Custom label for bar end
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderBarLabel(props: Record<string, any>): React.ReactElement | null {
  const x = typeof props.x === 'number' ? props.x : undefined;
  const y = typeof props.y === 'number' ? props.y : undefined;
  const width = typeof props.width === 'number' ? props.width : undefined;
  const height = typeof props.height === 'number' ? props.height : undefined;
  const value = typeof props.value === 'number' ? props.value : undefined;

  if (
    x == null ||
    y == null ||
    width == null ||
    height == null ||
    value == null
  ) {
    return null;
  }

  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill="#374151"
      fontSize={12}
      fontWeight={600}
      dominantBaseline="middle"
    >
      {value.toFixed(1)}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  payload: ChartDatum;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-semibold">{item.payload.name}</p>
      <p className="text-sm text-muted-foreground">
        Score: {item.value.toFixed(1)} / 100
      </p>
      <p className="text-xs text-muted-foreground">
        Weight: {item.payload.weight}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WaterfallChart({
  subScores,
  calibratedScore,
  priorityTier,
}: WaterfallChartProps) {
  const chartData = buildChartData(subScores);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-blue-500" />
          <CardTitle>Score Decomposition</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 50, bottom: 0, left: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                label={renderBarLabel}
                maxBarSize={28}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weight labels */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {chartData.map((d) => (
            <span
              key={d.name}
              className="text-[11px] text-muted-foreground"
            >
              {d.name}: <span className="font-medium">{d.weight}</span>
            </span>
          ))}
        </div>

        {/* Composite score callout */}
        <div className="mt-4 flex items-center justify-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            Priority Score:
          </span>
          <span className="text-xl font-bold tabular-nums">
            {calibratedScore.toFixed(1)}
          </span>
          <TierBadge tier={priorityTier} size="md" />
        </div>
      </CardContent>
    </Card>
  );
}
