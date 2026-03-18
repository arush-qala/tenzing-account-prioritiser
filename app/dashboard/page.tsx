import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';
import type { PortfolioInsightsData } from '@/components/dashboard/ai-insights-panel';
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary';
import { AiInsightsPanel } from '@/components/dashboard/ai-insights-panel';
import { AccuracyTracker } from '@/components/dashboard/accuracy-tracker';
import { RenewalTimeline } from '@/components/dashboard/renewal-timeline';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { Filters } from '@/components/dashboard/filters';
import { PriorityList } from '@/components/dashboard/priority-list';
import { NavHeader } from '@/components/nav-header';
import { AnalyseAllButton } from '@/components/dashboard/analyse-all-button';
import { Separator } from '@/components/ui/separator';

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
    .select('account_id, reasoning');

  const analysesMap: Record<string, { reasoning: string }> = {};
  if (analysesRows) {
    for (const row of analysesRows) {
      const r = row as { account_id: string; reasoning: string };
      analysesMap[r.account_id] = { reasoning: r.reasoning };
    }
  }

  // ---- Fetch all actions for accuracy tracker ----
  const { data: allActions } = await supabase
    .from('actions')
    .select('ai_accuracy_rating, created_at');

  const actions = (allActions ?? []) as Array<{
    ai_accuracy_rating: string | null;
    created_at: string;
  }>;

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
          {/* Summary cards */}
          <PortfolioSummary results={scoredResults} />

          {/* Renewal Timeline + Activity Feed + Accuracy Tracker */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <RenewalTimeline results={scoredResults} />
            </div>
            <div className="lg:col-span-1">
              <ActivityFeed />
            </div>
            <div className="lg:col-span-1">
              <AccuracyTracker actions={actions} />
            </div>
          </div>

          {/* AI Insights */}
          <AiInsightsPanel insights={portfolioInsights} />

          <Separator />

          {/* Filters + Table */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Priority List
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">
                  {accounts.length} accounts
                </span>
                <AnalyseAllButton
                  analysedCount={Object.keys(analysesMap).length}
                  totalCount={accounts.length}
                />
              </div>
            </div>
            <Filters owners={owners} />
            <PriorityList
              results={scoredResults}
              analyses={analysesMap}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
