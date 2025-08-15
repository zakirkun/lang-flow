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
from .streaming import stream_manager


def run_workflow_sync(
    workflow: Workflow,
    context: Optional[Dict] = None,
    on_log: Optional[Callable[[StepLog], None]] = None,
    run_id: Optional[str] = None,
    playground_instance_id: Optional[str] = None,
) -> RunResult:
    import logging
    logger = logging.getLogger(__name__)
    
    rid = run_id or str(uuid.uuid4())
    logger.info(f"Starting workflow execution: {workflow.id} with run_id {rid}")
    
    result = RunResult(
        run_id=rid, 
        workflow_id=workflow.id, 
        status="running", 
        context=context or {},
        playground_instance_id=playground_instance_id
    )

    # Add workflow metadata to context
    result.context["workflow_name"] = workflow.name
    result.context["workflow_id"] = workflow.id
    if playground_instance_id:
        result.context["playground_instance_id"] = playground_instance_id

    total_steps = len(workflow.steps)
    logger.info(f"Workflow has {total_steps} steps to execute")
    
    try:
        for step_index, step in enumerate(workflow.steps, 1):
            logger.info(f"Executing step {step_index}/{total_steps}: {step.name} ({step.type})")
            
            # Send step progress update via streaming (non-blocking)
            try:
                # Get the current thread's event loop
                loop = asyncio.get_running_loop()
                # Create a task for non-blocking execution
                loop.create_task(stream_manager.publish_step_progress(rid, step_index, total_steps, step.name))
            except RuntimeError:
                # No running loop, use asyncio.run
                asyncio.run(stream_manager.publish_step_progress(rid, step_index, total_steps, step.name))
            except Exception as e:
                logger.warning(f"Failed to publish step progress: {e}")
            
            log = StepLog(step_id=step.id, step_name=step.name, step_type=step.type, status="running", started_at=datetime.utcnow())
            result.logs.append(log)
            
            # Publish log via streaming (non-blocking)
            try:
                # Get the current thread's event loop
                loop = asyncio.get_running_loop()
                # Create a task for non-blocking execution
                loop.create_task(stream_manager.publish_log(rid, log))
            except RuntimeError:
                # No running loop, use asyncio.run
                asyncio.run(stream_manager.publish_log(rid, log))
            except Exception as e:
                logger.warning(f"Failed to publish log: {e}")
            
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
                    logger.info(f"Executing command: {command_text}")
                    output = run_command(
                        command_text, 
                        cwd=step.working_dir, 
                        timeout_seconds=step.timeout_seconds,
                        playground_instance_id=playground_instance_id
                    )
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
                logger.info(f"Step {step.name} completed successfully")
                
            except Exception as e:
                logger.error(f"Step {step.name} failed with error: {str(e)}")
                log.status = "error"
                log.error = str(e)
                result.status = "error"
                log.finished_at = datetime.utcnow()
                
                # Publish error log via streaming (non-blocking)
                try:
                    # Get the current thread's event loop
                    loop = asyncio.get_running_loop()
                    # Create a task for non-blocking execution
                    loop.create_task(stream_manager.publish_log(rid, log))
                except RuntimeError:
                    # No running loop, use asyncio.run
                    asyncio.run(stream_manager.publish_log(rid, log))
                except Exception as e:
                    logger.warning(f"Failed to publish error log: {e}")
                
                if on_log:
                    on_log(log)
                
                # Save the failed result
                logger.info(f"Saving failed run result for run {rid}")
                save_run(result)
                return result
                
            finally:
                log.finished_at = datetime.utcnow()
                
                # Publish final log status via streaming (non-blocking)
                try:
                    # Get the current thread's event loop
                    loop = asyncio.get_running_loop()
                    # Create a task for non-blocking execution
                    loop.create_task(stream_manager.publish_log(rid, log))
                except RuntimeError:
                    # No running loop, use asyncio.run
                    asyncio.run(stream_manager.publish_log(rid, log))
                except Exception as e:
                    logger.warning(f"Failed to publish final log: {e}")
                
                if on_log:
                    on_log(log)

        result.status = "success"
        result.finished_at = datetime.utcnow()
        logger.info(f"Workflow execution completed successfully for run {rid}")
        
    except Exception as e:
        logger.error(f"Unexpected error during workflow execution for run {rid}: {str(e)}")
        result.status = "error"
        result.finished_at = datetime.utcnow()
        # Save the failed result
        save_run(result)
        return result
    
    # Save the successful result
    logger.info(f"Saving successful run result for run {rid}")
    save_run(result)
    return result 