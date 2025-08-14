from typing import List, Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Body, Response
from pydantic import BaseModel
import asyncio
import json
import logging
import uuid
from datetime import datetime

from ..models import PlaygroundInstance, PlaygroundStats, PlaygroundCommand, PlaygroundTerminalSession
from ..services.playground_service import playground_service

router = APIRouter()
logger = logging.getLogger(__name__)

# Request/Response models
class CreateInstanceRequest(BaseModel):
    name: Optional[str] = None
    duration_hours: int = 4

class ExtendInstanceRequest(BaseModel):
    hours: int = 2

class PlaygroundResponse(BaseModel):
    status: str
    message: str
    data: Optional[dict] = None

# Active terminal sessions - keeping for backward compatibility but not used by file manager
active_sessions: dict = {}

@router.get("/", response_model=List[PlaygroundInstance])
async def list_instances():
    """List all playground instances"""
    try:
        instances = playground_service.list_instances()
        return instances
    except Exception as e:
        logger.error(f"Failed to list instances: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=PlaygroundInstance)
async def create_instance(request: CreateInstanceRequest):
    """Create a new playground instance"""
    try:
        instance = await playground_service.create_instance(
            name=request.name,
            duration_hours=request.duration_hours
        )
        return instance
    except Exception as e:
        logger.error(f"Failed to create instance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{instance_id}", response_model=PlaygroundInstance)
async def get_instance(instance_id: str):
    """Get instance details"""
    instance = playground_service.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Update status
    playground_service._update_instance_status(instance)
    return instance

@router.delete("/{instance_id}", response_model=PlaygroundResponse)
async def delete_instance(instance_id: str):
    """Delete a playground instance"""
    try:
        success = await playground_service.delete_instance(instance_id)
        if not success:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        return PlaygroundResponse(
            status="success",
            message=f"Instance {instance_id} deleted successfully"
        )
    except Exception as e:
        logger.error(f"Failed to delete instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{instance_id}/extend", response_model=PlaygroundResponse)
async def extend_instance(instance_id: str, request: ExtendInstanceRequest):
    """Extend instance session time"""
    try:
        success = await playground_service.extend_instance(instance_id, request.hours)
        if not success:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        return PlaygroundResponse(
            status="success",
            message=f"Instance {instance_id} extended by {request.hours} hours"
        )
    except Exception as e:
        logger.error(f"Failed to extend instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{instance_id}/refresh", response_model=PlaygroundResponse)
async def refresh_instance_status(instance_id: str):
    """Refresh and update instance status"""
    try:
        success = await playground_service.refresh_instance_status(instance_id)
        if not success:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        # Get updated instance
        instance = playground_service.get_instance(instance_id)
        status_message = f"Instance {instance_id} status: {instance.status}"
        
        if instance.status == "installing":
            status_message += " (Installing dependencies, please wait...)"
        elif instance.status == "running":
            status_message += " (Ready to use)"
        
        return PlaygroundResponse(
            status="success",
            message=status_message
        )
    except Exception as e:
        logger.error(f"Failed to refresh instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup", response_model=PlaygroundResponse)
async def cleanup_orphaned_containers():
    """Clean up orphaned containers and volumes"""
    try:
        playground_service.cleanup_orphaned_containers()
        return PlaygroundResponse(
            status="success",
            message="Orphaned containers and volumes cleaned up successfully"
        )
    except Exception as e:
        logger.error(f"Failed to cleanup orphaned containers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{instance_id}/command")
async def execute_command(instance_id: str, command: PlaygroundCommand):
    """Execute a command in the playground instance"""
    try:
        result = await playground_service.execute_command(instance_id, command)
        if result is None:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        return {
            "status": "success",
            "output": result,
            "command": command.command
        }
    except Exception as e:
        logger.error(f"Failed to execute command in instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{instance_id}/stats", response_model=PlaygroundStats)
async def get_instance_stats(instance_id: str):
    """Get instance resource usage statistics"""
    try:
        stats = await playground_service.get_instance_stats(instance_id)
        return stats  # The service method now always returns PlaygroundStats, never None
    except ValueError as e:
        # Instance not found
        logger.error(f"Instance not found for stats request {instance_id}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get stats for instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{instance_id}/files")
async def upload_file(instance_id: str, file_path: str = Body(...), content: str = Body(...)):
    """Upload a file to the playground instance"""
    try:
        instance = playground_service.get_instance(instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        container = playground_service.client.containers.get(instance.container_id)
        
        # Create file in container
        command = f"cat > {file_path} << 'EOF'\n{content}\nEOF"
        result = container.exec_run(command, workdir="/playground")
        
        if result.exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to create file: {result.output.decode()}")
        
        return PlaygroundResponse(
            status="success",
            message=f"File {file_path} uploaded successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to upload file to instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{instance_id}/files")
async def list_files(instance_id: str, path: str = "/playground"):
    """List files in the playground instance"""
    try:
        instance = playground_service.get_instance(instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        container = playground_service.client.containers.get(instance.container_id)
        
        # List files
        result = container.exec_run(f"ls -la {path}", workdir="/")
        
        if result.exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to list files: {result.output.decode()}")
        
        return {
            "status": "success",
            "path": path,
            "files": result.output.decode().strip().split('\n')
        }
        
    except Exception as e:
        logger.error(f"Failed to list files in instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{instance_id}/files/download")
async def download_file(instance_id: str, path: str):
    """Download a file from the playground instance"""
    try:
        instance = playground_service.get_instance(instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        container = playground_service.client.containers.get(instance.container_id)
        
        # Read file content
        result = container.exec_run(f"cat {path}", workdir="/")
        
        if result.exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to read file: {result.output.decode()}")
        
        return Response(
            content=result.output.decode(),
            media_type="text/plain"
        )
        
    except Exception as e:
        logger.error(f"Failed to download file from instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{instance_id}/files/delete")
async def delete_file(instance_id: str, file_path: str = Body(...)):
    """Delete a file from the playground instance"""
    try:
        instance = playground_service.get_instance(instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        container = playground_service.client.containers.get(instance.container_id)
        
        # Delete file
        result = container.exec_run(f"rm -f {file_path}", workdir="/")
        
        if result.exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {result.output.decode()}")
        
        return PlaygroundResponse(
            status="success",
            message=f"File {file_path} deleted successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to delete file from instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{instance_id}/files/mkdir")
async def create_directory(instance_id: str, dir_path: str = Body(...)):
    """Create a directory in the playground instance"""
    try:
        instance = playground_service.get_instance(instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        container = playground_service.client.containers.get(instance.container_id)
        
        # Create directory
        result = container.exec_run(f"mkdir -p {dir_path}", workdir="/")
        
        if result.exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to create directory: {result.output.decode()}")
        
        return PlaygroundResponse(
            status="success",
            message=f"Directory {dir_path} created successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to create directory in instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 