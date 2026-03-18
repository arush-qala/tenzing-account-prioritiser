// ---------------------------------------------------------------------------
// AI Chat — Build context-aware system prompt for account conversations
// ---------------------------------------------------------------------------

import type { Account, ScoringResult } from '@/lib/scoring/types';

interface AnalysisData {
  reasoning?: string;
  recommended_actions?: Array<{
    action: string;
    owner: string;
    timeframe: string;
    rationale: string;
  }>;
  risk_factors?: string[];
  opportunity_factors?: string[];
  key_signals?: string[];
  priority_tier?: string;
  priority_type?: string;
  confidence_level?: string;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

function formatPct(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

export function buildChatSystemPrompt(
  account: Account,
  scoringResult: ScoringResult,
  analysis: AnalysisData | null,
): string {
  const analysisBlock = analysis
    ? `
AI ANALYSIS SUMMARY:
- Reasoning: ${analysis.reasoning || 'Not yet analysed'}
- Priority Tier: ${analysis.priority_tier || scoringResult.priorityTier}
- Priority Type: ${analysis.priority_type || scoringResult.priorityType}
- Confidence: ${analysis.confidence_level || 'N/A'}
- Risk Factors: ${analysis.risk_factors?.join('; ') || 'None identified'}
- Opportunity Factors: ${analysis.opportunity_factors?.join('; ') || 'None identified'}
- Key Signals: ${analysis.key_signals?.join('; ') || 'None identified'}
- Recommended Actions: ${analysis.recommended_actions?.map((a) => `${a.action} (${a.owner}, ${a.timeframe})`).join('; ') || 'None'}`
    : '\nAI ANALYSIS: Not yet performed for this account.';

  return `You are a senior portfolio analyst at a B2B tech PE firm. You are having a conversation with a portfolio company leader about a specific account. Be concise, direct, and CEO-level in your communication. Reference specific data points when answering questions.

ACCOUNT CONTEXT:
- Account: ${account.account_name} (${account.account_id})
- Industry: ${account.industry} | Segment: ${account.segment} | Region: ${account.region}
- Status: ${account.account_status} | Lifecycle: ${account.lifecycle_stage}
- Account Owner: ${account.account_owner} | CSM: ${account.csm_owner}

FINANCIALS:
- ARR: ${formatCurrency(account.arr_gbp)}
- MRR Current: ${formatCurrency(account.mrr_current_gbp)} | MRR 3m Ago: ${formatCurrency(account.mrr_3m_ago_gbp)}
- MRR Trend: ${formatPct(account.mrr_trend_pct)}
- Expansion Pipeline: ${formatCurrency(account.expansion_pipeline_gbp)}
- Contraction Risk: ${formatCurrency(account.contraction_risk_gbp)}
- Overdue: ${formatCurrency(account.overdue_amount_gbp)}

USAGE & ENGAGEMENT:
- Seats: ${account.seats_used}/${account.seats_purchased} (${formatPct(account.seat_utilisation_pct)})
- Usage Score: ${account.usage_score_current} (was ${account.usage_score_3m_ago})
- Days to Renewal: ${account.days_to_renewal}
- NPS: ${account.latest_nps ?? 'N/A'} | CSAT: ${account.avg_csat_90d ?? 'N/A'}

SUPPORT:
- Open Tickets: ${account.open_tickets_count} (${account.urgent_open_tickets_count} urgent)
- SLA Breaches (90d): ${account.sla_breaches_90d}

QUALITATIVE NOTES:
- Support: ${account.recent_support_summary || 'None'}
- Customer: ${account.recent_customer_note || 'None'}
- Sales: ${account.recent_sales_note || 'None'}

SCORING:
- Sub-Scores: Revenue ${scoringResult.subScores.revenueHealth}, Engagement ${scoringResult.subScores.engagement}, Support ${scoringResult.subScores.supportHealth}, Opportunity ${scoringResult.subScores.opportunity}, Urgency ${scoringResult.subScores.urgency}
- Health Composite: ${scoringResult.healthComposite.toFixed(1)}
- Priority Score: ${scoringResult.calibratedScore.toFixed(1)} (${scoringResult.priorityTier})
- Contradictions: ${scoringResult.contradictions.length > 0 ? scoringResult.contradictions.map((c) => c.description).join('; ') : 'None'}
${analysisBlock}

INSTRUCTIONS:
- Be specific and reference the data above
- If asked about comparisons, note you only have data for this account
- If asked hypothetical "what if" questions, reason about how changes would affect the scoring
- Keep responses concise (2-4 paragraphs max unless asked for detail)
- Use British English and currency formatting`;
}
