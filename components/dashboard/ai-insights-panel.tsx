'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Lightbulb,
  UserCircle,
  BarChart3,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortfolioInsightsData {
  themes: string[];
  owner_patterns: Array<{ owner: string; pattern: string }>;
  segment_patterns: Array<{ segment: string; pattern: string }>;
  urgent_actions: string[];
}

interface AiInsightsPanelProps {
  insights: PortfolioInsightsData | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiInsightsPanel({ insights }: AiInsightsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [localInsights, setLocalInsights] =
    useState<PortfolioInsightsData | null>(insights);
  const [error, setError] = useState<string | null>(null);

  async function generateInsights() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolio-insights', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to generate insights');
      }
      const data = await res.json();
      // The API returns the full row; insights are in the `insights` field
      const parsed =
        data.insights as PortfolioInsightsData | undefined;
      if (parsed) {
        setLocalInsights(parsed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const displayInsights = localInsights;

  // No insights yet
  if (!displayInsights) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-purple-500" />
            <CardTitle className="text-sm font-medium">
              AI Portfolio Insights
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Run AI Analysis to generate portfolio-level insights
            </p>
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            <Button
              onClick={generateInsights}
              disabled={loading}
              size="sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1 size-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 size-3" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          <CardTitle className="text-sm font-medium">
            AI Portfolio Insights
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={generateInsights}
            disabled={loading}
            aria-label="Regenerate insights"
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {error && (
            <p className="mb-3 text-xs text-red-500">{error}</p>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {/* Themes */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Lightbulb className="size-3.5 text-amber-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Key Themes
                </h4>
              </div>
              <ul className="space-y-1">
                {displayInsights.themes.map((theme, i) => (
                  <li key={i} className="text-sm leading-snug">
                    {theme}
                  </li>
                ))}
              </ul>
            </div>

            {/* Owner Patterns */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <UserCircle className="size-3.5 text-blue-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Owner Patterns
                </h4>
              </div>
              <ul className="space-y-1">
                {displayInsights.owner_patterns.map((op, i) => (
                  <li key={i} className="text-sm leading-snug">
                    <span className="font-medium">{op.owner}:</span>{' '}
                    {op.pattern}
                  </li>
                ))}
              </ul>
            </div>

            {/* Segment Patterns */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <BarChart3 className="size-3.5 text-emerald-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Segment Patterns
                </h4>
              </div>
              <ul className="space-y-1">
                {displayInsights.segment_patterns.map((sp, i) => (
                  <li key={i} className="text-sm leading-snug">
                    <span className="font-medium">{sp.segment}:</span>{' '}
                    {sp.pattern}
                  </li>
                ))}
              </ul>
            </div>

            {/* Urgent Actions */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Zap className="size-3.5 text-red-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Urgent Actions
                </h4>
              </div>
              <ul className="space-y-1">
                {displayInsights.urgent_actions.map((action, i) => (
                  <li key={i} className="text-sm leading-snug">
                    {typeof action === 'string' ? action : (action as { action?: string }).action ?? JSON.stringify(action)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
