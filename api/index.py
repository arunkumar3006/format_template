from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import logging

# Ensure imports work
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
        # Load Dataset (Lightweight mode)
        ds_content = await dataset.read()
        data, ds_msg = load_dataset(io.BytesIO(ds_content))
        
        # Check against list instead of dataframe empty
        if not data:
            raise HTTPException(status_code=400, detail=ds_msg)

        # Read Template
        tmpl_content = await template.read()
        template_info, tmpl_msg = read_template(io.BytesIO(tmpl_content))
        
        if not template_info.sections:
            raise HTTPException(status_code=400, detail="Could not detect template sections.")

        # Build article blocks (Passing list of dicts)
        blocks, build_msg = build_article_blocks(data, template_info)
        
        if not blocks:
            raise HTTPException(status_code=400, detail="No articles were found.")

        # Write Final Document
        buffer, write_msg = build_document(template_info, blocks)
        
        # Stream result back to client
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename=News_Report.docx"
            }
        )

    except Exception as e:
        logger.exception("Internal Generation Error")
        raise HTTPException(status_code=500, detail=str(e))
