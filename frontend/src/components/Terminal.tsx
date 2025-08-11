import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import 'xterm/css/xterm.css'

function wsUrl(): string {
  const base = window.location.origin.replace('http', 'ws')
  return `${base}/api/terminal/ws`
}

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const term = new XTerm({ 
      convertEol: true, 
      cursorBlink: true, 
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: '#0f1325',
        foreground: '#e2e8f0',
        cursor: '#22d3ee',
        black: '#0f172a',
        red: '#ef4444',
        green: '#39ff14',
        yellow: '#f5f749',
        blue: '#22d3ee',
        magenta: '#ff3caa',
        cyan: '#22d3ee',
        white: '#e2e8f0',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#39ff14',
        brightYellow: '#f5f749',
        brightBlue: '#22d3ee',
        brightMagenta: '#ff3caa',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc'
      }
    })
    termRef.current = term
    if (containerRef.current) term.open(containerRef.current)

    const ws = new WebSocket(wsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      term.write('\x1b[38;5;51m' + 'Connected to server' + '\x1b[0m\r\n')
    }
    ws.onclose = () => {
      setConnected(false)
      term.write('\r\n\x1b[38;5;196m[disconnected]\x1b[0m\r\n')
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'stdout' || msg.type === 'stderr') {
          term.write(msg.data)
        }
      } catch {
        term.write(ev.data)
      }
    }

    const disposable = term.onData((data: string) => {
      ws.send(JSON.stringify({ type: 'input', data }))
    })

    return () => {
      disposable.dispose()
      ws.close()
      term.dispose()
    }
  }, [])

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg font-medium text-cyber-neonCyan">Interactive Terminal</h3>
        <span className={`text-xs px-2 py-0.5 rounded border ${connected ? 'bg-green-900/50 text-cyber-neonGreen border-green-800' : 'bg-slate-800 text-gray-400 border-slate-700'}`}>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div 
        ref={containerRef} 
        className="h-80 border border-slate-800 rounded bg-cyber-panel shadow-neonCyan" 
        style={{ 
          background: 'linear-gradient(135deg, #0f1325 0%, #1e293b 100%)',
          boxShadow: '0 0 20px rgba(34, 211, 238, 0.1), inset 0 0 20px rgba(34, 211, 238, 0.05)'
        }}
      />
    </div>
  )
} 