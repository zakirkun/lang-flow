from __future__ import annotations

from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException

from ..models import Workflow
from ..services.storage import list_workflows, get_workflow, upsert_workflow, delete_workflow

router = APIRouter()


@router.get("/", response_model=List[Workflow])
def get_all() -> List[Workflow]:
    return list_workflows()


@router.get("/{workflow_id}", response_model=Workflow)
def get_one(workflow_id: str) -> Workflow:
    wf = get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@router.post("/", response_model=Workflow)
def create_workflow(workflow: Workflow) -> Workflow:
    workflow.created_at = datetime.utcnow()
    workflow.updated_at = datetime.utcnow()
    return upsert_workflow(workflow)


@router.put("/{workflow_id}", response_model=Workflow)
def update_workflow(workflow_id: str, workflow: Workflow) -> Workflow:
    if workflow_id != workflow.id:
        raise HTTPException(status_code=400, detail="ID mismatch")
    workflow.updated_at = datetime.utcnow()
    return upsert_workflow(workflow)


@router.delete("/{workflow_id}")
def remove_workflow(workflow_id: str) -> dict:
    delete_workflow(workflow_id)
    return {"ok": True} 