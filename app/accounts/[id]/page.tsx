import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';

import { NavHeader } from '@/components/nav-header';
import { AccountHeader } from '@/components/account/account-header';
import { AtAGlance } from '@/components/account/at-a-glance';
import { WaterfallChart } from '@/components/account/waterfall-chart';
import { MetricsGrid } from '@/components/account/metrics-grid';
import { ContradictionsPanel } from '@/components/account/contradictions-panel';
import { AiReasoning } from '@/components/account/ai-reasoning';
import { RecommendedActions } from '@/components/account/recommended-actions';
import { RiskOpportunity } from '@/components/account/risk-opportunity';
import { CounterfactualPanel } from '@/components/account/counterfactual-panel';
import { NotesPanel } from '@/components/account/notes-panel';
import { CommentsSection } from '@/components/account/comments-section';
import { ActionRecorder } from '@/components/account/action-recorder';
import { AiChatPanel } from '@/components/account/ai-chat-panel';
import { VoiceChat } from '@/components/account/voice-chat';
import type { AccountAnalysis } from '@/components/account/ai-reasoning';

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

  // ---- Fetch standalone actions ----
  const { data: actionsRows } = await supabase
    .from('actions')
    .select('*')
    .eq('account_id', account.account_id)
    .order('created_at', { ascending: false });

  if (actionsRows && actionsRows.length > 0 && !actions) {
    actions = (actionsRows as Array<Record<string, unknown>>).map((row) => ({
      action: (row.action as string) ?? '',
      owner: (row.owner as string) ?? '',
      timeframe: (row.timeframe as string) ?? '',
      rationale: (row.rationale as string) ?? '',
    }));
  }

  // ---- Build account context for voice chat ----
  const voiceContext = [
    `Account: ${account.account_name} (${account.account_id})`,
    `Industry: ${account.industry} | Segment: ${account.segment} | Region: ${account.region}`,
    `Status: ${account.account_status} | Lifecycle: ${account.lifecycle_stage}`,
    `Owner: ${account.account_owner} | CSM: ${account.csm_owner}`,
    `ARR: £${account.arr_gbp?.toLocaleString()} | MRR: £${account.mrr_current_gbp?.toLocaleString()}`,
    `MRR Trend: ${((account.mrr_trend_pct ?? 0) * 100).toFixed(1)}%`,
    `Seats: ${account.seats_used}/${account.seats_purchased}`,
    `Usage Score: ${account.usage_score_current} (was ${account.usage_score_3m_ago})`,
    `Days to Renewal: ${account.days_to_renewal}`,
    `NPS: ${account.latest_nps ?? 'N/A'} | CSAT: ${account.avg_csat_90d ?? 'N/A'}`,
    `Open Tickets: ${account.open_tickets_count} (${account.urgent_open_tickets_count} urgent)`,
    `Priority Score: ${result.calibratedScore.toFixed(1)} | Tier: ${result.priorityTier} | Type: ${result.priorityType}`,
    analysis?.reasoning ? `AI Analysis: ${analysis.reasoning}` : '',
    account.recent_support_summary ? `Support Notes: ${account.recent_support_summary}` : '',
    account.recent_customer_note ? `Customer Notes: ${account.recent_customer_note}` : '',
    account.recent_sales_note ? `Sales Notes: ${account.recent_sales_note}` : '',
  ].filter(Boolean).join('\n');

  // Map existing actions for the recorder
  const existingActions = (actionsRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: (r.id as string) ?? '',
      action_type: (r.action_type as string) ?? '',
      description: (r.description as string) ?? '',
      ai_accuracy_rating: (r.ai_accuracy_rating as string) ?? null,
      created_at: (r.created_at as string) ?? '',
    };
  });

  // ---- Render ----
  return (
    <div className="min-h-screen bg-background">
      <NavHeader userEmail={user.email} />

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex flex-col gap-4">
          {/* Account header + Chat + Voice buttons */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <AccountHeader account={account} result={result} />
            </div>
            <div className="flex items-center gap-2">
              <VoiceChat
                accountId={account.account_id}
                accountName={account.account_name}
                accountContext={voiceContext}
              />
              <AiChatPanel
                accountId={account.account_id}
                accountName={account.account_name}
              />
            </div>
          </div>

          {/* At a Glance strip */}
          <AtAGlance account={account} result={result} />

          {/* ROW 1: Three-column layout — Score | AI | Actions */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
            {/* Col 1: Score Decomposition + Metrics + Contradictions */}
            <div className="min-w-0 flex flex-col gap-4">
              <WaterfallChart
                subScores={result.subScores}
                calibratedScore={result.calibratedScore}
                priorityTier={result.priorityTier}
              />
              <MetricsGrid account={account} />
              {result.contradictions.length > 0 && (
                <ContradictionsPanel contradictions={result.contradictions} />
              )}
            </div>

            {/* Col 2: AI Analysis + Risk/Opportunity */}
            <div className="min-w-0 flex flex-col gap-4">
              <AiReasoning
                accountId={account.account_id}
                analysis={analysis}
              />
              {analysis && (
                <RiskOpportunity
                  riskFactors={analysis.risk_factors}
                  opportunityFactors={analysis.opportunity_factors}
                />
              )}
            </div>

            {/* Col 3: Recommended Actions */}
            <div className="min-w-0 flex flex-col gap-4">
              <RecommendedActions
                accountId={account.account_id}
                actions={actions}
              />
            </div>
          </div>

          {/* ROW 2: Notes + What-If */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NotesPanel account={account} />
            {(counterfactualUp || counterfactualDown) && (
              <CounterfactualPanel
                counterfactualUp={counterfactualUp}
                counterfactualDown={counterfactualDown}
              />
            )}
          </div>

          {/* ROW 3: Comments + Action Recorder */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CommentsSection accountId={account.account_id} />
            <ActionRecorder
              accountId={account.account_id}
              existingActions={existingActions}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
