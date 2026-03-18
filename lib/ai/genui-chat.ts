// ---------------------------------------------------------------------------
// Generative UI Chat — System prompt + tool definitions for Thesys C1
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const PORTFOLIO_SYSTEM_PROMPT = `You are a senior portfolio analyst advising commercial leadership (CRO, VP Sales, Head of Customer Success) at a B2B tech PE firm. These leaders work cross-functionally across Sales and CS.

Their core challenge: insights are fragmented across CRM, support systems, and internal notes, making it hard to consistently identify which accounts need attention and what action to take.

Frame all analysis around three outcomes:
1. Pipeline conversion — turning leads and opportunities into closed deals
2. Expansion revenue — upselling and cross-selling within existing accounts
3. Churn reduction — identifying and saving at-risk accounts

You have access to real-time data for a portfolio of 60 SaaS accounts, including financials, usage metrics, support health, and AI-generated priority scores.

CAPABILITIES:
- Query individual accounts or the full portfolio via the tools provided
- Generate charts, tables, and visual breakdowns to answer questions
- Compare accounts across segments, regions, and priority tiers
- Analyse renewal pipelines, churn risk, and expansion opportunities

VISUALISATION RULES:
- Use BarChart when comparing values across accounts or categories (e.g. ARR by segment)
- Use PieChart for distribution/proportion questions (e.g. tier distribution, segment split)
- Use Tables when listing accounts with multiple attributes
- Use LineChart for trend data (e.g. MRR changes)
- Use RadarChart for comparing sub-scores of individual accounts
- Always include clear titles, labels, legends, and units
- Use GBP (£) for all currency values
- Use British English throughout

SCORING CONTEXT:
Priority scores range 0-100 (higher = needs more attention).
Tiers: critical (>=80), high (>=65), medium (>=50), low (>=35), monitor (<35).
Priority types: churn_risk, renewal_urgent, expansion_opportunity, mixed_signals, stable.
Health composite: 0-100 (higher = healthier).
Sub-scores: revenueHealth, engagement, supportHealth, opportunity, urgency (each 0-100).

RESPONSE STYLE:
- Lead with the visual (chart, table, or graph), then add a brief 1-2 sentence interpretation
- Be concise and data-driven
- When a question is ambiguous, use the most useful interpretation and note your assumption
- Always call the appropriate tool to get fresh data before answering`;

// ---------------------------------------------------------------------------
// Helper: load + score all accounts
// ---------------------------------------------------------------------------

async function loadScoredAccounts(supabase: SupabaseClient) {
  const { data: rawAccounts } = await supabase.from('accounts').select('*');
  const accounts = (rawAccounts ?? []) as Account[];
  return scoreAllAccounts(accounts);
}

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function-calling format)
// ---------------------------------------------------------------------------

export function buildGenuiTools(supabase: SupabaseClient) {
  return [
    // ---- 1. get_all_accounts ----
    {
      type: 'function' as const,
      function: {
        name: 'get_all_accounts',
        description:
          'Get all 60 portfolio accounts with key metrics: name, segment, region, ARR, priority tier, priority score, health composite, days to renewal, lifecycle stage, and industry.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
        function: async () => {
          const scored = await loadScoredAccounts(supabase);
          const result = scored.map(({ account, result: r }) => ({
            account_name: account.account_name,
            account_id: account.account_id,
            segment: account.segment,
            region: account.region,
            industry: account.industry,
            arr_gbp: account.arr_gbp,
            days_to_renewal: account.days_to_renewal,
            lifecycle_stage: account.lifecycle_stage,
            account_status: account.account_status,
            priority_tier: r.priorityTier,
            priority_type: r.priorityType,
            priority_score: Math.round(r.calibratedScore * 10) / 10,
            health_composite: Math.round(r.healthComposite * 10) / 10,
          }));
          return JSON.stringify(result);
        },
        parse: (input: string) => JSON.parse(input),
        strict: true,
      },
    },

    // ---- 2. get_account_details ----
    {
      type: 'function' as const,
      function: {
        name: 'get_account_details',
        description:
          'Get full details for a single account by name or ID. Returns all metrics, scoring sub-scores, and AI analysis if available.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Account name (partial match) or account ID',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
        function: async ({ query }: { query: string }) => {
          const scored = await loadScoredAccounts(supabase);
          const q = query.toLowerCase();
          const match = scored.find(
            ({ account }) =>
              account.account_id === query ||
              account.account_name.toLowerCase().includes(q),
          );
          if (!match) return JSON.stringify({ error: `No account found matching "${query}"` });

          const { account, result: r } = match;

          // Fetch AI analysis if exists
          const { data: analysisRow } = await supabase
            .from('ai_analyses')
            .select('reasoning, priority_tier, priority_type, confidence_level, risk_factors, opportunity_factors, key_signals, recommended_actions')
            .eq('account_id', account.account_id)
            .order('analysed_at', { ascending: false })
            .limit(1)
            .single();

          return JSON.stringify({
            account_id: account.account_id,
            account_name: account.account_name,
            industry: account.industry,
            segment: account.segment,
            region: account.region,
            account_status: account.account_status,
            lifecycle_stage: account.lifecycle_stage,
            account_owner: account.account_owner,
            csm_owner: account.csm_owner,
            support_tier: account.support_tier,
            arr_gbp: account.arr_gbp,
            mrr_current_gbp: account.mrr_current_gbp,
            mrr_3m_ago_gbp: account.mrr_3m_ago_gbp,
            mrr_trend_pct: account.mrr_trend_pct,
            seats_purchased: account.seats_purchased,
            seats_used: account.seats_used,
            seat_utilisation_pct: account.seat_utilisation_pct,
            usage_score_current: account.usage_score_current,
            usage_score_3m_ago: account.usage_score_3m_ago,
            latest_nps: account.latest_nps,
            avg_csat_90d: account.avg_csat_90d,
            open_tickets_count: account.open_tickets_count,
            urgent_open_tickets_count: account.urgent_open_tickets_count,
            sla_breaches_90d: account.sla_breaches_90d,
            days_to_renewal: account.days_to_renewal,
            renewal_date: account.renewal_date,
            expansion_pipeline_gbp: account.expansion_pipeline_gbp,
            contraction_risk_gbp: account.contraction_risk_gbp,
            overdue_amount_gbp: account.overdue_amount_gbp,
            recent_support_summary: account.recent_support_summary,
            recent_customer_note: account.recent_customer_note,
            recent_sales_note: account.recent_sales_note,
            scoring: {
              sub_scores: r.subScores,
              health_composite: Math.round(r.healthComposite * 10) / 10,
              priority_score: Math.round(r.calibratedScore * 10) / 10,
              priority_tier: r.priorityTier,
              priority_type: r.priorityType,
              contradictions: r.contradictions,
            },
            ai_analysis: analysisRow ?? null,
          });
        },
        parse: (input: string) => JSON.parse(input) as { query: string },
        strict: true,
      },
    },

    // ---- 3. get_portfolio_summary ----
    {
      type: 'function' as const,
      function: {
        name: 'get_portfolio_summary',
        description:
          'Get aggregated portfolio statistics: total ARR, tier distribution, segment breakdown, region breakdown, average health, renewal pipeline summary, and expansion/contraction totals.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
        function: async () => {
          const scored = await loadScoredAccounts(supabase);
          const accounts = scored.map((s) => s.account);

          const totalArr = accounts.reduce((sum, a) => sum + (a.arr_gbp ?? 0), 0);
          const totalExpansion = accounts.reduce((sum, a) => sum + (a.expansion_pipeline_gbp ?? 0), 0);
          const totalContraction = accounts.reduce((sum, a) => sum + (a.contraction_risk_gbp ?? 0), 0);
          const totalOverdue = accounts.reduce((sum, a) => sum + (a.overdue_amount_gbp ?? 0), 0);
          const avgHealth =
            scored.reduce((sum, s) => sum + s.result.healthComposite, 0) / scored.length;
          const avgDaysToRenewal =
            accounts.reduce((sum, a) => sum + (a.days_to_renewal ?? 0), 0) / accounts.length;

          const tierDist: Record<string, number> = {};
          const segmentDist: Record<string, { count: number; arr: number }> = {};
          const regionDist: Record<string, { count: number; arr: number }> = {};
          const typeDist: Record<string, number> = {};

          for (const { account, result: r } of scored) {
            tierDist[r.priorityTier] = (tierDist[r.priorityTier] ?? 0) + 1;
            typeDist[r.priorityType] = (typeDist[r.priorityType] ?? 0) + 1;

            if (!segmentDist[account.segment])
              segmentDist[account.segment] = { count: 0, arr: 0 };
            segmentDist[account.segment].count++;
            segmentDist[account.segment].arr += account.arr_gbp ?? 0;

            if (!regionDist[account.region])
              regionDist[account.region] = { count: 0, arr: 0 };
            regionDist[account.region].count++;
            regionDist[account.region].arr += account.arr_gbp ?? 0;
          }

          const renewingIn30 = accounts.filter((a) => a.days_to_renewal <= 30).length;
          const renewingIn90 = accounts.filter((a) => a.days_to_renewal <= 90).length;

          return JSON.stringify({
            total_accounts: accounts.length,
            total_arr_gbp: Math.round(totalArr),
            total_expansion_pipeline_gbp: Math.round(totalExpansion),
            total_contraction_risk_gbp: Math.round(totalContraction),
            total_overdue_gbp: Math.round(totalOverdue),
            avg_health_composite: Math.round(avgHealth * 10) / 10,
            avg_days_to_renewal: Math.round(avgDaysToRenewal),
            tier_distribution: tierDist,
            priority_type_distribution: typeDist,
            segment_breakdown: segmentDist,
            region_breakdown: regionDist,
            accounts_renewing_in_30_days: renewingIn30,
            accounts_renewing_in_90_days: renewingIn90,
          });
        },
        parse: (input: string) => JSON.parse(input),
        strict: true,
      },
    },

    // ---- 4. search_accounts ----
    {
      type: 'function' as const,
      function: {
        name: 'search_accounts',
        description:
          'Search and filter accounts by segment, region, priority tier, lifecycle stage, or ARR range. Returns matching accounts with key metrics.',
        parameters: {
          type: 'object',
          properties: {
            segment: {
              type: 'string',
              description: 'Filter by segment: Enterprise, Mid-Market, or SMB',
            },
            region: {
              type: 'string',
              description: 'Filter by region: US, EU, or UK',
            },
            tier: {
              type: 'string',
              description: 'Filter by priority tier: critical, high, medium, low, or monitor',
            },
            lifecycle_stage: {
              type: 'string',
              description: 'Filter by lifecycle: Customer, Renewal, or Expansion',
            },
            min_arr: {
              type: 'number',
              description: 'Minimum ARR in GBP',
            },
            max_arr: {
              type: 'number',
              description: 'Maximum ARR in GBP',
            },
          },
          required: [],
          additionalProperties: false,
        },
        function: async (params: {
          segment?: string;
          region?: string;
          tier?: string;
          lifecycle_stage?: string;
          min_arr?: number;
          max_arr?: number;
        }) => {
          const scored = await loadScoredAccounts(supabase);
          let filtered = scored;

          if (params.segment) {
            const seg = params.segment.toLowerCase();
            filtered = filtered.filter(({ account }) =>
              account.segment.toLowerCase() === seg,
            );
          }
          if (params.region) {
            const reg = params.region.toLowerCase();
            filtered = filtered.filter(({ account }) =>
              account.region.toLowerCase() === reg,
            );
          }
          if (params.tier) {
            const t = params.tier.toLowerCase();
            filtered = filtered.filter(({ result: r }) => r.priorityTier === t);
          }
          if (params.lifecycle_stage) {
            const ls = params.lifecycle_stage.toLowerCase();
            filtered = filtered.filter(({ account }) =>
              account.lifecycle_stage.toLowerCase() === ls,
            );
          }
          if (params.min_arr != null) {
            filtered = filtered.filter(({ account }) =>
              (account.arr_gbp ?? 0) >= params.min_arr!,
            );
          }
          if (params.max_arr != null) {
            filtered = filtered.filter(({ account }) =>
              (account.arr_gbp ?? 0) <= params.max_arr!,
            );
          }

          const result = filtered.map(({ account, result: r }) => ({
            account_name: account.account_name,
            account_id: account.account_id,
            segment: account.segment,
            region: account.region,
            arr_gbp: account.arr_gbp,
            days_to_renewal: account.days_to_renewal,
            lifecycle_stage: account.lifecycle_stage,
            priority_tier: r.priorityTier,
            priority_type: r.priorityType,
            priority_score: Math.round(r.calibratedScore * 10) / 10,
            health_composite: Math.round(r.healthComposite * 10) / 10,
          }));

          return JSON.stringify({ count: result.length, accounts: result });
        },
        parse: (input: string) => JSON.parse(input),
        strict: true,
      },
    },

    // ---- 5. get_renewal_pipeline ----
    {
      type: 'function' as const,
      function: {
        name: 'get_renewal_pipeline',
        description:
          'Get accounts renewing within the next N days (default 90), sorted by soonest renewal. Includes ARR, tier, and health for each.',
        parameters: {
          type: 'object',
          properties: {
            days_ahead: {
              type: 'number',
              description: 'Number of days ahead to look (default 90)',
            },
          },
          required: [],
          additionalProperties: false,
        },
        function: async (params: { days_ahead?: number }) => {
          const horizon = params.days_ahead ?? 90;
          const scored = await loadScoredAccounts(supabase);

          const pipeline = scored
            .filter(({ account }) => account.days_to_renewal <= horizon)
            .sort((a, b) => a.account.days_to_renewal - b.account.days_to_renewal)
            .map(({ account, result: r }) => ({
              account_name: account.account_name,
              account_id: account.account_id,
              days_to_renewal: account.days_to_renewal,
              renewal_date: account.renewal_date,
              arr_gbp: account.arr_gbp,
              segment: account.segment,
              priority_tier: r.priorityTier,
              priority_type: r.priorityType,
              health_composite: Math.round(r.healthComposite * 10) / 10,
              contraction_risk_gbp: account.contraction_risk_gbp,
              expansion_pipeline_gbp: account.expansion_pipeline_gbp,
            }));

          return JSON.stringify({
            horizon_days: horizon,
            count: pipeline.length,
            total_arr_at_risk: Math.round(
              pipeline.reduce((sum, a) => sum + (a.arr_gbp ?? 0), 0),
            ),
            accounts: pipeline,
          });
        },
        parse: (input: string) => JSON.parse(input),
        strict: true,
      },
    },
  ];
}
