from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import logging
import sys
import os

# Ensure the 'api' directory is in path for absolute imports on Vercel
sys.path.append(os.path.dirname(__file__))

# Absolute imports (Stable for Vercel)
try:
    import data_loader
    import template_reader
    import report_builder
    import docx_writer
except ImportError:
    # Fallback for different build environments
    from . import data_loader
    from . import template_reader
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

@app.post("/api/generate")
async def generate_report(
    dataset: UploadFile = File(...),
    template: UploadFile = File(...)
):
    try:
        # 1. Load Dataset
        ds_content = await dataset.read()
        data, ds_msg = data_loader.load_dataset(io.BytesIO(ds_content))
        
        if not data:
            return JSONResponse(status_code=400, content={"detail": ds_msg})

        # 2. Read Template
        tmpl_content = await template.read()
        template_info, tmpl_msg = template_reader.read_template(io.BytesIO(tmpl_content))
        
        if not template_info.sections:
            return JSONResponse(status_code=400, content={"detail": "Detecting template failed."})

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
