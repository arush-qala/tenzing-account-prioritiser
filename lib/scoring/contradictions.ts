// ---------------------------------------------------------------------------
// Contradiction Detection
// ---------------------------------------------------------------------------
// Identifies conflicting signals within a single account. These are surfaced
// in the UI and fed to the AI layer for contextual reasoning.
// ---------------------------------------------------------------------------

import type { Account, Contradiction, SubScores } from '@/lib/scoring/types';

/**
 * Detect contradictions between signals for a single account.
 * Returns an array of 0-N contradiction objects.
 */
export function detectContradictions(
  account: Account,
  subScores: SubScores,
): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // 1. Positive NPS (>30) + declining usage (trend < -10)
  if (
    account.latest_nps !== null &&
    account.latest_nps > 30 &&
    account.usage_trend < -10
  ) {
    contradictions.push({
      signal1: 'NPS > 30 (promoter)',
      signal2: `Usage declining (${account.usage_trend > 0 ? '+' : ''}${account.usage_trend.toFixed(0)} pts)`,
      description:
        'Customer reports high satisfaction but actual product usage is dropping. ' +
        'May indicate executive sponsor is positive while day-to-day users are disengaging.',
    });
  }

  // 2. Large pipeline (>15% ARR) + poor support health (score < 40)
  if (account.arr_gbp > 0) {
    const pipelineRatio = (account.expansion_pipeline_gbp / account.arr_gbp) * 100;
    if (pipelineRatio > 15 && subScores.supportHealth < 40) {
      contradictions.push({
        signal1: `Expansion pipeline ${pipelineRatio.toFixed(0)}% of ARR`,
        signal2: `Support health score ${subScores.supportHealth.toFixed(0)}/100`,
        description:
          'Active expansion opportunity exists alongside poor support experience. ' +
          'Expansion deal is at risk if support issues are not resolved first.',
      });
    }
  }

  // 3. Growing MRR (>+3%) + low seat utilisation (<50%)
  if (account.mrr_trend_pct > 3 && account.seat_utilisation_pct < 0.5) {
    contradictions.push({
      signal1: `MRR growing +${account.mrr_trend_pct.toFixed(1)}%`,
      signal2: `Seat utilisation ${(account.seat_utilisation_pct * 100).toFixed(0)}%`,
      description:
        'Revenue is growing but over half the purchased seats are unused. ' +
        'May indicate over-provisioning or adoption limited to a subset of the org.',
    });
  }

  // 4. Negative sentiment + high engagement score (>70)
  if (
    account.note_sentiment_hint === 'Negative' &&
    subScores.engagement > 70
  ) {
    contradictions.push({
      signal1: 'Negative note sentiment',
      signal2: `Engagement score ${subScores.engagement.toFixed(0)}/100`,
      description:
        'Qualitative notes indicate dissatisfaction despite strong quantitative engagement. ' +
        'Usage may be high out of necessity rather than satisfaction; churn risk may be understated.',
    });
  }

  // 5. High CSAT (>4.0) + multiple SLA breaches (>=3)
  if (
    account.avg_csat_90d !== null &&
    account.avg_csat_90d > 4.0 &&
    account.sla_breaches_90d >= 3
  ) {
    contradictions.push({
      signal1: `CSAT ${account.avg_csat_90d.toFixed(1)}`,
      signal2: `${account.sla_breaches_90d} SLA breaches (90d)`,
      description:
        'Customer satisfaction remains high despite repeated SLA breaches. ' +
        'Goodwill may be eroding; continued breaches could trigger a sharper sentiment shift.',
    });
  }

  return contradictions;
}
