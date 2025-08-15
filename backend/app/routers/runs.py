from __future__ import annotations

import threading
import uuid
import logging
from typing import Dict, Optional, List
from fastapi import APIRouter, HTTPException, Body, Request
from fastapi.responses import StreamingResponse
import asyncio
import json
from datetime import datetime

from ..models import RunResult, StepLog, WorkflowExecutionRequest
from ..services.workflow_engine import run_workflow_sync
from ..services.storage import get_workflow, load_run, list_runs, save_run
from ..services.streaming import stream_manager

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory cache of recent runs
_RUNS: Dict[str, RunResult] = {}


def _on_log_factory(run_id: str):
    def _on_log(log: StepLog) -> None:
        logger.info(f"Log generated for run {run_id}: {log.step_name} - {log.status}")
    return _on_log


def _run_in_thread(workflow_id: str, run_id: str, context: Optional[Dict] = None, playground_instance_id: Optional[str] = None) -> RunResult:
    logger.info(f"Starting workflow {workflow_id} with run_id {run_id} on playground {playground_instance_id or 'host'}")
    
    # Create a new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        wf = get_workflow(workflow_id)
        if not wf:
            raise RuntimeError("Workflow not found")
        
        logger.info(f"Publishing run_started event for run {run_id}")
        # Use the thread's event loop for streaming
        try:
            loop.run_until_complete(stream_manager.publish_run_started(run_id, workflow_id))
        except Exception as e:
            logger.warning(f"Failed to publish run_started event: {e}")
        
        result = run_workflow_sync(
            wf, 
            context=context, 
            run_id=run_id, 
            on_log=_on_log_factory(run_id),
            playground_instance_id=playground_instance_id
        )
        
        # Store the result in memory
        _RUNS[result.run_id] = result
        
        logger.info(f"Publishing run_finished event for run {run_id} with status {result.status}")
        # Use the thread's event loop for streaming
        try:
            loop.run_until_complete(stream_manager.publish_run_finished(result))
        except Exception as e:
            logger.warning(f"Failed to publish run_finished event: {e}")
        
        logger.info(f"Workflow execution completed for run {run_id} with status {result.status}")
        return result
        
    except Exception as e:
        logger.error(f"Error in workflow execution thread for run {run_id}: {str(e)}")
        
        # Create a failed result if we can
        try:
            failed_result = RunResult(
                run_id=run_id,
                workflow_id=workflow_id,
                status="error",
                context=context or {},
                playground_instance_id=playground_instance_id,
                finished_at=datetime.utcnow()
            )
            
            # Add error log
            error_log = StepLog(
                step_id="error",
                step_name="Workflow Execution Error",
                step_type="error",
                status="error",
                error=str(e),
                started_at=datetime.utcnow(),
                finished_at=datetime.utcnow()
            )
            failed_result.logs.append(error_log)
            
            # Store in memory and save
            _RUNS[run_id] = failed_result
            save_run(failed_result)
            
            # Publish error event using the thread's event loop
            try:
                loop.run_until_complete(stream_manager.publish_error(run_id, str(e)))
            except Exception as e:
                logger.warning(f"Failed to publish error event: {e}")
            
            return failed_result
            
        except Exception as save_error:
            logger.error(f"Failed to save error result for run {run_id}: {str(save_error)}")
            # Return a minimal error result
            return RunResult(
                run_id=run_id,
                workflow_id=workflow_id,
                status="error",
                context={"error": str(e)},
                playground_instance_id=playground_instance_id,
                finished_at=datetime.utcnow()
            )
    finally:
        # Clean up the event loop
        try:
            loop.close()
        except Exception as e:
            logger.warning(f"Failed to close event loop: {e}")


@router.get("/", response_model=List[RunResult])
def get_all_runs() -> List[RunResult]:
    return list_runs()


@router.post("/start/{workflow_id}")
def start_run(workflow_id: str, request: WorkflowExecutionRequest):
    wf = get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    run_id = str(uuid.uuid4())
    logger.info(f"Starting new run {run_id} for workflow {workflow_id} on playground {request.playground_instance_id or 'host'}")
    
    thread = threading.Thread(
        target=_run_in_thread, 
        args=(workflow_id, run_id, request.context, request.playground_instance_id), 
        daemon=True
    )
    thread.start()

    return {"status": "started", "run_id": run_id}


# Backward compatibility endpoint for old API format
@router.post("/")
def start_run_old_format(data: Dict = Body(...)):
    workflow_id = data.get("workflow_id")
    if not workflow_id:
        raise HTTPException(status_code=400, detail="workflow_id is required")
    
    context = data.get("context")
    playground_instance_id = data.get("playground_instance_id")
    
    request = WorkflowExecutionRequest(
        workflow_id=workflow_id,
        context=context,
        playground_instance_id=playground_instance_id
    )
    return start_run(workflow_id, request)


@router.get("/{run_id}", response_model=RunResult)
def get_run(run_id: str) -> RunResult:
    if run_id in _RUNS:
        return _RUNS[run_id]
    saved = load_run(run_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Run not found")
    _RUNS[run_id] = saved
    return saved


@router.get("/stream/{run_id}")
async def stream_execution(run_id: str, request: Request):
    """Stream execution updates using Server-Sent Events"""
    
    async def event_stream():
        # Send initial connection event
        yield f"data: {json.dumps({'type': 'connected', 'run_id': run_id})}\n\n"
        
        # Check if run exists and send current status
        current_run = _RUNS.get(run_id)
        if current_run:
            # Send current logs
            for log in current_run.logs:
                event_data = {
                    "type": "log",
                    "run_id": run_id,
                    "data": {
                        "step_id": log.step_id,
                        "step_name": log.step_name,
                        "step_type": log.step_type,
                        "status": log.status,
                        "started_at": log.started_at.isoformat() if log.started_at else None,
                        "finished_at": log.finished_at.isoformat() if log.finished_at else None,
                        "output": log.output,
                        "error": log.error
                    }
                }
                yield f"data: {json.dumps(event_data)}\n\n"
            
            # Send current status if finished
            if current_run.status in ['success', 'error']:
                event_data = {
                    "type": "run_finished",
                    "run_id": run_id,
                    "data": {
                        "workflow_id": current_run.workflow_id,
                        "status": current_run.status,
                        "finished_at": current_run.finished_at.isoformat() if current_run.finished_at else None
                    }
                }
                yield f"data: {json.dumps(event_data)}\n\n"
        
        # Subscribe to stream and get queue
        queue = await stream_manager.subscribe(run_id)
        
        try:
            # Keep connection alive and stream events
            while True:
                # Check if client is still connected
                if await request.is_disconnected():
                    break
                
                try:
                    # Wait for events with timeout
                    event = await asyncio.wait_for(queue.get(), timeout=1.0)
                    
                    # Send the event
                    event_data = {
                        "type": event.type,
                        "run_id": event.run_id,
                        "data": event.data
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"
                    
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    yield f"data: {json.dumps({'type': 'heartbeat', 'run_id': run_id})}\n\n"
                
        except Exception as e:
            logger.error(f"Error in stream for run {run_id}: {e}")
            error_event = {
                "type": "error",
                "run_id": run_id,
                "data": {"error": str(e)}
            }
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            # Unsubscribe from stream
            await stream_manager.unsubscribe(run_id, queue)
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    ) 