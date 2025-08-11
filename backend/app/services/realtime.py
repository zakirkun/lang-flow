from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Dict, List

from ..models import StepLog, RunResult


@dataclass
class Subscriber:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[str]


class RunLogBroker:
    def __init__(self) -> None:
        self._subs: Dict[str, List[Subscriber]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: str) -> Subscriber:
        queue: asyncio.Queue[str] = asyncio.Queue()
        sub = Subscriber(asyncio.get_event_loop(), queue)
        async with self._lock:
            self._subs.setdefault(run_id, []).append(sub)
        return sub

    async def unsubscribe(self, run_id: str, sub: Subscriber) -> None:
        async with self._lock:
            lst = self._subs.get(run_id, [])
            if sub in lst:
                lst.remove(sub)
            if not lst and run_id in self._subs:
                del self._subs[run_id]

    def publish(self, run_id: str, message: str) -> None:
        for sub in list(self._subs.get(run_id, [])):
            try:
                sub.loop.call_soon_threadsafe(sub.queue.put_nowait, message)
            except RuntimeError:
                # Subscriber loop likely closed; ignore
                pass


broker = RunLogBroker()


def json_log_event(run_id: str, log: StepLog) -> str:
    return json.dumps({
        "type": "log",
        "run_id": run_id,
        "payload": log.model_dump(mode="json"),
    })


def json_run_started(run_id: str, workflow_id: str) -> str:
    return json.dumps({
        "type": "run_started",
        "run_id": run_id,
        "workflow_id": workflow_id,
    })


def json_run_finished(result: RunResult) -> str:
    return json.dumps({
        "type": "run_finished",
        "run_id": result.run_id,
        "workflow_id": result.workflow_id,
        "status": result.status,
        "finished_at": result.finished_at.isoformat() if result.finished_at else None,
    }) 