from __future__ import annotations

import subprocess
import shlex
import os
from typing import Optional
from ..models import PlaygroundInstance
from .playground_service import playground_service


def run_command(command: str, cwd: Optional[str] = None, timeout_seconds: int = 90, playground_instance_id: Optional[str] = None) -> str:
    # If playground instance is specified, run command in container
    if playground_instance_id:
        return run_command_in_playground(command, cwd, timeout_seconds, playground_instance_id)
    
    # WARNING: Executing arbitrary commands is dangerous. Ensure trusted inputs only.
    shell = True  # Use shell for cross-platform simplicity; prefer explicit binaries in production
    try:
        completed = subprocess.run(
            command,
            shell=shell,
            cwd=cwd or os.getcwd(),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
        stdout = completed.stdout or ""
        stderr = completed.stderr or ""
        output = stdout
        if stderr:
            output += ("\n[stderr]\n" + stderr)
        if completed.returncode != 0:
            output += f"\n[exit_code]={completed.returncode}"
        return output.strip()
    except subprocess.TimeoutExpired as e:
        return f"Command timed out after {timeout_seconds}s. Partial output: {e.stdout or ''}"


def run_command_in_playground(command: str, cwd: Optional[str] = None, timeout_seconds: int = 90, playground_instance_id: str = None) -> str:
    """Run a command inside a playground container"""
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Executing command in playground {playground_instance_id}: {command}")
        
        # Validate inputs
        if not playground_instance_id:
            error_msg = "Error: Playground instance ID is required"
            logger.error(error_msg)
            return error_msg
        
        if not command or not command.strip():
            error_msg = "Error: Command cannot be empty"
            logger.error(error_msg)
            return error_msg
        
        # Check if playground service is available
        try:
            if not playground_service or not hasattr(playground_service, 'client'):
                error_msg = "Error: Playground service is not properly initialized"
                logger.error(error_msg)
                return error_msg
        except Exception as e:
            error_msg = f"Error: Failed to access playground service: {str(e)}"
            logger.error(error_msg)
            return error_msg
        
        # Get the playground instance
        try:
            instance = playground_service.get_instance(playground_instance_id)
        except Exception as e:
            error_msg = f"Error: Failed to get playground instance {playground_instance_id}: {str(e)}"
            logger.error(error_msg)
            return error_msg
        
        if not instance:
            error_msg = f"Error: Playground instance {playground_instance_id} not found"
            logger.error(error_msg)
            return error_msg
        
        if instance.status != 'running':
            error_msg = f"Error: Playground instance {playground_instance_id} is not running (status: {instance.status})"
            logger.error(error_msg)
            return error_msg
        
        if not instance.container_id:
            error_msg = f"Error: Playground instance {playground_instance_id} has no container ID"
            logger.error(error_msg)
            return error_msg
        
        logger.info(f"Found running playground instance: {instance.name} (container: {instance.container_id})")
        
        # Get the container
        try:
            container = playground_service.client.containers.get(instance.container_id)
        except Exception as e:
            error_msg = f"Error: Could not access container {instance.container_id}: {str(e)}"
            logger.error(error_msg)
            return error_msg
        
        # Verify container is running
        if container.status != 'running':
            error_msg = f"Error: Container {instance.container_id} is not running (status: {container.status})"
            logger.error(error_msg)
            return error_msg
        
        # Set working directory
        workdir = cwd or "/playground"
        logger.info(f"Executing command in container {instance.container_id} at {workdir}")
        
        # Execute command in container
        # Note: Docker exec_run doesn't support timeout parameter
        try:
            result = container.exec_run(
                command,
                workdir=workdir
            )
            
            stdout = result.output.decode('utf-8', errors='ignore') if result.output else ""
            exit_code = result.exit_code
            
            logger.info(f"Command completed with exit code {exit_code}")
            
            output = stdout
            if exit_code != 0:
                output += f"\n[exit_code]={exit_code}"
            
            return output.strip()
            
        except Exception as e:
            error_msg = f"Error executing command in container: {str(e)}"
            logger.error(error_msg)
            return error_msg
        
    except Exception as e:
        error_msg = f"Error executing command in playground: {str(e)}"
        logger.error(error_msg)
        return error_msg 