import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

function wsUrl(): string {
  const base = window.location.origin.replace('http', 'ws')
  return `${base}/api/terminal/ws`
}

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [connected, setConnected] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [connectionTime, setConnectionTime] = useState<Date | null>(null)
  const [currentCommand, setCurrentCommand] = useState('')

  // Callback functions
  const clearTerminal = useCallback(() => {
    if (termRef.current) {
      termRef.current.clear()
    }
  }, [])

  const copyToClipboard = useCallback(async () => {
    if (termRef.current) {
      const selection = termRef.current.getSelection()
      if (selection) {
        try {
          await navigator.clipboard.writeText(selection)
        } catch (err) {
          console.error('Failed to copy text: ', err)
        }
      }
    }
  }, [])

  const pasteFromClipboard = useCallback(async () => {
    if (termRef.current && wsRef.current) {
      try {
        const text = await navigator.clipboard.readText()
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }))
      } catch (err) {
        console.error('Failed to paste text: ', err)
      }
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }, 100)
  }, [isFullscreen])

  const executeQuickCommand = useCallback((command: string) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: command + '\r' }))
      setCommandHistory(prev => {
        const newHistory = [command, ...prev.filter(cmd => cmd !== command)]
        return newHistory.slice(0, 10) // Keep last 10 commands
      })
    }
  }, [])

  useEffect(() => {
    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon

    const term = new XTerm({ 
      convertEol: true, 
      cursorBlink: true,
      fontSize: 14,
      lineHeight: 1.2,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: '#0f1325',
        foreground: '#e2e8f0',
        cursor: '#22d3ee',
        cursorAccent: '#0f1325',
        selectionBackground: 'rgba(34, 211, 238, 0.3)',
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
      },
      allowTransparency: true,
      scrollback: 1000,
      tabStopWidth: 4
    })
    
    term.loadAddon(fitAddon)
    termRef.current = term
    
    if (containerRef.current) {
      term.open(containerRef.current)
      fitAddon.fit()
    }

    const ws = new WebSocket(wsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setConnectionTime(new Date())
      term.write('\x1b[38;5;51m┌─ Connected to Lang Flow Terminal ─┐\x1b[0m\r\n')
      term.write('\x1b[38;5;51m│ Ready for commands...              │\x1b[0m\r\n')
      term.write('\x1b[38;5;51m└────────────────────────────────────┘\x1b[0m\r\n\r\n')
    }
    
    ws.onclose = () => {
      setConnected(false)
      setConnectionTime(null)
      term.write('\r\n\x1b[38;5;196m┌─ Connection Lost ─┐\x1b[0m\r\n')
      term.write('\x1b[38;5;196m│ Disconnected from server\x1b[0m\r\n')
      term.write('\x1b[38;5;196m└───────────────────┘\x1b[0m\r\n')
    }
    
    ws.onerror = () => {
      term.write('\r\n\x1b[38;5;196m[ERROR] Connection failed\x1b[0m\r\n')
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
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
        
        // Track current command for history
        if (data === '\r') {
          if (currentCommand.trim()) {
            setCommandHistory(prev => {
              const newHistory = [currentCommand.trim(), ...prev.filter(cmd => cmd !== currentCommand.trim())]
              return newHistory.slice(0, 10)
            })
          }
          setCurrentCommand('')
        } else if (data === '\u007f') { // backspace
          setCurrentCommand(prev => prev.slice(0, -1))
        } else if (data !== '\r' && data !== '\n') {
          setCurrentCommand(prev => prev + data)
        }
      }
    })

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      disposable.dispose()
      ws.close()
      term.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, [currentCommand])

  // Quick commands for pentesting
  const quickCommands = [
    'whoami',
    'pwd',
    'ls -la',
    'netstat -tulpn',
    'ps aux',
    'uname -a',
    'ip addr show',
    'ss -tuln'
  ]

  const formatUptime = (startTime: Date) => {
    const now = new Date()
    const diff = now.getTime() - startTime.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-cyber-panel flex flex-col" style={{ background: 'linear-gradient(135deg, #0f1325 0%, #1e293b 100%)' }}>
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-cyber-panel/80 backdrop-blur">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-medium text-cyber-neonCyan">🔥 Lang Flow Terminal</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-cyber-neonGreen animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-300">
                {connected ? `Connected ${connectionTime ? `• ${formatUptime(connectionTime)}` : ''}` : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={clearTerminal}
              className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonCyan hover:shadow-neonCyan transition-all"
              title="Clear Terminal"
            >
              🧹 Clear
            </button>
            <button 
              onClick={copyToClipboard}
              className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonGreen hover:shadow-neonGreen transition-all"
              title="Copy Selection"
            >
              📋 Copy
            </button>
            <button 
              onClick={pasteFromClipboard}
              className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonYellow hover:shadow-neonYellow transition-all"
              title="Paste"
            >
              📄 Paste
            </button>
            <button 
              onClick={toggleFullscreen}
              className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonPink hover:shadow-neonPink transition-all"
              title="Exit Fullscreen"
            >
              ↙️ Exit
            </button>
          </div>
        </div>
        
        {/* Fullscreen Terminal */}
        <div 
          ref={containerRef} 
          className="flex-1 bg-cyber-panel" 
          style={{ 
            background: 'linear-gradient(135deg, #0f1325 0%, #1e293b 100%)',
            boxShadow: 'inset 0 0 30px rgba(34, 211, 238, 0.1)'
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-800 rounded-lg bg-cyber-panel/30 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <h3 className="text-lg font-medium text-cyber-neonCyan">Interactive Terminal</h3>
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-cyber-neonGreen animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-gray-300">
                  {connected ? `Connected ${connectionTime ? `• Uptime: ${formatUptime(connectionTime)}` : ''}` : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={clearTerminal}
            className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonCyan hover:shadow-neonCyan transition-all"
            title="Clear Terminal"
          >
            🧹 Clear
          </button>
          <button 
            onClick={copyToClipboard}
            className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonGreen hover:shadow-neonGreen transition-all"
            title="Copy Selection"
          >
            📋 Copy
          </button>
          <button 
            onClick={pasteFromClipboard}
            className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonYellow hover:shadow-neonYellow transition-all"
            title="Paste from Clipboard"
          >
            📄 Paste
          </button>
          <button 
            onClick={toggleFullscreen}
            className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonPink hover:shadow-neonPink transition-all"
            title="Fullscreen Mode"
          >
            ↗️ Fullscreen
          </button>
        </div>
      </div>

      {/* Quick Commands Panel */}
      <div className="border border-slate-800 rounded-lg bg-cyber-panel/20 backdrop-blur p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-cyber-neonCyan mb-2">⚡ Quick Commands</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quickCommands.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => executeQuickCommand(cmd)}
                  disabled={!connected}
                  className="px-2 py-1 text-xs rounded border border-slate-700 bg-cyber-panel/40 text-gray-300 hover:text-cyber-neonGreen hover:border-cyber-neonGreen hover:shadow-neonGreen transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                  title={`Execute: ${cmd}`}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
          
          {/* Command History */}
          {commandHistory.length > 0 && (
            <div className="w-full sm:w-60">
              <h4 className="text-sm font-medium text-cyber-neonYellow mb-2">📜 History</h4>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {commandHistory.slice(0, 5).map((cmd, index) => (
                  <button
                    key={index}
                    onClick={() => executeQuickCommand(cmd)}
                    disabled={!connected}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-cyber-panel/40 text-gray-300 hover:text-cyber-neonYellow hover:border-cyber-neonYellow transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono text-left truncate"
                    title={`Re-execute: ${cmd}`}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Terminal Container */}
      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <div 
          ref={containerRef} 
          className="h-96 bg-cyber-panel" 
          style={{ 
            background: 'linear-gradient(135deg, #0f1325 0%, #1e293b 100%)',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.1), inset 0 0 20px rgba(34, 211, 238, 0.05)'
          }}
        />
        
        {/* Terminal Footer */}
        <div className="border-t border-slate-800 bg-cyber-panel/50 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>📡 WebSocket: {connected ? 'Active' : 'Inactive'}</span>
            <span>📊 Buffer: 1000 lines</span>
          </div>
          <div className="flex items-center gap-2">
            <span>💡 Tip: Use Ctrl+C to interrupt, Ctrl+L to clear</span>
          </div>
        </div>
      </div>
    </div>
  )
} 