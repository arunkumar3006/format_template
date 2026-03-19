"""
template_reader.py
------------------
Detects article field order automatically from the template example block.
"""

import io
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

from docx import Document

logger = logging.getLogger(__name__)

# Keywords that identify a section heading
SECTION_KEYWORDS = [
    "company news", "competition news", "industry news", 
    "market news", "sector news", "general news", "global news"
]

DEFAULT_SECTION = "NEWS"

@dataclass
class ParagraphStyle:
    """Captures the visual style of a single paragraph."""
    bold: bool = False
    italic: bool = False
    font_name: Optional[str] = None
    font_size_pt: Optional[float] = None
    color_rgb: Optional[tuple] = None
    space_before_pt: Optional[float] = None
    space_after_pt: Optional[float] = None
    alignment: Optional[int] = None

@dataclass
class TemplateInfo:
    """All metadata extracted from the uploaded template."""
    title_paragraphs: list = field(default_factory=list)   # (text, ParagraphStyle)
    sections: list = field(default_factory=list)           # Section names
    section_styles: dict = field(default_factory=dict)     # name -> style
    article_style: ParagraphStyle = field(default_factory=ParagraphStyle)
    
    # Adaptive Field Order: detect what fields are used and in what order
    # Valid fields: "publisher_author", "title", "link", "summary"
    field_order: list = field(default_factory=lambda: ["publisher_author", "title", "link", "summary"])
    
    has_categories: bool = False
    raw_doc: Optional[object] = None


def _extract_para_style(para) -> ParagraphStyle:
    ps = ParagraphStyle()
    pf = para.paragraph_format
    if pf.space_before is not None: ps.space_before_pt = pf.space_before.pt
    if pf.space_after is not None: ps.space_after_pt = pf.space_after.pt
    if pf.alignment is not None: ps.alignment = pf.alignment

    for run in para.runs:
        if run.bold is not None: ps.bold = run.bold
        if run.italic is not None: ps.italic = run.italic
        if run.font.name: ps.font_name = run.font.name
        if run.font.size: ps.font_size_pt = run.font.size.pt
        if run.font.color and run.font.color.type is not None:
            try:
                rgb = run.font.color.rgb
                ps.color_rgb = (rgb.r, rgb.g, rgb.b)
            except: pass
        break
    return ps

def _is_section_heading(text: str) -> bool:
    t = text.strip().lower()
    return any(kw in t for kw in SECTION_KEYWORDS)

def _detect_field(text: str) -> Optional[str]:
    """
    Detect which article field a template line represents.
    Rules:
      - Contains '|' -> publisher_author
      - Contains 'http' -> link
      - > 8 words -> summary
      - else -> title
    """
    t = text.strip()
    if "|" in t:
        return "publisher_author"
    if re.search(r"https?://", t, re.I):
        return "link"
    if len(t.split()) > 8:
        return "summary"
    return "title"

def read_template(file_object) -> tuple[TemplateInfo, str]:
    try:
        raw = file_object.read()
        doc = Document(io.BytesIO(raw))
        info = TemplateInfo(raw_doc=doc)
    except Exception as exc:
        return TemplateInfo(), f"❌ Could not read template: {exc}"

    paragraphs = doc.paragraphs
    if not paragraphs:
        return info, "⚠️ Template is empty."

    in_header = True
    captured_fields = []
    
    for para in paragraphs:
        text = para.text.strip()
        if not text: continue

        if _is_section_heading(text):
            in_header = False
            sec_name = text.upper()
            if sec_name not in info.sections:
                info.sections.append(sec_name)
                info.section_styles[sec_name] = _extract_para_style(para)
            info.has_categories = True
            continue

        if in_header:
            info.title_paragraphs.append((text, _extract_para_style(para)))
            continue

        # Pattern detection phase (after first section)
        # We look for a pattern of fields to determine field_order
        f_type = _detect_field(text)
        if f_type and f_type not in captured_fields:
            captured_fields.append(f_type)
            # Capture base article style from the first detected field
            if not info.article_style.font_name:
                info.article_style = _extract_para_style(para)

    if captured_fields:
        info.field_order = captured_fields
        logger.info("Detected field order from template: %s", info.field_order)

    if not info.sections:
        info.sections = [DEFAULT_SECTION]
        info.has_categories = False

    msg = f"✅ Template parsed. Fields: {' → '.join(info.field_order)}."
    return info, msg
