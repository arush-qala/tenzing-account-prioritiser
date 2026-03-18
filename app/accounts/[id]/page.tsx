import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';
import { Separator } from '@/components/ui/separator';

import { NavHeader } from '@/components/nav-header';
import { AccountHeader } from '@/components/account/account-header';
import { WaterfallChart } from '@/components/account/waterfall-chart';
import { MetricsGrid } from '@/components/account/metrics-grid';
import { ContradictionsPanel } from '@/components/account/contradictions-panel';
import { AiReasoning } from '@/components/account/ai-reasoning';
import type { AccountAnalysis } from '@/components/account/ai-reasoning';
import { RecommendedActions } from '@/components/account/recommended-actions';
import { CounterfactualPanel } from '@/components/account/counterfactual-panel';
import { RiskOpportunity } from '@/components/account/risk-opportunity';
import { NotesPanel } from '@/components/account/notes-panel';
import { ActionRecorder } from '@/components/account/action-recorder';
import { CommentsSection } from '@/components/account/comments-section';
import { AiChatPanel } from '@/components/account/ai-chat-panel';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: { id: string };
}

export default async function AccountDetailPage({ params }: PageProps) {
  // ---- Auth ----
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // ---- Fetch all accounts (needed for calibrated scoring) ----
  const { data: rawAccounts } = await supabase.from('accounts').select('*');
  const accounts = (rawAccounts ?? []) as Account[];

  // ---- Score all accounts ----
  const scoredResults = scoreAllAccounts(accounts);

  // ---- Find this account ----
  const match = scoredResults.find(
    ({ account }) => account.account_id === params.id,
  );

  if (!match) {
    notFound();
  }

  const { account, result } = match;

  // ---- Fetch AI analysis (if exists) ----
  const { data: analysisRow } = await supabase
    .from('ai_analyses')
    .select('*')
    .eq('account_id', account.account_id)
    .order('analysed_at', { ascending: false })
    .limit(1)
    .single();

  let analysis: AccountAnalysis | null = null;
  let actions: Array<{
    action: string;
    owner: string;
    timeframe: string;
    rationale: string;
  }> | null = null;
  let counterfactualUp: string | null = null;
  let counterfactualDown: string | null = null;

  if (analysisRow) {
    const row = analysisRow as Record<string, unknown>;
    if (row.reasoning) {
      analysis = {
        reasoning: (row.reasoning as string) ?? '',
        recommended_actions: (row.recommended_actions as AccountAnalysis['recommended_actions']) ?? [],
        risk_factors: (row.risk_factors as string[]) ?? [],
        opportunity_factors: (row.opportunity_factors as string[]) ?? [],
        key_signals: (row.key_signals as string[]) ?? [],
        adjusted_tier: (row.adjusted_tier as string) ?? '',
        adjustment_reason: (row.adjustment_reason as string) ?? '',
        confidence_level: (row.confidence_level as AccountAnalysis['confidence_level']) ?? 'medium',
      };
      actions = analysis.recommended_actions;
    }
    if (row.counterfactual_up) {
      counterfactualUp = row.counterfactual_up as string;
    }
    if (row.counterfactual_down) {
      counterfactualDown = row.counterfactual_down as string;
    }
  }

  // ---- Fetch standalone actions (if any exist in a separate table) ----
  const { data: actionsRows } = await supabase
    .from('actions')
    .select('*')
    .eq('account_id', account.account_id)
    .order('created_at', { ascending: false });

  // If there are standalone action rows, map them as a fallback
  if (actionsRows && actionsRows.length > 0 && !actions) {
    actions = (actionsRows as Array<Record<string, unknown>>).map((row) => ({
      action: (row.action as string) ?? '',
      owner: (row.owner as string) ?? '',
      timeframe: (row.timeframe as string) ?? '',
      rationale: (row.rationale as string) ?? '',
    }));
  }

  // ---- Render ----
  return (
    <div className="min-h-screen bg-background">
      {/* Header with navigation */}
      <NavHeader userEmail={user.email} />

      {/* Main content */}
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex flex-col gap-6">
          {/* Account header + Chat button */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <AccountHeader account={account} result={result} />
            </div>
            <AiChatPanel
              accountId={account.account_id}
              accountName={account.account_name}
            />
          </div>

          <Separator />

          {/* Two-column layout */}
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            {/* Left column (60%) */}
            <div className="flex flex-col gap-6">
              <WaterfallChart
                subScores={result.subScores}
                calibratedScore={result.calibratedScore}
                priorityTier={result.priorityTier}
              />

              <MetricsGrid account={account} />

              <ContradictionsPanel contradictions={result.contradictions} />
            </div>

            {/* Right column (40%) - AI components */}
            <div className="flex flex-col gap-6">
              <AiReasoning
                analysis={analysis}
                accountId={account.account_id}
              />

              <RecommendedActions
                actions={actions}
                accountId={account.account_id}
              />

              <CounterfactualPanel
                counterfactualUp={counterfactualUp}
                counterfactualDown={counterfactualDown}
              />

              <RiskOpportunity
                riskFactors={analysis?.risk_factors ?? null}
                opportunityFactors={analysis?.opportunity_factors ?? null}
              />

              <NotesPanel account={account} />
            </div>
          </div>

          <Separator />

          {/* Comments + Action Recorder (side by side) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <CommentsSection accountId={account.account_id} />
            <ActionRecorder
              accountId={account.account_id}
              existingActions={(actionsRows ?? []).map((row) => {
                const r = row as Record<string, unknown>;
                return {
                  id: (r.id as string) ?? '',
                  action_type: (r.action_type as string) ?? '',
                  description: (r.description as string) ?? '',
                  ai_accuracy_rating: (r.ai_accuracy_rating as string) ?? null,
                  created_at: (r.created_at as string) ?? '',
                };
              })}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
