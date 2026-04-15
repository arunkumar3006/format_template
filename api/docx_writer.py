"""
docx_writer.py
--------------
Assembles the final DOCX report using high-performance lxml logic.
Adapts to the template's detected field order.
Supports grouped fields (side-by-side).
"""

import copy
import io
import logging
import re
from urllib.parse import urlparse
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
        self.has_color = True
        if style.color_rgb:
            r, g, b = style.color_rgb
            self.color_hex = f"{r:02X}{g:02X}{b:02X}"
        else:
            self.color_hex = "222222" # Soft black
    
    def with_color(self, hex_color: str):
        self.color_hex = hex_color.replace("#", "")
        return self
    
    def with_size(self, size_pt: float):
        self.sz_half_pt = str(int(size_pt * 2))
        return self

def _append_hyperlink_to_para(doc, para, url: str, text: str, cache: _StyleCache):
    """Appends a real clickable w:hyperlink XML element to an existing paragraph."""
    # Register the relationship
    r_id = doc.part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    
    # The Hyperlink element
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)

    # The Run inside the hyperlink
    r = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(_QN_ASCII, cache.font_name)
    rFonts.set(_QN_HANSI, cache.font_name)
    rPr.append(rFonts)
    sz = OxmlElement("w:sz")
    sz.set(_QN_VAL, cache.sz_half_pt)
    rPr.append(sz)
    
    # Underline and Blue Color for standard link look
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    rPr.append(u)
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0000EE")
    rPr.append(color)
    
    r.append(rPr)
    t = OxmlElement("w:t")
    t.text = text
    if text and (text[0] == " " or text[-1] == " "):
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    r.append(t)
    
    hyperlink.append(r)
    para.append(hyperlink)

def _append_run_to_para(para, text: str, cache: _StyleCache, bold: bool = False, italic: bool = False):
    """Appends a run to an existing paragraph."""
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
    para.append(r)

def _create_empty_para(cache: _StyleCache):
    """Creates a paragraph with spacing but no runs."""
    p = OxmlElement("w:p")
    pPr = OxmlElement("w:pPr")
    spacing = OxmlElement("w:spacing")
    spacing.set(_QN_BEFORE, cache.spc_bef_twips)
    spacing.set(_QN_AFTER,  cache.spc_aft_twips)
    pPr.append(spacing)
    p.append(pPr)
    return p

def _make_paragraph_xml(text: str, cache: _StyleCache, bold: bool = False, italic: bool = False):
    p = _create_empty_para(cache)
    _append_run_to_para(p, text, cache, bold, italic)
    return p

def _get_clean_link_text(b: dict) -> str:
    title = str(b.get("title", "")).strip()
    publisher = str(b.get("publisher_name", "")).strip()
    url = str(b.get("link", "")).strip()

    if title and title.lower() not in ("n/a", "none"):
        clean_title = re.sub(r'[*#_]', '', title).strip()
        words = clean_title.split()
        short_title = " ".join(words[:10]) 
        display_text = short_title
        if publisher and publisher.lower() not in ("n/a", "none"):
            if publisher.lower() not in clean_title.lower():
                display_text += f" ({publisher})"
        return display_text

    if publisher and publisher.lower() not in ("n/a", "none"):
        return f"Read via {publisher}"

    if url and "http" in url:
        try:
            domain = urlparse(url).netloc.replace("www.", "")
            return f"Read on {domain.split('.')[0].capitalize()}"
        except: pass
    return "View Full Article"

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
    hr_tmpl = _make_hr_template()
    deepcopy = copy.deepcopy
    for text, tstyle in template_info.title_paragraphs:
        _append(_make_paragraph_xml(text, _StyleCache(tstyle)))
    _append(OxmlElement("w:p"))
    grouped = defaultdict(list)
    for b in article_blocks: grouped[b["section"]].append(b)
    order = template_info.field_order
    for sec_name in (list(template_info.sections) + sorted(set(grouped.keys())-set(template_info.sections))):
        _append(_make_heading_xml(sec_name, art_cache))
        blocks = grouped.get(sec_name, [])
        if not blocks:
            _append(_make_paragraph_xml("No articles.", art_cache, italic=True))
        else:
            COLOR_NAVY = "1B3E6A"
            COLOR_GREY = "666666"
            COLOR_LINK = "0000EE"
            for b in blocks:
                for row_order in order:
                    sub_fields = [f.strip() for f in row_order.split("|") if f.strip()]
                    if not sub_fields: continue
                    # Tracking whether we've added a visible item to this para
                    visible_item_added = False
                    main_para = _create_empty_para(art_cache)

                    for field_name in sub_fields:
                        val = b.get(field_name, "N/A")
                        if val == "N/A":
                            for k, v in b.items():
                                if str(k).lower() == field_name.lower(): val = str(v); break
                        
                        if val == "N/A" and field_name != "title": continue
                        
                        # Add separator if this is NOT the first visible item in the para
                        if visible_item_added:
                            _append_run_to_para(main_para, " | ", art_cache)
                        
                        if field_name == "title":
                            title_cache = _StyleCache(art_style).with_color(COLOR_NAVY).with_size(art_cache.font_size_pt + 1)
                            _append_run_to_para(main_para, val, title_cache, bold=True)
                            visible_item_added = True
                        elif field_name == "publisher_author":
                            clean_val = val.replace("N/A | ", "").replace(" | N/A", "")
                            if clean_val != "N/A":
                                meta_cache = _StyleCache(art_style).with_color(COLOR_GREY).with_size(art_cache.font_size_pt - 1)
                                _append_run_to_para(main_para, clean_val, meta_cache, italic=True)
                                visible_item_added = True
                        elif field_name in ["publisher_name", "author_or_journalist", "date_time"]:
                            meta_cache = _StyleCache(art_style).with_color(COLOR_GREY).with_size(art_cache.font_size_pt - 1)
                            _append_run_to_para(main_para, val, meta_cache, italic=True)
                            visible_item_added = True
                        elif field_name == "link":
                            if val and val != "N/A":
                                link_text = _get_clean_link_text(b)
                                link_cache = _StyleCache(art_style).with_color(COLOR_LINK).with_size(art_cache.font_size_pt - 1)
                                _append_hyperlink_to_para(doc, main_para, val, link_text, link_cache)
                                visible_item_added = True
                        elif field_name in ["summary", "summary_of_article"]:
                            _append_run_to_para(main_para, val, art_cache)
                            visible_item_added = True
                        else:
                            _append_run_to_para(main_para, val, art_cache)
                            visible_item_added = True
                    if len(main_para.xpath(".//w:r")) > 0 or len(main_para.xpath(".//w:hyperlink")) > 0:
                        _append(main_para)
                _append(deepcopy(hr_tmpl))
        _append(OxmlElement("w:p"))
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer, f"✅ Generated {len(article_blocks):,} articles."
