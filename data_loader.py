"""
data_loader.py
--------------
Upgraded ingestion with robust column alias mapping and cleaning.
"""

import pandas as pd
import io
import logging

logger = logging.getLogger(__name__)

# Canonical columns and their common variations
COLUMN_ALIASES = {
    "title": [
        "title", "headline", "subject", "article_title", "news_title", "head"
    ],
    "author_or_journalist": [
        "author", "journalist", "reporter", "writer", "byline", 
        "author_name", "author_or_journalist"
    ],
    "publisher_name": [
        "publisher", "publication", "source", "publisher_name", 
        "media_house", "news_source", "portal"
    ],
    "date_time": [
        "date", "time", "date_time", "published_at", "timestamp", "pub_date"
    ],
    "summary_of_article": [
        "summary", "description", "content", "abstract", 
        "summary_of_article", "article_body", "snippet"
    ],
    "link": [
        "link", "url", "url_of_article", "source_url", "article_url", "web_link"
    ],
    "category": [
        "category", "section", "news_type", "tag", "industry"
    ]
}

def _normalise_name(name: str) -> str:
    """Lowercase and replace spaces with underscores for comparison."""
    if not isinstance(name, str):
        name = str(name)
    return name.strip().lower().replace(" ", "_")

def _apply_aliases(df: pd.DataFrame) -> pd.DataFrame:
    """Map variations in dataset column names to canonical internal names."""
    current_cols = df.columns.tolist()
    rename_map = {}

    # Build inverse map from Aliases
    # variation -> canonical
    lookup = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            lookup[_normalise_name(alias)] = canonical

    for col in current_cols:
        norm = _normalise_name(col)
        if norm in lookup:
            rename_map[col] = lookup[norm]
    
    return df.rename(columns=rename_map)

def load_dataset(file_object) -> tuple[pd.DataFrame, str]:
    """
    Load an Excel or CSV file. Handles aliases and cleans data.
    """
    try:
        raw = file_object.read()
        filename = getattr(file_object, "name", "upload").lower()

        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(raw), encoding="utf-8", on_bad_lines="skip")
        elif filename.endswith(".xls"):
            try:
                df = pd.read_excel(io.BytesIO(raw), engine="xlrd")
            except:
                df = pd.read_excel(io.BytesIO(raw))
        else:
            # Default to openpyxl for .xlsx
            df = pd.read_excel(io.BytesIO(raw), engine="openpyxl")

    except Exception as exc:
        logger.exception("Failed to read dataset file.")
        return pd.DataFrame(), f"❌ Could not read dataset: {exc}"

    if df.empty:
        return pd.DataFrame(), "❌ The uploaded dataset is completely empty."

    # 1. Alias Mapping
    df = _apply_aliases(df)

    # 2. Ensure canonical columns exist (fill with N/A if missing)
    all_needed = list(COLUMN_ALIASES.keys())
    for col in all_needed:
        if col not in df.columns:
            df[col] = "N/A"

    # 3. Handle NaNs and mixed types (convert to string)
    df = df.fillna("N/A")
    df = df.replace(["nan", "NaN", "None", "none", ""], "N/A")

    # Clean strings
    for col in all_needed:
        df[col] = df[col].astype(str).str.strip()

    # Drop rows that are functionally empty (all canonical fields are N/A)
    # Note: we check everything except 'category' to decide if it's a real article
    check_cols = [c for c in all_needed if c != "category"]
    df = df[~(df[check_cols] == "N/A").all(axis=1)]

    row_count = len(df)
    if row_count == 0:
        return pd.DataFrame(), "❌ No valid article rows found in dataset."

    msg = f"✅ Dataset loaded successfully – {row_count:,} article(s) found."
    logger.info(msg)
    return df, msg
