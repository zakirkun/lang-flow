import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .routers import workflows, runs, terminal, reports

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="LangFlow API")

# CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure data directories exist
runs_dir = Path(os.getenv("RUNS_DIR", "data/runs"))
runs_dir.mkdir(parents=True, exist_ok=True)

workflows_file = Path(os.getenv("WORKFLOWS_FILE", "data/workflows.json"))
workflows_file.parent.mkdir(parents=True, exist_ok=True)

reports_dir = Path(os.getenv("REPORTS_DIR", "data/reports"))
reports_dir.mkdir(parents=True, exist_ok=True)

app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(terminal.router, prefix="/api/terminal", tags=["terminal"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

logger.info("LangFlow API started successfully")

@app.get("/")
def read_root():
    return {"message": "LangFlow API"} 