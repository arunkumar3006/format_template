"""
report_builder.py
-----------------
Transforms DataFrame into blocks, now supporting dynamic field order.
"""

import logging
from typing import Any
import pandas as pd
from template_reader import TemplateInfo, DEFAULT_SECTION

logger = logging.getLogger(__name__)

def _get(row: Any, col: str, default: str = "N/A") -> str:
    val = getattr(row, col, None)
    if val is None or str(val).strip().lower() in ("", "nan", "none", "n/a"):
        return default
    return str(val).strip()

def _build_section_map(template_info: TemplateInfo) -> dict:
    mapping: dict = {}
    for section in template_info.sections:
        keyword = section.split()[0].lower()
        mapping[keyword] = section
    return mapping

def build_article_blocks(
    df: pd.DataFrame,
    template_info: TemplateInfo,
) -> tuple[list[dict], str]:
    """
    Convert every row in df into an article block dict.
    """
    if df.empty:
        return [], "❌ Dataset is empty."

    blocks: list[dict] = []
    section_map = _build_section_map(template_info)
    default_section = template_info.sections[0] if template_info.sections else DEFAULT_SECTION

    # Use itertuples for speed
    for row in df.itertuples(index=False):
        publisher = _get(row, "publisher_name")
        author    = _get(row, "author_or_journalist")
        title     = _get(row, "title")
        link      = _get(row, "link")
        summary   = _get(row, "summary_of_article")

        # Combine as required by template logic
        publisher_author = f"{publisher} | {author}"

        # Sectioning
        section = default_section
        if "category" in df.columns and template_info.has_categories:
            raw_cat = _get(row, "category", "").lower()
            for kw, sec in section_map.items():
                if kw in raw_cat:
                    section = sec
                    break

        blocks.append({
            "publisher_author": publisher_author,
            "title":            title,
            "link":             link,
            "summary":          summary,
            "section":          section,
        })

    msg = f"✅ {len(blocks):,} article block(s) built."
    return blocks, msg
