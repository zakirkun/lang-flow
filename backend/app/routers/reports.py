import os
import uuid
import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from typing import Dict, Any

from ..services.report_generator import report_generator
from ..services.storage import load_run

router = APIRouter()


@router.post("/generate/{run_id}")
async def generate_report(run_id: str) -> Dict[str, Any]:
    """Generate a formal PDF report for a specific run"""
    
    try:
        # Load run data
        run_result = load_run(run_id)
        if not run_result:
            raise HTTPException(status_code=404, detail="Run not found")
        
        # Create reports directory if it doesn't exist
        reports_dir = "backend/data/reports"
        os.makedirs(reports_dir, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{run_id}_{timestamp}.pdf"
        output_path = os.path.join(reports_dir, filename)
        
        # Generate report
        report_path = await report_generator.generate_formal_report(run_result, output_path)
        
        return {
            "status": "success",
            "message": "Report generated successfully",
            "report_id": f"{run_id}_{timestamp}",
            "filename": filename,
            "download_url": f"/api/reports/download/{filename}"
        }
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Run not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/download/{filename}")
async def download_report(filename: str):
    """Download a generated report file"""
    
    try:
        reports_dir = "backend/data/reports"
        file_path = os.path.join(reports_dir, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Report file not found")
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download report: {str(e)}")


@router.get("/list")
async def list_reports() -> Dict[str, Any]:
    """List all available reports"""
    
    try:
        reports_dir = "backend/data/reports"
        
        if not os.path.exists(reports_dir):
            return {"reports": []}
        
        reports = []
        for filename in os.listdir(reports_dir):
            if filename.endswith('.pdf'):
                file_path = os.path.join(reports_dir, filename)
                stat = os.stat(file_path)
                
                # Parse filename to extract run_id and timestamp
                parts = filename.replace('.pdf', '').split('_')
                if len(parts) >= 3:
                    run_id = parts[1]
                    timestamp = '_'.join(parts[2:])
                else:
                    run_id = "unknown"
                    timestamp = "unknown"
                
                reports.append({
                    "filename": filename,
                    "run_id": run_id,
                    "generated_at": timestamp,
                    "size": stat.st_size,
                    "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    "download_url": f"/api/reports/download/{filename}"
                })
        
        # Sort by creation time (newest first)
        reports.sort(key=lambda x: x['created'], reverse=True)
        
        return {"reports": reports}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reports: {str(e)}")


@router.delete("/delete/{filename}")
async def delete_report(filename: str) -> Dict[str, Any]:
    """Delete a report file"""
    
    try:
        reports_dir = "backend/data/reports"
        file_path = os.path.join(reports_dir, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Report file not found")
        
        os.remove(file_path)
        
        return {
            "status": "success",
            "message": f"Report {filename} deleted successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")


@router.get("/status/{run_id}")
async def get_report_status(run_id: str) -> Dict[str, Any]:
    """Get report generation status for a run"""
    
    try:
        reports_dir = "backend/data/reports"
        
        if not os.path.exists(reports_dir):
            return {
                "has_report": False,
                "reports": []
            }
        
        # Find reports for this run_id
        matching_reports = []
        for filename in os.listdir(reports_dir):
            if filename.startswith(f"report_{run_id}_") and filename.endswith('.pdf'):
                file_path = os.path.join(reports_dir, filename)
                stat = os.stat(file_path)
                
                matching_reports.append({
                    "filename": filename,
                    "size": stat.st_size,
                    "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    "download_url": f"/api/reports/download/{filename}"
                })
        
        # Sort by creation time (newest first)
        matching_reports.sort(key=lambda x: x['created'], reverse=True)
        
        return {
            "has_report": len(matching_reports) > 0,
            "reports": matching_reports
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check report status: {str(e)}")
