'use client';

import type { Account, ScoringResult } from '@/lib/scoring/types';
import type { AccountAnalysis } from '@/components/account/ai-reasoning';
import { CollapsibleSection } from './collapsible-section';
import { WaterfallChart } from './waterfall-chart';
import { MetricsGrid } from './metrics-grid';
import { ContradictionsPanel } from './contradictions-panel';
import { AiReasoning } from './ai-reasoning';
import { RecommendedActions } from './recommended-actions';
import { RiskOpportunity } from './risk-opportunity';
import { CounterfactualPanel } from './counterfactual-panel';
import { NotesPanel } from './notes-panel';
import { CommentsSection } from './comments-section';
import { ActionRecorder } from './action-recorder';
import {
  BarChart3,
  Sparkles,
  FileText,
  GitBranch,
  MessageSquare,
} from 'lucide-react';

interface AccountAccordionProps {
  account: Account;
  result: ScoringResult;
  analysis: AccountAnalysis | null;
  actions: Array<{
    action: string;
    owner: string;
    timeframe: string;
    rationale: string;
  }> | null;
  counterfactualUp: string | null;
  counterfactualDown: string | null;
  existingActions: Array<{
    id: string;
    action_type: string;
    description: string;
    ai_accuracy_rating: string | null;
    created_at: string;
  }>;
}

export function AccountAccordion({
  account,
  result,
  analysis,
  actions,
  counterfactualUp,
  counterfactualDown,
  existingActions,
}: AccountAccordionProps) {
  const actionCount = actions?.length ?? 0;
  const hasContradictions = result.contradictions.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Score Decomposition — expanded by default */}
      <CollapsibleSection
        title="Score Decomposition"
        subtitle="Scoring waterfall, account metrics, and data contradictions"
        icon={BarChart3}
        badge={hasContradictions ? `${result.contradictions.length} contradiction${result.contradictions.length !== 1 ? 's' : ''}` : null}
        defaultOpen
      >
        <div className="flex flex-col gap-6">
          <WaterfallChart
            subScores={result.subScores}
            calibratedScore={result.calibratedScore}
            priorityTier={result.priorityTier}
          />
          <MetricsGrid account={account} />
          {hasContradictions && (
            <ContradictionsPanel contradictions={result.contradictions} />
          )}
        </div>
      </CollapsibleSection>

      {/* AI Analysis & Recommendations — expanded by default */}
      <CollapsibleSection
        title="AI Analysis & Recommendations"
        subtitle="AI reasoning, recommended actions, and risk/opportunity factors"
        icon={Sparkles}
        badge={actionCount > 0 ? `${actionCount} action${actionCount !== 1 ? 's' : ''}` : null}
        defaultOpen
      >
        <div className="flex flex-col gap-6">
          <AiReasoning
            analysis={analysis}
            accountId={account.account_id}
          />
          <RecommendedActions
            actions={actions}
            accountId={account.account_id}
          />
          <RiskOpportunity
            riskFactors={analysis?.risk_factors ?? null}
            opportunityFactors={analysis?.opportunity_factors ?? null}
          />
        </div>
      </CollapsibleSection>

      {/* Notes & Sentiment — collapsed by default */}
      <CollapsibleSection
        title="Notes & Sentiment"
        subtitle="Support, customer, and sales team notes with sentiment analysis"
        icon={FileText}
      >
        <NotesPanel account={account} />
      </CollapsibleSection>

      {/* What-If Analysis — collapsed by default, only if data exists */}
      {(counterfactualUp || counterfactualDown) && (
        <CollapsibleSection
          title="What-If Analysis"
          subtitle="What would move this account up or down a tier"
          icon={GitBranch}
        >
          <CounterfactualPanel
            counterfactualUp={counterfactualUp}
            counterfactualDown={counterfactualDown}
          />
        </CollapsibleSection>
      )}

      {/* Comments & Actions — collapsed by default */}
      <CollapsibleSection
        title="Comments & Actions"
        subtitle="Team discussion and recorded actions with AI accuracy feedback"
        icon={MessageSquare}
        badge={existingActions.length > 0 ? existingActions.length : null}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <CommentsSection accountId={account.account_id} />
          <ActionRecorder
            accountId={account.account_id}
            existingActions={existingActions}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}
