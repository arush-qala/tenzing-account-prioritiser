'use client';

import { useState, useEffect, useRef } from 'react';
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
  hasAnalyses: boolean;
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
// Helpers: format action text with tag badges + highlighted values
// ---------------------------------------------------------------------------

const TAG_COLORS: Record<string, string> = {
  churn: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  pipeline: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  expansion: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  retention: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function parseActionTag(text: string): { tag: string | null; rest: string } {
  const match = text.match(/^\[([^\]]+)\]\s*/);
  if (match) {
    return { tag: match[1], rest: text.slice(match[0].length) };
  }
  return { tag: null, rest: text };
}

function formatActionText(text: string): React.ReactNode {
  // Highlight £amounts and "X days" patterns
  const parts = text.split(/(£[\d,]+(?:\.\d+)?|[\d,]+ days?\b|\d+ ARR\b)/g);
  return parts.map((part, i) => {
    if (/^£[\d,]/.test(part) || /^\d.*days?$/.test(part)) {
      return (
        <span key={i} className="font-semibold text-foreground">
          {part}
        </span>
      );
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiInsightsPanel({ insights, hasAnalyses }: AiInsightsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [runningFullPipeline, setRunningFullPipeline] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<number | null>(null);
  const [localInsights, setLocalInsights] =
    useState<PortfolioInsightsData | null>(insights);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/analyse-all/progress');
        if (res.ok) {
          const data = await res.json();
          setPipelineProgress(data.completed ?? 0);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPipelineProgress(null);
  }

  async function generateInsights() {
    setLoading(true);
    setError(null);

    // If no account analyses exist, run the full pipeline first
    const needsFullPipeline = !hasAnalyses;
    setRunningFullPipeline(needsFullPipeline);

    try {
      if (needsFullPipeline) {
        setPipelineProgress(0);
        startPolling();
        // Full pipeline: analyse all accounts + generate insights
        const analyseRes = await fetch('/api/analyse-all', { method: 'POST' });
        stopPolling();
        if (!analyseRes.ok) {
          const body = await analyseRes.json();
          throw new Error(body.error ?? 'Failed to analyse accounts');
        }
        // analyse-all already generates portfolio insights at the end,
        // so we need to fetch the latest insights
        const insightsRes = await fetch('/api/portfolio-insights');
        if (insightsRes.ok) {
          const data = await insightsRes.json();
          const parsed = data.insights as PortfolioInsightsData | undefined;
          if (parsed) {
            setLocalInsights(parsed);
          }
        }
        // Refresh the page to update AI summaries in the priority list
        window.location.reload();
        return;
      }

      // Normal path: just refresh insights
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
      stopPolling();
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRunningFullPipeline(false);
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
                  {runningFullPipeline
                    ? pipelineProgress !== null
                      ? `Analysing... ${pipelineProgress}/60`
                      : 'Starting analysis...'
                    : 'Generating...'}
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
          {/* Urgent Actions — red border */}
          <InsightSection
            title="Urgent Actions"
            icon={Zap}
            borderColor="border-l-red-500"
            iconColor="text-red-500"
            count={displayInsights.urgent_actions.length}
            defaultOpen
          >
            <div className="divide-y divide-border">
              {displayInsights.urgent_actions.map((action, i) => {
                const raw = typeof action === 'string' ? action : (action as { action?: string }).action ?? JSON.stringify(action);
                const { tag, rest } = parseActionTag(raw);
                const tagKey = tag?.toLowerCase() ?? '';
                const tagColor = TAG_COLORS[tagKey] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

                return (
                  <div key={i} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2 text-sm leading-relaxed">
                      {tag && (
                        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tagColor}`}>
                          {tag}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {formatActionText(rest)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </InsightSection>

          {/* Key Themes — amber border */}
          <InsightSection
            title="Key Themes"
            icon={Lightbulb}
            borderColor="border-l-amber-500"
            iconColor="text-amber-500"
            count={displayInsights.themes.length}
            defaultOpen
          >
            <div className="divide-y divide-border">
              {displayInsights.themes.map((theme, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {theme}
                  </span>
                </div>
              ))}
            </div>
          </InsightSection>

          {/* Owner Patterns — blue border */}
          <InsightSection
            title="Owner Patterns"
            icon={UserCircle}
            borderColor="border-l-blue-500"
            iconColor="text-blue-500"
            count={displayInsights.owner_patterns.length}
            defaultOpen
          >
            <div className="divide-y divide-border">
              {displayInsights.owner_patterns.map((op, i) => (
                <div key={i} className="py-2 first:pt-0 last:pb-0">
                  <span className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {op.owner}
                  </span>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {op.pattern}
                  </p>
                </div>
              ))}
            </div>
          </InsightSection>

          {/* Segment Patterns — emerald border */}
          <InsightSection
            title="Segment Patterns"
            icon={BarChart3}
            borderColor="border-l-emerald-500"
            iconColor="text-emerald-500"
            count={displayInsights.segment_patterns.length}
            defaultOpen
          >
            <div className="divide-y divide-border">
              {displayInsights.segment_patterns.map((sp, i) => (
                <div key={i} className="py-2 first:pt-0 last:pb-0">
                  <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {sp.segment}
                  </span>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {sp.pattern}
                  </p>
                </div>
              ))}
            </div>
          </InsightSection>
        </div>
      </CardContent>
    </Card>
  );
}
