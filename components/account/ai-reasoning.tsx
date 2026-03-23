'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  ShieldCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountAnalysis {
  reasoning: string;
  recommended_actions: Array<{
    action: string;
    owner: string;
    timeframe: string;
    rationale: string;
  }>;
  risk_factors: string[];
  opportunity_factors: string[];
  adjusted_tier: string;
  adjustment_reason: string;
  confidence_level: 'high' | 'medium' | 'low';
}

interface AiReasoningProps {
  analysis: AccountAnalysis | null;
  accountId: string;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const confidenceStyles: Record<AccountAnalysis['confidence_level'], string> = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-red-100 text-red-800 border-red-200',
};

const confidenceIcons: Record<AccountAnalysis['confidence_level'], typeof ShieldCheck> = {
  high: ShieldCheck,
  medium: AlertTriangle,
  low: AlertTriangle,
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiReasoning({ analysis, accountId, isLoading: externalLoading }: AiReasoningProps) {
  const [loading, setLoading] = useState(false);
  const [localAnalysis, setLocalAnalysis] = useState<AccountAnalysis | null>(analysis);
  const [error, setError] = useState<string | null>(null);

  const isLoading = externalLoading || loading;

  async function analyseAccount() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(body.error ?? 'Failed to analyse account');
      }
      const data = await res.json();
      if (data.analysis) {
        setLocalAnalysis(data.analysis as AccountAnalysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const displayAnalysis = localAnalysis;

  // ---- No analysis yet ----
  if (!displayAnalysis) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-purple-500" />
            <CardTitle>AI Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No AI analysis yet. Run analysis to get reasoning, recommendations, and risk assessment.
            </p>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button onClick={analyseAccount} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Analysing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 size-4" />
                  Analyse Account
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Analysis available ----
  const ConfidenceIcon = confidenceIcons[displayAnalysis.confidence_level];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          <CardTitle>AI Analysis</CardTitle>
        </div>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={analyseAccount}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3" />
            )}
            Re-analyse
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Reasoning */}
        <div className="rounded-lg bg-muted/50 p-4">
          <ul className="space-y-2 text-base leading-relaxed">
            {displayAnalysis.reasoning
              .split(/•|\n/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((bullet, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                  <span>{bullet}</span>
                </li>
              ))}
          </ul>
        </div>

        {/* Confidence */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              confidenceStyles[displayAnalysis.confidence_level]
            }`}
          >
            <ConfidenceIcon className="size-3" />
            {capitalize(displayAnalysis.confidence_level)} Confidence
          </span>
        </div>

        {/* Tier Adjustment Callout */}
        {displayAnalysis.adjustment_reason && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <ArrowUpDown className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">
                AI adjusted tier to{' '}
                <span className="font-bold">{capitalize(displayAnalysis.adjusted_tier)}</span>
              </p>
              <p className="text-sm text-amber-700">
                {displayAnalysis.adjustment_reason}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
