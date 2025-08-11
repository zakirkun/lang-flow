from __future__ import annotations

import os
import uuid
import asyncio
from datetime import datetime
from typing import Callable, Dict, Optional

from ..models import Workflow, RunResult, StepLog
from .ai import render_prompt, run_ai_completion
from .command_executor import run_command
from .storage import save_run
from .report_service import report_service


def run_workflow_sync(
    workflow: Workflow,
    context: Optional[Dict] = None,
    on_log: Optional[Callable[[StepLog], None]] = None,
    run_id: Optional[str] = None,
) -> RunResult:
    rid = run_id or str(uuid.uuid4())
    result = RunResult(run_id=rid, workflow_id=workflow.id, status="running", context=context or {})

    # Add workflow metadata to context
    result.context["workflow_name"] = workflow.name
    result.context["workflow_id"] = workflow.id

    for step in workflow.steps:
        log = StepLog(step_id=step.id, step_name=step.name, step_type=step.type, status="running", started_at=datetime.utcnow())
        result.logs.append(log)
        if on_log:
            on_log(log)
        try:
            if step.type == "ai":
                assert step.prompt, "AI step requires 'prompt'"
                model_name = (step.model.model if step.model else None) or \
                    (os.getenv("DEFAULT_MODEL_NAME") or "gpt-4o-mini")
                api_key = step.model.api_key if step.model else None
                prompt_text = render_prompt(step.prompt, {**result.context, **(step.inputs or {})})
                output = run_ai_completion(prompt_text, model_name=model_name, api_key=api_key)
                log.output = output
                result.context[step.id] = output
                result.context[step.name] = output  # Also allow reference by name
                result.context["last_output"] = output
                
            elif step.type == "command":
                assert step.command, "Command step requires 'command'"
                # Render command with context
                command_text = render_prompt(step.command, {**result.context, **(step.inputs or {})})
                output = run_command(command_text, cwd=step.working_dir, timeout_seconds=step.timeout_seconds)
                log.output = output
                result.context[step.id] = output
                result.context[step.name] = output  # Also allow reference by name
                result.context["last_output"] = output
                
            elif step.type == "report":
                assert step.report_config, "Report step requires 'report_config'"
                assert step.report_config.channels, "Report step requires at least one channel"
                
                # Send report asynchronously
                report_results = asyncio.run(report_service.send_report(step.report_config, result.context))
                
                # Format output
                successful_channels = [k for k, v in report_results.items() if v.get("success")]
                failed_channels = [k for k, v in report_results.items() if not v.get("success")]
                
                output_lines = []
                if successful_channels:
                    output_lines.append(f"✅ Successfully sent to: {', '.join(successful_channels)}")
                if failed_channels:
                    output_lines.append(f"❌ Failed to send to: {', '.join(failed_channels)}")
                    for channel in failed_channels:
                        error = report_results[channel].get("error", "Unknown error")
                        output_lines.append(f"  - {channel}: {error}")
                
                log.output = "\n".join(output_lines)
                result.context[step.id] = report_results
                result.context[step.name] = report_results
                result.context["last_output"] = log.output
                
            else:
                raise ValueError(f"Unknown step type: {step.type}")
            
            log.status = "success"
        except Exception as e:
            log.status = "error"
            log.error = str(e)
            result.status = "error"
            log.finished_at = datetime.utcnow()
            if on_log:
                on_log(log)
            save_run(result)
            return result
        finally:
            log.finished_at = datetime.utcnow()
            if on_log:
                on_log(log)

    result.status = "success"
    result.finished_at = datetime.utcnow()
    save_run(result)
    return result 