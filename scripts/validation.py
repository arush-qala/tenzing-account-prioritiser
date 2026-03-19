"""
validation.py
Validation script for the scoring model's robustness.

Three checks:
  A) Weight Sensitivity   -- Kendall's tau rank stability across weight scenarios
  B) Calibration Check    -- Score distribution analysis and tier balance
  C) Sanity Checks        -- Known accounts rank where expected

Replicates the deterministic scoring logic from the TypeScript engine in Python
to validate the model independently.

Usage:
    source C:/Users/arush/.tenzing-venv/Scripts/activate
    python scripts/validation.py

Output: console report + scripts/output/validation_summary.txt
"""

import os
import math
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from scipy.stats import kendalltau

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "scripts" / "data" / "account_prioritisation_challenge_data.csv"
OUTPUT_DIR = PROJECT_ROOT / "scripts" / "output"
OUTPUT_FILE = OUTPUT_DIR / "validation_summary.txt"

# Reference date matching the TypeScript engine
REFERENCE_DATE = date(2026, 3, 17)


# ---------------------------------------------------------------------------
# Data loading and derived fields
# ---------------------------------------------------------------------------

def load_data() -> pd.DataFrame:
    """Load CSV and compute all derived fields needed for scoring."""
    df = pd.read_csv(CSV_PATH)

    # Parse date columns
    date_cols = [
        "contract_start_date", "renewal_date", "last_lead_activity_date",
        "last_qbr_date", "latest_note_date",
    ]
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # mrr_trend_pct
    df["mrr_trend_pct"] = np.where(
        (df["mrr_3m_ago_gbp"].notna()) & (df["mrr_3m_ago_gbp"] != 0),
        (df["mrr_current_gbp"] - df["mrr_3m_ago_gbp"]) / df["mrr_3m_ago_gbp"] * 100,
        0.0,
    )

    # seat_utilisation_pct (0-1 range)
    df["seat_utilisation_pct"] = np.where(
        (df["seats_purchased"].notna()) & (df["seats_purchased"] > 0),
        df["seats_used"] / df["seats_purchased"],
        0.0,
    )

    # usage_trend
    df["usage_trend"] = df["usage_score_current"] - df["usage_score_3m_ago"]

    # days_to_renewal
    ref = pd.Timestamp(REFERENCE_DATE)
    df["days_to_renewal"] = df["renewal_date"].apply(
        lambda x: (x - ref).days if pd.notna(x) else 999
    )

    return df


# ---------------------------------------------------------------------------
# Signal scoring functions (Python port of signals.ts)
# ---------------------------------------------------------------------------

def _days_since(date_val) -> Optional[int]:
    """Days between REFERENCE_DATE and a date value. Positive = past."""
    if pd.isna(date_val):
        return None
    if isinstance(date_val, pd.Timestamp):
        d = date_val.date()
    elif isinstance(date_val, datetime):
        d = date_val.date()
    elif isinstance(date_val, date):
        d = date_val
    else:
        return None
    return (REFERENCE_DATE - d).days


# --- Revenue Health Signals ---

def score_mrr_trend(row: pd.Series) -> float:
    pct = row["mrr_trend_pct"]
    if pct >= 5:
        return 95
    if pct >= 2:
        return 80
    if pct >= -2:
        return 55
    if pct >= -5:
        return 30
    return 10


def score_contraction_risk(row: pd.Series) -> float:
    arr = row["arr_gbp"]
    if arr <= 0:
        return 50
    ratio = (row["contraction_risk_gbp"] / arr) * 100
    if ratio < 5:
        return 90
    if ratio < 15:
        return 60
    if ratio < 30:
        return 30
    return 10


def score_overdue(row: pd.Series) -> float:
    overdue = row.get("overdue_amount_gbp")
    if pd.isna(overdue):
        return 85
    if overdue == 0:
        return 85
    monthly = row["arr_gbp"] / 12
    if monthly <= 0:
        return 50
    ratio = (overdue / monthly) * 100
    if ratio < 50:
        return 70
    if ratio <= 100:
        return 45
    return 15


# --- Engagement Signals ---

def score_usage_current(row: pd.Series) -> float:
    return float(row["usage_score_current"])


def score_usage_trend(row: pd.Series) -> float:
    change = row["usage_trend"]
    if change >= 15:
        return 95
    if change >= 5:
        return 75
    if change >= -5:
        return 50
    if change >= -15:
        return 25
    return 10


def score_seat_util(row: pd.Series) -> float:
    pct = row["seat_utilisation_pct"] * 100
    if pct > 85:
        return 95
    if pct >= 70:
        return 75
    if pct >= 50:
        return 45
    return 15


def score_nps(row: pd.Series) -> float:
    nps = row.get("latest_nps")
    if pd.isna(nps):
        return 50
    if nps > 50:
        return 95
    if nps >= 20:
        return 70
    if nps >= 0:
        return 40
    return 15


# --- Support Health Signals ---

def score_urgent_tickets(row: pd.Series) -> float:
    count = int(row["urgent_open_tickets_count"])
    if count == 0:
        return 100
    if count == 1:
        return 60
    if count == 2:
        return 30
    return 10


def score_sla_breach(row: pd.Series) -> float:
    count = int(row["sla_breaches_90d"])
    if count == 0:
        return 100
    if count == 1:
        return 70
    if count <= 3:
        return 40
    return 10


def score_csat(row: pd.Series) -> float:
    csat = row.get("avg_csat_90d")
    if pd.isna(csat):
        return 50
    if csat > 4.5:
        return 95
    if csat >= 4.0:
        return 75
    if csat >= 3.5:
        return 50
    if csat >= 3.0:
        return 25
    return 10


def score_ticket_volume(row: pd.Series) -> float:
    count = int(row["open_tickets_count"])
    segment = row["segment"]

    if segment == "Enterprise":
        if count <= 2:
            return 90
        if count <= 4:
            return 60
        if count <= 6:
            return 35
        return 15

    if segment == "Mid-Market":
        if count <= 1:
            return 90
        if count <= 3:
            return 60
        if count <= 5:
            return 35
        return 15

    # SMB
    if count == 0:
        return 90
    if count == 1:
        return 60
    if count <= 3:
        return 35
    return 15


# --- Opportunity Signals ---

def score_pipeline(row: pd.Series) -> float:
    arr = row["arr_gbp"]
    if arr <= 0:
        return 10
    ratio = (row["expansion_pipeline_gbp"] / arr) * 100
    if ratio > 25:
        return 95
    if ratio >= 15:
        return 75
    if ratio >= 5:
        return 50
    if ratio >= 1:
        return 30
    return 10


def score_lifecycle(row: pd.Series) -> float:
    stage = row["lifecycle_stage"]
    if stage == "Expansion":
        return 85
    if stage == "Renewal":
        return 50
    return 40  # Customer or default


def score_lead_activity(row: pd.Series) -> float:
    leads = int(row["open_leads_count"])
    if leads == 0:
        return 20

    avg_score = row.get("avg_lead_score")
    last_activity = row.get("last_lead_activity_date")

    # Check recency
    is_recent = False
    if pd.notna(last_activity):
        days_ago = _days_since(last_activity)
        if days_ago is not None and days_ago < 14:
            is_recent = True

    if pd.notna(avg_score) and avg_score > 70 and is_recent:
        return 90
    if pd.notna(avg_score) and avg_score > 50:
        return 65
    return 40


# --- Urgency Signals ---

def score_renewal_urgency(row: pd.Series) -> float:
    if row["lifecycle_stage"] != "Renewal":
        return 20
    days = row["days_to_renewal"]
    if days < 30:
        return 100
    if days < 60:
        return 80
    if days < 90:
        return 60
    if days < 180:
        return 40
    return 20


def score_qbr_recency(row: pd.Series) -> float:
    qbr_date = row.get("last_qbr_date")
    if pd.isna(qbr_date):
        return 80
    days = _days_since(qbr_date)
    if days is None:
        return 80
    if days < 45:
        return 20
    if days < 90:
        return 40
    if days < 180:
        return 70
    return 90


def score_note_recency(row: pd.Series) -> float:
    note_date = row.get("latest_note_date")
    if pd.isna(note_date):
        return 80
    days = _days_since(note_date)
    if days is None:
        return 80
    if days < 14:
        return 20
    if days < 30:
        return 40
    if days < 60:
        return 65
    return 85


def score_paused_status(row: pd.Series) -> float:
    return 90 if row["account_status"] == "Paused" else 20


# ---------------------------------------------------------------------------
# Composite scoring with configurable weights
# ---------------------------------------------------------------------------

# Default internal signal weights (matching weights.ts)
REVENUE_W = {"mrr_trend": 0.45, "contraction": 0.30, "overdue": 0.25}
ENGAGEMENT_W = {"usage_current": 0.30, "usage_trend": 0.25, "seat_util": 0.25, "nps": 0.20}
SUPPORT_W = {"urgent": 0.30, "sla": 0.30, "csat": 0.25, "volume": 0.15}
OPPORTUNITY_W = {"pipeline": 0.50, "lifecycle": 0.25, "leads": 0.25}
URGENCY_W = {"renewal": 0.40, "qbr": 0.25, "notes": 0.20, "paused": 0.15}

# Default health composite weights (first 4 sub-scores, sum to 1.0)
DEFAULT_HEALTH_W = {"revenue": 0.29, "engagement": 0.29, "support": 0.18, "opportunity": 0.24}

# Default priority mix
PRIORITY_MIX = {"health": 0.6, "urgency": 0.4}


def compute_sub_scores(row: pd.Series) -> dict:
    """Compute all 5 sub-scores for a single row."""
    revenue = (
        REVENUE_W["mrr_trend"] * score_mrr_trend(row)
        + REVENUE_W["contraction"] * score_contraction_risk(row)
        + REVENUE_W["overdue"] * score_overdue(row)
    )

    engagement = (
        ENGAGEMENT_W["usage_current"] * score_usage_current(row)
        + ENGAGEMENT_W["usage_trend"] * score_usage_trend(row)
        + ENGAGEMENT_W["seat_util"] * score_seat_util(row)
        + ENGAGEMENT_W["nps"] * score_nps(row)
    )

    support = (
        SUPPORT_W["urgent"] * score_urgent_tickets(row)
        + SUPPORT_W["sla"] * score_sla_breach(row)
        + SUPPORT_W["csat"] * score_csat(row)
        + SUPPORT_W["volume"] * score_ticket_volume(row)
    )

    opportunity = (
        OPPORTUNITY_W["pipeline"] * score_pipeline(row)
        + OPPORTUNITY_W["lifecycle"] * score_lifecycle(row)
        + OPPORTUNITY_W["leads"] * score_lead_activity(row)
    )

    urgency = (
        URGENCY_W["renewal"] * score_renewal_urgency(row)
        + URGENCY_W["qbr"] * score_qbr_recency(row)
        + URGENCY_W["notes"] * score_note_recency(row)
        + URGENCY_W["paused"] * score_paused_status(row)
    )

    return {
        "revenue": round(revenue, 2),
        "engagement": round(engagement, 2),
        "support": round(support, 2),
        "opportunity": round(opportunity, 2),
        "urgency": round(urgency, 2),
    }


def compute_priority_score(
    sub_scores: dict,
    sub_score_weights: tuple[float, float, float, float, float],
) -> float:
    """
    Compute the final priority score using configurable top-level weights.

    sub_score_weights = (revenue_w, engagement_w, support_w, opportunity_w, urgency_w)

    The first 4 weights define the health composite blend. The 5th weight is not
    used directly in the health composite because urgency feeds separately into
    the priority formula. Instead, we rescale the first 4 to sum to 1.0 for
    the health composite, then use the standard priority mix formula.
    """
    w_rev, w_eng, w_sup, w_opp, w_urg = sub_score_weights

    # Rescale first 4 weights to sum to 1.0 for health composite
    health_total = w_rev + w_eng + w_sup + w_opp
    if health_total == 0:
        health_total = 1.0  # safety

    h_rev = w_rev / health_total
    h_eng = w_eng / health_total
    h_sup = w_sup / health_total
    h_opp = w_opp / health_total

    health = (
        h_rev * sub_scores["revenue"]
        + h_eng * sub_scores["engagement"]
        + h_sup * sub_scores["support"]
        + h_opp * sub_scores["opportunity"]
    )

    # Priority = inverted health + urgency
    priority = (100 - health) * PRIORITY_MIX["health"] + sub_scores["urgency"] * PRIORITY_MIX["urgency"]
    return round(priority, 2)


def score_all_accounts(
    df: pd.DataFrame,
    weights: tuple[float, float, float, float, float] = (0.25, 0.25, 0.15, 0.20, 0.15),
) -> pd.DataFrame:
    """Score all accounts and return a DataFrame with scores added."""
    scores_list = []
    for _, row in df.iterrows():
        sub = compute_sub_scores(row)
        priority = compute_priority_score(sub, weights)
        scores_list.append({
            "account_id": row["account_id"],
            "account_name": row["account_name"],
            "sub_revenue": sub["revenue"],
            "sub_engagement": sub["engagement"],
            "sub_support": sub["support"],
            "sub_opportunity": sub["opportunity"],
            "sub_urgency": sub["urgency"],
            "priority_score": priority,
        })

    result = pd.DataFrame(scores_list)
    # Merge back key columns for sanity checks
    merge_cols = [
        "account_id", "arr_gbp", "mrr_trend_pct", "contraction_risk_gbp",
        "note_sentiment_hint", "lifecycle_stage", "days_to_renewal",
        "account_status", "seat_utilisation_pct", "usage_score_current",
        "usage_trend",
    ]
    result = result.merge(df[merge_cols], on="account_id", how="left")
    return result


def assign_tier(score: float) -> str:
    """Assign priority tier from raw score."""
    if score >= 80:
        return "Critical"
    if score >= 65:
        return "High"
    if score >= 50:
        return "Medium"
    if score >= 35:
        return "Low"
    return "Monitor"


def calibrate_scores(scores: pd.Series) -> pd.Series:
    """Apply min-max calibration to stretch scores to 0-100 range."""
    smin = scores.min()
    smax = scores.max()
    if smax == smin:
        return pd.Series([50.0] * len(scores))
    return ((scores - smin) / (smax - smin)) * 100


# ---------------------------------------------------------------------------
# Validation A: Weight Sensitivity (Kendall's tau)
# ---------------------------------------------------------------------------

WEIGHT_SCENARIOS = {
    "Baseline":          (0.25, 0.25, 0.15, 0.20, 0.15),
    "Revenue-heavy":     (0.40, 0.20, 0.10, 0.15, 0.15),
    "Engagement-heavy":  (0.20, 0.40, 0.10, 0.15, 0.15),
    "Urgency-heavy":     (0.15, 0.20, 0.15, 0.15, 0.35),
}


def validate_weight_sensitivity(df: pd.DataFrame) -> list[str]:
    """Run 4 weight scenarios and compute Kendall's tau between all pairs."""
    lines = []
    lines.append("=" * 70)
    lines.append("VALIDATION A: Weight Sensitivity (Kendall's tau)")
    lines.append("=" * 70)
    lines.append("")

    # Compute rankings for each scenario
    rankings = {}
    for name, weights in WEIGHT_SCENARIOS.items():
        result = score_all_accounts(df, weights)
        # Use calibrated scores for ranking
        result["calibrated"] = calibrate_scores(result["priority_score"])
        result = result.sort_values("calibrated", ascending=False).reset_index(drop=True)
        result["rank"] = range(1, len(result) + 1)
        rankings[name] = result.set_index("account_id")["rank"]

        lines.append(f"  {name}: weights={weights}")
        top5 = result.head(5)
        for _, r in top5.iterrows():
            lines.append(f"    #{int(r['rank']):>2d}  {r['account_id']}  score={r['calibrated']:.1f}")
        lines.append("")

    # Compute tau correlation matrix
    scenario_names = list(WEIGHT_SCENARIOS.keys())
    n = len(scenario_names)
    tau_matrix = np.ones((n, n))

    lines.append("Kendall's tau correlation matrix:")
    lines.append(f"{'':>20s}  " + "  ".join(f"{s:>16s}" for s in scenario_names))

    all_pass = True
    for i in range(n):
        row_str = f"{scenario_names[i]:>20s}  "
        for j in range(n):
            if i == j:
                tau_matrix[i][j] = 1.0
                row_str += f"{'1.000':>16s}  "
            else:
                # Align by account_id
                ids = rankings[scenario_names[i]].index.intersection(
                    rankings[scenario_names[j]].index
                )
                r1 = rankings[scenario_names[i]].loc[ids]
                r2 = rankings[scenario_names[j]].loc[ids]
                tau, _pval = kendalltau(r1, r2)
                tau_matrix[i][j] = tau
                flag = " *" if tau < 0.7 else ""
                if tau < 0.7:
                    all_pass = False
                row_str += f"{tau:>14.3f}{flag:>2s}  "
        lines.append(row_str)

    lines.append("")
    if all_pass:
        lines.append("RESULT: PASS -- All tau values >= 0.7 (good rank stability)")
    else:
        lines.append("RESULT: WARNING -- Some tau values < 0.7 (rankings may be weight-sensitive)")
    lines.append("")

    return lines


# ---------------------------------------------------------------------------
# Validation B: Calibration Distribution Check
# ---------------------------------------------------------------------------

TARGET_DISTRIBUTION = {
    "Critical": 10,
    "High": 20,
    "Medium": 35,
    "Low": 25,
    "Monitor": 10,
}


def validate_calibration(df: pd.DataFrame) -> list[str]:
    """Check score distribution and tier balance."""
    lines = []
    lines.append("=" * 70)
    lines.append("VALIDATION B: Calibration Distribution Check")
    lines.append("=" * 70)
    lines.append("")

    result = score_all_accounts(df)
    raw_scores = result["priority_score"]
    calibrated = calibrate_scores(raw_scores)

    # Raw score statistics
    lines.append("Raw priority scores:")
    lines.append(f"  Min:    {raw_scores.min():.2f}")
    lines.append(f"  Max:    {raw_scores.max():.2f}")
    lines.append(f"  Mean:   {raw_scores.mean():.2f}")
    lines.append(f"  Std:    {raw_scores.std():.2f}")
    lines.append(f"  Q25:    {raw_scores.quantile(0.25):.2f}")
    lines.append(f"  Q50:    {raw_scores.quantile(0.50):.2f}")
    lines.append(f"  Q75:    {raw_scores.quantile(0.75):.2f}")
    lines.append("")

    # Calibrated score statistics
    lines.append("Calibrated scores (min-max normalised to 0-100):")
    lines.append(f"  Min:    {calibrated.min():.2f}")
    lines.append(f"  Max:    {calibrated.max():.2f}")
    lines.append(f"  Mean:   {calibrated.mean():.2f}")
    lines.append(f"  Std:    {calibrated.std():.2f}")
    lines.append("")

    # Check for tight clustering
    if raw_scores.std() < 10:
        lines.append("WARNING: Raw score std < 10 -- scores may cluster too tightly")
    else:
        lines.append("OK: Raw score std >= 10 -- reasonable spread")
    lines.append("")

    # Tier distribution (using calibrated scores)
    result["calibrated"] = calibrated
    result["tier"] = result["calibrated"].apply(assign_tier)

    tier_counts = result["tier"].value_counts()
    total = len(result)

    lines.append("Tier distribution (calibrated):")
    lines.append(f"{'Tier':>10s}  {'Count':>5s}  {'Actual %':>8s}  {'Target %':>8s}  {'Status':>8s}")
    lines.append("-" * 50)

    for tier in ["Critical", "High", "Medium", "Low", "Monitor"]:
        count = tier_counts.get(tier, 0)
        actual_pct = count / total * 100
        target_pct = TARGET_DISTRIBUTION[tier]
        deviation = abs(actual_pct - target_pct)
        status = "OK" if deviation <= 15 else "WARN"
        lines.append(
            f"{tier:>10s}  {count:>5d}  {actual_pct:>7.1f}%  {target_pct:>7.1f}%  {status:>8s}"
        )

    lines.append("")
    return lines


# ---------------------------------------------------------------------------
# Validation C: Sanity Checks
# ---------------------------------------------------------------------------

def validate_sanity(df: pd.DataFrame) -> list[str]:
    """Run specific sanity checks against known expected outcomes."""
    lines = []
    lines.append("=" * 70)
    lines.append("VALIDATION C: Sanity Checks")
    lines.append("=" * 70)
    lines.append("")

    result = score_all_accounts(df)
    result["calibrated"] = calibrate_scores(result["priority_score"])
    result = result.sort_values("calibrated", ascending=False).reset_index(drop=True)
    result["rank"] = range(1, len(result) + 1)
    result["tier"] = result["calibrated"].apply(assign_tier)

    checks_passed = 0
    checks_total = 0

    # Check 1: Top 5 should include ACC-012, ACC-034, ACC-019
    lines.append("Check 1: Top 5 accounts should include ACC-012, ACC-034, ACC-019")
    top5_ids = set(result.head(5)["account_id"].tolist())
    expected_top = {"ACC-012", "ACC-034", "ACC-019"}
    found_in_top5 = expected_top.intersection(top5_ids)
    missing_from_top5 = expected_top - top5_ids

    lines.append(f"  Top 5: {', '.join(result.head(5)['account_id'].tolist())}")
    lines.append(f"  Found in top 5: {', '.join(sorted(found_in_top5)) if found_in_top5 else 'NONE'}")
    if missing_from_top5:
        # Check their actual rank
        for acc_id in sorted(missing_from_top5):
            acc_row = result[result["account_id"] == acc_id]
            if len(acc_row) > 0:
                rank = int(acc_row.iloc[0]["rank"])
                score = acc_row.iloc[0]["calibrated"]
                lines.append(f"  MISS: {acc_id} ranked #{rank} (score={score:.1f})")

    checks_total += 1
    if len(found_in_top5) >= 2:
        lines.append("  RESULT: PASS (at least 2 of 3 in top 5)")
        checks_passed += 1
    else:
        lines.append("  RESULT: FAIL")
    lines.append("")

    # Check 2: Bottom 5 should NOT include any with negative MRR trend
    lines.append("Check 2: Bottom 5 should NOT include accounts with negative MRR trend")
    bottom5 = result.tail(5)
    bottom5_neg_mrr = bottom5[bottom5["mrr_trend_pct"] < 0]

    lines.append(f"  Bottom 5: {', '.join(bottom5['account_id'].tolist())}")
    checks_total += 1
    if len(bottom5_neg_mrr) == 0:
        lines.append("  RESULT: PASS (no negative MRR trend in bottom 5)")
        checks_passed += 1
    else:
        for _, r in bottom5_neg_mrr.iterrows():
            lines.append(
                f"  FAIL: {r['account_id']} has MRR trend {r['mrr_trend_pct']:.1f}% "
                f"but is in bottom 5 (rank #{int(r['rank'])})"
            )
        lines.append("  RESULT: FAIL")
    lines.append("")

    # Check 3: Accounts with contraction_risk > 30% ARR should be Critical or High
    lines.append("Check 3: Accounts with contraction > 30% ARR should be Critical or High tier")
    high_contraction = result[
        (result["arr_gbp"] > 0)
        & ((result["contraction_risk_gbp"] / result["arr_gbp"]) * 100 > 30)
    ].copy()

    checks_total += 1
    if len(high_contraction) == 0:
        lines.append("  No accounts with contraction > 30% ARR found")
        lines.append("  RESULT: PASS (vacuously true)")
        checks_passed += 1
    else:
        bad_tier = high_contraction[~high_contraction["tier"].isin(["Critical", "High"])]
        lines.append(f"  Accounts with >30% contraction: {len(high_contraction)}")
        for _, r in high_contraction.iterrows():
            ratio = (r["contraction_risk_gbp"] / r["arr_gbp"]) * 100
            status = "OK" if r["tier"] in ("Critical", "High") else "FAIL"
            lines.append(
                f"    {r['account_id']} contraction={ratio:.0f}% tier={r['tier']} [{status}]"
            )
        if len(bad_tier) == 0:
            lines.append("  RESULT: PASS")
            checks_passed += 1
        else:
            lines.append(f"  RESULT: FAIL ({len(bad_tier)} accounts in wrong tier)")
    lines.append("")

    # Check 4: All 5 paused accounts should score above median
    lines.append("Check 4: All paused accounts should score above median")
    median_score = result["calibrated"].median()
    paused = result[result["account_status"] == "Paused"]

    checks_total += 1
    if len(paused) == 0:
        lines.append("  No paused accounts found")
        lines.append("  RESULT: SKIP")
    else:
        below_median = paused[paused["calibrated"] < median_score]
        lines.append(f"  Paused accounts: {len(paused)}, median score: {median_score:.1f}")
        for _, r in paused.iterrows():
            status = "OK" if r["calibrated"] >= median_score else "BELOW"
            lines.append(
                f"    {r['account_id']} score={r['calibrated']:.1f} [{status}]"
            )
        if len(below_median) == 0:
            lines.append("  RESULT: PASS")
            checks_passed += 1
        else:
            lines.append(f"  RESULT: FAIL ({len(below_median)} paused accounts below median)")
    lines.append("")

    # Summary
    lines.append(f"Sanity checks: {checks_passed}/{checks_total} passed")
    lines.append("")

    return lines


# ---------------------------------------------------------------------------
# Full validation report
# ---------------------------------------------------------------------------

def run_validation():
    """Execute all validation checks and write report."""
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading data...")
    df = load_data()
    print(f"Loaded {len(df)} accounts\n")

    report_lines = []
    report_lines.append("=" * 70)
    report_lines.append("SCORING MODEL VALIDATION REPORT")
    report_lines.append(f"Date: {REFERENCE_DATE}")
    report_lines.append(f"Accounts: {len(df)}")
    report_lines.append("=" * 70)
    report_lines.append("")

    # Run all validations
    report_lines.extend(validate_weight_sensitivity(df))
    report_lines.extend(validate_calibration(df))
    report_lines.extend(validate_sanity(df))

    # Final summary
    report_lines.append("=" * 70)
    report_lines.append("END OF VALIDATION REPORT")
    report_lines.append("=" * 70)

    # Print to console
    report_text = "\n".join(report_lines)
    print(report_text)

    # Save to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"\nReport saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    run_validation()
