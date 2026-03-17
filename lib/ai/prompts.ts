// ---------------------------------------------------------------------------
// AI Prompt Templates
// ---------------------------------------------------------------------------
// Each function returns { system, user } strings for an Anthropic API call.
// All prompts instruct Claude to return ONLY valid JSON, no markdown fences.
// ---------------------------------------------------------------------------

import type { Account, ScoringResult } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function nullSafe(value: string | number | null, fallback = 'N/A'): string {
  return value === null || value === undefined ? fallback : String(value);
}

// ---------------------------------------------------------------------------
// A) Account Analysis Prompt
// ---------------------------------------------------------------------------

export interface AccountAnalysisPrompt {
  system: string;
  user: string;
}

export function buildAccountAnalysisPrompt(
  account: Account,
  scoringResult: ScoringResult,
): AccountAnalysisPrompt {
  const system =
    'You are a senior portfolio analyst at a B2B tech PE firm. ' +
    'Provide clear, CEO-level analysis. Return ONLY valid JSON with no markdown fences, ' +
    'no commentary, and no extra keys.';

  const user = `Analyse the following B2B SaaS account and provide a prioritisation assessment.

ACCOUNT DATA:
- Account: ${account.account_name} (${account.account_id})
- Industry: ${account.industry} | Segment: ${account.segment} | Region: ${account.region}
- Status: ${account.account_status} | Lifecycle: ${account.lifecycle_stage}
- Account Owner: ${account.account_owner} | CSM: ${account.csm_owner}
- Support Tier: ${account.support_tier}

FINANCIALS:
- ARR: ${formatCurrency(account.arr_gbp)}
- MRR Current: ${formatCurrency(account.mrr_current_gbp)} | MRR 3m Ago: ${formatCurrency(account.mrr_3m_ago_gbp)}
- MRR Trend: ${formatPct(account.mrr_trend_pct)}
- Expansion Pipeline: ${formatCurrency(account.expansion_pipeline_gbp)}
- Contraction Risk: ${formatCurrency(account.contraction_risk_gbp)}
- Overdue Amount: ${nullSafe(account.overdue_amount_gbp !== null ? formatCurrency(account.overdue_amount_gbp) : null)}

USAGE & ENGAGEMENT:
- Seats: ${account.seats_used}/${account.seats_purchased} (${formatPct(account.seat_utilisation_pct)})
- Usage Score: ${account.usage_score_current} (was ${account.usage_score_3m_ago})
- Usage Trend: ${formatPct(account.usage_trend)}
- Days to Renewal: ${account.days_to_renewal}

SENTIMENT & SUPPORT:
- NPS: ${nullSafe(account.latest_nps)}
- Avg CSAT (90d): ${nullSafe(account.avg_csat_90d)}
- Open Tickets: ${account.open_tickets_count} (${account.urgent_open_tickets_count} urgent)
- SLA Breaches (90d): ${account.sla_breaches_90d}
- Sentiment Hint: ${nullSafe(account.note_sentiment_hint)}

ML ENRICHMENTS:
- Anomaly: ${account.is_anomaly ? 'Yes' : 'No'} (score: ${nullSafe(account.anomaly_score)})
- Cluster: ${nullSafe(account.cluster_label)} (ID: ${nullSafe(account.cluster_id)})
- Support Sentiment (VADER): ${nullSafe(account.support_sentiment_vader)}
- Customer Sentiment (VADER): ${nullSafe(account.customer_sentiment_vader)}
- Sales Sentiment (VADER): ${nullSafe(account.sales_sentiment_vader)}
- Sentiment Disagreement: ${account.sentiment_disagreement ? 'Yes' : 'No'}

QUALITATIVE NOTES:
- Recent Support Summary: ${nullSafe(account.recent_support_summary)}
- Recent Customer Note: ${nullSafe(account.recent_customer_note)}
- Recent Sales Note: ${nullSafe(account.recent_sales_note)}

SCORING RESULTS:
- Sub-Scores: Revenue ${scoringResult.subScores.revenueHealth}, Engagement ${scoringResult.subScores.engagement}, Support ${scoringResult.subScores.supportHealth}, Opportunity ${scoringResult.subScores.opportunity}, Urgency ${scoringResult.subScores.urgency}
- Health Composite: ${scoringResult.healthComposite}
- Priority Score: ${scoringResult.priorityScore} | Calibrated: ${scoringResult.calibratedScore}
- Priority Tier: ${scoringResult.priorityTier} | Type: ${scoringResult.priorityType}
- ARR Factor: ${scoringResult.arrFactor}
- Contradictions: ${scoringResult.contradictions.length > 0 ? scoringResult.contradictions.map((c) => `${c.signal1} vs ${c.signal2}: ${c.description}`).join('; ') : 'None'}
- Data Completeness: ${formatPct(account.data_completeness_score)}

Return a JSON object with exactly these fields:
{
  "reasoning": "2-3 sentences of CEO-level analysis specific to this account",
  "recommended_actions": [
    { "action": "specific action", "owner": "person name from account data", "timeframe": "e.g. Next 7 days", "rationale": "why this action" },
    { "action": "...", "owner": "...", "timeframe": "...", "rationale": "..." },
    { "action": "...", "owner": "...", "timeframe": "...", "rationale": "..." }
  ],
  "risk_factors": ["specific risk 1", "specific risk 2"],
  "opportunity_factors": ["specific opportunity 1", "specific opportunity 2"],
  "key_signals": ["top signal 1", "top signal 2", "top signal 3"],
  "adjusted_tier": "${scoringResult.priorityTier}",
  "adjustment_reason": "explain if changed from current tier, or 'Tier confirmed by qualitative review' if unchanged",
  "confidence_level": "high|medium|low"
}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// B) Counterfactual Prompt
// ---------------------------------------------------------------------------

export interface SensitivityEntry {
  subScore: string;
  currentValue: number;
  pointsToNextTierUp: number | null;
  pointsToNextTierDown: number | null;
}

export interface CounterfactualPrompt {
  system: string;
  user: string;
}

export function buildCounterfactualPrompt(
  account: Account,
  scoringResult: ScoringResult,
  sensitivityData: SensitivityEntry[],
): CounterfactualPrompt {
  const system =
    'You are a senior portfolio analyst at a B2B tech PE firm. ' +
    'Provide specific, metric-driven counterfactual analysis. ' +
    'Return ONLY valid JSON with no markdown fences, no commentary, and no extra keys.';

  const sensitivityBlock = sensitivityData
    .map(
      (s) =>
        `- ${s.subScore}: currently ${s.currentValue.toFixed(1)}, ` +
        `needs ${s.pointsToNextTierUp !== null ? `+${s.pointsToNextTierUp.toFixed(1)} pts to move UP` : 'already at top tier'}, ` +
        `${s.pointsToNextTierDown !== null ? `-${s.pointsToNextTierDown.toFixed(1)} pts to move DOWN` : 'already at bottom tier'}`,
    )
    .join('\n');

  const user = `For account ${account.account_name} (${account.account_id}), currently tier "${scoringResult.priorityTier}" with calibrated score ${scoringResult.calibratedScore.toFixed(1)}:

CURRENT SUB-SCORES:
- Revenue Health: ${scoringResult.subScores.revenueHealth}
- Engagement: ${scoringResult.subScores.engagement}
- Support Health: ${scoringResult.subScores.supportHealth}
- Opportunity: ${scoringResult.subScores.opportunity}
- Urgency: ${scoringResult.subScores.urgency}

KEY METRICS:
- ARR: ${formatCurrency(account.arr_gbp)}
- MRR Trend: ${formatPct(account.mrr_trend_pct)}
- Seat Utilisation: ${formatPct(account.seat_utilisation_pct)}
- Days to Renewal: ${account.days_to_renewal}
- NPS: ${nullSafe(account.latest_nps)}
- Open Urgent Tickets: ${account.urgent_open_tickets_count}

SENSITIVITY ANALYSIS (points needed to cross tier boundaries):
${sensitivityBlock}

TIER BOUNDARIES: Critical >= 80, High >= 65, Medium >= 50, Low >= 35, Monitor < 35

Return a JSON object with exactly these fields:
{
  "counterfactual_up": "Specific narrative about what metric changes would move this account UP one tier. Reference exact values and sub-scores.",
  "counterfactual_down": "Specific narrative about what metric changes would move this account DOWN one tier. Reference exact values and sub-scores."
}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// C) Portfolio Insights Prompt
// ---------------------------------------------------------------------------

export interface PortfolioSummaryData {
  totalAccounts: number;
  tierDistribution: Record<string, number>;
  totalArr: number;
  arrByTier: Record<string, number>;
  topRisks: Array<{ accountName: string; riskDescription: string }>;
  topOpportunities: Array<{ accountName: string; opportunity: string }>;
  ownerStats: Array<{
    owner: string;
    accountCount: number;
    avgScore: number;
    criticalCount: number;
  }>;
  segmentStats: Array<{
    segment: string;
    accountCount: number;
    avgScore: number;
    avgHealth: number;
  }>;
}

export interface PortfolioInsightsPrompt {
  system: string;
  user: string;
}

export function buildPortfolioInsightsPrompt(
  summaryData: PortfolioSummaryData,
): PortfolioInsightsPrompt {
  const system =
    'You are a senior portfolio analyst at a B2B tech PE firm advising the leadership team. ' +
    'Synthesise portfolio data into strategic, actionable insights. ' +
    'Return ONLY valid JSON with no markdown fences, no commentary, and no extra keys.';

  const tierDist = Object.entries(summaryData.tierDistribution)
    .map(([tier, count]) => `${tier}: ${count}`)
    .join(', ');

  const arrDist = Object.entries(summaryData.arrByTier)
    .map(([tier, arr]) => `${tier}: ${formatCurrency(arr)}`)
    .join(', ');

  const risksBlock = summaryData.topRisks
    .map((r) => `- ${r.accountName}: ${r.riskDescription}`)
    .join('\n');

  const oppsBlock = summaryData.topOpportunities
    .map((o) => `- ${o.accountName}: ${o.opportunity}`)
    .join('\n');

  const ownerBlock = summaryData.ownerStats
    .map(
      (o) =>
        `- ${o.owner}: ${o.accountCount} accounts, avg score ${o.avgScore.toFixed(1)}, ${o.criticalCount} critical`,
    )
    .join('\n');

  const segmentBlock = summaryData.segmentStats
    .map(
      (s) =>
        `- ${s.segment}: ${s.accountCount} accounts, avg score ${s.avgScore.toFixed(1)}, avg health ${s.avgHealth.toFixed(1)}`,
    )
    .join('\n');

  const user = `Analyse this B2B tech portfolio and provide strategic insights for the leadership team.

PORTFOLIO OVERVIEW:
- Total Accounts: ${summaryData.totalAccounts}
- Total ARR: ${formatCurrency(summaryData.totalArr)}
- Tier Distribution: ${tierDist}
- ARR by Tier: ${arrDist}

TOP RISKS:
${risksBlock}

TOP OPPORTUNITIES:
${oppsBlock}

OWNER PERFORMANCE:
${ownerBlock}

SEGMENT BREAKDOWN:
${segmentBlock}

Return a JSON object with exactly these fields:
{
  "themes": ["theme 1", "theme 2", "theme 3"],
  "owner_patterns": [
    { "owner": "name", "pattern": "observation about this owner's portfolio" }
  ],
  "segment_patterns": [
    { "segment": "segment name", "pattern": "observation about this segment" }
  ],
  "urgent_actions": ["action 1 for leadership this week", "action 2", "action 3"]
}`;

  return { system, user };
}
