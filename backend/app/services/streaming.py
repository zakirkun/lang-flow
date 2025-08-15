from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Callable, Any
from ..models import StepLog, RunResult, StreamEvent

logger = logging.getLogger(__name__)

class ExecutionStreamManager:
    """Manages execution streams for real-time updates"""
    
    def __init__(self):
        self._streams: Dict[str, List[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()
    
    async def subscribe(self, run_id: str) -> asyncio.Queue:
        """Subscribe to execution stream for a specific run"""
        async with self._lock:
            if run_id not in self._streams:
                self._streams[run_id] = []
            queue = asyncio.Queue()
            self._streams[run_id].append(queue)
            logger.info(f"Subscribed to stream for run {run_id}")
            return queue
    
    async def unsubscribe(self, run_id: str, queue: asyncio.Queue) -> None:
        """Unsubscribe from execution stream"""
        async with self._lock:
            if run_id in self._streams:
                try:
                    self._streams[run_id].remove(queue)
                    if not self._streams[run_id]:
                        del self._streams[run_id]
                    logger.info(f"Unsubscribed from stream for run {run_id}")
                except ValueError:
                    pass
    
    async def publish(self, run_id: str, event_type: str, data: Dict[str, Any]) -> None:
        """Publish an event to all subscribers of a run"""
        event = StreamEvent(
            type=event_type,
            run_id=run_id,
            timestamp=datetime.utcnow().isoformat(),
            data=data
        )
        
        async with self._lock:
            queues = self._streams.get(run_id, [])
        
        # Notify all subscribers
        for queue in queues:
            try:
                await queue.put(event)
                logger.debug(f"Published {event_type} event to subscriber for run {run_id}")
            except Exception as e:
                logger.error(f"Error publishing to subscriber for run {run_id}: {e}")
    
    async def publish_log(self, run_id: str, log: StepLog) -> None:
        """Publish a log event"""
        await self.publish(run_id, "log", {
            "step_id": log.step_id,
            "step_name": log.step_name,
            "step_type": log.step_type,
            "status": log.status,
            "started_at": log.started_at.isoformat() if log.started_at else None,
            "finished_at": log.finished_at.isoformat() if log.finished_at else None,
            "output": log.output,
            "error": log.error
        })
    
    async def publish_step_progress(self, run_id: str, current_step: int, total_steps: int, step_name: str) -> None:
        """Publish step progress update"""
        await self.publish(run_id, "step_progress", {
            "current_step": current_step,
            "total_steps": total_steps,
            "step_name": step_name
        })
    
    async def publish_run_started(self, run_id: str, workflow_id: str) -> None:
        """Publish run started event"""
        await self.publish(run_id, "run_started", {
            "workflow_id": workflow_id
        })
    
    async def publish_run_finished(self, result: RunResult) -> None:
        """Publish run finished event"""
        await self.publish(result.run_id, "run_finished", {
            "workflow_id": result.workflow_id,
            "status": result.status,
            "finished_at": result.finished_at.isoformat() if result.finished_at else None
        })
    
    async def publish_error(self, run_id: str, error: str) -> None:
        """Publish error event"""
        await self.publish(run_id, "error", {
            "error": error
        })

# Global instance
stream_manager = ExecutionStreamManager() 