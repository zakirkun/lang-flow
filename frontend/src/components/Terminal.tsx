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
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [connectionTime, setConnectionTime] = useState<Date | null>(null)
  const [currentCommand, setCurrentCommand] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Enhanced command suggestions for pentesting
  const commonCommands = [
    // System info
    'whoami', 'pwd', 'uname -a', 'hostname', 'id',
    // File operations
    'ls -la', 'ls -lah', 'find . -name', 'grep -r',
    // Network
    'netstat -tulpn', 'ss -tuln', 'ip addr show', 'ifconfig',
    'ping -c 4', 'nslookup', 'dig', 'traceroute',
    // Process management
    'ps aux', 'ps -ef', 'top', 'htop', 'kill -9',
    // Security tools
    'nmap -sS', 'nmap -sV', 'nmap -A', 'nikto -h',
    'sqlmap -u', 'gobuster dir -u', 'dirb',
    // System monitoring
    'df -h', 'free -h', 'lscpu', 'lsblk', 'mount'
  ]

  // Callback functions
  const clearTerminal = useCallback(() => {
    if (termRef.current) {
      termRef.current.clear()
      termRef.current.write('\x1b[38;5;51m┌─ Terminal Cleared ─┐\x1b[0m\r\n')
      termRef.current.write('\x1b[38;5;51m│ Ready for commands │\x1b[0m\r\n')
      termRef.current.write('\x1b[38;5;51m└────────────────────┘\x1b[0m\r\n\r\n')
    }
  }, [])

  const copyToClipboard = useCallback(async () => {
    if (termRef.current) {
      const selection = termRef.current.getSelection()
      if (selection) {
        try {
          await navigator.clipboard.writeText(selection)
          // Show feedback
          if (termRef.current) {
            termRef.current.write('\r\n\x1b[38;5;46m[COPIED] Text copied to clipboard\x1b[0m\r\n')
          }
        } catch (err) {
          console.error('Failed to copy text: ', err)
          if (termRef.current) {
            termRef.current.write('\r\n\x1b[38;5;196m[ERROR] Failed to copy text\x1b[0m\r\n')
          }
        }
      } else {
        if (termRef.current) {
          termRef.current.write('\r\n\x1b[38;5;214m[INFO] No text selected\x1b[0m\r\n')
        }
      }
    }
  }, [])

  const pasteFromClipboard = useCallback(async () => {
    if (termRef.current && wsRef.current && connected) {
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          wsRef.current.send(JSON.stringify({ type: 'input', data: text }))
          // Show feedback
          termRef.current.write(`\r\n\x1b[38;5;46m[PASTED] ${text.length} characters\x1b[0m\r\n`)
        }
      } catch (err) {
        console.error('Failed to paste text: ', err)
        if (termRef.current) {
          termRef.current.write('\r\n\x1b[38;5;196m[ERROR] Failed to paste text\x1b[0m\r\n')
        }
      }
    }
  }, [connected])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }, 100)
  }, [isFullscreen])

  const executeQuickCommand = useCallback((command: string) => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: command + '\r' }))
      setCommandHistory(prev => {
        const newHistory = [command, ...prev.filter(cmd => cmd !== command)]
        return newHistory.slice(0, 20) // Keep last 20 commands
      })
      setHistoryIndex(-1)
      
      // Show visual feedback
      if (termRef.current) {
        termRef.current.write(`\r\n\x1b[38;5;51m[QUICK] Executing: ${command}\x1b[0m\r\n`)
      }
    }
  }, [connected])

  const handleKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (!termRef.current || !connected) return

    // Ctrl+L - Clear terminal
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      clearTerminal()
    }
    
    // Ctrl+C - Interrupt (send SIGINT)
    if (e.ctrlKey && e.key === 'c') {
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: '\x03' })) // Ctrl+C
      }
    }

    // Ctrl+D - EOF
    if (e.ctrlKey && e.key === 'd') {
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: '\x04' })) // Ctrl+D
      }
    }

    // Ctrl+Shift+V - Paste
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      e.preventDefault()
      pasteFromClipboard()
    }

    // F11 - Toggle fullscreen
    if (e.key === 'F11') {
      e.preventDefault()
      toggleFullscreen()
    }
  }, [connected, clearTerminal, pasteFromClipboard, toggleFullscreen])

  // Separate the WebSocket connection logic from the terminal setup
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    const ws = new WebSocket(wsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setConnectionTime(new Date())
      if (termRef.current) {
        termRef.current.write('\x1b[38;5;51m╔═══════════════════════════════════════════════════════════════════════════════╗\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;51m║                        🔥 LangFlow Terminal v2.0                             ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;51m╠═══════════════════════════════════════════════════════════════════════════════╣\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;51m║ Connected to secure shell session                                            ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;51m║                                                                               ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;46m║ 💡 Shortcuts: Ctrl+L (clear) | Ctrl+C (interrupt) | F11 (fullscreen)        ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;46m║ 💡 Features: Command history | Auto-completion | Quick commands             ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;51m╚═══════════════════════════════════════════════════════════════════════════════╝\x1b[0m\r\n\r\n')
      }
    }
    
    ws.onclose = () => {
      setConnected(false)
      setConnectionTime(null)
      if (termRef.current) {
        termRef.current.write('\r\n\x1b[38;5;196m╔═════════════════════════════════════════╗\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;196m║           Connection Lost                ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;196m║     Disconnected from server            ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;214m║   Click reconnect to establish new      ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;214m║        connection                       ║\x1b[0m\r\n')
        termRef.current.write('\x1b[38;5;196m╚═════════════════════════════════════════╝\x1b[0m\r\n')
      }
    }
    
    ws.onerror = () => {
      if (termRef.current) {
        termRef.current.write('\r\n\x1b[38;5;196m[ERROR] Connection failed - Check server status\x1b[0m\r\n')
      }
    }
    
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'stdout' || msg.type === 'stderr') {
          if (termRef.current) {
            termRef.current.write(msg.data)
          }
          setIsTyping(false) // Reset typing indicator when we get output
        }
      } catch {
        if (termRef.current) {
          termRef.current.write(ev.data)
        }
        setIsTyping(false)
      }
    }
  }, [])

  // Terminal initialization effect - runs only once
  useEffect(() => {
    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon

    const term = new XTerm({ 
      convertEol: true, 
      cursorBlink: true,
      fontSize: 14,
      lineHeight: 1.2,
      fontFamily: 'ui-monospace, SFMono-Regular, "Fira Code", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
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
      scrollback: 2000, // Increased buffer
      tabStopWidth: 4,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      fastScrollModifier: 'shift'
    })
    
    term.loadAddon(fitAddon)
    termRef.current = term
    
    if (containerRef.current) {
      term.open(containerRef.current)
      fitAddon.fit()
    }

    let currentLine = ''
    const disposable = term.onData((data: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setIsTyping(true)
        
        // Handle special keys
        if (data === '\r') { // Enter key
          if (currentLine.trim()) {
            setCommandHistory(prev => {
              const newHistory = [currentLine.trim(), ...prev.filter(cmd => cmd !== currentLine.trim())]
              return newHistory.slice(0, 20)
            })
          }
          currentLine = ''
          setHistoryIndex(-1)
          setCurrentCommand('')
        } else if (data === '\u007f' || data === '\b') { // Backspace
          currentLine = currentLine.slice(0, -1)
          setCurrentCommand(currentLine)
        } else if (data === '\x1b[A') { // Up arrow - history navigation
          if (commandHistory.length > 0) {
            const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
            setHistoryIndex(newIndex)
            const cmd = commandHistory[newIndex] || ''
            currentLine = cmd
            setCurrentCommand(cmd)
            // Clear current line and write the history command
            wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }))
            setTimeout(() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'input', data: cmd }))
              }
            }, 10)
            return // Don't send the arrow key to terminal
          }
        } else if (data === '\x1b[B') { // Down arrow - history navigation
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1
            setHistoryIndex(newIndex)
            const cmd = commandHistory[newIndex] || ''
            currentLine = cmd
            setCurrentCommand(cmd)
            // Clear current line and write the history command
            wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }))
            setTimeout(() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'input', data: cmd }))
              }
            }, 10)
            return // Don't send the arrow key to terminal
          } else if (historyIndex === 0) {
            setHistoryIndex(-1)
            currentLine = ''
            setCurrentCommand('')
            wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }))
            return
          }
        } else if (data === '\t') { // Tab completion
          const matches = commonCommands.filter(cmd => 
            cmd.toLowerCase().startsWith(currentLine.toLowerCase())
          )
          if (matches.length === 1) {
            const completion = matches[0].substring(currentLine.length)
            currentLine = matches[0]
            setCurrentCommand(currentLine)
            wsRef.current.send(JSON.stringify({ type: 'input', data: completion }))
            return
          } else if (matches.length > 1) {
            // Show available completions
            term.write(`\r\n\x1b[38;5;214m[TAB] Available completions:\x1b[0m\r\n`)
            matches.slice(0, 5).forEach(match => {
              term.write(`\x1b[38;5;46m  ${match}\x1b[0m\r\n`)
            })
            if (matches.length > 5) {
              term.write(`\x1b[38;5;214m  ... and ${matches.length - 5} more\x1b[0m\r\n`)
            }
            return
          }
        } else if (data.charCodeAt(0) >= 32 && data.charCodeAt(0) <= 126) { // Printable characters
          currentLine += data
          setCurrentCommand(currentLine)
        }

        // Send data to terminal
        wsRef.current.send(JSON.stringify({ type: 'input', data }))
        
        // Reset typing indicator after a delay
        setTimeout(() => setIsTyping(false), 1000)
      }
    })

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts)

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }
    window.addEventListener('resize', handleResize)

    // Initialize WebSocket connection
    connectWebSocket()

    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts)
      disposable.dispose()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      term.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, []) // Empty dependency array - only run once on mount

  // Separate effect for handling keyboard shortcuts to avoid recreating the terminal
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      handleKeyboardShortcuts(e)
    }
    
    document.addEventListener('keydown', handleShortcuts)
    return () => {
      document.removeEventListener('keydown', handleShortcuts)
    }
  }, [handleKeyboardShortcuts])

  const reconnectTerminal = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
    setConnectionTime(null)
    
    // Wait a bit before reconnecting
    setTimeout(() => {
      connectWebSocket()
    }, 500)
  }, [connectWebSocket])

  // Quick commands for pentesting organized by category
  const quickCommandCategories = {
    'System Info': ['whoami', 'pwd', 'uname -a', 'hostname', 'id'],
    'Network': ['netstat -tulpn', 'ss -tuln', 'ip addr show', 'ping -c 4'],
    'Files': ['ls -la', 'find . -name', 'grep -r', 'df -h'],
    'Processes': ['ps aux', 'top', 'kill -9', 'free -h']
  }

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
            <h3 className="text-xl font-medium text-cyber-neonCyan">🔥 LangFlow Terminal - Fullscreen</h3>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-cyber-neonGreen animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-300">
                {connected ? `Connected ${connectionTime ? `• ${formatUptime(connectionTime)}` : ''}` : 'Disconnected'}
              </span>
              {isTyping && (
                <span className="text-xs text-cyber-neonYellow animate-pulse">⌨️ Typing...</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={clearTerminal}
              className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonCyan hover:shadow-neonCyan transition-all"
              title="Clear Terminal (Ctrl+L)"
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
              title="Paste (Ctrl+Shift+V)"
            >
              📄 Paste
            </button>
            {!connected && (
              <button 
                onClick={reconnectTerminal}
                className="px-3 py-1 text-sm rounded border border-green-800 bg-green-900/30 text-cyber-neonGreen hover:shadow-neonGreen transition-all"
                title="Reconnect"
              >
                🔄 Reconnect
              </button>
            )}
            <button 
              onClick={toggleFullscreen}
              className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonPink hover:shadow-neonPink transition-all"
              title="Exit Fullscreen (F11)"
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
                {isTyping && (
                  <span className="text-xs text-cyber-neonYellow animate-pulse ml-2">⌨️ Typing...</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={clearTerminal}
            className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonCyan hover:shadow-neonCyan transition-all"
            title="Clear Terminal (Ctrl+L)"
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
            title="Paste from Clipboard (Ctrl+Shift+V)"
          >
            📄 Paste
          </button>
          {!connected && (
            <button 
              onClick={reconnectTerminal}
              className="px-3 py-1 text-sm rounded border border-green-800 bg-green-900/30 text-cyber-neonGreen hover:shadow-neonGreen transition-all"
              title="Reconnect to Terminal"
            >
              🔄 Reconnect
            </button>
          )}
          <button 
            onClick={toggleFullscreen}
            className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonPink hover:shadow-neonPink transition-all"
            title="Fullscreen Mode (F11)"
          >
            ↗️ Fullscreen
          </button>
        </div>
      </div>

      {/* Enhanced Quick Commands Panel */}
      <div className="border border-slate-800 rounded-lg bg-cyber-panel/20 backdrop-blur p-4">
        <div className="flex flex-col gap-4">
          {/* Quick Commands by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(quickCommandCategories).map(([category, commands]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-cyber-neonCyan mb-2">⚡ {category}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {commands.map((cmd, index) => (
                    <button
                      key={index}
                      onClick={() => executeQuickCommand(cmd)}
                      disabled={!connected}
                      className="px-2 py-1 text-xs rounded border border-slate-700 bg-cyber-panel/40 text-gray-300 hover:text-cyber-neonGreen hover:border-cyber-neonGreen hover:shadow-neonGreen transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono text-left"
                      title={`Execute: ${cmd}`}
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Command History */}
          {commandHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-cyber-neonYellow mb-2">📜 Recent Commands</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-24 overflow-y-auto">
                {commandHistory.slice(0, 6).map((cmd, index) => (
                  <button
                    key={index}
                    onClick={() => executeQuickCommand(cmd)}
                    disabled={!connected}
                    className="px-2 py-1 text-xs rounded border border-slate-700 bg-cyber-panel/40 text-gray-300 hover:text-cyber-neonYellow hover:border-cyber-neonYellow transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono text-left truncate"
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
        
        {/* Enhanced Terminal Footer */}
        <div className="border-t border-slate-800 bg-cyber-panel/50 px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-gray-400">
          <div className="flex flex-wrap items-center gap-4">
            <span>📡 WebSocket: {connected ? 'Active' : 'Inactive'}</span>
            <span>📊 Buffer: 2000 lines</span>
            <span>📈 History: {commandHistory.length} commands</span>
            {currentCommand && (
              <span className="text-cyber-neonYellow">⌨️ Current: {currentCommand}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>💡 Shortcuts:</span>
            <span className="px-1 py-0.5 rounded bg-slate-800 text-gray-300">Ctrl+L</span>
            <span>clear</span>
            <span className="px-1 py-0.5 rounded bg-slate-800 text-gray-300">Tab</span>
            <span>complete</span>
            <span className="px-1 py-0.5 rounded bg-slate-800 text-gray-300">↑↓</span>
            <span>history</span>
            <span className="px-1 py-0.5 rounded bg-slate-800 text-gray-300">F11</span>
            <span>fullscreen</span>
          </div>
        </div>
      </div>
    </div>
  )
} 