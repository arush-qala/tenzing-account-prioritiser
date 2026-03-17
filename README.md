# AI-Powered Account Prioritisation Tool

An account prioritisation tool for B2B SaaS portfolio leadership. Takes 60 accounts with 40 data columns each (financials, usage, support, sentiment, free-text notes) and produces a ranked priority list with AI-generated reasoning, recommended actions, and counterfactual explanations.

**Live prototype**: [DEPLOYED_URL]

**Demo credentials**: `demo@tenzing.pe` / `TenzingDemo2026`

Built for the Tenzing AI Sherpa Programme technical challenge.

---

## Table of Contents

1. [Architecture](#architecture)
2. [How Prioritisation Works](#how-prioritisation-works)
3. [ML Enrichment](#ml-enrichment)
4. [AI Integration](#ai-integration)
5. [Handling Imperfect Data](#handling-imperfect-data)
6. [UX Decisions](#ux-decisions)
7. [Trade-Offs](#trade-offs)
8. [Validation](#validation)
9. [What I Would Build Next](#what-i-would-build-next)
10. [Running Locally](#running-locally)

---

## Architecture

The system has four layers. Each one has a specific job, and they feed forward in sequence:

```
CSV (60 accounts, 40 columns)
        │
        ▼
┌─────────────────────────────────────────────┐
│  Layer 1: ML Enrichment (Python, offline)   │
│  Isolation Forest, K-Means, VADER Sentiment │
│  Outputs: anomaly flags, cluster labels,    │
│  sentiment scores, disagreement flags       │
└─────────────────────────────────────────────┘
        │  Enriched data stored in Supabase
        ▼
┌─────────────────────────────────────────────┐
│  Layer 2: Deterministic Scoring (TypeScript) │
│  5 sub-scores → health composite → priority │
│  score → calibration → tiers → type floors  │
│  Pure math, no AI, fully auditable          │
└─────────────────────────────────────────────┘
        │  Scores + account data
        ▼
┌─────────────────────────────────────────────┐
│  Layer 3: AI Contextual Analysis (Claude)   │
│  Account reasoning, actions, counterfactuals│
│  Portfolio insights, risk/opportunity factors│
│  Claude synthesises; it does not compute    │
└─────────────────────────────────────────────┘
        │  AI results cached in DB
        ▼
┌─────────────────────────────────────────────┐
│  Layer 4: Frontend (Next.js 14)             │
│  Dashboard with filters, priority table,    │
│  account detail with waterfall, actions,    │
│  accuracy tracker, renewal timeline         │
└─────────────────────────────────────────────┘
```

**Why this architecture?** The evaluation criteria prioritise clarity and defensibility of prioritisation logic. Deterministic scoring handles that: every score is traceable to a formula with known weights. AI then adds what formulas cannot: synthesising free-text notes with quantitative signals into natural language reasoning and recommended actions. ML adds pattern detection (anomalies, clusters, sentiment analysis) that neither deterministic rules nor AI alone would produce efficiently.

### Tech Stack

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) | Single deployable unit; server components handle data fetching, API routes handle AI calls |
| UI | Tailwind CSS + shadcn/ui + Recharts | Clean component library for leadership-facing dashboards, fast to iterate |
| Database | Supabase (PostgreSQL) | Auth + DB in one service; free tier handles 60 accounts easily; row-level security |
| Auth | Supabase Auth (email/password) | Minimal auth that meets the "include authentication" requirement |
| AI | Claude API (Sonnet) via Anthropic SDK | Fast, cost-effective (~$0.50 per full batch of 60 accounts); signals comfort with the Claude ecosystem |
| ML | Python (scikit-learn, VADER) | Offline preprocessing step; keeps ML complexity out of the TypeScript runtime |
| Deployment | Vercel | One-click deploy from GitHub, handles Next.js natively |

---

## How Prioritisation Works

Prioritisation runs in two phases: deterministic scoring produces numbers, then AI adds reasoning on top.

### Phase 1: Deterministic Scoring

Five sub-scores, each 0-100, capture different dimensions of account health and urgency:

| Sub-Score | Weight | What It Measures | Key Signals |
|-----------|--------|-----------------|-------------|
| Revenue Health | 25% | Financial trajectory | MRR trend (45%), contraction risk ratio (30%), overdue ratio (25%) |
| Engagement | 25% | Product adoption and satisfaction | Current usage (30%), usage trend (25%), seat utilisation (25%), NPS (20%) |
| Support Health | 15% | Service quality and burden | Urgent tickets (30%), SLA breaches (30%), CSAT (25%), ticket volume normalised by segment (15%) |
| Opportunity | 20% | Growth potential | Expansion pipeline ratio (50%), lifecycle stage (25%), lead activity (25%) |
| Urgency | 15% | Time pressure for action | Renewal proximity (40%), QBR recency (25%), note recency (20%), paused status (15%) |

Each sub-score uses lookup tables that map raw metrics to 0-100 signal scores. For example, MRR trend >= +5% maps to 95 (strong growth), while < -5% maps to 10 (severe decline). This is intentionally simple: lookup tables are auditable, and evaluators can trace any score back to the exact threshold that produced it.

### Composite Formula

The five sub-scores combine in two steps:

**Step 1: Health composite** (first four sub-scores, urgency excluded):

```
health = 0.29 * revenue + 0.29 * engagement + 0.18 * support + 0.24 * opportunity
```

**Step 2: Priority score** (higher = needs more attention):

```
priority = (100 - health) * 0.6 + urgency * 0.4
```

The inversion of health is deliberate: an unhealthy account that also has high urgency gets the highest priority score.

### Min-Max Calibration

Raw priority scores clustered between 18 and 71 out of 100, which made tier boundaries (Critical >= 80) largely useless. Min-max calibration rescales the raw scores to span the full 0-100 range. After calibration, the standard deviation improves from 13.49 to 25.63, giving meaningful separation between tiers.

### Priority Types and Tier Floors

After scoring, each account is classified into a priority type based on business logic:

| Type | Rule | Tier Floor |
|------|------|-----------|
| `churn_risk` | Health < 40 AND (negative sentiment OR contraction > 15% ARR) | High |
| `renewal_urgent` | Lifecycle = Renewal AND days < 90 AND health < 60 | High |
| `expansion_opportunity` | Pipeline > 15% ARR AND (positive sentiment OR Expansion stage) | High |
| `mixed_signals` | Sentiment contradicts health score, or contradictions detected | Medium |
| `stable` | Everything else | No floor |

Tier floors are the key design choice here. A healthy account with a large expansion pipeline still needs attention (to capture the opportunity), so `expansion_opportunity` accounts are elevated to at least High tier even if their priority score would otherwise land them in Medium or Low. This intentionally distorts the score distribution toward higher tiers for business-critical accounts.

### ARR Weighting

Not all accounts are equal. A declining £400K account matters more to the portfolio than a declining £20K account at the same risk level. The ARR factor uses log-scaled weighting:

```
arrFactor = 1 + log10(arr / medianArr) * 0.3    [clamped to 0.7 - 1.5]
```

Log scaling prevents large accounts from completely dominating the rankings while still giving them meaningful uplift. The clamp at 0.7-1.5 ensures no account is crushed or inflated beyond reason.

---

## ML Enrichment

Three unsupervised models run as a Python preprocessing step. They enrich the dataset before AI analysis. The choice of unsupervised methods is intentional: the dataset has no outcome labels (no churn events, no expansion outcomes), so supervised learning would require fabricating a target variable, which I was not willing to do.

### Isolation Forest (Anomaly Detection)

Trains on 8 financial/usage/support features. Contamination set to 0.08 (expecting ~5 anomalies out of 60).

**Result**: 5 anomalies flagged. All share a pattern of negative MRR trends combined with other warning signals (high contraction, declining usage). These are surfaced as visual badges in the UI and included in the data sent to the AI layer for contextual reasoning.

### K-Means Clustering (k=5)

Clusters accounts into 5 behavioural segments using 10 features (the 8 anomaly features plus expansion pipeline and NPS). Features are StandardScaler-normalised before clustering.

Cluster labels are auto-assigned by scoring each cluster's centroid against five archetype profiles (High-Value Growth, At-Risk Enterprise, Stable Mid-Market, Low-Engagement SMB, Expansion Ready). This avoids hardcoded label assignments that would break if cluster composition shifted.

| Cluster | Label | Count | Avg ARR | Avg Usage |
|---------|-------|-------|---------|-----------|
| 0 | At-Risk Enterprise | 9 | £339,796 | 45.3 |
| 1 | Stable Mid-Market | 19 | £183,047 | 66.0 |
| 2 | High-Value Growth | 3 | £402,212 | 68.7 |
| 3 | Expansion Ready | 20 | £95,576 | 74.2 |
| 4 | Low-Engagement SMB | 9 | £110,399 | 49.9 |

### VADER Sentiment Analysis

Runs VADER compound sentiment on three free-text columns (support summary, customer note, sales note). The critical output is **disagreement detection**: comparing VADER's sentiment direction against the `note_sentiment_hint` column from the source data.

**Result**: 11 disagreements found across 56 accounts with sentiment data. In 9 of 11 cases, the hand-labelled hint says "Negative" but VADER reads the actual text as Positive. This surfaces a real data quality issue: the categorical hint and the free-text content are telling different stories. These disagreements are flagged for AI contextual review.

### How ML Feeds AI

The ML enrichments are inputs to the AI reasoning layer, not standalone outputs. The AI prompt for each account includes anomaly status, cluster label, VADER scores, and disagreement flags. Claude can then incorporate patterns like "this account was flagged as anomalous by the Isolation Forest due to its unusual combination of high ARR and severely declining usage" into its reasoning narrative.

---

## AI Integration

The philosophy throughout: Claude synthesises, it does not compute. All math (scores, tiers, calibration, sensitivity analysis) is deterministic TypeScript. Claude's role is to produce natural language reasoning, recommended actions, and narrative explanations that a formula cannot.

### Account Analysis

For each account, Claude receives the full structured data, all five sub-scores, the calibrated priority score, ML enrichments, and the free-text notes. It returns:

- **Reasoning**: 2-3 sentences written for CEO-level consumption
- **3 Recommended Actions**: Each with a specific owner (pulled from account data), timeframe, and rationale
- **Risk and Opportunity Factors**: Specific to this account's signals
- **Confidence Level**: High, medium, or low based on data completeness
- **Optional Tier Adjustment**: If qualitative signals strongly override quantitative scoring

The prompt explicitly tells Claude that scores are pre-computed and should not be re-calculated. This prevents the well-known problem of LLMs producing incorrect arithmetic.

### Counterfactual Explanations

"What would need to change for this account to move up (or down) a tier?"

This combines deterministic sensitivity calculation with AI narrative:
1. The TypeScript code calculates the exact points needed to cross tier boundaries and identifies which sub-score is weakest (most room for improvement) and strongest (most buffer before decline)
2. Claude takes that sensitivity data and writes a metric-driven narrative, referencing specific values

If the AI call fails, a deterministic fallback generates the counterfactuals from the sensitivity data alone. No blank panels.

### Portfolio Insights

A single Claude call receives summary data for all 60 accounts: tier distribution, ARR by tier, top risks, top opportunities, owner-level statistics, and segment breakdowns. It returns:

- Portfolio-wide themes (3 strategic observations)
- Owner patterns (workload imbalances, risk concentration)
- Segment patterns (which segments are healthiest/riskiest)
- Urgent actions for leadership this week

### Caching

AI results are stored in the `ai_analyses` table, not regenerated on every page view. A "Re-analyse" button triggers a fresh Claude call on demand. Full batch analysis of 60 accounts costs approximately $0.50 in API usage.

---

## Handling Imperfect Data

The dataset has nulls across NPS, CSAT, QBR dates, note dates, customer notes, sales notes, and overdue amounts. The null handling strategy has three rules:

1. **Never silently impute.** A null NPS is not a 0, and it is not a 50. The scoring engine uses a midpoint value (e.g., 50 for NPS) with reduced weight. This avoids penalising accounts for missing data while also avoiding rewarding them.

2. **Track data completeness per account.** Eight key nullable fields are checked. The resulting percentage (0-100%) drives a confidence badge (High >= 88%, Medium >= 63%, Low < 63%) visible on every account card and detail page.

3. **Surface conflicts, do not hide them.** The VADER disagreement detection (11 accounts where text sentiment contradicts the categorical hint) is shown explicitly. Contradiction detection identifies 5 types of conflicting signals within a single account:
   - Positive NPS (>30) with declining usage (trend < -10)
   - Large expansion pipeline (>15% ARR) with poor support health (score < 40)
   - Growing MRR (>+3%) with low seat utilisation (<50%)
   - Negative sentiment with high engagement score (>70)
   - High CSAT (>4.0) with multiple SLA breaches (>=3)

These contradictions are displayed in the account detail view and fed to the AI layer, where Claude can reason about what the conflicting signals might mean.

---

## UX Decisions

The dashboard is designed for PE portfolio leadership: people who need to scan 60 accounts quickly, identify the 5-10 that need action this week, and drill into any one of them for context.

**Dashboard** (`/dashboard`):
- Summary cards: ARR at risk, expansion pipeline, accounts needing attention, upcoming renewals (90 days)
- Renewal timeline showing upcoming renewal dates across the portfolio
- AI accuracy tracker showing how AI recommendations are performing based on user feedback
- AI portfolio insights (collapsible, 3-4 strategic bullets)
- Filterable priority table sorted by calibrated score, with tier badges, type labels, signal summaries, and data confidence indicators
- Filters via URL search params, so filtered views are shareable as links

**Account Detail** (`/accounts/[id]`):
- Waterfall chart: the single most important visual. Shows how each sub-score contributes to the final priority score, making the "why" immediately visible without reading any numbers
- Metrics grid with trend arrows (up/down/flat)
- AI reasoning panel with recommended actions (owner, timeframe, rationale per action)
- Counterfactual panel: "what would need to change" for tier movement
- Contradictions panel when conflicting signals exist
- Notes display with VADER sentiment comparison when disagreement is detected
- Action recorder with a mandatory AI accuracy rating (1-5 stars). This creates a feedback loop: every time someone acts on an AI recommendation, they rate whether the recommendation was useful. Over time, this produces data on AI recommendation quality.

**Design choices**:
- Consistent tier colour coding throughout (red = Critical, orange = High, yellow = Medium, blue = Low, grey = Monitor)
- Information-dense by default; the audience is not casual users, they are portfolio operators

---

## Trade-Offs

### 1. Deterministic + AI hybrid vs. pure AI scoring
Chose deterministic scoring for the numbers, AI for the reasoning. A pure AI scoring approach (send all data to Claude, ask it to output a score) would be faster to build but impossible to audit. When a portfolio director asks "why is this account Critical?", the answer needs to trace to specific formulas and thresholds, not "the AI said so." The cost is added system complexity and a longer build.

### 2. Fixed weights vs. user-configurable
Weights are hardcoded in `lib/scoring/weights.ts`. This is an opinionated product decision: configurable weights add UI complexity and invite endless tuning without clear improvement. The validation shows rankings are stable across weight variations (Kendall's tau 0.91-0.97), so the exact weight values matter less than getting the structure right. Configurable weights would be a natural v2 feature.

### 3. Pre-computed AI analysis vs. real-time
AI results are generated in batch and cached. Real-time analysis (calling Claude on every page view) would ensure freshness but costs ~$0.50 per batch, adds 2-3 seconds of latency per account, and risks rate limiting during demo walkthroughs. The "Re-analyse" button handles the staleness trade-off.

### 4. Unsupervised ML only vs. supervised
The dataset has no outcome labels (no churn flag, no expansion event, no "did this account renew"). Without outcomes, supervised learning requires fabricating a target variable, which I refused to do. Unsupervised methods (anomaly detection, clustering, sentiment) add genuine value without pretending to predict outcomes we cannot measure. Supervised models are the obvious next step once outcome data exists.

### 5. Min-max calibration vs. percentile tiers
Min-max is simpler and produces more intuitive scores (0 = lowest risk in portfolio, 100 = highest). The downside: it is sensitive to outliers. If one account has an extreme score, it compresses the rest. For 60 accounts this is manageable; for 600, percentile-based tiers would be more robust.

### 6. Tier floors for priority types
Priority types with tier floors (churn_risk, renewal_urgent, expansion_opportunity all floored at High) intentionally distort the score-based distribution. This means the tier distribution skews heavier toward Critical/High than pure score bucketing would produce. The trade-off is correct: a £400K account with 34% contraction risk should not sit in "Medium" because its usage score happens to be decent.

### 7. Sequential AI analysis vs. parallel
Account analyses run sequentially (one API call at a time) rather than in parallel batches. This is simpler to implement, easier to debug, and avoids rate limit issues with the Claude API. The trade-off is speed: 60 sequential calls take longer than 6 batches of 10. For a 60-account portfolio analysed once, this is acceptable.

### 8. VADER + hand labels vs. LLM-only sentiment
VADER is fast, free, and deterministic. The real value is not the sentiment score itself but the disagreement detection: finding accounts where VADER and the hand-labelled hint disagree. An LLM-only approach would be more accurate per-note but would cost API calls for every note, remove determinism, and lose the disagreement signal.

### 9. Log-scaled ARR weighting vs. linear
Linear ARR weighting would make the £436K account dominate rankings regardless of other signals. Log scaling compresses the range: a £400K account gets a modest uplift (~1.15x) over the median, not a 3x multiplier. This keeps ARR as a tiebreaker rather than a ranking override.

### 10. Mandatory accuracy rating vs. optional
The action recorder requires a 1-5 star rating of AI accuracy before an action can be recorded. This adds friction. The trade-off is worth it: optional ratings get ignored (see: any "was this helpful?" prompt), and mandatory ratings create actual data on whether AI recommendations are useful. This is the kind of feedback loop that makes the tool improvable over time.

---

## Validation

An independent Python validation script (`scripts/validation.py`) replicates the scoring logic outside the TypeScript engine to verify consistency.

### Weight Sensitivity (Kendall's Tau)

Four weight configurations tested: baseline, revenue-heavy, engagement-heavy, urgency-heavy.

| Pair | Kendall's Tau |
|------|--------------|
| Baseline vs. Revenue-heavy | 0.941 |
| Baseline vs. Engagement-heavy | 0.958 |
| Baseline vs. Urgency-heavy | 0.971 |
| Revenue-heavy vs. Engagement-heavy | 0.929 |
| Revenue-heavy vs. Urgency-heavy | 0.912 |
| Engagement-heavy vs. Urgency-heavy | 0.951 |

All pairwise correlations are above 0.91, well above the 0.7 stability threshold. Account rankings remain highly stable regardless of weight configuration.

### Score Distribution

| Metric | Raw | Calibrated |
|--------|-----|------------|
| Min | 17.94 | 0.00 |
| Max | 70.56 | 100.00 |
| Mean | 39.77 | 41.49 |
| Std Dev | 13.49 | 25.63 |

Calibration nearly doubles the standard deviation, confirming it solves the clustering problem.

### Tier Distribution

| Tier | Count | % |
|------|-------|---|
| Critical | 11 | 18.3% |
| High | 18 | 30.0% |
| Medium | 10 | 16.7% |
| Low | 7 | 11.7% |
| Monitor | 14 | 23.3% |

The skew toward Critical/High is expected and intentional due to tier floors. 48.3% of accounts land in Critical or High, which reflects the business logic that churn risks, urgent renewals, and expansion opportunities all warrant elevated attention.

### Sanity Checks

| Check | Result |
|-------|--------|
| High-risk accounts (ACC-012, ACC-034) surface in top 5 | PASS |
| No declining-MRR accounts in bottom 5 | PASS |
| All high-contraction (>30%) accounts in Critical/High | PASS |
| Paused accounts score above portfolio median | FAIL (2 of 5 below; addressed by TypeScript engine refinements not replicated in Python validator) |

3/4 sanity checks pass. The one failure is a known gap between the simplified Python validator and the full TypeScript scoring pipeline.

### Top 5 Accounts by Priority Score

| Rank | Account | Name | Score | Tier | Type |
|------|---------|------|-------|------|------|
| 1 | ACC-034 | Pioneer Networks | 100.0 | Critical | churn_risk |
| 2 | ACC-012 | Nimbus People | 96.8 | Critical | churn_risk |
| 3 | ACC-007 | Northstar Retail | 76.1 | High | churn_risk |
| 4 | ACC-045 | BrightForge Systems | 75.6 | High | churn_risk |
| 5 | ACC-006 | Nimbus Logistics | 74.7 | Critical | churn_risk |

Pioneer Networks (ACC-034) scores highest: £107K ARR, renewal in 26 days, MRR declining 10.9%, usage dropped from 69 to 39, notes mention "confidence dropped." This is exactly the kind of account that should be at the top.

---

## What I Would Build Next

1. **Supervised ML once outcome data exists.** Train churn prediction and expansion probability models on actual renewal/churn/expansion events. The current unsupervised enrichments would become features in the supervised pipeline.
2. **Historical trend tracking.** Store score snapshots over time so leadership can see whether an account is improving or deteriorating, not just its current state.
3. **Configurable weights UI.** Let leadership adjust sub-score weights through a settings panel with live preview of how rankings shift. The validation already shows rankings are stable across reasonable weight ranges.
4. **CRM integration.** Pull live data from Salesforce or HubSpot instead of CSV import. Real-time sync would keep the prioritisation current.
5. **Scheduled re-analysis.** Weekly batch re-scoring and AI analysis, with email/Slack alerts when an account changes tier.
6. **Alert system.** Notify account owners when their accounts cross tier boundaries or trigger new contradictions.
7. **Multi-portfolio support.** Separate views per portfolio company, with aggregate reporting across the fund.
8. **Action workflow automation.** Connect recommended actions to calendar invites, task management, and CRM activity logging.

---

## Running Locally

### Prerequisites
- Node.js 18+
- Python 3.10+ (for ML pipeline only)
- Supabase project (URL + anon key + service role key)
- Anthropic API key

### Setup

```bash
# Clone and install
git clone <repo-url>
cd tenzing-account-prioritiser
npm install

# Environment variables
cp .env.local.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#          SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# Database setup (run migrations, then seed)
# Apply supabase/migrations/001_create_tables.sql via Supabase dashboard or CLI
# Then run the seed script to load CSV data

# ML enrichment (optional, one-time)
pip install -r scripts/requirements.txt
python scripts/ml_pipeline.py

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with the demo credentials above.

### Project Structure

```
tenzing-account-prioritiser/
├── app/                    # Next.js App Router pages + API routes
│   ├── dashboard/          # Main dashboard page
│   ├── accounts/[id]/      # Account detail page
│   ├── login/              # Auth page
│   └── api/                # analyse, analyse-all, actions, portfolio-insights
├── components/
│   ├── dashboard/          # Portfolio summary, priority list, filters, AI insights,
│   │                         accuracy tracker, renewal timeline
│   ├── account/            # AI reasoning, actions, waterfall, metrics, contradictions,
│   │                         counterfactuals, notes, action recorder
│   └── ui/                 # shadcn/ui base components + custom badges
├── lib/
│   ├── scoring/            # engine.ts, signals.ts, weights.ts, calibration.ts,
│   │                         contradictions.ts, types.ts
│   ├── ai/                 # client.ts, prompts.ts, analyse-account.ts,
│   │                         batch-analyse.ts, counterfactuals.ts, portfolio-insights.ts
│   ├── supabase/           # client.ts, server.ts, middleware.ts
│   └── utils/              # null-handling.ts, arr-weighting.ts, format.ts
├── scripts/                # ml_pipeline.py, validation.py, seed_data.py
└── supabase/               # Migrations and seed SQL
```
