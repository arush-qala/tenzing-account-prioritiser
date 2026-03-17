'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Target } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccuracyTrackerProps {
  actions: Array<{
    ai_accuracy_rating: string | null;
    created_at: string;
  }>;
}

type RatingKey = 'spot_on' | 'mostly_right' | 'partially_right' | 'wrong';

interface RatingConfig {
  label: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATING_CONFIG: Record<RatingKey, RatingConfig> = {
  spot_on: { label: 'Spot On', color: '#22c55e' },
  mostly_right: { label: 'Mostly Right', color: '#3b82f6' },
  partially_right: { label: 'Partially Right', color: '#f97316' },
  wrong: { label: 'Wrong', color: '#ef4444' },
};

const RATING_KEYS: RatingKey[] = [
  'spot_on',
  'mostly_right',
  'partially_right',
  'wrong',
];

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface ChartDatum {
  name: string;
  value: number;
  color: string;
  pct: string;
}

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
      <p className="text-xs text-muted-foreground">
        {item.value} decision{item.value !== 1 ? 's' : ''} ({item.payload.pct})
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccuracyTracker({ actions }: AccuracyTrackerProps) {
  // Filter to actions that have a rating
  const rated = actions.filter(
    (a) => a.ai_accuracy_rating !== null && a.ai_accuracy_rating !== '',
  );

  const total = rated.length;

  // Count per rating
  const counts: Record<RatingKey, number> = {
    spot_on: 0,
    mostly_right: 0,
    partially_right: 0,
    wrong: 0,
  };

  for (const action of rated) {
    const key = action.ai_accuracy_rating as RatingKey;
    if (key in counts) {
      counts[key]++;
    }
  }

  // Build chart data (only include ratings with count > 0)
  const chartData: ChartDatum[] = RATING_KEYS.filter(
    (key) => counts[key] > 0,
  ).map((key) => ({
    name: RATING_CONFIG[key].label,
    value: counts[key],
    color: RATING_CONFIG[key].color,
    pct: total > 0 ? `${Math.round((counts[key] / total) * 100)}%` : '0%',
  }));

  const accurateCount = counts.spot_on + counts.mostly_right;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-purple-500" />
          <CardTitle className="text-sm font-medium">
            AI Accuracy Tracker
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No ratings yet. Record actions on account detail pages to track AI
            accuracy.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Donut chart with center label */}
            <div className="relative mx-auto h-[160px] w-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums">
                  n={total}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  decisions
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {RATING_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: RATING_CONFIG[key].color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {RATING_CONFIG[key].label}:{' '}
                    <span className="font-medium text-foreground">
                      {counts[key]}
                    </span>{' '}
                    ({total > 0
                      ? Math.round((counts[key] / total) * 100)
                      : 0}
                    %)
                  </span>
                </div>
              ))}
            </div>

            {/* Summary line */}
            <p className="text-center text-xs text-muted-foreground">
              AI recommendations are{' '}
              <span className="font-medium text-foreground">
                {accurateCount}/{total}
              </span>{' '}
              mostly accurate
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
