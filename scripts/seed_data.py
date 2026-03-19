"""
seed_data.py
Reads the account CSV, computes derived fields, and inserts all 60 rows
into the Supabase `accounts` table.

Usage:
    python scripts/seed_data.py

Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
at the project root.
"""

import os
import math
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "scripts" / "data" / "account_prioritisation_challenge_data.csv"
ENV_PATH = PROJECT_ROOT / ".env.local"

# Load environment variables from .env.local
load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    )


# ---------------------------------------------------------------------------
# Derived-field helpers
# ---------------------------------------------------------------------------

DATA_COMPLETENESS_FIELDS = [
    "latest_nps",
    "avg_csat_90d",
    "note_sentiment_hint",
    "last_qbr_date",
    "latest_note_date",
    "recent_customer_note",
    "recent_sales_note",
    "overdue_amount_gbp",
]

TODAY = date.today()


def compute_derived(row: pd.Series) -> dict:
    """Return a dict of the five derived columns for a single row."""
    # seat_utilisation_pct
    if pd.notna(row.get("seats_purchased")) and row["seats_purchased"] > 0 and pd.notna(row.get("seats_used")):
        seat_util = row["seats_used"] / row["seats_purchased"]
    else:
        seat_util = None

    # mrr_trend_pct
    if pd.notna(row.get("mrr_3m_ago_gbp")) and row["mrr_3m_ago_gbp"] != 0 and pd.notna(row.get("mrr_current_gbp")):
        mrr_trend = (row["mrr_current_gbp"] - row["mrr_3m_ago_gbp"]) / row["mrr_3m_ago_gbp"] * 100
    else:
        mrr_trend = None

    # usage_trend
    if pd.notna(row.get("usage_score_current")) and pd.notna(row.get("usage_score_3m_ago")):
        usage_trend = int(row["usage_score_current"] - row["usage_score_3m_ago"])
    else:
        usage_trend = None

    # days_to_renewal
    if pd.notna(row.get("renewal_date")):
        renewal = row["renewal_date"]
        if isinstance(renewal, str):
            renewal = datetime.strptime(renewal, "%Y-%m-%d").date()
        elif isinstance(renewal, pd.Timestamp):
            renewal = renewal.date()
        days_to_renewal = (renewal - TODAY).days
    else:
        days_to_renewal = None

    # data_completeness_score (% of key fields that are non-null and non-empty)
    filled = 0
    for field in DATA_COMPLETENESS_FIELDS:
        val = row.get(field)
        if pd.notna(val) and val != "":
            filled += 1
    data_completeness = filled / len(DATA_COMPLETENESS_FIELDS)

    return {
        "seat_utilisation_pct": round(seat_util, 4) if seat_util is not None else None,
        "mrr_trend_pct": round(mrr_trend, 2) if mrr_trend is not None else None,
        "usage_trend": usage_trend,
        "days_to_renewal": days_to_renewal,
        "data_completeness_score": round(data_completeness, 4),
    }


# ---------------------------------------------------------------------------
# Sanitise a row dict for JSON / Supabase insertion
# ---------------------------------------------------------------------------

# Columns that should be stored as dates (TEXT in transit, DATE in Postgres)
DATE_COLUMNS = {
    "contract_start_date",
    "renewal_date",
    "last_lead_activity_date",
    "last_qbr_date",
    "latest_note_date",
}

# Columns that should be integers
INT_COLUMNS = {
    "seats_purchased",
    "seats_used",
    "open_leads_count",
    "open_tickets_count",
    "urgent_open_tickets_count",
    "sla_breaches_90d",
    "usage_score_3m_ago",
    "usage_score_current",
    "usage_trend",
    "days_to_renewal",
}


def sanitise_value(key: str, val):
    """Convert pandas / numpy types to JSON-safe Python types."""
    # NaN / NaT -> None
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    if pd.isna(val):
        return None
    if isinstance(val, pd.Timestamp):
        if pd.isna(val):
            return None
        return val.strftime("%Y-%m-%d")
    # numpy int / float -> Python native
    if hasattr(val, "item"):
        val = val.item()
    # Enforce integer columns
    if key in INT_COLUMNS and val is not None:
        return int(val)
    # Ensure date columns are strings
    if key in DATE_COLUMNS:
        if isinstance(val, date):
            return val.strftime("%Y-%m-%d")
        return str(val) if val else None
    return val


def row_to_record(row: pd.Series) -> dict:
    """Convert a pandas row + derived fields into a clean dict for Supabase."""
    derived = compute_derived(row)
    record = {}
    for col in row.index:
        record[col] = sanitise_value(col, row[col])
    for col, val in derived.items():
        record[col] = sanitise_value(col, val)
    return record


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Reading CSV from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")

    # Parse date columns so derived-field logic works cleanly
    for col in DATE_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # Build list of records
    records = []
    for idx, row in df.iterrows():
        records.append(row_to_record(row))

    print(f"Computed derived fields for {len(records)} accounts")

    # Connect to Supabase using the service role key (bypasses RLS)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Insert in batches of 20
    batch_size = 20
    inserted = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        response = supabase.table("accounts").upsert(batch).execute()
        inserted += len(batch)
        print(f"  Inserted batch {i // batch_size + 1}: {len(batch)} rows (total: {inserted}/{len(records)})")

    print()
    print("=" * 50)
    print(f"Seed complete. {inserted} accounts inserted.")
    print("=" * 50)

    # Quick summary of derived fields
    print()
    print("Derived field samples (first 3 rows):")
    for rec in records[:3]:
        print(
            f"  {rec['account_id']}: "
            f"seat_util={rec['seat_utilisation_pct']}, "
            f"mrr_trend={rec['mrr_trend_pct']}%, "
            f"usage_trend={rec['usage_trend']}, "
            f"days_to_renewal={rec['days_to_renewal']}, "
            f"completeness={rec['data_completeness_score']}"
        )


if __name__ == "__main__":
    main()
