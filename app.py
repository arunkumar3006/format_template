"""
app.py
------
Streamlit entry-point for the Template-Driven News Report Generator.

UI flow:
  1. User uploads Excel dataset
  2. User uploads DOCX template
  3. User clicks Generate Report
  4. System runs pipeline and shows download button
"""

import logging
import datetime
import streamlit as st

from data_loader import load_dataset
from template_reader import read_template
from report_builder import build_article_blocks
from docx_writer import build_document

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="News Report Generator",
    page_icon="📰",
    layout="centered",
)

# ---------------------------------------------------------------------------
# Minimal custom CSS
# ---------------------------------------------------------------------------
st.markdown(
    """
    <style>
        .stButton > button {
            width: 100%;
            background-color: #1a73e8;
            color: white;
            font-weight: 600;
            border-radius: 6px;
            padding: 0.5rem 1rem;
        }
        .stButton > button:hover {
            background-color: #1558b0;
        }
        .status-box {
            background: #f0f4ff;
            border-left: 4px solid #1a73e8;
            padding: 0.75rem 1rem;
            border-radius: 4px;
            margin: 0.5rem 0;
            font-size: 0.9rem;
        }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Title
# ---------------------------------------------------------------------------
st.title("📰 News Report Generator")
st.caption(
    "Upload an Excel dataset and a Word template to generate a formatted "
    "corporate news monitoring report."
)

st.divider()

# ---------------------------------------------------------------------------
# File upload widgets
# ---------------------------------------------------------------------------
col1, col2 = st.columns(2)

with col1:
    st.subheader("1️⃣  Dataset")
    dataset_file = st.file_uploader(
        "Upload Excel file (.xlsx / .xls / .csv)",
        type=["xlsx", "xls", "csv"],
        key="dataset_upload",
    )

with col2:
    st.subheader("2️⃣  Template")
    template_file = st.file_uploader(
        "Upload Word template (.docx)",
        type=["docx"],
        key="template_upload",
    )

st.divider()

# ---------------------------------------------------------------------------
# Generate Report button
# ---------------------------------------------------------------------------
generate_clicked = st.button("⚡ Generate Report", disabled=(not dataset_file or not template_file))

if generate_clicked:
    if not dataset_file or not template_file:
        st.error("Please upload both a dataset and a template before generating.")
    else:
        with st.spinner("Processing… Please wait."):

            # Step 1 – Load dataset
            with st.status("Loading dataset…", expanded=True) as status_widget:
                df, ds_msg = load_dataset(dataset_file)
                st.write(ds_msg)
                if df.empty:
                    status_widget.update(label="Dataset error", state="error", expanded=True)
                    st.stop()

            # Step 2 – Read template
            with st.status("Reading template…", expanded=True) as status_widget:
                template_info, tmpl_msg = read_template(template_file)
                st.write(tmpl_msg)
                if not template_info.sections:
                    status_widget.update(label="Template error", state="error", expanded=True)
                    st.stop()

            # Step 3 – Build article blocks
            with st.status("Building article blocks…", expanded=True) as status_widget:
                blocks, build_msg = build_article_blocks(df, template_info)
                st.write(build_msg)
                if not blocks:
                    status_widget.update(label="Build error", state="error", expanded=True)
                    st.stop()

            # Step 4 – Write DOCX
            with st.status("Writing document…", expanded=True) as status_widget:
                buffer, write_msg = build_document(template_info, blocks)
                st.write(write_msg)
                if buffer.getbuffer().nbytes == 0:
                    status_widget.update(label="Write error", state="error", expanded=True)
                    st.stop()

        # -------------------------------------------------------------------
        # Success summary
        # -------------------------------------------------------------------
        st.success(f"✅ Report ready! {len(blocks):,} article(s) included.")

        col_stats1, col_stats2, col_stats3 = st.columns(3)
        with col_stats1:
            st.metric("Total Articles", f"{len(blocks):,}")
        with col_stats2:
            st.metric("Sections", len(template_info.sections))
        with col_stats3:
            st.metric("Dataset Rows", f"{len(df):,}")

        # -------------------------------------------------------------------
        # Download button
        # -------------------------------------------------------------------
        today = datetime.date.today().strftime("%Y-%m-%d")
        filename = f"News_Report_{today}.docx"

        st.divider()
        st.download_button(
            label="📥 Download Report (.docx)",
            data=buffer,
            file_name=filename,
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

# ---------------------------------------------------------------------------
# Footer
# ---------------------------------------------------------------------------
st.divider()
st.caption(
    "Template-Driven News Report Generator · "
    "Supports Excel (xlsx / xls / csv) datasets and DOCX templates · "
    "Handles 4,000+ rows"
)
