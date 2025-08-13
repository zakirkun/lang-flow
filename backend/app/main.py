import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from .routers import workflows, runs, terminal, playground

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(
    title="LangFlow API",
    description="AI-Powered Security Automation Workflow Engine",
    version="1.0.0"
)

# CORS configuration
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create data directories
data_dir = Path("data")
data_dir.mkdir(exist_ok=True)
runs_dir = Path(os.getenv("RUNS_DIR", "data/runs"))
runs_dir.mkdir(exist_ok=True)

# Include routers
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(terminal.router, prefix="/api/terminal", tags=["terminal"])
app.include_router(playground.router, prefix="/api/playground", tags=["playground"])

@app.get("/")
async def root():
    return {
        "message": "🚀 LangFlow API - AI-Powered Security Automation",
        "version": "1.0.0",
        "features": [
            "AI Workflow Engine",
            "Command Execution",
            "Report Generation", 
            "Real-time Logs",
            "Interactive Terminal",
            "Virtual Playground"
        ]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "LangFlow API is running"}
