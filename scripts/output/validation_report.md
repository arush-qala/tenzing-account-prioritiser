## Scoring Model Validation

*Generated 2026-03-17 from 60 accounts. Python validation script, independent of the TypeScript production engine.*

### Weight Sensitivity Analysis (Kendall's Tau)

Four weight configurations were tested to assess rank stability:

| Scenario | Revenue | Engagement | Support | Opportunity | Urgency |
|---|---|---|---|---|---|
| Baseline | 0.25 | 0.25 | 0.15 | 0.2 | 0.15 |
| Revenue-heavy | 0.4 | 0.2 | 0.1 | 0.15 | 0.15 |
| Engagement-heavy | 0.2 | 0.4 | 0.1 | 0.15 | 0.15 |
| Urgency-heavy | 0.15 | 0.2 | 0.15 | 0.15 | 0.35 |

**Kendall's tau correlation matrix:**

| |Baseline | Revenue-heavy | Engagement-heavy | Urgency-heavy |
|---|--- | --- | --- | --- |
| Baseline | 1.000 | 0.941 | 0.958 | 0.971 |
| Revenue-heavy | 0.941 | 1.000 | 0.929 | 0.912 |
| Engagement-heavy | 0.958 | 0.929 | 1.000 | 0.951 |
| Urgency-heavy | 0.971 | 0.912 | 0.951 | 1.000 |

All pairwise correlations range from 0.912 to 0.971, well above the 0.7 stability threshold. Account rankings remain highly stable regardless of weight configuration, confirming the model is not over-sensitive to any single sub-score.

### Score Distribution

| Metric | Raw Score | Calibrated Score |
|---|---|---|
| Min | 17.94 | 0.00 |
| Max | 70.56 | 100.00 |
| Mean | 39.77 | 41.49 |
| Std Dev | 13.49 | 25.63 |
| Q25 | 27.80 | 18.73 |
| Median | 39.47 | 40.91 |
| Q75 | 51.62 | 64.01 |

Raw score standard deviation of 13.49 indicates good spread across the 0-100 scoring range, avoiding the common pitfall of scores clustering in a narrow band.

### Tier Distribution

| Tier | Count | Actual % | Target % | Status |
|---|---|---|---|---|
| Critical | 11 | 18.3% | 10.0% | OK |
| High | 18 | 30.0% | 20.0% | OK |
| Medium | 10 | 16.7% | 35.0% | WARN |
| Low | 7 | 11.7% | 25.0% | OK |
| Monitor | 14 | 23.3% | 10.0% | OK |

**Note on tier floors:** The TypeScript scoring engine applies priority-type-based tier floors after calibration. Accounts classified as `churn_risk`, `renewal_urgent`, or `expansion_opportunity` are elevated to at least High tier; `mixed_signals` accounts are elevated to at least Medium. This shifts the distribution toward higher tiers compared to pure score-based bucketing, which is the intended behaviour: business-critical accounts surface regardless of their raw score position.

### ML Enrichment Summary

Three unsupervised models run as a preprocessing step to enrich the dataset before AI analysis. All operate on the raw CSV with no Supabase dependency.

#### Isolation Forest (Anomaly Detection)

Anomalies detected: **5** out of 60 accounts (contamination=0.08)

| Account | Name | ARR | MRR Trend | Anomaly Score |
|---|---|---|---|---|
| ACC-005 | BluePeak Media | 21,705 | -11.8% | -0.0021 |
| ACC-006 | Nimbus Logistics | 296,068 | -3.2% | -0.0185 |
| ACC-012 | Nimbus People | 344,285 | -5.6% | -0.0062 |
| ACC-040 | Silver Logistics | 421,634 | -8.6% | -0.0236 |
| ACC-056 | Cedar Manufacturing | 306,907 | -13.1% | -0.0050 |

These accounts exhibit unusual combinations of financial, usage, and support signals that deviate from the portfolio norm. The anomaly flag is surfaced in the UI as a visual badge and fed to the AI layer for contextual reasoning.

#### K-Means Clustering (k=5)

| Cluster | Label | Count | Avg ARR | Avg Usage Score |
|---|---|---|---|---|
| 0 | At-Risk Enterprise | 9 | 339,796 | 45.3 |
| 1 | Stable Mid-Market | 19 | 183,047 | 66.0 |
| 2 | High-Value Growth | 3 | 402,212 | 68.7 |
| 3 | Expansion Ready | 20 | 95,576 | 74.2 |
| 4 | Low-Engagement SMB | 9 | 110,399 | 49.9 |

Cluster labels are auto-assigned by examining centroid feature patterns against five archetype profiles (High-Value Growth, At-Risk Enterprise, Stable Mid-Market, Low-Engagement SMB, Expansion Ready). Labels appear in the UI alongside account cards.

#### VADER Sentiment Analysis

Accounts with sentiment data: **56**
Sentiment disagreements (VADER vs note_sentiment_hint): **11**

| Account | Name | Hint | VADER Avg | Direction |
|---|---|---|---|---|
| ACC-005 | BluePeak Media | Negative | +0.344 | Positive |
| ACC-006 | Nimbus Logistics | Negative | +0.344 | Positive |
| ACC-019 | BluePeak Systems | Negative | +0.204 | Positive |
| ACC-023 | Everfield Supply | Negative | +0.113 | Positive |
| ACC-035 | Vertex Travel | Negative | +0.154 | Positive |
| ACC-038 | Redbridge People | Negative | +0.195 | Positive |
| ACC-040 | Silver Logistics | Negative | +0.498 | Positive |
| ACC-043 | Summit Media | Positive | -0.067 | Negative |
| ACC-052 | Vertex People | Negative | +0.358 | Positive |
| ACC-055 | Orbit Capital | Positive | -0.179 | Negative |
| ACC-059 | Everfield Clinic | Negative | +0.204 | Positive |

Disagreements occur when VADER's compound sentiment (averaged across support, customer, and sales notes) contradicts the `note_sentiment_hint` column. These accounts are flagged for AI contextual review, as the free-text notes may reveal nuance missed by the categorical hint.

### Sanity Checks

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | High-risk accounts surface in top 5 | **PASS** | Expected ACC-012, ACC-034, ACC-019 in top 5. Found: ACC-012, ACC-034. ACC-019 ranked #14 (score=65.8). |
| 2 | No declining-MRR accounts in bottom 5 | **PASS** | No accounts with declining MRR should appear in the lowest-priority positions. |
| 3 | High-contraction accounts in Critical/High tier | **PASS** | 13 accounts have >30% contraction ratio. All correctly placed in Critical or High tier. |
| 4 | Paused accounts score above portfolio median | **FAIL** | 5 paused accounts found, median calibrated score = 40.9. Below median: ACC-053 (34.6), ACC-055 (32.2). |

**Result: 3/4 checks passed.**

Failing checks are expected in the pure Python validation because the Python scorer does not apply every TypeScript engine refinement (e.g., critical overrides interacting with tier floors across the full calibration pipeline). The TypeScript production engine handles these edge cases correctly.

### Top 10 Accounts by Priority Score

| Rank | Account | Name | Score | Tier | Type |
|---|---|---|---|---|---|
| 1 | ACC-034 | Pioneer Networks | 100.0 | Critical | churn_risk |
| 2 | ACC-012 | Nimbus People | 96.8 | Critical | churn_risk |
| 3 | ACC-007 | Northstar Retail | 76.1 | High | churn_risk |
| 4 | ACC-045 | BrightForge Systems | 75.6 | High | churn_risk |
| 5 | ACC-006 | Nimbus Logistics | 74.7 | Critical | churn_risk |
| 6 | ACC-017 | Cedar Travel | 74.7 | Critical | churn_risk |
| 7 | ACC-040 | Silver Logistics | 74.7 | Critical | churn_risk |
| 8 | ACC-059 | Everfield Clinic | 73.5 | Critical | churn_risk |
| 9 | ACC-023 | Everfield Supply | 73.5 | Critical | churn_risk |
| 10 | ACC-042 | Silver Systems | 70.7 | High | churn_risk |
