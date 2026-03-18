// ---------------------------------------------------------------------------
// AI Counterfactual Analysis
// ---------------------------------------------------------------------------
// Generates "what would need to change" narratives for tier transitions.
// Combines deterministic sensitivity calculation with AI narrative generation.
// ---------------------------------------------------------------------------

import type { Account, ScoringResult } from '@/lib/scoring/types';
import { TIER_BOUNDARIES } from '@/lib/scoring/weights';
import { getAnthropicClient } from '@/lib/ai/client';
import { buildCounterfactualPrompt, type SensitivityEntry } from '@/lib/ai/prompts';

// ---------------------------------------------------------------------------
// Tier ordering (used for boundary lookups)
// ---------------------------------------------------------------------------

const TIER_ORDER = ['monitor', 'low', 'medium', 'high', 'critical'] as const;

const TIER_LOWER_BOUNDS: Record<string, number> = {
  monitor: 0,
  low: TIER_BOUNDARIES.low,
  medium: TIER_BOUNDARIES.medium,
  high: TIER_BOUNDARIES.high,
  critical: TIER_BOUNDARIES.critical,
};

// ---------------------------------------------------------------------------
// Sensitivity calculation
// ---------------------------------------------------------------------------

function calculateSensitivity(scoringResult: ScoringResult): SensitivityEntry[] {
  const currentTier = scoringResult.priorityTier;
  const tierIndex = TIER_ORDER.indexOf(currentTier);
  const calibrated = scoringResult.calibratedScore;

  // Points needed to reach the next tier up
  let pointsToNextTierUp: number | null = null;
  if (tierIndex < TIER_ORDER.length - 1) {
    const nextTierUp = TIER_ORDER[tierIndex + 1];
    const boundary = TIER_LOWER_BOUNDS[nextTierUp];
    pointsToNextTierUp = Math.max(0, boundary - calibrated);
  }

  // Points buffer before dropping to the tier below
  let pointsToNextTierDown: number | null = null;
  if (tierIndex > 0) {
    const currentBoundary = TIER_LOWER_BOUNDS[currentTier];
    pointsToNextTierDown = Math.max(0, calibrated - currentBoundary);
  }

  const subScoreEntries: Array<{ name: string; value: number }> = [
    { name: 'Revenue Health', value: scoringResult.subScores.revenueHealth },
    { name: 'Engagement', value: scoringResult.subScores.engagement },
    { name: 'Support Health', value: scoringResult.subScores.supportHealth },
    { name: 'Opportunity', value: scoringResult.subScores.opportunity },
    { name: 'Urgency', value: scoringResult.subScores.urgency },
  ];

  return subScoreEntries.map((entry) => ({
    subScore: entry.name,
    currentValue: entry.value,
    pointsToNextTierUp,
    pointsToNextTierDown,
  }));
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function buildFallbackCounterfactuals(
  account: Account,
  scoringResult: ScoringResult,
  sensitivityData: SensitivityEntry[],
): { counterfactual_up: string; counterfactual_down: string } {
  const currentTier = scoringResult.priorityTier;
  const tierIndex = TIER_ORDER.indexOf(currentTier);

  // Find the weakest sub-score (most room for improvement upward)
  const sorted = [...sensitivityData].sort((a, b) => a.currentValue - b.currentValue);
  const weakest = sorted[0];

  // Find the strongest sub-score (most room to decline downward)
  const strongest = sorted[sorted.length - 1];

  const upNarrative =
    tierIndex < TIER_ORDER.length - 1
      ? `${account.account_name} would need to improve its calibrated score by approximately ` +
        `${weakest.pointsToNextTierUp?.toFixed(1) ?? '?'} points to move from ${currentTier} to ` +
        `${TIER_ORDER[tierIndex + 1]}. The most impactful lever is ${weakest.subScore} ` +
        `(currently ${weakest.currentValue.toFixed(1)}), which is the weakest sub-score.`
      : `${account.account_name} is already at the highest tier (critical). No upward tier movement is possible.`;

  const downNarrative =
    tierIndex > 0
      ? `${account.account_name} has a buffer of approximately ` +
        `${strongest.pointsToNextTierDown?.toFixed(1) ?? '?'} points before dropping from ` +
        `${currentTier} to ${TIER_ORDER[tierIndex - 1]}. The area most at risk of decline ` +
        `is ${strongest.subScore} (currently ${strongest.currentValue.toFixed(1)}), as any ` +
        `deterioration there would have the largest impact.`
      : `${account.account_name} is already at the lowest tier (monitor). No downward tier movement is possible.`;

  return {
    counterfactual_up: upNarrative,
    counterfactual_down: downNarrative,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function generateCounterfactuals(
  account: Account,
  scoringResult: ScoringResult,
): Promise<{ counterfactual_up: string; counterfactual_down: string }> {
  const sensitivityData = calculateSensitivity(scoringResult);

  try {
    const client = getAnthropicClient();
    const { system, user } = buildCounterfactualPrompt(
      account,
      scoringResult,
      sensitivityData,
    );

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in API response');
    }

    const parsed: { counterfactual_up: string; counterfactual_down: string } =
      JSON.parse(textBlock.text);

    if (!parsed.counterfactual_up || !parsed.counterfactual_down) {
      throw new Error('API response missing required counterfactual fields');
    }

    return parsed;
  } catch (error) {
    console.warn(
      `[AI] Counterfactual generation failed for ${account.account_id} (${account.account_name}):`,
      error instanceof Error ? error.message : error,
    );
    return buildFallbackCounterfactuals(account, scoringResult, sensitivityData);
  }
}
