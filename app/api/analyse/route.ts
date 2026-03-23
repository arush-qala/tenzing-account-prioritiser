// ---------------------------------------------------------------------------
// POST /api/analyse — Analyse a single account
// ---------------------------------------------------------------------------
// Takes { account_id } in the request body, runs deterministic scoring
// (calibrated against the full portfolio), then calls Claude for qualitative
// analysis and counterfactual narratives. Upserts the result into ai_analyses.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import { analyseAccount } from '@/lib/ai/analyse-account';
import { generateCounterfactuals } from '@/lib/ai/counterfactuals';
import type { Account } from '@/lib/scoring/types';

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();

    // ---- Auth ----
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- Parse body ----
    const body = await request.json();
    const { account_id } = body as { account_id?: string };
    if (!account_id) {
      return NextResponse.json(
        { error: 'Missing account_id in request body' },
        { status: 400 },
      );
    }

    // ---- Fetch all accounts (needed for calibrated scoring) ----
    const { data: allAccounts, error: fetchAllError } = await supabase
      .from('accounts')
      .select('*');
    if (fetchAllError || !allAccounts) {
      return NextResponse.json(
        { error: 'Failed to fetch accounts', details: fetchAllError?.message },
        { status: 500 },
      );
    }

    const accounts = allAccounts as Account[];

    // ---- Verify target account exists ----
    const targetAccount = accounts.find((a) => a.account_id === account_id);
    if (!targetAccount) {
      return NextResponse.json(
        { error: `Account ${account_id} not found` },
        { status: 404 },
      );
    }

    // ---- Score all accounts (calibrated) and find target ----
    const scoredAccounts = scoreAllAccounts(accounts);
    const scoredTarget = scoredAccounts.find(
      (s) => s.account.account_id === account_id,
    );
    if (!scoredTarget) {
      return NextResponse.json(
        { error: 'Scoring failed for target account' },
        { status: 500 },
      );
    }

    const { result: scoringResult } = scoredTarget;

    // ---- Run AI analysis + counterfactuals in parallel ----
    const [analysis, counterfactuals] = await Promise.all([
      analyseAccount(targetAccount, scoringResult),
      generateCounterfactuals(targetAccount, scoringResult),
    ]);

    // ---- Upsert into ai_analyses ----
    const analysisRow = {
      account_id,
      priority_score: scoringResult.calibratedScore,
      priority_tier: scoringResult.priorityTier,
      priority_type: scoringResult.priorityType,
      reasoning: analysis.reasoning,
      recommended_actions: analysis.recommended_actions,
      risk_factors: analysis.risk_factors,
      opportunity_factors: analysis.opportunity_factors,
      counterfactual_up: counterfactuals.counterfactual_up,
      counterfactual_down: counterfactuals.counterfactual_down,
      confidence_level: analysis.confidence_level,
      adjusted_tier: analysis.adjusted_tier,
      adjustment_reason: analysis.adjustment_reason,
      analysed_at: new Date().toISOString(),
      model_version: 'claude-sonnet-4-6',
    };

    // Delete any existing analysis for this account, then insert fresh
    await supabase
      .from('ai_analyses')
      .delete()
      .eq('account_id', account_id);

    const { data: upserted, error: upsertError } = await supabase
      .from('ai_analyses')
      .insert(analysisRow)
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save analysis', details: upsertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(upserted);
  } catch (error) {
    console.error('[API /analyse] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
