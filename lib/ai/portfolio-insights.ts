// ---------------------------------------------------------------------------
// AI Portfolio Insights
// ---------------------------------------------------------------------------
// Aggregates data across all accounts and generates portfolio-level themes,
// owner patterns, segment patterns, and urgent leadership actions.
// ---------------------------------------------------------------------------

import type { Account, ScoringResult } from '@/lib/scoring/types';
import { getAnthropicClient } from '@/lib/ai/client';
import {
  buildPortfolioInsightsPrompt,
  type PortfolioSummaryData,
} from '@/lib/ai/prompts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortfolioInsights {
  themes: string[];
  owner_patterns: Array<{ owner: string; pattern: string }>;
  segment_patterns: Array<{ segment: string; pattern: string }>;
  urgent_actions: string[];
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

function aggregatePortfolioData(
  accounts: Account[],
  results: ScoringResult[],
): PortfolioSummaryData {
  const tierDistribution: Record<string, number> = {};
  const arrByTier: Record<string, number> = {};
  const ownerMap = new Map<
    string,
    { scores: number[]; criticalCount: number }
  >();
  const segmentMap = new Map<
    string,
    { scores: number[]; healths: number[] }
  >();
  const topRisks: Array<{ accountName: string; riskDescription: string }> = [];
  const topOpportunities: Array<{ accountName: string; opportunity: string }> = [];
  let totalArr = 0;

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const result = results[i];
    const tier = result.priorityTier;

    // Tier distribution
    tierDistribution[tier] = (tierDistribution[tier] ?? 0) + 1;

    // ARR by tier
    arrByTier[tier] = (arrByTier[tier] ?? 0) + account.arr_gbp;
    totalArr += account.arr_gbp;

    // Owner stats
    const ownerEntry = ownerMap.get(account.account_owner) ?? {
      scores: [],
      criticalCount: 0,
    };
    ownerEntry.scores.push(result.calibratedScore);
    if (tier === 'critical') ownerEntry.criticalCount++;
    ownerMap.set(account.account_owner, ownerEntry);

    // Segment stats
    const segEntry = segmentMap.get(account.segment) ?? {
      scores: [],
      healths: [],
    };
    segEntry.scores.push(result.calibratedScore);
    segEntry.healths.push(result.healthComposite);
    segmentMap.set(account.segment, segEntry);

    // Top risks (critical and high-priority churn/renewal accounts)
    if (
      (tier === 'critical' || tier === 'high') &&
      (result.priorityType === 'churn_risk' ||
        result.priorityType === 'renewal_urgent')
    ) {
      topRisks.push({
        accountName: account.account_name,
        riskDescription:
          `${result.priorityType.replace(/_/g, ' ')} — ` +
          `ARR £${account.arr_gbp.toLocaleString('en-GB')}, ` +
          `health ${result.healthComposite.toFixed(1)}, ` +
          `${account.days_to_renewal} days to renewal`,
      });
    }

    // Top opportunities (expansion accounts with pipeline)
    if (account.expansion_pipeline_gbp > 0 && result.priorityType === 'expansion_opportunity') {
      topOpportunities.push({
        accountName: account.account_name,
        opportunity:
          `Pipeline £${account.expansion_pipeline_gbp.toLocaleString('en-GB')}, ` +
          `engagement ${result.subScores.engagement.toFixed(1)}`,
      });
    }
  }

  // Build owner stats array
  const ownerStats = Array.from(ownerMap.entries()).map(([owner, data]) => ({
    owner,
    accountCount: data.scores.length,
    avgScore:
      data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length,
    criticalCount: data.criticalCount,
  }));

  // Build segment stats array
  const segmentStats = Array.from(segmentMap.entries()).map(
    ([segment, data]) => ({
      segment,
      accountCount: data.scores.length,
      avgScore:
        data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length,
      avgHealth:
        data.healths.reduce((sum, h) => sum + h, 0) / data.healths.length,
    }),
  );

  // Sort risks and opportunities by relevance, take top entries
  topRisks.sort((a, b) => b.riskDescription.length - a.riskDescription.length);
  topOpportunities.sort(
    (a, b) => b.opportunity.length - a.opportunity.length,
  );

  return {
    totalAccounts: accounts.length,
    tierDistribution,
    totalArr,
    arrByTier,
    topRisks: topRisks.slice(0, 5),
    topOpportunities: topOpportunities.slice(0, 5),
    ownerStats,
    segmentStats,
  };
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function buildFallbackInsights(
  summaryData: PortfolioSummaryData,
): PortfolioInsights {
  const themes: string[] = [];

  if (summaryData.tierDistribution['critical']) {
    themes.push(
      `${summaryData.tierDistribution['critical']} accounts at critical priority require immediate attention`,
    );
  }
  if (summaryData.topRisks.length > 0) {
    themes.push(
      `${summaryData.topRisks.length} high-risk accounts identified with churn or renewal concerns`,
    );
  }
  if (summaryData.topOpportunities.length > 0) {
    themes.push(
      `${summaryData.topOpportunities.length} expansion opportunities in the pipeline`,
    );
  }
  if (themes.length === 0) {
    themes.push('Portfolio data aggregated but AI insights unavailable');
  }

  return {
    themes,
    owner_patterns: summaryData.ownerStats.map((o) => ({
      owner: o.owner,
      pattern: `Manages ${o.accountCount} accounts with avg score ${o.avgScore.toFixed(1)}`,
    })),
    segment_patterns: summaryData.segmentStats.map((s) => ({
      segment: s.segment,
      pattern: `${s.accountCount} accounts, avg health ${s.avgHealth.toFixed(1)}`,
    })),
    urgent_actions: [
      'Review all critical-tier accounts this week',
      'Schedule QBRs for accounts with upcoming renewals',
      'Follow up on top expansion pipeline opportunities',
    ],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function generatePortfolioInsights(
  accounts: Account[],
  results: ScoringResult[],
): Promise<PortfolioInsights> {
  const summaryData = aggregatePortfolioData(accounts, results);

  try {
    const client = getAnthropicClient();
    const { system, user } = buildPortfolioInsightsPrompt(summaryData);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in API response');
    }

    const parsed: PortfolioInsights = JSON.parse(textBlock.text);

    if (
      !Array.isArray(parsed.themes) ||
      !Array.isArray(parsed.owner_patterns) ||
      !Array.isArray(parsed.segment_patterns) ||
      !Array.isArray(parsed.urgent_actions)
    ) {
      throw new Error('API response missing required portfolio insight fields');
    }

    return parsed;
  } catch (error) {
    console.warn(
      '[AI] Portfolio insights generation failed:',
      error instanceof Error ? error.message : error,
    );
    return buildFallbackInsights(summaryData);
  }
}
