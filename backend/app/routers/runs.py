from __future__ import annotations

import threading
import uuid
import logging
from typing import Dict, Optional, List
from fastapi import APIRouter, HTTPException, Body, WebSocket, WebSocketDisconnect

from ..models import RunResult, StepLog
from ..services.workflow_engine import run_workflow_sync
from ..services.storage import get_workflow, load_run, list_runs
from ..services.realtime import broker, json_log_event, json_run_started, json_run_finished

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory cache of recent runs
_RUNS: Dict[str, RunResult] = {}


def _on_log_factory(run_id: str):
    def _on_log(log: StepLog) -> None:
        logger.info(f"Publishing log for run {run_id}: {log.step_name} - {log.status}")
        broker.publish(run_id, json_log_event(run_id, log))
    return _on_log


def _run_in_thread(workflow_id: str, run_id: str, context: Optional[Dict] = None) -> RunResult:
    logger.info(f"Starting workflow {workflow_id} with run_id {run_id}")
    wf = get_workflow(workflow_id)
    if not wf:
        raise RuntimeError("Workflow not found")
    
    logger.info(f"Publishing run_started event for run {run_id}")
    broker.publish(run_id, json_run_started(run_id, workflow_id))
    
    result = run_workflow_sync(wf, context=context, run_id=run_id, on_log=_on_log_factory(run_id))
    _RUNS[result.run_id] = result
    
    logger.info(f"Publishing run_finished event for run {run_id} with status {result.status}")
    broker.publish(run_id, json_run_finished(result))
    
    return result


@router.get("/", response_model=List[RunResult])
def get_all_runs() -> List[RunResult]:
    return list_runs()


@router.post("/start/{workflow_id}")
def start_run(workflow_id: str, context: Optional[Dict] = Body(default=None)):
    wf = get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    run_id = str(uuid.uuid4())
    logger.info(f"Starting new run {run_id} for workflow {workflow_id}")
    
    thread = threading.Thread(target=_run_in_thread, args=(workflow_id, run_id, context), daemon=True)
    thread.start()

    return {"status": "started", "run_id": run_id}


# Backward compatibility endpoint for old API format
@router.post("/")
def start_run_old_format(data: Dict = Body(...)):
    workflow_id = data.get("workflow_id")
    if not workflow_id:
        raise HTTPException(status_code=400, detail="workflow_id is required")
    
    context = data.get("context")
    return start_run(workflow_id, context)


@router.get("/{run_id}", response_model=RunResult)
def get_run(run_id: str) -> RunResult:
    if run_id in _RUNS:
        return _RUNS[run_id]
    saved = load_run(run_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Run not found")
    _RUNS[run_id] = saved
    return saved


@router.websocket("/ws/{run_id}")
async def ws_run(websocket: WebSocket, run_id: str):
    logger.info(f"WebSocket connection attempt for run_id: {run_id}")
    await websocket.accept()
    logger.info(f"WebSocket connection accepted for run_id: {run_id}")
    
    sub = await broker.subscribe(run_id)
    logger.info(f"Subscribed to broker for run_id: {run_id}")
    
    try:
        # Send initial connection confirmation
        await websocket.send_text('{"type": "connected", "run_id": "' + run_id + '"}')
        
        while True:
            msg = await sub.queue.get()
            logger.info(f"Sending WebSocket message for run {run_id}: {msg[:100]}...")
            await websocket.send_text(msg)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for run_id: {run_id}")
    except Exception as e:
        logger.error(f"WebSocket error for run_id {run_id}: {e}")
    finally:
        logger.info(f"Cleaning up WebSocket subscription for run_id: {run_id}")
        await broker.unsubscribe(run_id, sub) 