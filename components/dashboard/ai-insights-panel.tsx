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
  ChevronRight,
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
// Collapsible insight section
// ---------------------------------------------------------------------------

interface InsightSectionProps {
  title: string;
  icon: React.ElementType;
  borderColor: string;
  iconColor: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function InsightSection({
  title,
  icon: Icon,
  borderColor,
  iconColor,
  count,
  defaultOpen = false,
  children,
}: InsightSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-md border-l-4 ${borderColor} border bg-card`}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
        <Icon className={`size-3.5 ${iconColor}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          {title}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {count}
        </span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiInsightsPanel({ insights }: AiInsightsPanelProps) {
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
      const parsed = data.insights as PortfolioInsightsData | undefined;
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
              Run AI analysis to generate portfolio-level insights
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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          <CardTitle className="text-sm font-medium">
            AI Portfolio Insights
          </CardTitle>
        </div>
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
      </CardHeader>

      <CardContent>
        {error && (
          <p className="mb-3 text-xs text-red-500">{error}</p>
        )}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Urgent Actions — expanded by default, red border */}
          <InsightSection
            title="Urgent Actions"
            icon={Zap}
            borderColor="border-l-red-500"
            iconColor="text-red-500"
            count={displayInsights.urgent_actions.length}
            defaultOpen
          >
            <ul className="space-y-1.5">
              {displayInsights.urgent_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-snug">
                  <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-red-400" />
                  {typeof action === 'string' ? action : (action as { action?: string }).action ?? JSON.stringify(action)}
                </li>
              ))}
            </ul>
          </InsightSection>

          {/* Key Themes — collapsed by default, amber border */}
          <InsightSection
            title="Key Themes"
            icon={Lightbulb}
            borderColor="border-l-amber-500"
            iconColor="text-amber-500"
            count={displayInsights.themes.length}
          >
            <ul className="space-y-1.5">
              {displayInsights.themes.map((theme, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-snug">
                  <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-amber-400" />
                  {theme}
                </li>
              ))}
            </ul>
          </InsightSection>

          {/* Owner Patterns — collapsed by default, blue border */}
          <InsightSection
            title="Owner Patterns"
            icon={UserCircle}
            borderColor="border-l-blue-500"
            iconColor="text-blue-500"
            count={displayInsights.owner_patterns.length}
          >
            <dl className="space-y-2">
              {displayInsights.owner_patterns.map((op, i) => (
                <div key={i}>
                  <dt className="text-sm font-medium">{op.owner}</dt>
                  <dd className="text-sm text-muted-foreground leading-snug">{op.pattern}</dd>
                </div>
              ))}
            </dl>
          </InsightSection>

          {/* Segment Patterns — collapsed by default, emerald border */}
          <InsightSection
            title="Segment Patterns"
            icon={BarChart3}
            borderColor="border-l-emerald-500"
            iconColor="text-emerald-500"
            count={displayInsights.segment_patterns.length}
          >
            <dl className="space-y-2">
              {displayInsights.segment_patterns.map((sp, i) => (
                <div key={i}>
                  <dt className="text-sm font-medium">{sp.segment}</dt>
                  <dd className="text-sm text-muted-foreground leading-snug">{sp.pattern}</dd>
                </div>
              ))}
            </dl>
          </InsightSection>
        </div>
      </CardContent>
    </Card>
  );
}
