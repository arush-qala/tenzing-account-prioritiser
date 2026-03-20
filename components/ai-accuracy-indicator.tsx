'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccuracyData {
  counts: Record<string, number>;
  total: number;
  accurate: number;
  percentage: number;
}

const RATING_CONFIG: Record<string, { label: string; color: string }> = {
  spot_on: { label: 'Spot On', color: '#22c55e' },
  mostly_right: { label: 'Mostly Right', color: '#3b82f6' },
  partially_right: { label: 'Partially Right', color: '#f97316' },
  wrong: { label: 'Wrong', color: '#ef4444' },
};

const RATING_KEYS = ['spot_on', 'mostly_right', 'partially_right', 'wrong'] as const;

export function AiAccuracyIndicator() {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [showPopover, setShowPopover] = useState(false);

  useEffect(() => {
    fetch('/api/accuracy')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  if (!data || data.total === 0) return null;

  const chartData = RATING_KEYS
    .filter((key) => (data.counts[key] ?? 0) > 0)
    .map((key) => ({
      name: RATING_CONFIG[key].label,
      value: data.counts[key],
      color: RATING_CONFIG[key].color,
    }));

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground"
        onClick={() => setShowPopover((p) => !p)}
      >
        <Target className="size-3.5 text-purple-500" />
        AI: {data.percentage}% accurate
        <span className="text-muted-foreground/60">(n={data.total})</span>
      </Button>

      {showPopover && (
        <>
          {/* Backdrop to close popover */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border bg-background p-4 shadow-lg">
            <p className="mb-3 text-sm font-medium">AI Accuracy Breakdown</p>

            {/* Mini donut */}
            <div className="relative mx-auto h-[120px] w-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={50}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const p = payload[0].payload as { name: string; value: number };
                      return (
                        <div className="rounded border bg-background px-2 py-1 text-xs shadow">
                          {p.name}: {p.value}
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold tabular-nums">{data.percentage}%</span>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3 space-y-1">
              {RATING_KEYS.map((key) => {
                const count = data.counts[key] ?? 0;
                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: RATING_CONFIG[key].color }}
                      />
                      <span className="text-muted-foreground">{RATING_CONFIG[key].label}</span>
                    </div>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              {data.accurate}/{data.total} recommendations mostly accurate
            </p>
          </div>
        </>
      )}
    </div>
  );
}
