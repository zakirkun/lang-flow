from __future__ import annotations

import asyncio
import json
import os
from typing import List
import contextlib
import threading

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


def _shell_command() -> List[str]:
    if os.name == 'nt':
        # Always use PowerShell on Windows
        return ['powershell.exe', '-NoLogo', '-NoProfile']
    # Prefer bash if available, else sh
    return ['bash'] if os.path.exists('/bin/bash') else ['sh']


async def _reader(stream: asyncio.StreamReader, websocket: WebSocket, kind: str):
    try:
        while True:
            data = await stream.readline()
            if not data:
                break
            # Send as text; decode bytes
            try:
                await websocket.send_text(json.dumps({"type": kind, "data": data.decode(errors='ignore')}))
            except RuntimeError:
                break
    except asyncio.CancelledError:
        pass


async def _terminal_ws_threaded(websocket: WebSocket):
    """Fallback implementation using threads and standard subprocess when asyncio subprocess is unsupported (e.g., certain Windows loop policies)."""
    import subprocess

    loop = asyncio.get_running_loop()
    cmd = _shell_command()
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()
    stop_event = threading.Event()

    def reader_thread(stream, kind: str):
        try:
            while not stop_event.is_set():
                chunk = stream.readline()
                if not chunk:
                    break
                text = chunk.decode(errors='ignore') if isinstance(chunk, (bytes, bytearray)) else str(chunk)
                loop.call_soon_threadsafe(queue.put_nowait, (kind, text))
        except Exception:
            pass

    t_out = threading.Thread(target=reader_thread, args=(proc.stdout, 'stdout'), daemon=True)
    t_err = threading.Thread(target=reader_thread, args=(proc.stderr, 'stderr'), daemon=True)
    t_out.start()
    t_err.start()

    consumer = asyncio.create_task(_queue_consumer(queue, websocket))

    try:
        while True:
            msg = await websocket.receive_text()
            try:
                parsed = json.loads(msg)
                if isinstance(parsed, dict) and parsed.get('type') == 'input':
                    text: str = parsed.get('data', '')
                else:
                    text = msg
            except Exception:
                text = msg
            try:
                if proc.stdin:
                    proc.stdin.write(text.encode())
                    proc.stdin.flush()
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        stop_event.set()
        consumer.cancel()
        with contextlib.suppress(Exception):
            await consumer
        try:
            if proc.stdin:
                proc.stdin.close()
        except Exception:
            pass
        with contextlib.suppress(Exception):
            proc.terminate()


async def _queue_consumer(queue: asyncio.Queue[tuple[str, str]], websocket: WebSocket):
    try:
        while True:
            kind, text = await queue.get()
            await websocket.send_text(json.dumps({"type": kind, "data": text}))
    except asyncio.CancelledError:
        pass


@router.websocket("/ws")
async def terminal_ws(websocket: WebSocket):
    await websocket.accept()

    cmd = _shell_command()
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except NotImplementedError:
        # Fallback for Windows selector loop: use threaded implementation
        return await _terminal_ws_threaded(websocket)

    # Start async readers for stdout/stderr
    tasks = [
        asyncio.create_task(_reader(proc.stdout, websocket, 'stdout')),
        asyncio.create_task(_reader(proc.stderr, websocket, 'stderr')),
    ]

    try:
        while True:
            msg = await websocket.receive_text()
            try:
                parsed = json.loads(msg)
                if isinstance(parsed, dict) and parsed.get('type') == 'input':
                    text: str = parsed.get('data', '')
                else:
                    text = msg
            except Exception:
                text = msg
            if proc.stdin is not None:
                try:
                    proc.stdin.write(text.encode())
                    await proc.stdin.drain()
                except Exception:
                    break
            # If process exited, break
            if proc.returncode is not None:
                break
    except WebSocketDisconnect:
        pass
    finally:
        for t in tasks:
            t.cancel()
        try:
            if proc.stdin and not proc.stdin.is_closing():
                proc.stdin.close()
        except Exception:
            pass
        try:
            proc.terminate()
        except Exception:
            pass
        with contextlib.suppress(Exception):
            await websocket.close() 