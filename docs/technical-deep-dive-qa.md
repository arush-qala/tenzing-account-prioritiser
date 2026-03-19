# Technical Deep-Dive: Q&A Reference

This document captures detailed technical questions and answers about the Tenzing Account Prioritiser's scoring model, AI integration, data handling, and design decisions. Intended for use in the write-up appendix.

---

## 1. How is the Confidence column in the Priority List calculated?

The Confidence column is based on `data_completeness_score`, which measures what percentage of 8 key nullable fields are non-null for each account.

**Fields checked:**
- `latest_nps`
- `avg_csat_90d`
- `note_sentiment_hint`
- `last_qbr_date`
- `latest_note_date`
- `recent_customer_note`
- `recent_sales_note`
- `overdue_amount_gbp`

**Thresholds:**
- **High** (green): >= 75% of fields present
- **Medium** (amber): 50-74% present
- **Low** (red): < 50% present

This is a data quality indicator, not a model confidence score. It tells leadership "how much data do we have on this account?" An account with Low confidence means key fields are missing, so the scoring is less reliable.

**Code reference:** `lib/utils/null-handling.ts` (`computeDataCompleteness` function), `components/dashboard/priority-list.tsx` (`confidenceLabel` function)

---

## 2. What model and data are used for the AI Summary column?

**Model:** `claude-sonnet-4-20250514` (Claude Sonnet 4) with `max_tokens=1500`

**Data fed to the AI for each account's analysis:**

| Category | Fields |
|----------|--------|
| Account context | account_name, account_id, industry, segment, region, account_status, lifecycle_stage, account_owner, csm_owner, support_tier |
| Financials | arr_gbp, mrr_current_gbp, mrr_3m_ago_gbp, mrr_trend_pct, expansion_pipeline_gbp, contraction_risk_gbp, overdue_amount_gbp |
| Usage & Engagement | seats_used, seats_purchased, seat_utilisation_pct, usage_score_current, usage_score_3m_ago, usage_trend, days_to_renewal |
| Sentiment & Support | latest_nps, avg_csat_90d, open_tickets_count, urgent_open_tickets_count, sla_breaches_90d, note_sentiment_hint |
| ML enrichments | is_anomaly, anomaly_score, cluster_label, cluster_id, support/customer/sales_sentiment_vader, sentiment_disagreement |
| Qualitative notes | recent_support_summary, recent_customer_note, recent_sales_note |
| Pre-computed scoring | All 5 sub-scores, health composite, priority score, calibrated score, priority tier, priority type, ARR factor, contradictions list, data_completeness_score |

Every column from the CSV plus all derived fields, ML enrichments, and deterministic scoring results are passed to Claude. The AI does not compute anything; it synthesises all of this into reasoning, actions, risks, and opportunities.

**Code reference:** `lib/ai/prompts.ts` (`buildAccountAnalysisPrompt`), `lib/ai/analyse-account.ts`

---

## 3. Does Portfolio Insights AI use individual account AI outputs?

**No.** The portfolio insights and account-level analyses are completely independent.

Portfolio insights receives only:
- Aggregated deterministic scoring data (tier distribution, ARR by tier, sub-scores, health composites)
- Top risks/opportunities derived from scoring types
- Owner stats (account count, avg score, critical count per owner)
- Segment stats (account count, avg score, avg health per segment)

It never reads from the `ai_analyses` table. The two AI features operate on different data:
- Account analysis: raw account data + scoring results -> per-account reasoning
- Portfolio insights: aggregated stats across all accounts -> portfolio-level themes

This is a deliberate trade-off (speed, decoupling, and cost), but it means portfolio insights miss the nuanced per-account reasoning that individual analyses produce.

**Code reference:** `lib/ai/portfolio-insights.ts` (`aggregatePortfolioData` function)

---

## 4. Is this problem centred around unsupervised learning only?

**Yes, given this dataset.** The CSV has no outcome labels (no `did_churn`, `expanded`, `renewed`, `lost` columns). Without knowing what actually happened to accounts, supervised learning cannot be used.

**What we use:**
- **Isolation Forest** (anomaly detection, unsupervised): finds accounts with unusual signal combinations
- **K-Means** (clustering, unsupervised): groups similar accounts into 5 archetypes
- **VADER** (rule-based sentiment, not ML training): scores text polarity

The deterministic scoring engine is the real workhorse. The ML adds enrichment signals, but the prioritisation itself is formula-driven with published weights, not learned from data.

The README's "What I'd Build Next" section explicitly calls this out: once the company has 6-12 months of outcome data (which accounts churned, expanded, renewed), a supervised model (gradient boosting, logistic regression) could be trained that would likely outperform hand-tuned weights.

---

## 5. How to evaluate performance and accuracy without outcome labels?

Without outcome labels, traditional accuracy metrics (precision, recall, F1) cannot be calculated. Instead:

**What we built:**

| Evaluation method | What it proves | Location |
|---|---|---|
| Rank stability (Kendall's tau 0.91-0.97) | Rankings don't collapse when weights change. The model isn't fragile. | `scripts/validation.py` |
| Sanity checks | Known-bad accounts (ACC-012, ACC-034) surface at the top. No healthy accounts misclassified as critical. | `scripts/validation.py` |
| Score calibration | Scores use the full 0-100 range (std=25.6 after calibration), not clustered in a narrow band. | `scripts/validation.py` |
| Face validity | A human reviewing the top 10 would agree they need attention (high contraction, declining MRR, urgent renewals). | Manual review |
| Contradiction detection | The system flags its own uncertainty rather than presenting false confidence. | `lib/scoring/contradictions.ts` |

**The feedback loop (the real long-term answer):**

The mandatory AI accuracy rating on every recorded action is how the system evaluates over time. After 3 months of use:
- If 80% of actions are rated "spot on" or "mostly right," the model is working
- If "wrong" ratings cluster on certain account types or tiers, that reveals where to re-tune weights
- The accuracy tracker on the dashboard visualises this trend

**Bottom line:** You can't fully evaluate a prioritisation model before deployment without outcome data. You validate the engineering (stability, calibration, sanity), then build the feedback mechanism to evaluate in production. The accuracy rating is that mechanism.

---

## 6. How is imperfect operational data handled?

### 6.1 Null handling in scoring (never silently impute)

Each signal function handles nulls explicitly with midpoint defaults:

| Signal | Null behaviour | Score returned | Rationale |
|--------|---------------|----------------|-----------|
| `scoreNps()` | null NPS | 50 (midpoint) | No information, neutral assumption |
| `scoreCsat()` | null CSAT | 50 (midpoint) | No information, neutral assumption |
| `scoreOverdue()` | null overdue | 85 | "No overdue data" likely means nothing is overdue |
| `scoreQbrRecency()` | null QBR date | 80 (high urgency) | No QBR on record is a risk signal |
| `scoreNoteRecency()` | null note date | 80 (high urgency) | Account going dark is a risk signal |

**Important:** These are midpoints of the **scoring range** (0-100), not medians of the actual data values. For example, NPS null returns 50 (middle of 0-100 score output), not the median NPS in the dataset (which is around 24).

**Code reference:** `lib/scoring/signals.ts` (each function has explicit null checks)

### 6.2 Why scoring midpoints instead of column means?

Two reasons:

1. **Mean imputation hides the missing data problem.** If CSAT is null and you substitute the column mean (say 4.1, mapping to a score of ~75), you're saying "this account's support health is above average" when you have zero information. A score of 50 says "we don't know, so we're not giving credit or penalty."

2. **Column means shift with the dataset.** If you add 10 new accounts with terrible CSAT (2.5), the mean drops, and every null-CSAT account's score silently changes even though nothing about those accounts changed. Scoring midpoints are stable and deterministic.

For 60 accounts where ~10% of values are null, the practical difference is small. Both approaches are defensible. We chose midpoints because they're simpler to explain ("null = we don't know = neutral score"), and the data completeness indicator makes the uncertainty visible rather than hidden.

### 6.3 Data completeness scoring

Every account gets a `data_completeness_score` (0-1) measuring what percentage of 8 key nullable fields are present. This flows into the UI as the Confidence column (High/Medium/Low) so leadership knows how much to trust each score.

**Code reference:** `lib/utils/null-handling.ts`

### 6.4 Seed script null handling

The Python seed script (`scripts/seed_data.py`) converts pandas NaN/NaT to Python `None` before inserting to Supabase via the `sanitise_value()` function. This ensures nulls are stored as proper SQL NULLs, not string "NaN".

### 6.5 Contradiction detection

5 deterministic rules catch when signals disagree with each other:

1. Positive NPS (>30) but declining usage (trend < -10)
2. Large pipeline (>15% ARR) but poor support health (score < 40)
3. Growing MRR (>+3%) but low seat utilisation (<50%)
4. Negative sentiment but high engagement score (>70)
5. High CSAT (>4.0) but multiple SLA breaches (>=3)

These are surfaced as amber warnings on account detail pages rather than silently averaged out.

**Code reference:** `lib/scoring/contradictions.ts`

### 6.6 VADER vs hand-label disagreement

The CSV's `note_sentiment_hint` column is a categorical label ("Positive", "Negative", "Neutral", "Mixed"). VADER analyses the actual note text and produces a compound sentiment score (-1 to +1). When they disagree (11 accounts), we flag `sentiment_disagreement = true`. This catches cases where the label says "Negative" but the notes are actually neutral/positive, or vice versa. These disagreements are shown with amber badges on the Notes Panel in account detail pages.

**Code reference:** `scripts/ml_pipeline.py` (VADER section), `components/account/notes-panel.tsx`

### 6.7 ML anomaly detection

Isolation Forest flags 5 accounts with unusual feature combinations that the scoring formula might not catch. These get amber badges in the UI so leadership can investigate manually.

### 6.8 How AI handles imperfect data

The prompt explicitly passes `Data Completeness: X%` to Claude. For accounts with low completeness, the AI response includes lower `confidence_level` and the reasoning typically caveats which signals are missing.

**Summary:** The approach is transparency over imputation. Rather than guessing what missing data might be, we tell the user "this data is incomplete" and let them factor that into their decision.

---

## 7. Full scoring model: Sub-scores, signals, weights, and formulas

### 7.1 Revenue Health (top-level weight: 25%)

| Signal | Internal weight | Input column | Scoring thresholds |
|--------|----------------|--------------|-------------------|
| MRR Trend | 45% | `mrr_trend_pct` (derived) | >=+5% -> 95, +2 to +5 -> 80, -2 to +2 -> 55, -5 to -2 -> 30, <-5% -> 10 |
| Contraction Risk | 30% | `contraction_risk_gbp / arr_gbp * 100` | <5% -> 90, 5-15% -> 60, 15-30% -> 30, >30% -> 10 |
| Overdue | 25% | `overdue_amount_gbp / (arr_gbp/12) * 100` | null -> 85, 0 -> 85, <50% -> 70, 50-100% -> 45, >100% -> 15 |

**Revenue Health = 0.45 x MRR Trend + 0.30 x Contraction Risk + 0.25 x Overdue**

### 7.2 Engagement (top-level weight: 25%)

| Signal | Internal weight | Input column | Scoring thresholds |
|--------|----------------|--------------|-------------------|
| Usage Current | 30% | `usage_score_current` | Direct passthrough (already 0-100 in data) |
| Usage Trend | 25% | `usage_trend` (current - 3m ago) | >=+15 -> 95, +5 to +15 -> 75, -5 to +5 -> 50, -15 to -5 -> 25, <-15 -> 10 |
| Seat Utilisation | 25% | `seat_utilisation_pct * 100` | >85% -> 95, 70-85% -> 75, 50-70% -> 45, <50% -> 15 |
| NPS | 20% | `latest_nps` | >50 -> 95, 20-50 -> 70, 0-20 -> 40, <0 -> 15, null -> 50 |

### 7.3 Support Health (top-level weight: 15%)

| Signal | Internal weight | Input column | Scoring thresholds |
|--------|----------------|--------------|-------------------|
| Urgent Tickets | 30% | `urgent_open_tickets_count` | 0 -> 100, 1 -> 60, 2 -> 30, 3+ -> 10 |
| SLA Breaches | 30% | `sla_breaches_90d` | 0 -> 100, 1 -> 70, 2-3 -> 40, 4+ -> 10 |
| CSAT | 25% | `avg_csat_90d` | >4.5 -> 95, 4.0-4.5 -> 75, 3.5-4.0 -> 50, 3.0-3.5 -> 25, <3.0 -> 10, null -> 50 |
| Ticket Volume | 15% | `open_tickets_count` | Normalised by segment: Enterprise tolerates more tickets (0-2=90) than SMB (0=90, 1=60) |

### 7.4 Opportunity (top-level weight: 20%)

| Signal | Internal weight | Input column | Scoring thresholds |
|--------|----------------|--------------|-------------------|
| Pipeline | 50% | `expansion_pipeline_gbp / arr_gbp * 100` | >25% -> 95, 15-25% -> 75, 5-15% -> 50, 1-5% -> 30, <1% -> 10 |
| Lifecycle | 25% | `lifecycle_stage` | Expansion -> 85, Renewal -> 50, Customer -> 40 |
| Lead Activity | 25% | leads count + avg_lead_score + last_lead_activity_date | High score + recent + leads -> 90, leads but low quality -> 40, no leads -> 20 |

### 7.5 Urgency (top-level weight: 15%)

| Signal | Internal weight | Input column | Scoring thresholds |
|--------|----------------|--------------|-------------------|
| Renewal Urgency | 40% | `days_to_renewal` | <30d -> 100, 30-60d -> 80, 60-90d -> 60, 90-180d -> 40, >180d -> 20. Non-renewal lifecycle -> 20 |
| QBR Recency | 25% | `last_qbr_date` | <45d ago -> 20, 45-90d -> 40, 90-180d -> 70, >180d -> 90, null -> 80 |
| Note Recency | 20% | `latest_note_date` | <14d -> 20, 14-30d -> 40, 30-60d -> 65, >60d -> 85, null -> 80 |
| Paused Status | 15% | `account_status` | Paused -> 90, Active -> 20 |

### 7.6 Composite formulas

**Health Composite:**

```
Health = 0.29 x Revenue + 0.29 x Engagement + 0.18 x Support + 0.24 x Opportunity
```

These weights are **mechanically derived** from the top-level sub-score weights (25/25/15/20) by rescaling to sum to 1.0 after removing Urgency (which feeds into priority separately):
- Revenue: 25/85 = 0.294, rounded to 0.29
- Engagement: 25/85 = 0.294, rounded to 0.29
- Support: 15/85 = 0.176, rounded to 0.18
- Opportunity: 20/85 = 0.235, rounded to 0.24

They are not independently chosen; they preserve the same relative proportions as the sub-score weights.

**Priority Score:**

```
Priority = (100 - Health) x 0.6 + Urgency x 0.4
```

The `(100 - Health)` inversion means low health produces high priority (unhealthy accounts need more attention).

The 0.6/0.4 split is a **design decision** about how much account health vs time pressure should drive prioritisation:
- If 0.5/0.5: an account renewing tomorrow with perfect health would rank equally to a deteriorating account with no deadline. That underweights health.
- If 0.8/0.2: urgency barely matters, and a healthy account renewing in 10 days might not surface. That underweights time pressure.
- 0.6/0.4 says "health is the primary driver, but urgency can meaningfully elevate priority." Like all weights in this model: defensible domain intuition, not empirically derived.

The priority score is then min-max calibrated across all 60 accounts to use the full 0-100 range.

**Code references:** `lib/scoring/weights.ts`, `lib/scoring/signals.ts`, `lib/scoring/engine.ts`, `lib/scoring/calibration.ts`

---

## 8. Origin and justification of all weights and thresholds

### 8.1 What is the source of these numbers?

All weights and thresholds are **hand-tuned heuristics** based on general B2B SaaS best practices. They are:

- **Not random**: there is a logic (e.g., Revenue and Engagement weighted equally highest because they're the strongest churn/expansion predictors in B2B SaaS)
- **Not data-derived**: the ML layer (Isolation Forest, K-Means, VADER) does NOT inform the weights. ML and scoring are completely independent layers.
- **Not empirically validated against outcomes**: without outcome data (did_churn, did_expand), there is no way to optimise weights against actual events

| Component | Source | Justification level |
|-----------|--------|-------------------|
| Sub-score weights (25/25/15/20/15) | General B2B SaaS prioritisation best practice | Reasonable, domain-informed |
| Internal signal weights (e.g., MRR 45%, Contraction 30%) | Domain intuition about which signals matter most within each category | Reasonable, domain-informed |
| Score thresholds (e.g., NPS >50 -> 95) | Industry benchmarks for "good" vs "bad" NPS/CSAT/utilisation | Defensible, based on known benchmarks |
| Health composite weights (0.29/0.29/0.18/0.24) | Mechanically rescaled from first 4 sub-scores (excluding urgency) to sum to 1.0 | Mechanically derived |
| Priority formula (0.6 health, 0.4 urgency) | Design decision: health matters more than time pressure alone | Debatable, explicit trade-off |
| Tier boundaries (80/65/50/35) | Chosen to target roughly 10/20/35/25/10% distribution | Calibration target |

### 8.2 Mapping to Lucia's stated success metrics

Lucia's email (18 March 2026) states success metrics are: **pipeline conversion, expansion within existing accounts, and reducing churn risk.**

| Lucia's metric | Maps to sub-score(s) | Current combined weight |
|---|---|---|
| Pipeline conversion | Opportunity (pipeline ratio, lead activity) | 20% |
| Expansion within existing accounts | Engagement (usage, seats) + Opportunity (pipeline) | 25% + 20% = 45% |
| Reducing churn risk | Revenue Health (MRR trend, contraction) + Support Health (tickets, SLA, CSAT) | 25% + 15% = 40% |

The current weights are not far off from what these metrics would suggest, though there is a case for boosting Support Health from 15% to 20% given churn reduction's importance.

### 8.3 Can the ML layer inform weight selection?

**Not with this dataset.** Analysis by technique:

| ML approach | Could it set weights? | Why not here |
|---|---|---|
| Supervised learning (logistic regression, gradient boosting) | Yes, feature importance scores would directly suggest weights | No outcome labels. This is the fundamental blocker. |
| K-Means clustering (what we have) | No. Groups similar accounts, but "similar" is not "important for churn prediction." | Clusters describe structure, not causation |
| Isolation Forest (what we have) | No. Finds outliers, not feature importance for a business outcome. | Anomaly does not equal priority |
| PCA / factor analysis | Partially. Could reveal which features explain the most variance. But variance does not equal business importance. | Explains data structure, not outcomes |
| SHAP on surrogate model | Clever workaround: train a model to predict our own priority scores, then use SHAP. But this just explains our heuristics back to us. | Circular reasoning |

**What would work with 6-12 months of outcome data:**
1. Train a gradient boosting model with `churned` / `expanded` / `renewed` as labels
2. Extract feature importances
3. Use those to set sub-score weights empirically
4. Compare ML-derived ranking against heuristic ranking
5. The feedback loop (accuracy ratings on recorded actions) is the first step toward building this outcome dataset

### 8.4 Recommendation

Do not change weights for the submission. The current weights are defensible, the system is transparent about them (waterfall chart, published weights in the README), and Kendall's tau proves stability. What matters is being able to articulate:
- Why the weights are what they are
- How they map to the stated success metrics
- What would be needed to improve them (outcome data)
- What mechanism exists to build toward that (the feedback loop)

---

## 9. Validation results summary

| Metric | Result | Interpretation |
|--------|--------|---------------|
| Kendall's tau (4 weight scenarios) | 0.91 to 0.97 | Excellent rank stability across weight configurations |
| Raw score std dev | 13.49 | Good spread, not clustered |
| Calibrated score std dev | 25.63 | Full range utilised after min-max normalisation |
| Sanity: top 5 includes key risk accounts | ACC-012, ACC-034 in top 5 | Pass |
| Sanity: no declining-MRR in bottom 5 | Pass | Healthy accounts correctly at bottom |
| Sanity: >30% contraction all Critical/High | 11/13 pass (2 at Medium in Python validator) | Minor gap, resolved by TypeScript tier floors |
| Sanity: paused accounts above median | 3/5 pass | 2 paused accounts below median, acceptable |
| Anomalies detected | 5 out of 60 | ACC-005, ACC-006, ACC-012, ACC-040, ACC-056 |
| K-Means clusters | 5 clusters with auto-labels | At-Risk Enterprise (9), Stable Mid-Market (19), High-Value Growth (3), Expansion Ready (20), Low-Engagement SMB (9) |
| VADER sentiment disagreements | 11 out of 56 accounts with notes | Mostly "Negative" hint but VADER reads notes as positive |

---

## 10. AI Feedback Loop: Current State and Roadmap

### What exists today

The action recorder requires a mandatory AI accuracy rating (wrong / partially right / mostly right / spot on) on every recorded action. These ratings are:
- Stored in the `actions` table
- Displayed in the Accuracy Tracker donut chart on the dashboard

### What does NOT happen today

- Accuracy ratings are **not fed back** into AI prompts when re-analysing accounts
- The scoring engine **never reads** from the `actions` table
- Portfolio insights **don't reference** past accuracy data
- No weight adjustment happens based on ratings

The feedback loop is currently a **data collection mechanism**, not a closed loop.

### Roadmap: 3 steps to close the loop

**Step 1 (prompt refinement):** When re-analysing an account, include past accuracy ratings in the prompt: "Previous AI recommendations for this account were rated 'wrong' by the user. Adjust your approach." This is a small code change that makes the AI context-aware of its own track record.

**Step 2 (pattern detection):** Aggregate accuracy by priority type. If `churn_risk` accounts consistently get "wrong" ratings, that signals the churn detection logic or the AI prompts need tuning. This informs manual weight and prompt adjustments.

**Step 3 (supervised learning):** With sufficient accumulated ratings (and ideally real outcome data: did the account churn, expand, renew?), train supervised models that can empirically set scoring weights rather than relying on hand-tuned heuristics.

### Why this was the right trade-off for the prototype

The challenge brief says "not being evaluated: production-hardening beyond reasonable scope." Building the rating mechanism demonstrates product lifecycle thinking. Actually closing the loop is a production refinement. The data collection is the hard part; the wiring is straightforward.

For the write-up, frame as: "The rating mechanism collects the data needed to close the loop. In production, accumulated ratings would inform prompt refinement and, with sufficient volume, weight optimisation."

---

*Document generated from conversation on 17-19 March 2026. All code references verified against current codebase.*
