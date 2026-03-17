// ---------------------------------------------------------------------------
// GET & POST /api/portfolio-insights — Portfolio-level AI insights
// ---------------------------------------------------------------------------
// GET: Fetch the most recent portfolio insights
// POST: Generate fresh portfolio insights from current account data
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import { generatePortfolioInsights } from '@/lib/ai/portfolio-insights';
import type { Account } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// GET /api/portfolio-insights
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // Suppress unused variable warning in strict mode
  void request;

  try {
    const supabase = createServerSupabaseClient();

    // ---- Auth ----
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- Fetch most recent insights ----
    const { data: insights, error: fetchError } = await supabase
      .from('portfolio_insights')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError) {
      // PGRST116 = no rows found, which is a valid "empty" state
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(null);
      }
      return NextResponse.json(
        { error: 'Failed to fetch portfolio insights', details: fetchError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(insights);
  } catch (error) {
    console.error('[API GET /portfolio-insights] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/portfolio-insights
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Suppress unused variable warning in strict mode
  void request;

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

    // ---- Score all accounts ----
    const scoredAccounts = scoreAllAccounts(accounts);
    const allResults = scoredAccounts.map((s) => s.result);

    // ---- Generate portfolio insights via Claude ----
    const insights = await generatePortfolioInsights(accounts, allResults);

    // ---- Insert into database ----
    const { data: saved, error: insertError } = await supabase
      .from('portfolio_insights')
      .insert({
        insights,
        generated_at: new Date().toISOString(),
        model_version: 'claude-sonnet-4-20250514',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to save portfolio insights', details: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(saved);
  } catch (error) {
    console.error('[API POST /portfolio-insights] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
