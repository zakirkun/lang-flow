from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional
from threading import RLock

from ..models import Workflow, RunResult, PlaygroundInstance

_DATA_DIR = Path("backend/data")
_WORKFLOWS_FILE = Path(os.getenv("WORKFLOWS_FILE", _DATA_DIR / "workflows.json"))
_PLAYGROUND_FILE = Path(os.getenv("PLAYGROUND_FILE", _DATA_DIR / "playground.json"))
_RUNS_DIR = Path(os.getenv("RUNS_DIR", _DATA_DIR / "runs"))

_LOCK = RLock()


def _ensure_storage():
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _RUNS_DIR.mkdir(parents=True, exist_ok=True)
    if not _WORKFLOWS_FILE.exists():
        _WORKFLOWS_FILE.write_text("[]", encoding="utf-8")
    if not _PLAYGROUND_FILE.exists():
        _PLAYGROUND_FILE.write_text("[]", encoding="utf-8")


def list_workflows() -> List[Workflow]:
    _ensure_storage()
    with _LOCK:
        data = json.loads(_WORKFLOWS_FILE.read_text(encoding="utf-8"))
    return [Workflow.model_validate(item) for item in data]


def get_workflow(workflow_id: str) -> Optional[Workflow]:
    for wf in list_workflows():
        if wf.id == workflow_id:
            return wf
    return None


def upsert_workflow(workflow: Workflow) -> Workflow:
    workflows = list_workflows()
    found = False
    for i, wf in enumerate(workflows):
        if wf.id == workflow.id:
            workflows[i] = workflow
            found = True
            break
    if not found:
        workflows.append(workflow)
    with _LOCK:
        _WORKFLOWS_FILE.write_text(
            json.dumps([w.model_dump(mode="json") for w in workflows], indent=2),
            encoding="utf-8",
        )
    return workflow


def delete_workflow(workflow_id: str) -> bool:
    workflows = list_workflows()
    workflows = [w for w in workflows if w.id != workflow_id]
    with _LOCK:
        _WORKFLOWS_FILE.write_text(
            json.dumps([w.model_dump(mode="json") for w in workflows], indent=2),
            encoding="utf-8",
        )
    return True


# Runs persistence (append-only per run)

def save_run(run: RunResult) -> None:
    _ensure_storage()
    run_path = _RUNS_DIR / f"{run.run_id}.json"
    with _LOCK:
        run_path.write_text(json.dumps(run.model_dump(mode="json"), indent=2), encoding="utf-8")


def load_run(run_id: str) -> Optional[RunResult]:
    run_path = _RUNS_DIR / f"{run_id}.json"
    if not run_path.exists():
        return None
    with _LOCK:
        data = json.loads(run_path.read_text(encoding="utf-8"))
    return RunResult.model_validate(data)


def list_runs() -> List[RunResult]:
    _ensure_storage()
    results: List[RunResult] = []
    for file in sorted(_RUNS_DIR.glob("*.json")):
        try:
            with _LOCK:
                data = json.loads(file.read_text(encoding="utf-8"))
            results.append(RunResult.model_validate(data))
        except Exception:
            continue
    return results


# Playground persistence

def list_playground_instances() -> List[PlaygroundInstance]:
    """Load all playground instances from storage"""
    _ensure_storage()
    with _LOCK:
        try:
            data = json.loads(_PLAYGROUND_FILE.read_text(encoding="utf-8"))
            return [PlaygroundInstance.model_validate(item) for item in data]
        except Exception:
            return []


def save_playground_instances(instances: List[PlaygroundInstance]) -> None:
    """Save all playground instances to storage"""
    _ensure_storage()
    with _LOCK:
        _PLAYGROUND_FILE.write_text(
            json.dumps([instance.model_dump(mode="json") for instance in instances], indent=2),
            encoding="utf-8",
        )


def get_playground_instance(instance_id: str) -> Optional[PlaygroundInstance]:
    """Get a playground instance by ID"""
    for instance in list_playground_instances():
        if instance.id == instance_id:
            return instance
    return None


def save_playground_instance(instance: PlaygroundInstance) -> None:
    """Save or update a single playground instance"""
    instances = list_playground_instances()
    found = False
    for i, existing in enumerate(instances):
        if existing.id == instance.id:
            instances[i] = instance
            found = True
            break
    if not found:
        instances.append(instance)
    save_playground_instances(instances)


def delete_playground_instance(instance_id: str) -> bool:
    """Delete a playground instance from storage"""
    instances = list_playground_instances()
    original_count = len(instances)
    instances = [instance for instance in instances if instance.id != instance_id]
    if len(instances) < original_count:
        save_playground_instances(instances)
        return True
    return False 