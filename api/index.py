from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import logging

# Standardized Imports
try:
    from .data_loader import load_dataset
    from .template_reader import read_template
    from .report_builder import build_article_blocks
    from .docx_writer import build_document
except ImportError:
    from data_loader import load_dataset
    from template_reader import read_template
    from report_builder import build_article_blocks
    from docx_writer import build_document

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

@app.post("/api/generate")
async def generate_report(
    dataset: UploadFile = File(...),
    template: UploadFile = File(...)
):
    try:
        # Load Dataset
        ds_content = await dataset.read()
        data, ds_msg = load_dataset(io.BytesIO(ds_content))
        
        if not data:
            return JSONResponse(status_code=400, content={"detail": ds_msg})

        # Read Template
        tmpl_content = await template.read()
        template_info, tmpl_msg = read_template(io.BytesIO(tmpl_content))
        
        if not template_info.sections:
            return JSONResponse(status_code=400, content={"detail": "Detecting template failed."})

        # Build article blocks
        blocks, build_msg = build_article_blocks(data, template_info)
        
        if not blocks:
            return JSONResponse(status_code=400, content={"detail": "Build failed."})

        # Final Document Synthesis
        buffer, write_msg = build_document(template_info, blocks)
        
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename=News_Report.docx"
            }
        )

    except Exception as e:
        logger.exception("Global Generation Exception")
        return JSONResponse(status_code=500, content={"detail": str(e)})
