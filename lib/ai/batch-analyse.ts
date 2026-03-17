// ---------------------------------------------------------------------------
// Batch Account Analysis
// ---------------------------------------------------------------------------
// Sequentially analyses all accounts with AI, respecting rate limits.
// Combines per-account analysis with counterfactual narratives.
// ---------------------------------------------------------------------------

import type { Account, ScoringResult } from '@/lib/scoring/types';
import { analyseAccount, type AccountAnalysis } from '@/lib/ai/analyse-account';
import { generateCounterfactuals } from '@/lib/ai/counterfactuals';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BatchAnalysisResult = AccountAnalysis & {
  counterfactual_up: string;
  counterfactual_down: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function batchAnalyseAccounts(
  accounts: Account[],
  results: ScoringResult[],
): Promise<Map<string, BatchAnalysisResult>> {
  const output = new Map<string, BatchAnalysisResult>();

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const scoringResult = results[i];

    console.log(
      `Analysing ${i + 1}/${accounts.length}: ${account.account_id} ${account.account_name}...`,
    );

    try {
      // Run analysis and counterfactuals for this account
      const [analysis, counterfactuals] = await Promise.all([
        analyseAccount(account, scoringResult),
        generateCounterfactuals(account, scoringResult),
      ]);

      output.set(account.account_id, {
        ...analysis,
        counterfactual_up: counterfactuals.counterfactual_up,
        counterfactual_down: counterfactuals.counterfactual_down,
      });
    } catch (error) {
      console.warn(
        `[Batch] Failed for ${account.account_id} (${account.account_name}):`,
        error instanceof Error ? error.message : error,
      );
      // Continue to next account on failure
    }

    // Rate limit delay between accounts (skip after the last one)
    if (i < accounts.length - 1) {
      await delay(500);
    }
  }

  return output;
}
