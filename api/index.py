from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import logging
import sys
import os
import json

# Ensure the 'api' directory is in path for absolute imports on Vercel
sys.path.append(os.path.dirname(__file__))

# Absolute imports (Stable for Vercel)
try:
    import data_loader
    import template_reader
    from template_reader import TemplateInfo, ParagraphStyle, DEFAULT_SECTION
    import report_builder
    import docx_writer
except ImportError:
    # Fallback for different build environments
    from . import data_loader
    from . import template_reader
    from .template_reader import TemplateInfo, ParagraphStyle, DEFAULT_SECTION
    from . import report_builder
    from . import docx_writer

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="News Report Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def root():
    return {"status": "ok", "message": "API Active"}

@app.post("/api/preview")
async def preview_endpoint(dataset: UploadFile = File(...)):
    """Extract first few rows of the dataset for UI preview."""
    try:
        content = await dataset.read()
        data, msg = data_loader.load_dataset(io.BytesIO(content))
        if not data:
            return JSONResponse(content={"error": msg}, status_code=400)
        
        return JSONResponse(content={
            "preview": data, 
            "total_rows": len(data),
            "message": msg
        })
    except Exception as e:
        logger.exception("Preview failed")
        return JSONResponse(status_code=500, content={"error": f"Internal mapping error: {str(e)}"})

@app.post("/api/generate")
async def generate_report(
    dataset: UploadFile = File(...),
    template: UploadFile | None = File(None),
    field_order: str = Form("title,link,publisher_author,summary_of_article,date_time")
):
    try:
        # 1. Load Dataset
        ds_content = await dataset.read()
        data, ds_msg = data_loader.load_dataset(io.BytesIO(ds_content))
        
        if not data:
            return JSONResponse(status_code=400, content={"detail": ds_msg})

        # 2. Get Template Info
        if template and template.filename:
            tmpl_content = await template.read()
            template_info, tmpl_msg = template_reader.read_template(io.BytesIO(tmpl_content))
        else:
            # Create a default template structure
            template_info = TemplateInfo()
            template_info.sections = [DEFAULT_SECTION]
            template_info.field_order = field_order.split(",")
            # Optional: Add a default title
            template_info.title_paragraphs = [("Daily News Report", ParagraphStyle(bold=True, font_size_pt=18))]

        # 3. Build Article Blocks
        blocks, build_msg = report_builder.build_article_blocks(data, template_info)
        
        if not blocks:
            return JSONResponse(status_code=400, content={"detail": "Build failed."})

        # 4. Final Document Synthesis
        buffer, write_msg = docx_writer.build_document(template_info, blocks)
        
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename=News_Report.docx"
            }
        )

    except Exception as e:
        logger.exception("Global Generation Exception")
        return JSONResponse(status_code=500, content={"detail": f"Execution Error: {str(e)}"})

