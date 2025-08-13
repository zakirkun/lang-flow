import asyncio
import docker
import docker.types
import json
import uuid
import threading
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path

from ..models import PlaygroundInstance, PlaygroundStats, PlaygroundCommand
from .storage import (
    list_playground_instances, 
    save_playground_instance, 
    delete_playground_instance,
    save_playground_instances
)

logger = logging.getLogger(__name__)

class PlaygroundService:
    """Docker-in-Docker Virtual Playground Service"""
    
    def __init__(self):
        try:
            self.client = docker.from_env()
            # Test Docker connection
            self.client.ping()
        except Exception as e:
            logger.error(f"Failed to connect to Docker: {e}")
            raise RuntimeError(f"Docker connection failed: {e}")
        
        self.instances: Dict[str, PlaygroundInstance] = {}
        self.base_ssh_port = 2222
        self.base_docker_port = 2376
        self.base_web_port = 8080
        self.session_timeout = timedelta(hours=4)
        self.dind_image = "docker:dind"
        self.running = True
        
        # Load existing instances from storage
        self._load_existing_instances()
        
        # Clean up any orphaned containers
        self.cleanup_orphaned_containers()
        
        # Start cleanup thread
        self.cleanup_thread = threading.Thread(target=self._cleanup_expired_instances, daemon=True)
        self.cleanup_thread.start()
        
        # Ensure required Docker images are available
        self._ensure_images()
    
    def _ensure_images(self):
        """Ensure required Docker images are available"""
        required_images = [
            "docker:dind",
            "alpine:latest",
            "nginx:alpine",
            "python:3.9-alpine",
            "ubuntu:latest"
        ]
        
        for image in required_images:
            try:
                self.client.images.get(image)
                logger.info(f"Image {image} already available")
            except docker.errors.ImageNotFound:
                logger.info(f"Pulling image {image}...")
                try:
                    self.client.images.pull(image)
                    logger.info(f"Successfully pulled {image}")
                except Exception as e:
                    logger.warning(f"Failed to pull {image}: {e}")
    
    def _load_existing_instances(self):
        """Load existing instances from storage and verify their status"""
        try:
            saved_instances = list_playground_instances()
            logger.info(f"Found {len(saved_instances)} saved playground instances")
            
            for instance in saved_instances:
                try:
                    # instance is already a PlaygroundInstance object from storage
                    # Check if instance is expired
                    if datetime.utcnow() > instance.expires_at:
                        logger.info(f"Instance {instance.id} is expired, skipping")
                        continue
                    
                    # Verify container status
                    container_status = self._check_container_status(instance)
                    instance.status = container_status
                    
                    self.instances[instance.id] = instance
                    logger.info(f"Loaded instance {instance.id} from storage (status: {instance.status})")
                    
                    # If container is installing dependencies, mark as installing
                    if container_status == "running":
                        asyncio.create_task(self._check_if_installing(instance))
                        
                except Exception as e:
                    logger.warning(f"Failed to load instance {getattr(instance, 'id', 'unknown')}: {e}")
            
            # Clean up expired instances from storage
            self._cleanup_expired_from_storage()
            
        except Exception as e:
            logger.error(f"Failed to load existing instances from storage: {e}")
    
    def _check_container_status(self, instance: PlaygroundInstance) -> str:
        """Check the actual status of a container and Docker daemon"""
        if not instance.container_id:
            return "error"
        
        try:
            container = self.client.containers.get(instance.container_id)
            container.reload()
            
            if container.status != 'running':
                return container.status
            
            # Container is running, check if Docker daemon is ready
            try:
                result = container.exec_run(['docker', 'version'])
                if result.exit_code == 0:
                    return "running"
                else:
                    # Docker daemon not ready yet, still installing
                    return "installing"
            except Exception:
                # Docker daemon not ready or not responding
                return "installing"
                
        except Exception as e:
            logger.error(f"Error checking container status: {e}")
            return "error"
    
    async def _check_if_installing(self, instance: PlaygroundInstance):
        """Check if container is still installing dependencies"""
        try:
            max_checks = 30  # Check for up to 5 minutes
            check_count = 0
            
            while check_count < max_checks and instance.status == "installing":
                await asyncio.sleep(10)  # Check every 10 seconds
                
                try:
                    container = self.client.containers.get(instance.container_id)
                    if container.status != 'running':
                        instance.status = "error"
                        break
                    
                    # Test if setup is complete
                    result = container.exec_run("docker version")
                    if result.exit_code == 0:
                        instance.status = "running"
                        logger.info(f"Instance {instance.id} finished installing, now running")
                        save_playground_instance(instance)
                        break
                        
                except Exception as e:
                    logger.debug(f"Instance {instance.id} still installing: {e}")
                
                check_count += 1
            
            if check_count >= max_checks:
                logger.warning(f"Instance {instance.id} took too long to finish installation")
                instance.status = "error"
                save_playground_instance(instance)
                
        except Exception as e:
            logger.error(f"Error checking installation status for {instance.id}: {e}")
    
    def _cleanup_expired_from_storage(self):
        """Remove expired instances from storage"""
        try:
            current_instances = list_playground_instances()
            active_instances = []
            current_time = datetime.utcnow()
            
            for instance in current_instances:
                try:
                    # instance is already a PlaygroundInstance object
                    if current_time <= instance.expires_at:
                        active_instances.append(instance)
                    else:
                        logger.info(f"Removing expired instance {instance.id} from storage")
                except Exception as e:
                    logger.warning(f"Error processing instance: {e}")
            
            save_playground_instances(active_instances)
            
        except Exception as e:
            logger.error(f"Error cleaning up expired instances from storage: {e}")
    
    async def create_instance(self, name: Optional[str] = None, duration_hours: int = 4) -> PlaygroundInstance:
        """Create a new playground instance"""
        try:
            instance_id = str(uuid.uuid4())[:8]
            if not name:
                name = f"playground-{instance_id}"
            
            # Calculate available ports - check both in-memory instances AND existing containers
            used_ports = set()
            
            # Check ports from in-memory instances
            for instance in self.instances.values():
                used_ports.add(instance.ssh_port)
                used_ports.add(instance.docker_port)
                used_ports.add(instance.web_port)
            
            # Check ports from existing Docker containers with langflow-playground labels
            try:
                containers = self.client.containers.list(all=True, filters={
                    "label": "langflow.playground.id"
                })
                for container in containers:
                    for port_mapping in container.attrs.get('NetworkSettings', {}).get('Ports', {}):
                        port_info = container.attrs['NetworkSettings']['Ports'].get(port_mapping)
                        if port_info:
                            for mapping in port_info:
                                if mapping and 'HostPort' in mapping:
                                    used_ports.add(int(mapping['HostPort']))
            except Exception as e:
                logger.warning(f"Failed to check existing container ports: {e}")
            
            # Find available ports
            ssh_port = self.base_ssh_port
            while ssh_port in used_ports:
                ssh_port += 1
            
            docker_port = self.base_docker_port
            while docker_port in used_ports:
                docker_port += 1
                
            web_port = self.base_web_port
            while web_port in used_ports:
                web_port += 1
            
            # Create instance object
            instance = PlaygroundInstance(
                id=instance_id,
                name=name,
                container_id="",  # Will be set after container creation
                ssh_port=ssh_port,
                docker_port=docker_port,
                web_port=web_port,
                status="creating",
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(hours=duration_hours),
                environment={
                    "PLAYGROUND_ID": instance_id,
                    "PLAYGROUND_NAME": name,
                    "DOCKER_TLS_CERTDIR": "",
                    "DOCKER_HOST": "tcp://0.0.0.0:2376"
                },
                resource_limits={
                    "memory": "1g",
                    "cpus": "1.0",
                    "disk_space": "2g"
                }
            )
            
            self.instances[instance_id] = instance
            
            # Save to storage
            save_playground_instance(instance)
            
            # Create container in background
            asyncio.create_task(self._create_container(instance))
            
            logger.info(f"Playground instance '{name}' creation started (ID: {instance_id})")
            return instance
            
        except Exception as e:
            logger.error(f"Failed to create playground instance: {e}")
            raise
    
    async def _create_container(self, instance: PlaygroundInstance):
        """Create the Docker container for the playground instance"""
        try:
            # Container startup script
            startup_script = f'''#!/bin/bash
set -e

echo "🚀 Starting LangFlow Virtual Playground..."

# Clean up any existing Docker data to prevent corruption
rm -rf /var/lib/docker/* 2>/dev/null || true

# Start Docker daemon in background with proper DIND configuration
dockerd \\
    --host=tcp://0.0.0.0:2376 \\
    --host=unix:///var/run/docker.sock \\
    --tls=false \\
    --storage-driver=overlay2 \\
    --data-root=/var/lib/docker \\
    --exec-opt native.cgroupdriver=cgroupfs \\
    --log-level=warn \\
    --insecure-registry=localhost:5000 \\
    &
DOCKER_PID=$!

# Wait for Docker daemon to be ready
echo "⏳ Waiting for Docker daemon..."
timeout=120
while [ $timeout -gt 0 ]; do
    if docker version >/dev/null 2>&1; then
        echo "✅ Docker daemon is ready"
        break
    fi
    echo "⏳ Still waiting... ($timeout seconds left)"
    sleep 2
    timeout=$((timeout-2))
done

if [ $timeout -le 0 ]; then
    echo "❌ Docker daemon failed to start within 120 seconds"
    echo "📋 Docker daemon logs:"
    tail -20 /var/log/docker.log 2>/dev/null || echo "No logs available"
    exit 1
fi

# Verify Docker is working properly
echo "🧪 Testing Docker functionality..."
if ! docker run --rm hello-world >/dev/null 2>&1; then
    echo "⚠️ Docker basic functionality test failed, but continuing..."
fi

# Install additional tools
echo "📦 Installing tools..."
apk add --no-cache \\
    openssh \\
    curl \\
    wget \\
    git \\
    nano \\
    vim \\
    bash \\
    htop \\
    tree \\
    jq \\
    python3 \\
    py3-pip \\
    nodejs \\
    npm \\
    nginx \\
    nmap \\
    tcpdump \\
    netcat-openbsd \\
    iptables \\
    2>/dev/null || echo "⚠️ Some tools failed to install"

# Setup SSH
echo "🔐 Setting up SSH..."
ssh-keygen -A 2>/dev/null
echo "root:playground" | chpasswd
cat > /etc/ssh/sshd_config << 'SSHEOF'
Port 22
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key
Subsystem sftp /usr/lib/openssh/sftp-server
SSHEOF
/usr/sbin/sshd &

# Setup web server for file browsing
echo "🌐 Setting up web interface..."
mkdir -p /var/www/html
cat > /var/www/html/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>🐳 LangFlow Virtual Playground</title>
    <style>
        body {{ font-family: 'Courier New', monospace; background: #0f1325; color: #e2e8f0; margin: 0; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #22d3ee, #39ff14); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 2em; margin-bottom: 20px; }}
        .info {{ background: rgba(34, 211, 238, 0.1); border: 1px solid #22d3ee; border-radius: 8px; padding: 20px; margin: 10px 0; }}
        .command {{ background: #1e293b; border-left: 4px solid #22d3ee; padding: 10px; margin: 10px 0; font-family: monospace; }}
        .status {{ color: #39ff14; }}
        .warning {{ color: #f59e0b; }}
        .button {{ background: #22d3ee; color: #0f1325; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }}
    </style>
</head>
<body>  
    <h1 class="header">🐳 LangFlow Virtual Playground</h1>
    <div class="info">
        <h3>Instance Information</h3>
        <p><strong>Instance ID:</strong> {instance.id}</p>
        <p><strong>Name:</strong> {instance.name}</p>
        <p><strong>Status:</strong> <span class="status">Running</span></p>
        <p><strong>Docker Port:</strong> {instance.docker_port}</p>
        <p><strong>SSH Port:</strong> {instance.ssh_port}</p>
        <p><strong>Expires:</strong> <span class="warning">{instance.expires_at}</span></p>
    </div>
    <div class="info">
        <h3>Getting Started</h3>
        <p>Your virtual playground is ready! Here are some commands to try:</p>
        <div class="command">docker run hello-world</div>
        <div class="command">docker run -it alpine sh</div>
        <div class="command">docker run -d -p 80:80 nginx:alpine</div>
        <div class="command">ls /playground/</div>
        <div class="command">python3 /playground/hello.py</div>
    </div>
    <div class="info">
        <h3>Security Tools Available</h3>
        <p>This playground includes security testing tools:</p>
        <div class="command">nmap -sn 127.0.0.1</div>
        <div class="command">curl -I http://localhost</div>
        <div class="command">netstat -tulpn</div>
    </div>
</body>
</html>
EOF

# Setup nginx
cat > /etc/nginx/http.d/default.conf << 'EOF'
server {{
    listen {instance.web_port};
    server_name localhost;
    root /var/www/html;
    index index.html;
    
    location / {{
        try_files $uri $uri/ =404;
    }}
    
    location /files {{
        alias /playground/;
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }}
}}
EOF

nginx &

# Pull common Docker images in background
echo "📥 Pre-loading Docker images..."
(
    docker pull alpine:latest &
    docker pull nginx:alpine &
    docker pull python:3.9-alpine &
    docker pull node:alpine &
    docker pull ubuntu:latest &
    wait
    echo "✅ Images pre-loaded"
) &

# Create playground directory with examples
mkdir -p /playground
echo "Welcome to LangFlow Virtual Playground!" > /playground/README.txt
echo "Instance ID: {instance.id}" >> /playground/README.txt
echo "Created: $(date)" >> /playground/README.txt

# Create example Dockerfile
cat > /playground/Dockerfile.example << 'EOF'
FROM alpine:latest
RUN apk add --no-cache curl
WORKDIR /app
COPY . .
CMD ["echo", "Hello from LangFlow Playground!"]
EOF

# Create example Python script
cat > /playground/hello.py << 'EOF'
#!/usr/bin/env python3
print("🐳 Hello from LangFlow Virtual Playground!")
print("This is a Python script running in your isolated Docker environment.")
EOF

chmod +x /playground/hello.py

# Setup bash aliases and environment
cat >> /root/.bashrc << 'EOF'
alias ll="ls -la"
alias dps="docker ps"
alias di="docker images"
alias playground="cd /playground"
export PS1="🐳 \\u@playground:\\w$ "
export TERM=xterm-256color
cd /playground
EOF

echo "🎉 LangFlow Virtual Playground is ready!"
echo "Instance: {instance.name} ({instance.id})"
echo "Docker endpoint: localhost:{instance.docker_port}"
echo "SSH: ssh root@localhost -p {instance.ssh_port} (password: playground)"
echo "Web: http://localhost:{instance.web_port}"

# Keep container running and monitor Docker daemon with restart capability
echo "🔧 Starting enhanced monitoring loop..."
restart_count=0
max_restarts=5
last_restart_time=0
cycle_count=0

# Function to restart Docker daemon
restart_docker_daemon() {{
    echo "🔄 Restarting Docker daemon..."
    pkill -f dockerd 2>/dev/null || true
    sleep 10
    
    # Clean up any corrupted Docker state
    rm -rf /var/lib/docker/tmp/* 2>/dev/null || true
    
    # Restart dockerd with enhanced stability settings
    dockerd \\
        --host=tcp://0.0.0.0:2376 \\
        --host=unix:///var/run/docker.sock \\
        --tls=false \\
        --storage-driver=overlay2 \\
        --data-root=/var/lib/docker \\
        --exec-opt native.cgroupdriver=cgroupfs \\
        --log-level=warn \\
        --insecure-registry=localhost:5000 \\
        --max-concurrent-downloads=1 \\
        --max-concurrent-uploads=1 \\
        --default-runtime=runc \\
        --oom-score-adjust=-500 \\
        --userland-proxy=false \\
        --no-new-privileges \\
        --experimental=false \\
        --metrics-addr=0.0.0.0:9323 \\
        --default-ulimit nofile=65536:65536 \\
        --default-ulimit nproc=4096:4096 \\
        &
    
    DOCKER_PID=$!
    echo "🔗 Docker daemon restarted with PID $DOCKER_PID"
    
    # Wait for Docker daemon to be ready
    timeout=90
    while [ $timeout -gt 0 ]; do
        if docker version >/dev/null 2>&1; then
            echo "✅ Docker daemon is ready after restart"
            return 0
        fi
        sleep 2
        timeout=$((timeout-2))
    done
    
    echo "❌ Docker daemon failed to restart within 90 seconds"
    return 1
}}

# Function to check Docker daemon health
check_docker_health() {{
    # Check if daemon is responding
    if ! docker version >/dev/null 2>&1; then
        return 1
    fi
    
    # Check if daemon can create containers (using timestamp for unique name)
    health_name="health-check-$(date +%s)"
    if ! docker run --rm --name "$health_name" alpine:latest echo "healthy" >/dev/null 2>&1; then
        return 1
    fi
    
    return 0
}}

# Main monitoring loop
while true; do
    current_time=$(date +%s)
    
    # Check if Docker daemon process is still running
    if ! kill -0 $DOCKER_PID 2>/dev/null; then
        echo "⚠️ Docker daemon process stopped (PID $DOCKER_PID)"
        
        # Rate limiting: don't restart too frequently
        if [ $((current_time - last_restart_time)) -lt 60 ]; then
            echo "⏳ Rate limiting restart attempts (last restart was recent)"
            sleep 30
            continue
        fi
        
        if [ $restart_count -lt $max_restarts ]; then
            restart_count=$((restart_count + 1))
            last_restart_time=$current_time
            echo "🔄 Attempting restart $restart_count/$max_restarts..."
            
            if restart_docker_daemon; then
                echo "✅ Docker daemon restarted successfully"
                restart_count=0  # Reset counter on successful restart
            else
                echo "❌ Failed to restart Docker daemon (attempt $restart_count)"
                sleep 30
            fi
        else
            echo "❌ Maximum restart attempts reached, container will exit"
            break
        fi
    else
        # Daemon process is running, check health every few cycles
        cycle_count=$((cycle_count + 1))
        if [ $((cycle_count % 4)) -eq 0 ]; then
            if ! check_docker_health; then
                echo "⚠️ Docker daemon health check failed, restarting..."
                pkill -f dockerd 2>/dev/null || true
                sleep 5
                
                if restart_docker_daemon; then
                    echo "✅ Docker daemon health restored"
                else
                    echo "❌ Failed to restore Docker daemon health"
                fi
            fi
        fi
        
        # Reset restart counter if we've been stable for a while
        if [ $restart_count -gt 0 ] && [ $((current_time - last_restart_time)) -gt 300 ]; then
            echo "🔄 Resetting restart counter (stable for 5 minutes)"
            restart_count=0
        fi
    fi
    
    # Check every 15 seconds for faster response
    sleep 15
done

echo "❌ Docker daemon monitoring stopped, container exiting..."
'''
            
            # Create container
            container_config = {
                'image': self.dind_image,
                'name': f"langflow-playground-{instance.id}",
                'privileged': True,
                'ports': {
                    '2376/tcp': instance.docker_port,  # Docker daemon
                    '22/tcp': instance.ssh_port,       # SSH access
                    f'{instance.web_port}/tcp': instance.web_port,  # Web interface
                },
                'environment': [f"{k}={v}" for k, v in instance.environment.items()],
                'volumes': {
                    # Use named volume for Docker data to prevent host conflicts
                    f"langflow-playground-{instance.id}-docker": {'bind': '/var/lib/docker', 'mode': 'rw'},
                    # Create a playground workspace
                    f"langflow-playground-{instance.id}-workspace": {'bind': '/playground', 'mode': 'rw'}
                },
                'mem_limit': instance.resource_limits.get("memory", "2g"),  # Increased from 1g
                'nano_cpus': int(float(instance.resource_limits.get("cpus", "1.5")) * 1_000_000_000),  # Increased from 1.0
                'detach': True,
                'command': ['sh', '-c', startup_script],
                # Additional security and stability settings
                'security_opt': ['apparmor:unconfined'],
                'tmpfs': {
                    '/tmp': 'rw,noexec,nosuid,size=256m',
                    '/run': 'rw,noexec,nosuid,size=64m'
                },
                'ulimits': [
                    docker.types.Ulimit(name='nofile', soft=65536, hard=65536),
                    docker.types.Ulimit(name='nproc', soft=4096, hard=4096)
                ],
                'shm_size': '128m',
                'cap_add': ['SYS_ADMIN'],  # Required for DIND
                'devices': ['/dev/fuse'],  # For some container operations
                'labels': {
                    'langflow.playground.id': instance.id,
                    'langflow.playground.name': instance.name,
                    'langflow.playground.created': instance.created_at.isoformat()
                }
            }
            
            logger.info(f"Creating container for instance {instance.id}")
            try:
                container = self.client.containers.run(**container_config)
                logger.info(f"Container created successfully: {container.id}")
            except Exception as e:
                logger.error(f"Container creation failed: {e}")
                # Log container config for debugging (without sensitive data)
                debug_config = {k: v for k, v in container_config.items() if k not in ['environment']}
                logger.debug(f"Container config: {debug_config}")
                
                # Update instance status to error and save
                instance.status = "error"
                save_playground_instance(instance)
                
                # Clean up the failed instance from memory
                if instance.id in self.instances:
                    del self.instances[instance.id]
                
                raise
            
            # Update instance with container ID
            instance.container_id = container.id
            
            # Save updated instance to storage
            save_playground_instance(instance)
            
            # Wait for container to be ready
            await self._wait_for_container_ready(instance)
            
            instance.status = "running"
            save_playground_instance(instance)  # Save final status
            logger.info(f"Playground instance {instance.id} is now running")
            
        except Exception as e:
            logger.error(f"Failed to create container for instance {instance.id}: {e}")
            
            # Ensure instance status is set to error
            instance.status = "error"
            save_playground_instance(instance)
            
            # If we have a container ID but creation failed, try to clean it up
            if hasattr(instance, 'container_id') and instance.container_id:
                try:
                    container = self.client.containers.get(instance.container_id)
                    container.remove(force=True)
                    logger.info(f"Cleaned up failed container {instance.container_id}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to cleanup container {instance.container_id}: {cleanup_error}")
            
            # Remove from instances dict if creation failed
            if instance.id in self.instances:
                del self.instances[instance.id]
            
            raise
    
    async def _wait_for_container_ready(self, instance: PlaygroundInstance, timeout: int = 180):
        """Wait for container services to be ready"""
        start_time = time.time()
        last_log_time = 0
        
        logger.info(f"Waiting for container {instance.id} to be ready (timeout: {timeout}s)")
        
        while time.time() - start_time < timeout:
            try:
                container = self.client.containers.get(instance.container_id)
                
                # Log container status periodically
                current_time = time.time()
                if current_time - last_log_time > 10:  # Log every 10 seconds
                    logger.info(f"Container {instance.id} status: {container.status}")
                    last_log_time = current_time
                
                if container.status != 'running':
                    if container.status == 'exited':
                        # Container exited, get logs for debugging
                        logs = container.logs(tail=50).decode('utf-8')
                        logger.error(f"Container {instance.id} exited. Last 50 lines of logs:\n{logs}")
                        raise RuntimeError(f"Container exited with status: {container.status}")
                    await asyncio.sleep(2)
                    continue
                
                # Check if Docker daemon is responding
                logger.debug(f"Testing Docker daemon in container {instance.id}")
                result = container.exec_run("docker version")
                if result.exit_code == 0:
                    logger.info(f"Container {instance.id} is ready (Docker daemon responding)")
                    return True
                else:
                    logger.debug(f"Docker daemon not ready yet in {instance.id}: exit_code={result.exit_code}")
                    
            except Exception as e:
                logger.debug(f"Container {instance.id} not ready yet: {e}")
            
            await asyncio.sleep(3)
        
        # Timeout reached, collect diagnostics
        try:
            container = self.client.containers.get(instance.container_id)
            logs = container.logs(tail=100).decode('utf-8')
            logger.error(f"Container {instance.id} failed to become ready within {timeout} seconds. Status: {container.status}")
            logger.error(f"Last 100 lines of container logs:\n{logs}")
        except Exception as e:
            logger.error(f"Failed to get diagnostics for container {instance.id}: {e}")
        
        raise TimeoutError(f"Container {instance.id} failed to become ready within {timeout} seconds")
    
    def get_instance(self, instance_id: str) -> Optional[PlaygroundInstance]:
        """Get instance by ID"""
        return self.instances.get(instance_id)
    
    def list_instances(self) -> List[PlaygroundInstance]:
        """List all instances with updated status"""
        for instance in self.instances.values():
            self._update_instance_status(instance)
        return list(self.instances.values())
    
    async def refresh_instance_status(self, instance_id: str) -> bool:
        """Manually refresh and update instance status"""
        try:
            instance = self.instances.get(instance_id)
            if not instance:
                return False
            
            old_status = instance.status
            new_status = self._check_container_status(instance)
            
            if old_status != new_status:
                instance.status = new_status
                save_playground_instance(instance)
                logger.info(f"Instance {instance_id} status changed: {old_status} → {new_status}")
                
                # If status changed from installing to running, log success
                if old_status == "installing" and new_status == "running":
                    logger.info(f"Instance {instance_id} finished installing dependencies")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to refresh status for instance {instance_id}: {e}")
            return False
    
    def _update_instance_status(self, instance: PlaygroundInstance):
        """Update instance status based on container state"""
        try:
            # Check if container_id is valid
            if not instance.container_id:
                if instance.status not in ["creating", "error"]:
                    instance.status = "error"
                    save_playground_instance(instance)
                return
                
            container = self.client.containers.get(instance.container_id)
            old_status = instance.status
            
            if container.status == 'running':
                # Check if Docker daemon is ready (for instances that might be installing)
                if instance.status == "installing":
                    try:
                        result = container.exec_run("docker version")
                        if result.exit_code == 0:
                            instance.status = "running"
                        # else keep as installing
                    except:
                        pass  # Keep as installing
                else:
                    instance.status = "running"
            elif container.status == 'exited':
                instance.status = "stopped"
            else:
                instance.status = "error"
                
            # Save to storage if status changed
            if old_status != instance.status:
                save_playground_instance(instance)
                
        except docker.errors.NotFound:
            if instance.status != "error":
                instance.status = "error"
                save_playground_instance(instance)
        except Exception as e:
            logger.error(f"Failed to update status for instance {instance.id}: {e}")
            if instance.status not in ["creating", "error"]:
                instance.status = "error"
                save_playground_instance(instance)
    
    def cleanup_orphaned_containers(self):
        """Clean up containers that don't have corresponding instances"""
        try:
            # Get all langflow playground containers
            containers = self.client.containers.list(all=True, filters={
                "label": "langflow.playground.id"
            })
            
            # Get known instance IDs
            known_instance_ids = set(self.instances.keys())
            
            for container in containers:
                container_instance_id = container.labels.get('langflow.playground.id')
                if container_instance_id and container_instance_id not in known_instance_ids:
                    try:
                        logger.info(f"Cleaning up orphaned container {container.id} for instance {container_instance_id}")
                        container.stop(timeout=10)
                        container.remove()
                        
                        # Also clean up volumes
                        volume_names = [
                            f"langflow-playground-{container_instance_id}-docker",
                            f"langflow-playground-{container_instance_id}-workspace"
                        ]
                        
                        for volume_name in volume_names:
                            try:
                                volume = self.client.volumes.get(volume_name)
                                volume.remove()
                                logger.info(f"Removed orphaned volume {volume_name}")
                            except docker.errors.NotFound:
                                pass
                            except Exception as e:
                                logger.warning(f"Failed to remove orphaned volume {volume_name}: {e}")
                                
                    except Exception as e:
                        logger.warning(f"Failed to cleanup orphaned container {container.id}: {e}")
                        
        except Exception as e:
            logger.error(f"Error during orphaned container cleanup: {e}")
    
    async def execute_command(self, instance_id: str, command: PlaygroundCommand) -> Optional[str]:
        """Execute command in playground instance"""
        try:
            instance = self.instances.get(instance_id)
            if not instance:
                return None
            
            container = self.client.containers.get(instance.container_id)
            
            # Prepare command environment
            env_vars = []
            if command.environment:
                env_vars = [f"{k}={v}" for k, v in command.environment.items()]
            
            # Execute command
            exec_command = command.command
            if command.working_dir:
                exec_command = f"cd {command.working_dir} && {command.command}"
            
            result = container.exec_run(
                exec_command,
                environment=env_vars,
                workdir=command.working_dir,
                tty=True
            )
            
            instance.last_activity = datetime.utcnow()
            
            return result.output.decode('utf-8') if result.output else ""
            
        except Exception as e:
            logger.error(f"Command execution failed for instance {instance_id}: {e}")
            return None
    
    async def get_instance_stats(self, instance_id: str) -> PlaygroundStats:
        """Get real-time statistics for a playground instance"""
        instance = self.get_instance(instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")
        
        # Calculate uptime
        uptime = int((datetime.utcnow() - instance.created_at).total_seconds())
        
        if not instance.container_id:
            return PlaygroundStats(
                cpu_usage=0.0,
                memory_usage=0.0,
                memory_limit=0,
                disk_usage=0.0,
                network_rx=0,
                network_tx=0,
                uptime=uptime,
                containers_count=0
            )
        
        try:
            container = self.client.containers.get(instance.container_id)
            container.reload()
            
            if container.status != 'running':
                return PlaygroundStats(
                    cpu_usage=0.0,
                    memory_usage=0.0,
                    memory_limit=0,
                    disk_usage=0.0,
                    network_rx=0,
                    network_tx=0,
                    uptime=uptime,
                    containers_count=0
                )
            
            # Get container stats with timeout
            try:
                stats = container.stats(stream=False)
            except Exception as e:
                logger.warning(f"Failed to get container stats: {e}")
                return PlaygroundStats(
                    cpu_usage=0.0,
                    memory_usage=0.0,
                    memory_limit=0,
                    disk_usage=0.0,
                    network_rx=0,
                    network_tx=0,
                    uptime=uptime,
                    containers_count=0
                )
            
            # Calculate CPU usage with error handling
            cpu_usage = 0.0
            try:
                if 'cpu_stats' in stats and 'precpu_stats' in stats:
                    cpu_stats = stats['cpu_stats']
                    precpu_stats = stats['precpu_stats']
                    
                    # Check if required fields exist
                    if ('cpu_usage' in cpu_stats and 'total_usage' in cpu_stats['cpu_usage'] and
                        'cpu_usage' in precpu_stats and 'total_usage' in precpu_stats['cpu_usage'] and
                        'system_cpu_usage' in cpu_stats and 'system_cpu_usage' in precpu_stats):
                        
                        cpu_delta = cpu_stats['cpu_usage']['total_usage'] - precpu_stats['cpu_usage']['total_usage']
                        system_delta = cpu_stats['system_cpu_usage'] - precpu_stats['system_cpu_usage']
                        
                        # Get number of CPUs
                        num_cpus = len(cpu_stats['cpu_usage'].get('percpu_usage', [1]))
                        if num_cpus == 0:
                            num_cpus = 1
                        
                        if system_delta > 0:
                            cpu_usage = (cpu_delta / system_delta) * num_cpus * 100.0
                            cpu_usage = min(max(cpu_usage, 0.0), 100.0 * num_cpus)  # Clamp between 0 and 100*num_cpus
            except Exception as e:
                logger.debug(f"CPU calculation error: {e}")
                cpu_usage = 0.0
            
            # Calculate memory usage with error handling
            memory_usage = 0.0
            memory_limit_bytes = 0
            try:
                if 'memory_stats' in stats:
                    memory_stats = stats['memory_stats']
                    if 'usage' in memory_stats and 'limit' in memory_stats:
                        memory_used_bytes = memory_stats['usage']
                        memory_limit_bytes = memory_stats['limit']
                        if memory_limit_bytes > 0:
                            memory_usage = (memory_used_bytes / memory_limit_bytes) * 100.0
                            memory_usage = min(max(memory_usage, 0.0), 100.0)  # Clamp between 0 and 100
            except Exception as e:
                logger.debug(f"Memory calculation error: {e}")
                memory_usage = 0.0
                memory_limit_bytes = 0
            
            # Calculate network usage with error handling
            network_rx = 0
            network_tx = 0
            try:
                if 'networks' in stats:
                    networks = stats['networks']
                    for interface in networks.values():
                        if isinstance(interface, dict):
                            network_rx += interface.get('rx_bytes', 0)
                            network_tx += interface.get('tx_bytes', 0)
            except Exception as e:
                logger.debug(f"Network calculation error: {e}")
                network_rx = 0
                network_tx = 0
            
            # Count containers inside the playground
            containers_count = 0
            try:
                # Execute docker ps command inside the container
                result = container.exec_run(['docker', 'ps', '-q'])
                if result.exit_code == 0 and result.output:
                    containers_count = len([line for line in result.output.decode().strip().split('\n') if line.strip()])
            except Exception as e:
                logger.debug(f"Container count error: {e}")
                containers_count = 0
            
            return PlaygroundStats(
                cpu_usage=round(cpu_usage, 1),
                memory_usage=round(memory_usage, 1),
                memory_limit=memory_limit_bytes,  # Use memory_limit field name
                disk_usage=0.0,  # TODO: Implement disk usage calculation
                network_rx=network_rx,
                network_tx=network_tx,
                uptime=uptime,
                containers_count=containers_count
            )
            
        except Exception as e:
            logger.error(f"Failed to get stats for instance {instance_id}: {e}")
            return PlaygroundStats(
                cpu_usage=0.0,
                memory_usage=0.0,
                memory_limit=0,
                disk_usage=0.0,
                network_rx=0,
                network_tx=0,
                uptime=uptime,
                containers_count=0
            )
    
    async def extend_instance(self, instance_id: str, hours: int) -> bool:
        """Extend instance session time"""
        try:
            instance = self.instances.get(instance_id)
            if not instance:
                return False
            
            instance.expires_at = max(
                instance.expires_at + timedelta(hours=hours),
                datetime.utcnow() + timedelta(hours=hours)
            )
            
            # Save updated instance to storage
            save_playground_instance(instance)
            
            logger.info(f"Extended session for {instance_id} by {hours} hours")
            return True
            
        except Exception as e:
            logger.error(f"Failed to extend instance {instance_id}: {e}")
            return False
    
    async def delete_instance(self, instance_id: str) -> bool:
        """Delete playground instance"""
        try:
            instance = self.instances.get(instance_id)
            if not instance:
                return False
            
            # Stop and remove container
            try:
                container = self.client.containers.get(instance.container_id)
                container.stop(timeout=10)
                container.remove()
                logger.info(f"Removed container for instance {instance_id}")
            except docker.errors.NotFound:
                logger.warning(f"Container for instance {instance_id} already gone")
            except Exception as e:
                logger.error(f"Error removing container for instance {instance_id}: {e}")
            
            # Clean up associated volumes
            volume_names = [
                f"langflow-playground-{instance_id}-docker",
                f"langflow-playground-{instance_id}-workspace"
            ]
            
            for volume_name in volume_names:
                try:
                    volume = self.client.volumes.get(volume_name)
                    volume.remove()
                    logger.info(f"Removed volume {volume_name}")
                except docker.errors.NotFound:
                    logger.debug(f"Volume {volume_name} not found (already removed)")
                except Exception as e:
                    logger.warning(f"Failed to remove volume {volume_name}: {e}")
            
            # Remove from instances
            del self.instances[instance_id]
            
            # Remove from storage
            delete_playground_instance(instance_id)
            
            logger.info(f"Deleted playground instance {instance_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete instance {instance_id}: {e}")
            return False
    
    def _cleanup_expired_instances(self):
        """Background cleanup of expired instances"""
        while self.running:
            try:
                current_time = datetime.utcnow()
                expired_instances = [
                    instance_id for instance_id, instance in self.instances.items()
                    if current_time > instance.expires_at
                ]
                
                for instance_id in expired_instances:
                    logger.info(f"Cleaning up expired instance: {instance_id}")
                    asyncio.run(self.delete_instance(instance_id))
                
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
                time.sleep(60)
    
    def stop(self):
        """Stop the playground service"""
        self.running = False
        # Clean up all instances
        for instance_id in list(self.instances.keys()):
            asyncio.run(self.delete_instance(instance_id))

# Global playground service instance
playground_service = PlaygroundService() 