from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import logging

# Ensure imports work regardless of execution context (serverless / local)
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
    return {"status": "ok", "message": "News Generator API is active"}

@app.post("/api/generate")
async def generate_report(
    dataset: UploadFile = File(...),
    template: UploadFile = File(...)
):
    try:
        # Load Dataset
        ds_content = await dataset.read()
        df, ds_msg = load_dataset(io.BytesIO(ds_content))
        
        if df.empty:
            raise HTTPException(status_code=400, detail=ds_msg)

        # Read Template
        tmpl_content = await template.read()
        template_info, tmpl_msg = read_template(io.BytesIO(tmpl_content))
        
        if not template_info.sections:
            raise HTTPException(status_code=400, detail="Could not detect template sections.")

        # Build article blocks
        blocks, build_msg = build_article_blocks(df, template_info)
        
        if not blocks:
            raise HTTPException(status_code=400, detail="No articles found.")

        # Write Final Document
        buffer, write_msg = build_document(template_info, blocks)
        
        # Stream download result
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": "attachment; filename=News_Report.docx"
            }
        )

    except Exception as e:
        logger.exception("Internal Generation Error")
        raise HTTPException(status_code=500, detail=str(e))
