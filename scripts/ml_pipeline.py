"""
ml_pipeline.py
ML enrichment pipeline for the Account Prioritisation Tool.

Three unsupervised models:
  A) Isolation Forest  -- anomaly detection on financial/usage/support signals
  B) K-Means (k=5)     -- cluster accounts into behavioural segments
  C) VADER Sentiment   -- sentiment scoring on free-text note columns

After computing, updates the Supabase `accounts` table with the ML columns.

Usage:
    source C:/Users/arush/.tenzing-venv/Scripts/activate
    python scripts/ml_pipeline.py
"""

import os
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from dotenv import load_dotenv
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "scripts" / "data" / "account_prioritisation_challenge_data.csv"
ENV_PATH = PROJECT_ROOT / ".env.local"

# Load environment variables
load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


# ---------------------------------------------------------------------------
# Step 0: Load CSV and compute derived fields
# ---------------------------------------------------------------------------

def load_data() -> pd.DataFrame:
    """Read the CSV and compute derived fields needed by ML models."""
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} accounts, {len(df.columns)} columns")

    # Compute mrr_trend_pct
    df["mrr_trend_pct"] = np.where(
        (df["mrr_3m_ago_gbp"].notna()) & (df["mrr_3m_ago_gbp"] != 0),
        (df["mrr_current_gbp"] - df["mrr_3m_ago_gbp"]) / df["mrr_3m_ago_gbp"] * 100,
        np.nan,
    )

    # Compute seat_utilisation_pct (0-1 range)
    df["seat_utilisation_pct"] = np.where(
        (df["seats_purchased"].notna()) & (df["seats_purchased"] > 0),
        df["seats_used"] / df["seats_purchased"],
        np.nan,
    )

    return df


# ---------------------------------------------------------------------------
# Model A: Isolation Forest (anomaly detection)
# ---------------------------------------------------------------------------

ISOLATION_FEATURES = [
    "arr_gbp",
    "mrr_trend_pct",
    "seat_utilisation_pct",
    "usage_score_current",
    "open_tickets_count",
    "urgent_open_tickets_count",
    "sla_breaches_90d",
    "contraction_risk_gbp",
]


def run_isolation_forest(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fit Isolation Forest and add is_anomaly + anomaly_score columns.
    contamination=0.08 expects ~5 anomalies out of 60 accounts.
    """
    print("\n" + "=" * 60)
    print("MODEL A: Isolation Forest (Anomaly Detection)")
    print("=" * 60)

    # Prepare feature matrix, fill nulls with median
    X = df[ISOLATION_FEATURES].copy()
    for col in ISOLATION_FEATURES:
        median_val = X[col].median()
        X[col] = X[col].fillna(median_val)

    # Fit model
    model = IsolationForest(
        contamination=0.08,
        random_state=42,
        n_estimators=100,
    )
    model.fit(X)

    # Predictions: -1 = anomaly, 1 = normal
    predictions = model.predict(X)
    # Raw anomaly score from decision_function (lower = more anomalous)
    scores = model.decision_function(X)

    df["is_anomaly"] = (predictions == -1).astype(int)
    df["anomaly_score"] = np.round(scores, 6)

    # Report
    anomalies = df[df["is_anomaly"] == 1]
    print(f"\nAnomalies detected: {len(anomalies)} / {len(df)}")
    if len(anomalies) > 0:
        print("\nFlagged accounts:")
        for _, row in anomalies.iterrows():
            print(
                f"  {row['account_id']} {row['account_name']:<25s} "
                f"ARR={row['arr_gbp']:>10,.0f}  "
                f"MRR_trend={row['mrr_trend_pct']:>+6.1f}%  "
                f"score={row['anomaly_score']:.4f}"
            )

    return df


# ---------------------------------------------------------------------------
# Model B: K-Means Clustering (k=5)
# ---------------------------------------------------------------------------

KMEANS_FEATURES = ISOLATION_FEATURES + [
    "expansion_pipeline_gbp",
    "latest_nps",
]

# Candidate labels ordered by archetype pattern
LABEL_CANDIDATES = [
    "High-Value Growth",
    "At-Risk Enterprise",
    "Stable Mid-Market",
    "Low-Engagement SMB",
    "Expansion Ready",
]


def _auto_label_clusters(
    centroids: np.ndarray,
    feature_names: list[str],
    scaler: StandardScaler,
) -> list[str]:
    """
    Assign human-readable labels by examining standardised centroid values.
    Strategy: for each cluster, find which features are most extreme and
    match to a predefined label archetype.
    """
    n_clusters = centroids.shape[0]

    # Get the original-scale centroids for interpretability
    original_centroids = scaler.inverse_transform(centroids)
    centroid_df = pd.DataFrame(original_centroids, columns=feature_names)

    labels = [""] * n_clusters
    used_labels = set()

    # Score each cluster against each archetype and greedily assign
    # Build a scoring matrix: (n_clusters x n_labels)
    scoring_matrix = np.zeros((n_clusters, len(LABEL_CANDIDATES)))

    for i in range(n_clusters):
        c = centroid_df.iloc[i]

        # High-Value Growth: high ARR, positive MRR trend, high expansion pipeline
        scoring_matrix[i, 0] = (
            _rank_val(c["arr_gbp"], centroid_df["arr_gbp"])
            + _rank_val(c["mrr_trend_pct"], centroid_df["mrr_trend_pct"])
            + _rank_val(c["expansion_pipeline_gbp"], centroid_df["expansion_pipeline_gbp"])
        )

        # At-Risk Enterprise: high ARR but poor signals (high contraction, low usage, SLA breaches)
        scoring_matrix[i, 1] = (
            _rank_val(c["arr_gbp"], centroid_df["arr_gbp"])
            + _rank_val(c["contraction_risk_gbp"], centroid_df["contraction_risk_gbp"])
            + _rank_val(c["sla_breaches_90d"], centroid_df["sla_breaches_90d"])
            - _rank_val(c["usage_score_current"], centroid_df["usage_score_current"])
        )

        # Stable Mid-Market: middling on most dimensions
        scoring_matrix[i, 2] = (
            -abs(_rank_val(c["arr_gbp"], centroid_df["arr_gbp"]) - 0.5)
            - abs(_rank_val(c["mrr_trend_pct"], centroid_df["mrr_trend_pct"]) - 0.5)
            - abs(_rank_val(c["usage_score_current"], centroid_df["usage_score_current"]) - 0.5)
        )

        # Low-Engagement SMB: low ARR, low usage, low NPS
        scoring_matrix[i, 3] = (
            -_rank_val(c["arr_gbp"], centroid_df["arr_gbp"])
            - _rank_val(c["usage_score_current"], centroid_df["usage_score_current"])
            - _rank_val(c["latest_nps"], centroid_df["latest_nps"])
            - _rank_val(c["seat_utilisation_pct"], centroid_df["seat_utilisation_pct"])
        )

        # Expansion Ready: high pipeline ratio, positive MRR, good usage
        scoring_matrix[i, 4] = (
            _rank_val(c["expansion_pipeline_gbp"], centroid_df["expansion_pipeline_gbp"])
            + _rank_val(c["mrr_trend_pct"], centroid_df["mrr_trend_pct"])
            + _rank_val(c["usage_score_current"], centroid_df["usage_score_current"])
        )

    # Greedy assignment: pick highest scoring (cluster, label) pair, then remove both
    for _ in range(n_clusters):
        # Mask already-assigned clusters and labels
        masked = scoring_matrix.copy()
        for ci in range(n_clusters):
            if labels[ci]:
                masked[ci, :] = -np.inf
        for li in range(len(LABEL_CANDIDATES)):
            if LABEL_CANDIDATES[li] in used_labels:
                masked[:, li] = -np.inf

        best_idx = np.unravel_index(np.argmax(masked), masked.shape)
        best_cluster = best_idx[0]
        best_label_idx = best_idx[1]

        labels[best_cluster] = LABEL_CANDIDATES[best_label_idx]
        used_labels.add(LABEL_CANDIDATES[best_label_idx])

    return labels


def _rank_val(val: float, series: pd.Series) -> float:
    """Return a 0-1 percentile rank of val within the series values."""
    vals = series.values
    if len(vals) <= 1:
        return 0.5
    vmin = vals.min()
    vmax = vals.max()
    if vmax == vmin:
        return 0.5
    return float((val - vmin) / (vmax - vmin))


def run_kmeans(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fit K-Means (k=5) with StandardScaler.
    Adds cluster_id and cluster_label columns.
    """
    print("\n" + "=" * 60)
    print("MODEL B: K-Means Clustering (k=5)")
    print("=" * 60)

    # Prepare feature matrix, fill nulls with median
    X = df[KMEANS_FEATURES].copy()
    for col in KMEANS_FEATURES:
        median_val = X[col].median()
        X[col] = X[col].fillna(median_val)

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Fit K-Means
    model = KMeans(n_clusters=5, random_state=42, n_init=10)
    model.fit(X_scaled)

    df["cluster_id"] = model.labels_

    # Auto-generate human-readable labels
    cluster_labels = _auto_label_clusters(
        model.cluster_centers_, KMEANS_FEATURES, scaler
    )

    # Map cluster_id to label
    label_map = {i: cluster_labels[i] for i in range(5)}
    df["cluster_label"] = df["cluster_id"].map(label_map)

    # Report
    print(f"\nCluster summary:")
    print(f"{'Cluster':>8s}  {'Label':<25s}  {'Count':>5s}  {'Avg ARR':>12s}  {'Avg Usage':>10s}")
    print("-" * 70)
    for cid in range(5):
        cluster_df = df[df["cluster_id"] == cid]
        print(
            f"{cid:>8d}  {label_map[cid]:<25s}  "
            f"{len(cluster_df):>5d}  "
            f"{cluster_df['arr_gbp'].mean():>12,.0f}  "
            f"{cluster_df['usage_score_current'].mean():>10.1f}"
        )

    return df


# ---------------------------------------------------------------------------
# Model C: VADER Sentiment Analysis
# ---------------------------------------------------------------------------

TEXT_COLUMNS = [
    "recent_support_summary",
    "recent_customer_note",
    "recent_sales_note",
]

VADER_OUTPUT_COLS = [
    "support_sentiment_vader",
    "customer_sentiment_vader",
    "sales_sentiment_vader",
]


def run_vader_sentiment(df: pd.DataFrame) -> pd.DataFrame:
    """
    Run VADER compound sentiment on each text column.
    Adds per-column sentiment scores and a sentiment_disagreement flag.
    """
    print("\n" + "=" * 60)
    print("MODEL C: VADER Sentiment Analysis")
    print("=" * 60)

    analyzer = SentimentIntensityAnalyzer()

    for text_col, out_col in zip(TEXT_COLUMNS, VADER_OUTPUT_COLS):
        scores = []
        for val in df[text_col]:
            if pd.isna(val) or str(val).strip() == "":
                scores.append(None)
            else:
                compound = analyzer.polarity_scores(str(val))["compound"]
                scores.append(round(compound, 4))
        df[out_col] = scores

    # Compute sentiment_disagreement
    # Average the non-null VADER scores per row, compare direction with note_sentiment_hint
    disagreements = []
    for _, row in df.iterrows():
        vader_vals = []
        for col in VADER_OUTPUT_COLS:
            if row[col] is not None and not (isinstance(row[col], float) and math.isnan(row[col])):
                vader_vals.append(row[col])

        hint = row.get("note_sentiment_hint")

        if len(vader_vals) == 0 or pd.isna(hint) or hint is None:
            disagreements.append(None)
            continue

        avg_compound = sum(vader_vals) / len(vader_vals)

        # Determine VADER direction
        if avg_compound > 0.05:
            vader_direction = "Positive"
        elif avg_compound < -0.05:
            vader_direction = "Negative"
        else:
            vader_direction = "Neutral"

        # Check disagreement: VADER positive but hint negative, or vice versa
        hint_str = str(hint)
        is_disagree = False
        if vader_direction == "Positive" and hint_str == "Negative":
            is_disagree = True
        elif vader_direction == "Negative" and hint_str == "Positive":
            is_disagree = True

        disagreements.append(1 if is_disagree else 0)

    df["sentiment_disagreement"] = disagreements

    # Report
    non_null_mask = df["sentiment_disagreement"].notna()
    total_with_data = non_null_mask.sum()
    disagree_count = (df.loc[non_null_mask, "sentiment_disagreement"] == 1).sum()

    print(f"\nAccounts with sentiment data: {total_with_data}")
    print(f"Sentiment disagreements (VADER vs hint): {disagree_count}")

    if disagree_count > 0:
        print("\nDisagreement details:")
        disagree_rows = df[df["sentiment_disagreement"] == 1]
        for _, row in disagree_rows.iterrows():
            vader_avg = np.nanmean([
                v for v in [row["support_sentiment_vader"],
                            row["customer_sentiment_vader"],
                            row["sales_sentiment_vader"]]
                if v is not None and not (isinstance(v, float) and math.isnan(v))
            ])
            print(
                f"  {row['account_id']} {row['account_name']:<25s} "
                f"hint={row['note_sentiment_hint']:<10s} "
                f"VADER_avg={vader_avg:>+.3f}"
            )

    return df


# ---------------------------------------------------------------------------
# Supabase UPDATE
# ---------------------------------------------------------------------------

ML_COLUMNS = [
    "is_anomaly",
    "anomaly_score",
    "cluster_id",
    "cluster_label",
    "support_sentiment_vader",
    "customer_sentiment_vader",
    "sales_sentiment_vader",
    "sentiment_disagreement",
]


def _safe_val(col, val):
    """Convert numpy/pandas types to JSON-safe Python types."""
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    if pd.isna(val):
        return None
    if hasattr(val, "item"):
        val = val.item()
    # Boolean columns must be True/False, not 0.0/1.0
    if col in ("is_anomaly", "sentiment_disagreement"):
        return bool(val)
    return val


def update_supabase(df: pd.DataFrame) -> None:
    """Update existing account rows in Supabase with ML enrichment columns."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\nSkipping Supabase update: credentials not configured in .env.local")
        return

    if SUPABASE_URL == "your-supabase-url":
        print("\nSkipping Supabase update: placeholder credentials detected in .env.local")
        return

    print("\n" + "=" * 60)
    print("Updating Supabase with ML enrichment columns...")
    print("=" * 60)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    updated = 0
    errors = 0

    for _, row in df.iterrows():
        account_id = row["account_id"]
        update_data = {}
        for col in ML_COLUMNS:
            update_data[col] = _safe_val(col, row[col])

        try:
            supabase.table("accounts").update(update_data).eq(
                "account_id", account_id
            ).execute()
            updated += 1
        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"  Error updating {account_id}: {e}")

    print(f"\nUpdated: {updated} accounts")
    if errors > 0:
        print(f"Errors: {errors}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("ML Enrichment Pipeline")
    print("=" * 60)

    # Step 0: Load and prepare data
    df = load_data()

    # Step 1: Isolation Forest
    df = run_isolation_forest(df)

    # Step 2: K-Means Clustering
    df = run_kmeans(df)

    # Step 3: VADER Sentiment
    df = run_vader_sentiment(df)

    # Step 4: Update Supabase
    update_supabase(df)

    # Step 5: Final summary
    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Accounts processed: {len(df)}")
    print(f"Anomalies flagged:  {df['is_anomaly'].sum()}")
    print(f"Clusters assigned:  {df['cluster_id'].notna().sum()}")
    print(f"Sentiment scored:   {df['support_sentiment_vader'].notna().sum()}")

    # Save enriched CSV for inspection
    output_path = PROJECT_ROOT / "scripts" / "output" / "ml_enriched_accounts.csv"
    output_cols = ["account_id", "account_name"] + ML_COLUMNS
    df[output_cols].to_csv(output_path, index=False)
    print(f"\nEnriched data saved to: {output_path}")


if __name__ == "__main__":
    main()
