import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';
import type { PortfolioInsightsData } from '@/components/dashboard/ai-insights-panel';
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary';
import { AiInsightsPanel } from '@/components/dashboard/ai-insights-panel';
import { AccuracyTracker } from '@/components/dashboard/accuracy-tracker';
import { RenewalTimeline } from '@/components/dashboard/renewal-timeline';
import { Filters } from '@/components/dashboard/filters';
import { PriorityList } from '@/components/dashboard/priority-list';
import { SignOutButton } from './sign-out-button';
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Account Prioritiser
            </h1>
            <p className="text-xs text-muted-foreground">
              AI-powered portfolio prioritisation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex flex-col gap-6">
          {/* Summary cards */}
          <PortfolioSummary results={scoredResults} />

          {/* Renewal Timeline + Accuracy Tracker (side by side) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RenewalTimeline results={scoredResults} />
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
