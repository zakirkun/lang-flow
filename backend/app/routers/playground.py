from typing import List, Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Body
from pydantic import BaseModel
import asyncio
import json
import logging
import uuid
from datetime import datetime

from ..models import PlaygroundInstance, PlaygroundStats, PlaygroundCommand, PlaygroundTerminalSession
from ..services.playground_service import playground_service

router = APIRouter()
logger = logging.getLogger(__name__)

# Request/Response models
class CreateInstanceRequest(BaseModel):
    name: Optional[str] = None
    duration_hours: int = 4

class ExtendInstanceRequest(BaseModel):
    hours: int = 2

class PlaygroundResponse(BaseModel):
    status: str
    message: str
    data: Optional[dict] = None

# Active terminal sessions
active_sessions: dict = {}

@router.get("/", response_model=List[PlaygroundInstance])
async def list_instances():
    """List all playground instances"""
    try:
        instances = playground_service.list_instances()
        return instances
    except Exception as e:
        logger.error(f"Failed to list instances: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=PlaygroundInstance)
async def create_instance(request: CreateInstanceRequest):
    """Create a new playground instance"""
    try:
        instance = await playground_service.create_instance(
            name=request.name,
            duration_hours=request.duration_hours
        )
        return instance
    except Exception as e:
        logger.error(f"Failed to create instance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{instance_id}", response_model=PlaygroundInstance)
async def get_instance(instance_id: str):
    """Get instance details"""
    instance = playground_service.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Update status
    playground_service._update_instance_status(instance)
    return instance

@router.delete("/{instance_id}", response_model=PlaygroundResponse)
async def delete_instance(instance_id: str):
    """Delete a playground instance"""
    try:
        success = await playground_service.delete_instance(instance_id)
        if not success:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        return PlaygroundResponse(
            status="success",
            message=f"Instance {instance_id} deleted successfully"
        )
    except Exception as e:
        logger.error(f"Failed to delete instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{instance_id}/extend", response_model=PlaygroundResponse)
async def extend_instance(instance_id: str, request: ExtendInstanceRequest):
    """Extend instance session time"""
    try:
        success = await playground_service.extend_instance(instance_id, request.hours)
        if not success:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        return PlaygroundResponse(
            status="success",
            message=f"Instance {instance_id} extended by {request.hours} hours"
        )
    except Exception as e:
        logger.error(f"Failed to extend instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{instance_id}/refresh", response_model=PlaygroundResponse)
async def refresh_instance_status(instance_id: str):
    """Refresh and update instance status"""
    try:
        success = await playground_service.refresh_instance_status(instance_id)
        if not success:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        # Get updated instance
        instance = playground_service.get_instance(instance_id)
        status_message = f"Instance {instance_id} status: {instance.status}"
        
        if instance.status == "installing":
            status_message += " (Installing dependencies, please wait...)"
        elif instance.status == "running":
            status_message += " (Ready to use)"
        
        return PlaygroundResponse(
            status="success",
            message=status_message
        )
    except Exception as e:
        logger.error(f"Failed to refresh instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup", response_model=PlaygroundResponse)
async def cleanup_orphaned_containers():
    """Clean up orphaned containers and volumes"""
    try:
        playground_service.cleanup_orphaned_containers()
        return PlaygroundResponse(
            status="success",
            message="Orphaned containers and volumes cleaned up successfully"
        )
    except Exception as e:
        logger.error(f"Failed to cleanup orphaned containers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{instance_id}/command")
async def execute_command(instance_id: str, command: PlaygroundCommand):
    """Execute a command in the playground instance"""
    try:
        result = await playground_service.execute_command(instance_id, command)
        if result is None:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        return {
            "status": "success",
            "output": result,
            "command": command.command
        }
    except Exception as e:
        logger.error(f"Failed to execute command in instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{instance_id}/stats", response_model=PlaygroundStats)
async def get_instance_stats(instance_id: str):
    """Get instance resource usage statistics"""
    try:
        stats = await playground_service.get_instance_stats(instance_id)
        return stats  # The service method now always returns PlaygroundStats, never None
    except ValueError as e:
        # Instance not found
        logger.error(f"Instance not found for stats request {instance_id}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get stats for instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/{instance_id}/terminal")
async def playground_terminal_websocket(websocket: WebSocket, instance_id: str):
    """Enhanced WebSocket terminal connection to playground instance"""
    await websocket.accept()
    
    # Check if instance exists
    instance = playground_service.get_instance(instance_id)
    if not instance:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Instance not found"
        }))
        await websocket.close()
        return
    
    # Check if instance is running
    if instance.status != 'running':
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Instance is not running (status: {instance.status})"
        }))
        await websocket.close()
        return
    
    session_id = str(uuid.uuid4())
    logger.info(f"Terminal WebSocket connection established for instance {instance_id}, session {session_id}")
    
    try:
        # Get Docker container with retry logic
        container = None
        for attempt in range(3):
            try:
                logger.info(f"Container check attempt {attempt + 1}/3 for instance {instance_id}")
                container = playground_service.client.containers.get(instance.container_id)
                
                # Check if container is actually running
                container.reload()
                logger.info(f"Container status: {container.status} for instance {instance_id}")
                if container.status != 'running':
                    raise Exception(f"Container status is {container.status}, not running")
                
                # Test if container is responsive
                try:
                    logger.info(f"Testing container responsiveness for instance {instance_id}")
                    result = container.exec_run(['echo', 'test'])
                    logger.info(f"Container responsiveness test result: exit_code={result.exit_code} for instance {instance_id}")
                    if result.exit_code != 0:
                        raise Exception(f"Container not responsive, exit code: {result.exit_code}")
                except Exception as e:
                    logger.warning(f"Container responsiveness test failed for instance {instance_id}: {e}")
                    raise Exception(f"Container not responsive: {str(e)}")
                
                logger.info(f"Container check passed for instance {instance_id}")
                break
                
            except Exception as e:
                logger.warning(f"Container check attempt {attempt + 1}/3 failed for instance {instance_id}: {e}")
                if attempt == 2:
                    raise Exception(f"Container not ready after 3 attempts: {str(e)}")
                await asyncio.sleep(2)
        
        # Wait a bit more to ensure container is fully ready
        await asyncio.sleep(1)
        
        # Check if Docker daemon inside container is ready
        docker_ready = False
        for docker_attempt in range(5):
            try:
                logger.info(f"Checking Docker daemon readiness attempt {docker_attempt + 1}/5 for instance {instance_id}")
                result = container.exec_run(['docker', 'version'])
                if result.exit_code == 0:
                    logger.info(f"Docker daemon is ready in container for instance {instance_id}")
                    docker_ready = True
                    break
                else:
                    logger.warning(f"Docker daemon not ready, exit code: {result.exit_code} for instance {instance_id}")
            except Exception as e:
                logger.warning(f"Docker daemon check failed attempt {docker_attempt + 1}/5 for instance {instance_id}: {e}")
            
            if docker_attempt < 4:  # Don't sleep on the last attempt
                await asyncio.sleep(3)
        
        if not docker_ready:
            logger.error(f"Docker daemon not ready after 5 attempts for instance {instance_id}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Docker daemon not ready in container. Please wait and try again."
            }))
            await websocket.close()
            return
        
        # Create exec instance for interactive session with proper terminal settings
        try:
            logger.info(f"Creating exec instance for session {session_id}")
            exec_instance = container.client.api.exec_create(
                container.id,
                ['/bin/bash', '-l', '-i'],  # Interactive login shell
                stdin=True,
                tty=True,
                environment=[
                    'PS1=🐳 \\[\\033[38;5;39m\\]\\u@playground\\[\\033[0m\\]:\\[\\033[38;5;220m\\]\\w\\[\\033[0m\\]$ ',
                    'TERM=xterm-256color',
                    'COLORTERM=truecolor',
                    'LANG=en_US.UTF-8',
                    'LC_ALL=en_US.UTF-8',
                    'PLAYGROUND_SESSION=' + session_id,
                    'HISTSIZE=10000',
                    'HISTFILESIZE=20000',
                    'PROMPT_COMMAND=history -a',
                    'COLUMNS=80',
                    'LINES=24',
                    'SHELL=/bin/bash'
                ],
                user='root',
                workdir='/playground'
            )
            logger.info(f"Exec instance created successfully for session {session_id}: {exec_instance['Id']}")
        except Exception as e:
            logger.error(f"Failed to create exec instance for session {session_id}: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Failed to create terminal session: {str(e)}"
            }))
            await websocket.close()
            return
        
        # Start exec with proper terminal dimensions
        try:
            logger.info(f"Starting exec session for session {session_id}")
            exec_socket = container.client.api.exec_start(
                exec_instance['Id'],
                detach=False,
                tty=True,
                socket=True
            )
            logger.info(f"Exec session started successfully for session {session_id}")
        except Exception as e:
            logger.error(f"Failed to start exec session for session {session_id}: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Failed to start terminal session: {str(e)}"
            }))
            await websocket.close()
            return
        
        # Wait for exec session to be fully ready
        await asyncio.sleep(0.5)
        
        # Test if exec socket is working
        try:
            # Send a test command to verify the connection
            exec_socket.send("echo 'Terminal initializing...'\n".encode())
            await asyncio.sleep(0.2)
        except Exception as e:
            logger.error(f"Exec socket test failed: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Terminal session not responsive: {str(e)}"
            }))
            await websocket.close()
            return
        
        # Store session with enhanced metadata
        active_sessions[session_id] = {
            "websocket": websocket,
            "exec_socket": exec_socket,
            "exec_id": exec_instance['Id'],
            "instance_id": instance_id,
            "container": container,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "terminal_size": {"cols": 80, "rows": 24}
        }
        
        # Send enhanced welcome message
        await websocket.send_text(json.dumps({
            "type": "connected",
            "message": f"Connected to playground {instance.name} ({instance_id})",
            "session_id": session_id,
            "instance": {
                "id": instance.id,
                "name": instance.name,
                "docker_port": instance.docker_port,
                "web_port": instance.web_port,
                "ssh_port": instance.ssh_port
            },
            "terminal": {
                "shell": "bash",
                "encoding": "utf-8",
                "features": ["colors", "history", "completion", "resize"]
            }
        }))
        
        # Send initial terminal setup with proper timing
        initial_commands = [
            "clear",
            "echo '🚀 Welcome to LangFlow Virtual Playground!'",
            "echo '📂 Current directory: $(pwd)'",
            "echo '🐳 Docker version: $(docker --version 2>/dev/null || echo \"Docker not ready\")'",
            "echo '💻 Available tools: git, curl, wget, python3, nodejs, nginx, nmap'",
            "echo '📖 Type \"ls\" to see files, \"docker ps\" to see containers'",
            "echo ''"
        ]
        
        # Send commands with proper timing to avoid overwhelming the shell
        for i, cmd in enumerate(initial_commands):
            try:
                exec_socket.send(f"{cmd}\n".encode())
                if i < len(initial_commands) - 1:  # Don't delay after the last command
                    await asyncio.sleep(0.2)  # Reduced delay for better responsiveness
            except Exception as e:
                logger.warning(f"Failed to send initial command '{cmd}': {e}")
                break
        
        # Send a final newline to ensure prompt appears
        try:
            await asyncio.sleep(0.3)
            exec_socket.send("\n".encode())
        except Exception as e:
            logger.warning(f"Failed to send final newline: {e}")
        
        # Handle bidirectional communication with improved buffering and error handling
        async def read_from_container():
            """Read output from container and send to WebSocket with proper buffering"""
            buffer = b""
            try:
                while True:
                    try:
                        # Check if exec session is still alive
                        if session_id not in active_sessions:
                            logger.debug(f"Session {session_id} no longer active, stopping reader")
                            break
                            
                        # Read with optimal chunk size
                        chunk = await asyncio.wait_for(
                            asyncio.get_event_loop().run_in_executor(
                                None, lambda: exec_socket._sock.recv(8192)
                            ), timeout=0.1
                        )
                        
                        if not chunk:
                            logger.debug("No more data from container, connection closed")
                            break
                        
                        buffer += chunk
                        
                        # Process complete sequences
                        while buffer:
                            try:
                                # Try to decode and send
                                output = buffer.decode('utf-8')
                                
                                # Check if WebSocket is still connected before sending
                                if websocket.client_state.name != "CONNECTED":
                                    logger.debug(f"WebSocket not connected for session {session_id}, stopping reader")
                                    return
                                
                                await websocket.send_text(json.dumps({
                                    "type": "output",
                                    "data": output
                                }))
                                buffer = b""
                                break
                            except UnicodeDecodeError:
                                # Wait for more data if incomplete UTF-8 sequence
                                if len(buffer) > 1024:  # Prevent buffer overflow
                                    # Send what we can decode
                                    output = buffer.decode('utf-8', errors='replace')
                                    
                                    # Check WebSocket connection before sending
                                    if websocket.client_state.name != "CONNECTED":
                                        logger.debug(f"WebSocket not connected for session {session_id}, stopping reader")
                                        return
                                    
                                    await websocket.send_text(json.dumps({
                                        "type": "output",
                                        "data": output
                                    }))
                                    buffer = b""
                                break
                            except Exception as e:
                                logger.error(f"Failed to send WebSocket message for session {session_id}: {e}")
                                return
                        
                        # Update session activity
                        if session_id in active_sessions:
                            active_sessions[session_id]["last_activity"] = datetime.utcnow()
                            
                    except asyncio.TimeoutError:
                        # Normal timeout, continue reading
                        continue
                    except Exception as e:
                        logger.debug(f"Container read error for session {session_id}: {e}")
                        break
                        
            except Exception as e:
                logger.error(f"Container reader error for session {session_id}: {e}")
            finally:
                logger.debug(f"Container reader ended for session {session_id}")
        
        # Start container reader task
        reader_task = asyncio.create_task(read_from_container())
        
        # Handle WebSocket messages (input from frontend)
        async def handle_websocket_messages():
            try:
                while session_id in active_sessions:
                    try:
                        message = await websocket.receive_text()
                        data = json.loads(message)
                        
                        if data.get("type") == "input":
                            input_data = data.get("data", "")
                            logger.debug(f"Received terminal input: {repr(input_data)} for session {session_id}")
                            
                            # Send input to container
                            try:
                                if exec_socket:
                                    # Send input directly to the shell without modification
                                    exec_socket.send(input_data.encode('utf-8'))
                                    logger.debug(f"Sent input to container for session {session_id}: {repr(input_data)}")
                                        
                            except Exception as e:
                                logger.error(f"Failed to send input to container for session {session_id}: {e}")
                                await websocket.send_text(json.dumps({
                                    "type": "error", 
                                    "message": f"Failed to send input: {str(e)}"
                                }))
                                
                        elif data.get("type") == "resize":
                            # Handle terminal resize
                            cols = data.get("cols", 80)
                            rows = data.get("rows", 24)
                            try:
                                container.client.api.exec_resize(exec_instance['Id'], height=rows, width=cols)
                                logger.debug(f"Terminal resized to {cols}x{rows} for session {session_id}")
                                
                                # Update session terminal size
                                if session_id in active_sessions:
                                    active_sessions[session_id]["terminal_size"] = {"cols": cols, "rows": rows}
                                    
                            except Exception as e:
                                logger.warning(f"Failed to resize terminal for session {session_id}: {e}")
                                
                        elif data.get("type") == "ping":
                            # Handle ping for keepalive
                            await websocket.send_text(json.dumps({"type": "pong"}))
                            
                        # Update last activity
                        if session_id in active_sessions:
                            active_sessions[session_id]["last_activity"] = datetime.utcnow()
                            
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON received for session {session_id}")
                    except WebSocketDisconnect:
                        logger.info(f"WebSocket disconnected for session {session_id}")
                        break
                    except Exception as e:
                        logger.error(f"Error handling WebSocket message for session {session_id}: {e}")
                        break
                        
            except Exception as e:
                logger.error(f"WebSocket message handler error for session {session_id}: {e}")
            finally:
                logger.info(f"WebSocket message handler ended for session {session_id}")
        
        # Start WebSocket message handler task
        message_handler_task = asyncio.create_task(handle_websocket_messages())
        
        try:
            # Wait for either task to complete (reader or message handler)
            done, pending = await asyncio.wait(
                [reader_task, message_handler_task], 
                return_when=asyncio.FIRST_COMPLETED
            )
            
            # Log which task completed first
            for task in done:
                if task == reader_task:
                    logger.info(f"Container reader completed for session {session_id}")
                elif task == message_handler_task:
                    logger.info(f"Message handler completed for session {session_id}")
            
            # Cancel remaining tasks gracefully
            for task in pending:
                logger.debug(f"Cancelling pending task for session {session_id}")
                task.cancel()
                try:
                    await asyncio.wait_for(task, timeout=2.0)  # Give tasks time to cleanup
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    pass
                    
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for session {session_id}")
        except Exception as e:
            logger.error(f"Terminal session error for {session_id}: {e}")
        finally:
            # Clean up session
            logger.info(f"Cleaning up session {session_id}")
            if session_id in active_sessions:
                del active_sessions[session_id]
            
            # Close exec socket safely
            if 'exec_socket' in locals() and exec_socket:
                try:
                    logger.debug(f"Closing exec socket for session {session_id}")
                    exec_socket.close()
                except Exception as e:
                    logger.debug(f"Error closing exec socket for session {session_id}: {e}")
                    
            # Cancel any remaining tasks
            for task_name, task in [("reader", reader_task), ("message_handler", message_handler_task)]:
                if 'task' in locals() and task and not task.done():
                    logger.debug(f"Cancelling {task_name} task for session {session_id}")
                    task.cancel()
                    try:
                        await asyncio.wait_for(task, timeout=1.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        pass
                    
            logger.info(f"Terminal session {session_id} ended for instance {instance_id}")
                
    except Exception as e:
        logger.error(f"Terminal WebSocket setup error for instance {instance_id}: {e}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Failed to connect to terminal: {str(e)}"
        }))
        await websocket.close()

@router.get("/{instance_id}/terminal/sessions", response_model=List[PlaygroundTerminalSession])
async def list_terminal_sessions(instance_id: str):
    """List active terminal sessions for an instance"""
    sessions = [
        PlaygroundTerminalSession(
            session_id=session_id,
            instance_id=session_data["instance_id"],
            status="active"
        )
        for session_id, session_data in active_sessions.items()
        if session_data["instance_id"] == instance_id
    ]
    return sessions

@router.post("/{instance_id}/files")
async def upload_file(instance_id: str, file_path: str = Body(...), content: str = Body(...)):
    """Upload a file to the playground instance"""
    try:
        instance = playground_service.get_instance(instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        container = playground_service.client.containers.get(instance.container_id)
        
        # Create file in container
        command = f"cat > {file_path} << 'EOF'\n{content}\nEOF"
        result = container.exec_run(command, workdir="/playground")
        
        if result.exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to create file: {result.output.decode()}")
        
        return PlaygroundResponse(
            status="success",
            message=f"File {file_path} uploaded successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to upload file to instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{instance_id}/files")
async def list_files(instance_id: str, path: str = "/playground"):
    """List files in the playground instance"""
    try:
        instance = playground_service.get_instance(instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="Instance not found")
        
        container = playground_service.client.containers.get(instance.container_id)
        
        # List files
        result = container.exec_run(f"ls -la {path}", workdir="/")
        
        if result.exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to list files: {result.output.decode()}")
        
        return {
            "status": "success",
            "path": path,
            "files": result.output.decode().strip().split('\n')
        }
        
    except Exception as e:
        logger.error(f"Failed to list files in instance {instance_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 