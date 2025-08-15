from __future__ import annotations

from typing import Dict, List, Literal, Optional, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime


class AIModel(BaseModel):
    provider: Literal["openai"] = Field(default="openai")
    model: str = Field(default_factory=lambda: "gpt-4o-mini")
    api_key: Optional[str] = None


class EmailConfig(BaseModel):
    type: Literal["email"] = "email"
    smtp_server: str
    smtp_port: int = 587
    smtp_username: str
    smtp_password: str
    from_email: str
    to_emails: List[str]
    use_tls: bool = True


class TelegramConfig(BaseModel):
    type: Literal["telegram"] = "telegram"
    bot_token: str
    chat_ids: List[str]


class SlackConfig(BaseModel):
    type: Literal["slack"] = "slack"
    webhook_url: str
    channel: Optional[str] = None
    username: Optional[str] = "LangFlow Bot"


class ReportChannel(BaseModel):
    type: Literal["email", "telegram", "slack"]
    config: Union[EmailConfig, TelegramConfig, SlackConfig] = Field(discriminator='type')


class ReportConfig(BaseModel):
    channels: List[ReportChannel] = Field(default_factory=list)
    template: Optional[str] = None
    subject: Optional[str] = None


class PentestStep(BaseModel):
    id: str
    name: str
    type: Literal["ai", "command", "report"]
    description: Optional[str] = None

    # AI step fields
    prompt: Optional[str] = None
    model: Optional[AIModel] = None

    # Command step fields
    command: Optional[str] = None
    working_dir: Optional[str] = None
    timeout_seconds: int = 90

    # Report step fields
    report_config: Optional[ReportConfig] = None

    # Inputs/templating
    inputs: Dict[str, Any] = Field(default_factory=dict)


class Workflow(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    steps: List[PentestStep] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    graph: Optional[Dict[str, Any]] = None


class StepLog(BaseModel):
    step_id: str
    step_name: str
    step_type: Literal["ai", "command", "report"]
    status: Literal["pending", "running", "success", "error"] = "pending"
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    output: Optional[str] = None
    error: Optional[str] = None


class RunResult(BaseModel):
    run_id: str
    workflow_id: str
    status: Literal["running", "success", "error"] = "running"
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
    context: Dict[str, Any] = Field(default_factory=dict)
    logs: List[StepLog] = Field(default_factory=list)
    playground_instance_id: Optional[str] = None


class WorkflowExecutionRequest(BaseModel):
    workflow_id: str
    playground_instance_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class StreamEvent(BaseModel):
    type: str
    run_id: str
    timestamp: str
    data: Dict[str, Any]


# Virtual Playground Models
class PlaygroundInstance(BaseModel):
    id: str
    name: str
    container_id: str
    ssh_port: int
    docker_port: int
    web_port: int
    status: Literal["creating", "running", "stopped", "error", "expired", "installing"] = "creating"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    environment: Dict[str, str] = Field(default_factory=dict)
    resource_limits: Dict[str, Any] = Field(default_factory=dict)


class PlaygroundCommand(BaseModel):
    command: str
    working_dir: Optional[str] = None
    environment: Optional[Dict[str, str]] = None


class PlaygroundStats(BaseModel):
    cpu_usage: float
    memory_usage: float
    memory_limit: int
    disk_usage: float
    network_rx: int
    network_tx: int
    uptime: int
    containers_count: int 

class CreateDirectoryRequest(BaseModel):
    dir_path: str

class UploadFileRequest(BaseModel):
    file_path: str
    content: str