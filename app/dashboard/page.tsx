import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';
import type { PortfolioInsightsData } from '@/components/dashboard/ai-insights-panel';
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary';
import { AiInsightsPanel } from '@/components/dashboard/ai-insights-panel';
import { RenewalTimeline } from '@/components/dashboard/renewal-timeline';
import { PriorityList } from '@/components/dashboard/priority-list';
import { NavHeader } from '@/components/nav-header';

export default async function DashboardPage() {
  // ---- Auth ----
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // ---- Fetch accounts ----
  const { data: rawAccounts } = await supabase
    .from('accounts')
    .select('*');

  const accounts = (rawAccounts ?? []) as Account[];

  // ---- Score all accounts ----
  const scoredResults = scoreAllAccounts(accounts);

  // ---- Fetch latest portfolio insights (if any) ----
  let portfolioInsights: PortfolioInsightsData | null = null;
  const { data: insightsRow } = await supabase
    .from('portfolio_insights')
    .select('insights')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (insightsRow?.insights) {
    portfolioInsights = insightsRow.insights as PortfolioInsightsData;
  }

  // ---- Fetch AI analyses (if any) ----
  const { data: analysesRows } = await supabase
    .from('ai_analyses')
    .select('account_id, reasoning, recommended_actions');

  const analysesMap: Record<string, { reasoning: string; recommended_actions?: Array<{ action: string; owner: string; timeframe: string }> }> = {};
  if (analysesRows) {
    for (const row of analysesRows) {
      const r = row as { account_id: string; reasoning: string; recommended_actions?: Array<{ action: string; owner: string; timeframe: string }> };
      analysesMap[r.account_id] = { reasoning: r.reasoning, recommended_actions: r.recommended_actions ?? undefined };
    }
  }

  // ---- Extract unique owners for filter dropdown ----
  const ownersSet = new Set<string>();
  for (const account of accounts) {
    if (account.account_owner) {
      ownersSet.add(account.account_owner);
    }
  }
  const owners = Array.from(ownersSet).sort();

  // ---- Render ----
  return (
    <div className="min-h-screen bg-background">
      {/* Header with navigation */}
      <NavHeader userEmail={user.email} />

      {/* Main content */}
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex flex-col gap-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Portfolio Dashboard</h1>
            <span className="text-xs text-muted-foreground">{accounts.length} accounts</span>
          </div>

          {/* Summary cards */}
          <PortfolioSummary results={scoredResults} />

          {/* Renewal Timeline */}
          <RenewalTimeline results={scoredResults} analyses={analysesMap} />

          {/* AI Insights */}
          <AiInsightsPanel insights={portfolioInsights} analysedCount={Object.keys(analysesMap).length} totalCount={accounts.length} />

          {/* Priority List (includes filters, search, analyse-all) */}
          <PriorityList
            results={scoredResults}
            analyses={analysesMap}
            owners={owners}
            analysedCount={Object.keys(analysesMap).length}
          />
        </div>
      </main>
    </div>
  );
}
