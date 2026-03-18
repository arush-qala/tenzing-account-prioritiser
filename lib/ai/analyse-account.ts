// ---------------------------------------------------------------------------
// AI Account Analysis
// ---------------------------------------------------------------------------
// Calls Claude to generate qualitative analysis for a single account.
// Falls back to a deterministic summary on API failure.
// ---------------------------------------------------------------------------

import type { Account, ScoringResult } from '@/lib/scoring/types';
import { getAnthropicClient } from '@/lib/ai/client';
import { buildAccountAnalysisPrompt } from '@/lib/ai/prompts';

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
  key_signals: string[];
  adjusted_tier: string;
  adjustment_reason: string;
  confidence_level: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Fallback (deterministic, used when AI call fails)
// ---------------------------------------------------------------------------

function buildFallbackAnalysis(
  account: Account,
  scoringResult: ScoringResult,
): AccountAnalysis {
  const risks: string[] = [];
  const opportunities: string[] = [];
  const signals: string[] = [];

  if (scoringResult.subScores.revenueHealth < 40) {
    risks.push(`Revenue health score is low at ${scoringResult.subScores.revenueHealth}`);
    signals.push('Declining revenue health');
  }
  if (account.days_to_renewal < 90) {
    risks.push(`Renewal in ${account.days_to_renewal} days`);
    signals.push('Upcoming renewal');
  }
  if (account.urgent_open_tickets_count > 0) {
    risks.push(`${account.urgent_open_tickets_count} urgent open tickets`);
  }
  if (account.expansion_pipeline_gbp > 0) {
    opportunities.push(
      `Expansion pipeline of £${account.expansion_pipeline_gbp.toLocaleString('en-GB')}`,
    );
    signals.push('Active expansion pipeline');
  }
  if (account.seat_utilisation_pct < 0.5) {
    risks.push(
      `Low seat utilisation at ${(account.seat_utilisation_pct * 100).toFixed(0)}%`,
    );
  }
  if (scoringResult.subScores.engagement > 70) {
    opportunities.push('Strong engagement scores');
    signals.push('High engagement');
  }

  // Ensure we always have at least some content
  if (signals.length === 0) signals.push('Overall score profile');
  if (risks.length === 0) risks.push('No major risks identified from available data');
  if (opportunities.length === 0)
    opportunities.push('Monitor for emerging opportunities');

  return {
    reasoning:
      `${account.account_name} is currently a ${scoringResult.priorityTier}-priority ` +
      `${scoringResult.priorityType.replace(/_/g, ' ')} account with a calibrated score ` +
      `of ${scoringResult.calibratedScore.toFixed(1)}. ` +
      `AI analysis unavailable; this summary is generated from scoring data.`,
    recommended_actions: [
      {
        action: `Review account health and recent activity`,
        owner: account.account_owner,
        timeframe: 'Next 7 days',
        rationale: `Calibrated priority score of ${scoringResult.calibratedScore.toFixed(1)}`,
      },
      {
        action: `Check in with customer on satisfaction and usage`,
        owner: account.csm_owner,
        timeframe: 'Next 14 days',
        rationale: `Current engagement score: ${scoringResult.subScores.engagement}`,
      },
      {
        action: `Prepare renewal strategy if applicable`,
        owner: account.account_owner,
        timeframe: 'Next 30 days',
        rationale: `${account.days_to_renewal} days to renewal`,
      },
    ],
    risk_factors: risks,
    opportunity_factors: opportunities,
    key_signals: signals.slice(0, 3),
    adjusted_tier: scoringResult.priorityTier,
    adjustment_reason: 'Tier confirmed (fallback analysis, no AI adjustment)',
    confidence_level: 'low',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function analyseAccount(
  account: Account,
  scoringResult: ScoringResult,
): Promise<AccountAnalysis> {
  try {
    const client = getAnthropicClient();
    const { system, user } = buildAccountAnalysisPrompt(account, scoringResult);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6-20250627',
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: user }],
    });

    // Extract text from the response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in API response');
    }

    const parsed: AccountAnalysis = JSON.parse(textBlock.text);

    // Validate required fields
    if (
      !parsed.reasoning ||
      !Array.isArray(parsed.recommended_actions) ||
      !Array.isArray(parsed.risk_factors) ||
      !Array.isArray(parsed.opportunity_factors) ||
      !Array.isArray(parsed.key_signals) ||
      !parsed.adjusted_tier ||
      !parsed.adjustment_reason ||
      !parsed.confidence_level
    ) {
      throw new Error('API response missing required fields');
    }

    return parsed;
  } catch (error) {
    console.warn(
      `[AI] Analysis failed for ${account.account_id} (${account.account_name}):`,
      error instanceof Error ? error.message : error,
    );
    return buildFallbackAnalysis(account, scoringResult);
  }
}
