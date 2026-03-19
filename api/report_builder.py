"""
api/report_builder.py
---------------------
Now optimized to work with a list of dictionaries (from lightweight data_loader)
rather than a pandas DataFrame.
"""

import logging
from typing import Any
from template_reader import TemplateInfo, DEFAULT_SECTION

logger = logging.getLogger(__name__)

# Helpers to handle raw data safely
def _get(row: dict, col: str, default: str = "N/A") -> str:
    val = row.get(col, default)
    if val in (None, "", "NaN", "nan", "None"):
        return default
    return str(val).strip()

def _build_section_map(template_info: TemplateInfo) -> dict:
    mapping: dict = {}
    for section in template_info.sections:
        # Use first word of section as keyword matching
        keyword = section.split()[0].lower()
        mapping[keyword] = section
    return mapping

def build_article_blocks(
    dataset_rows: list,
    template_info: TemplateInfo,
) -> tuple[list[dict], str]:
    """
    Iterates through the list of dictionaries and constructs
    article blocks formatted for the DOCX writer.
    """
    if not dataset_rows:
        return [], "❌ No data to process."

    blocks: list[dict] = []
    section_map = _build_section_map(template_info)
    default_section = template_info.sections[0] if template_info.sections else DEFAULT_SECTION

    # Process all rows (O(N) loop)
    # The dataset_rows is built by data_loader with normalized column keys
    for row in dataset_rows:
        publisher = _get(row, "publisher_name")
        author    = _get(row, "author_or_journalist")
        title     = _get(row, "title")
        link      = _get(row, "link")
        summary   = _get(row, "summary_of_article")

        # Formatting publisher | author logic
        publisher_author = f"{publisher} | {author}"

        # Mapping article to section (COMPANY, COMPETITION, etc.)
        section = default_section
        if "category" in row and template_info.has_categories:
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

    msg = f"✅ {len(blocks):,} article block(s) built successfully."
    logger.info(msg)
    return blocks, msg
