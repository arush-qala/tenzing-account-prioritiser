// ---------------------------------------------------------------------------
// POST /api/analyse-all — Batch-analyse all accounts
// ---------------------------------------------------------------------------
// Long-running operation: scores all accounts, runs AI analysis on each one
// sequentially (with rate limiting), then generates portfolio insights.
// Returns a summary of results when complete.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import { analyseAccount } from '@/lib/ai/analyse-account';
import { generateCounterfactuals } from '@/lib/ai/counterfactuals';
import { generatePortfolioInsights } from '@/lib/ai/portfolio-insights';
import type { Account } from '@/lib/scoring/types';

// Force long timeout for this route (5 minutes)
export const maxDuration = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  // Suppress unused variable warning in strict mode
  void request;

  const startTime = Date.now();

  try {
    const supabase = createServerSupabaseClient();

    // ---- Auth ----
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- Fetch all accounts ----
    const { data: allAccounts, error: fetchError } = await supabase
      .from('accounts')
      .select('*');
    if (fetchError || !allAccounts) {
      return NextResponse.json(
        { error: 'Failed to fetch accounts', details: fetchError?.message },
        { status: 500 },
      );
    }

    const accounts = allAccounts as Account[];
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found in database' },
        { status: 404 },
      );
    }

    // ---- Score all accounts (calibrated) ----
    const scoredAccounts = scoreAllAccounts(accounts);

    let analysedCount = 0;
    let failedCount = 0;

    // ---- Analyse accounts in parallel batches of 5 ----
    const BATCH_SIZE = 5;

    const analyseOne = async (item: typeof scoredAccounts[0]) => {
      const { account, result: scoringResult } = item;
      try {
        const [analysis, counterfactuals] = await Promise.all([
          analyseAccount(account, scoringResult),
          generateCounterfactuals(account, scoringResult),
        ]);

        const analysisRow = {
          account_id: account.account_id,
          priority_score: scoringResult.calibratedScore,
          priority_tier: scoringResult.priorityTier,
          priority_type: scoringResult.priorityType,
          reasoning: analysis.reasoning,
          recommended_actions: analysis.recommended_actions,
          key_signals: analysis.key_signals,
          risk_factors: analysis.risk_factors,
          opportunity_factors: analysis.opportunity_factors,
          counterfactual_up: counterfactuals.counterfactual_up,
          counterfactual_down: counterfactuals.counterfactual_down,
          confidence_level: analysis.confidence_level,
          adjusted_tier: analysis.adjusted_tier,
          adjustment_reason: analysis.adjustment_reason,
          analysed_at: new Date().toISOString(),
          model_version: 'claude-sonnet-4-20250514',
        };

        await supabase
          .from('ai_analyses')
          .delete()
          .eq('account_id', account.account_id);

        const { error: insertError } = await supabase
          .from('ai_analyses')
          .insert(analysisRow);

        if (insertError) {
          console.warn(`[Batch] DB insert failed for ${account.account_id}:`, insertError.message);
          failedCount++;
        } else {
          analysedCount++;
        }
      } catch (error) {
        console.warn(
          `[Batch] Analysis failed for ${account.account_id} (${account.account_name}):`,
          error instanceof Error ? error.message : error,
        );
        failedCount++;
      }
    };

    for (let i = 0; i < scoredAccounts.length; i += BATCH_SIZE) {
      const batch = scoredAccounts.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(analyseOne));
      // Short delay between batches to avoid rate limits
      if (i + BATCH_SIZE < scoredAccounts.length) {
        await delay(200);
      }
    }

    // ---- Generate portfolio insights ----
    try {
      const allResults = scoredAccounts.map((s) => s.result);
      const insights = await generatePortfolioInsights(accounts, allResults);

      const { error: insightsError } = await supabase
        .from('portfolio_insights')
        .insert({
          insights,
          generated_at: new Date().toISOString(),
          model_version: 'claude-sonnet-4-20250514',
        });

      if (insightsError) {
        console.warn(
          '[Batch] Failed to save portfolio insights:',
          insightsError.message,
        );
      }
    } catch (error) {
      console.warn(
        '[Batch] Portfolio insights generation failed:',
        error instanceof Error ? error.message : error,
      );
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      analysed: analysedCount,
      failed: failedCount,
      total: accounts.length,
      duration_ms: durationMs,
    });
  } catch (error) {
    console.error('[API /analyse-all] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
