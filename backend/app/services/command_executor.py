from __future__ import annotations

import subprocess
import shlex
import os
from typing import Optional


def run_command(command: str, cwd: Optional[str] = None, timeout_seconds: int = 90) -> str:
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