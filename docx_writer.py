"""
docx_writer.py
--------------
Assembles the final DOCX report using high-performance lxml logic.
Adapts to the template's detected field order.
"""

import copy
import io
import logging
from collections import defaultdict
from docx import Document
from docx.shared import Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from template_reader import TemplateInfo, ParagraphStyle, DEFAULT_SECTION

logger = logging.getLogger(__name__)

# Pre-resolve namespace tags
_QN_BEFORE  = qn("w:before")
_QN_AFTER   = qn("w:after")
_QN_VAL     = qn("w:val")
_QN_SZ      = qn("w:sz")
_QN_SPACE   = qn("w:space")
_QN_COLOR   = qn("w:color")
_QN_ASCII   = qn("w:ascii")
_QN_HANSI   = qn("w:hAnsi")

class _StyleCache:
    __slots__ = (
        "font_name", "font_size_pt", "sz_half_pt",
        "spc_bef_twips", "spc_aft_twips",
        "bold", "italic", "has_color", "color_hex",
    )

    def __init__(self, style: ParagraphStyle, size_fallback: float = 11.0):
        self.font_name    = style.font_name or "Calibri"
        self.font_size_pt = style.font_size_pt or size_fallback
        self.sz_half_pt   = str(int(self.font_size_pt * 2))
        self.spc_bef_twips = str(int((style.space_before_pt or 2) * 20))
        self.spc_aft_twips = str(int((style.space_after_pt or 2) * 20))
        self.bold         = bool(style.bold)
        self.italic       = bool(style.italic)
        if style.color_rgb:
            r, g, b = style.color_rgb
            self.has_color = True
            self.color_hex = f"{r:02X}{g:02X}{b:02X}"
        else:
            self.has_color = False
            self.color_hex = ""

def _make_paragraph_xml(text: str, cache: _StyleCache, bold: bool = False, italic: bool = False):
    p = OxmlElement("w:p")
    pPr = OxmlElement("w:pPr")
    spacing = OxmlElement("w:spacing")
    spacing.set(_QN_BEFORE, cache.spc_bef_twips)
    spacing.set(_QN_AFTER,  cache.spc_aft_twips)
    pPr.append(spacing)
    p.append(pPr)

    r = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(_QN_ASCII, cache.font_name)
    rFonts.set(_QN_HANSI, cache.font_name)
    rPr.append(rFonts)
    sz = OxmlElement("w:sz")
    sz.set(_QN_VAL, cache.sz_half_pt)
    rPr.append(sz)
    szCs = OxmlElement("w:szCs")
    szCs.set(_QN_VAL, cache.sz_half_pt)
    rPr.append(szCs)
    if bold: 
        rPr.append(OxmlElement("w:b"))
        rPr.append(OxmlElement("w:bCs"))
    if italic: 
        rPr.append(OxmlElement("w:i"))
        rPr.append(OxmlElement("w:iCs"))
    if cache.has_color:
        color_el = OxmlElement("w:color")
        color_el.set(_QN_VAL, cache.color_hex)
        rPr.append(color_el)
    r.append(rPr)

    t = OxmlElement("w:t")
    t.text = text
    if text and (text[0] == " " or text[-1] == " "):
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    r.append(t)
    p.append(r)
    return p

def _make_heading_xml(text: str, cache: _StyleCache):
    p = OxmlElement("w:p")
    pPr = OxmlElement("w:pPr")
    spacing = OxmlElement("w:spacing")
    spacing.set(_QN_BEFORE, str(int(12*20)))
    spacing.set(_QN_AFTER,  str(int(6*20)))
    pPr.append(spacing)
    p.append(pPr)

    r = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    heading_sz = str(int((cache.font_size_pt + 1) * 2))
    sz = OxmlElement("w:sz")
    sz.set(_QN_VAL, heading_sz)
    rPr.append(sz)
    rPr.append(OxmlElement("w:b"))
    rPr.append(OxmlElement("w:bCs"))
    if cache.has_color:
        color_el = OxmlElement("w:color")
        color_el.set(_QN_VAL, cache.color_hex)
        rPr.append(color_el)
    r.append(rPr)
    t = OxmlElement("w:t")
    t.text = text
    r.append(t)
    p.append(r)
    return p

def _make_hr_template():
    p = OxmlElement("w:p")
    pPr = OxmlElement("w:pPr")
    spacing = OxmlElement("w:spacing")
    spacing.set(_QN_BEFORE, str(int(4*20)))
    spacing.set(_QN_AFTER,  str(int(4*20)))
    pPr.append(spacing)
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(_QN_VAL, "single"); bottom.set(_QN_SZ, "6"); bottom.set(_QN_SPACE, "1"); bottom.set(_QN_COLOR, "CCCCCC")
    pBdr.append(bottom)
    pPr.append(pBdr)
    p.append(pPr)
    return p

def build_document(template_info: TemplateInfo, article_blocks: list[dict]) -> tuple[io.BytesIO, str]:
    if not article_blocks: return io.BytesIO(), "❌ Empty blocks."

    doc = Document()
    for sec in doc.sections:
        sec.top_margin = sec.bottom_margin = Pt(72*0.8)
    
    body = doc.element.body
    sectPr = body[-1]
    def _append(el): sectPr.addprevious(el)

    art_style = template_info.article_style
    art_cache = _StyleCache(art_style)
    
    # Pre-build style for URL (force italic)
    url_cache = _StyleCache(art_style)
    url_cache.bold = False
    url_cache.italic = True

    hr_tmpl = _make_hr_template()
    deepcopy = copy.deepcopy

    # Title
    for text, tstyle in template_info.title_paragraphs:
        _append(_make_paragraph_xml(text, _StyleCache(tstyle)))
    _append(OxmlElement("w:p"))

    # Group
    grouped = defaultdict(list)
    for b in article_blocks: grouped[b["section"]].append(b)

    order = template_info.field_order

    for sec_name in (list(template_info.sections) + sorted(set(grouped.keys())-set(template_info.sections))):
        _append(_make_heading_xml(sec_name, art_cache))
        blocks = grouped.get(sec_name, [])
        if not blocks:
            _append(_make_paragraph_xml("No articles.", art_cache, italic=True))
        else:
            for b in blocks:
                # ADAPTIVE ORDER LOOP
                for field_name in order:
                    val = b.get(field_name, "N/A")
                    if field_name == "link":
                        _append(_make_paragraph_xml(val, url_cache, italic=True))
                    elif field_name == "publisher_author":
                        _append(_make_paragraph_xml(val, art_cache, bold=True))
                    else:
                        _append(_make_paragraph_xml(val, art_cache))
                _append(deepcopy(hr_tmpl))
        _append(OxmlElement("w:p"))

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer, f"✅ Report generated with {len(article_blocks):,} articles."
