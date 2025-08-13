import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import { PlaygroundInstance, PlaygroundStats } from '../types'

function playgroundTerminalWsUrl(instanceId: string): string {
  const base = window.location.origin.replace('http', 'ws')
  return `${base}/api/playground/${instanceId}/terminal`
}

interface Props {
  instance: PlaygroundInstance
  stats?: PlaygroundStats
}

export default function PlaygroundTerminal({ instance, stats }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pingIntervalRef = useRef<number | null>(null)
  
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchVisible, setSearchVisible] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [reconnectCountdown, setReconnectCountdown] = useState(0)
  
  const maxReconnectAttempts = 1
  
  // Enhanced WebSocket connection with auto-reconnect and delay
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    if (instance.status !== 'running') {
      setConnectionError('Instance is not running')
      return
    }

    // Add 5-second delay before each connection attempt
    setConnectionError('Connecting to terminal...')
    setIsConnecting(true)
    setReconnectCountdown(5)
    
    // Countdown timer
    const countdownInterval = window.setInterval(() => {
      setReconnectCountdown(prev => {
        if (prev <= 1) {
          window.clearInterval(countdownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    setTimeout(() => {
      window.clearInterval(countdownInterval)
      setIsConnecting(false)
      setReconnectCountdown(0)
      
      if (instance.status !== 'running') {
        setConnectionError('Instance is not running')
        return
      }

      setConnectionError(null)
      const ws = new WebSocket(playgroundTerminalWsUrl(instance.id))
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setConnectionError(null)
        setReconnectAttempts(0)
        setIsConnecting(false)
        setReconnectCountdown(0)
        
        // Start ping interval to keep connection alive
        if (pingIntervalRef.current) {
          window.clearInterval(pingIntervalRef.current)
        }
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000) // Ping every 30 seconds
      }

      ws.onclose = (event) => {
        setConnected(false)
        setSessionId(null)
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          window.clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }
        
        console.log(`WebSocket closed for instance ${instance.id}:`, event.code, event.reason)
        
        if (termRef.current && !event.wasClean) {
          termRef.current.write('\r\n\x1b[38;5;196m╔══════════════════════════════════════════╗\x1b[0m\r\n')
          termRef.current.write('\x1b[38;5;196m║           Connection Lost                ║\x1b[0m\r\n')
          termRef.current.write('\x1b[38;5;196m║     Reconnecting in 5 seconds...         ║\x1b[0m\r\n')
          termRef.current.write('\x1b[38;5;196m╚══════════════════════════════════════════╝\x1b[0m\r\n')
          
          // Auto-reconnect logic with 5-second base delay
          if (reconnectAttempts < maxReconnectAttempts && instance.status === 'running') {
            const baseDelay = 5000 // 5 seconds base delay
            const exponentialDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000)
            const totalDelay = baseDelay + exponentialDelay
            const totalSeconds = Math.ceil(totalDelay / 1000)
            
            setReconnectAttempts(prev => prev + 1)
            setConnectionError(`Reconnecting in ${totalSeconds} seconds... (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`)
            setIsConnecting(true)
            setReconnectCountdown(totalSeconds)
            
            // Countdown timer for reconnect
            const reconnectCountdownInterval = window.setInterval(() => {
              setReconnectCountdown(prev => {
                const newCount = prev - 1
                if (newCount > 0) {
                  setConnectionError(`Reconnecting in ${newCount} seconds... (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`)
                }
                if (newCount <= 0) {
                  window.clearInterval(reconnectCountdownInterval)
                }
                return newCount
              })
            }, 1000)
            
            reconnectTimeoutRef.current = window.setTimeout(() => {
              window.clearInterval(reconnectCountdownInterval)
              connectWebSocket()
            }, totalDelay)
          } else {
            termRef.current.write('\r\n\x1b[38;5;196m╔══════════════════════════════════════════╗\x1b[0m\r\n')
            termRef.current.write('\x1b[38;5;196m║     Max reconnection attempts reached     ║\x1b[0m\r\n')
            termRef.current.write('\x1b[38;5;196m║     Please refresh the page              ║\x1b[0m\r\n')
            termRef.current.write('\x1b[38;5;196m╚══════════════════════════════════════════╝\x1b[0m\r\n')
            setConnectionError('Max reconnection attempts reached. Please refresh the page.')
            setIsConnecting(false)
            setReconnectCountdown(0)
          }
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionError('Failed to connect to playground terminal')
        setConnected(false)
        setIsConnecting(false)
        setReconnectCountdown(0)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          switch (data.type) {
            case 'connected':
              console.log('Terminal connected successfully')
              setIsConnecting(false)
              break
              
            case 'output':
              // Write output from container to terminal
              if (data.data && termRef.current) {
                termRef.current.write(data.data)
              }
              break
              
            case 'error':
              console.error('Terminal error:', data.message)
              if (termRef.current) {
                termRef.current.write(`\r\n❌ Error: ${data.message}\r\n`)
              }
              break
              
            case 'pong':
              // Handle keepalive response
              console.log('Received pong from terminal')
              break
              
            default:
              // Handle any raw output data
              if ((data.data || typeof data === 'string') && termRef.current) {
                const output = data.data || data
                termRef.current.write(output)
              }
          }
        } catch (error) {
          // Handle raw text messages (fallback)
          console.log('Raw terminal output:', event.data)
          if (termRef.current) {
            termRef.current.write(event.data)
          }
        }
      }
    }, 5000) // 5-second delay before each connection attempt
  }, [instance, reconnectAttempts])

  // Initialize terminal with enhanced features
  useEffect(() => {
    const fitAddon = new FitAddon()
    
    fitAddonRef.current = fitAddon

    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontSize: 14,
      lineHeight: 1.2,
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
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
      scrollback: 10000, // Increased scrollback buffer
      tabStopWidth: 4,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      fastScrollModifier: 'shift',
      wordSeparator: ' ()[]{},"`\''
    })

    // Load addons
    term.loadAddon(fitAddon)
    termRef.current = term

    if (containerRef.current) {
      term.open(containerRef.current)
      fitAddon.fit()
      
      // Focus the terminal immediately
      term.focus()
      
      // Send initial terminal size
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows
          }))
        }
        // Ensure terminal is focused after connection
        term.focus()
      }, 100)
    }

    // Enhanced terminal input handling
    const disposable = term.onData((data: string) => {
      console.log('Terminal input:', data, 'Connected:', wsRef.current?.readyState === WebSocket.OPEN)
      
      // Don't show input locally - let the backend handle echo to prevent double characters
      // Only show immediate feedback for connection errors
      
      // Send to backend via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'input',
            data: data
          }))
        } catch (error) {
          console.error('Failed to send WebSocket message:', error)
          if (termRef.current) {
            termRef.current.write('\r\n❌ Connection error, message not sent\r\n')
          }
        }
      } else {
        console.warn('WebSocket not connected, input ignored:', data)
        if (termRef.current && data === '\r') {
          termRef.current.write('\r\n❌ Not connected to terminal\r\n')
        }
      }
    })

    // Handle window resize with debouncing
    let resizeTimeout: number
    const handleResize = () => {
      window.clearTimeout(resizeTimeout)
      resizeTimeout = window.setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
          
          // Send new terminal size to backend
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && termRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'resize',
              cols: termRef.current.cols,
              rows: termRef.current.rows
            }))
          }
        }
      }, 100)
    }
    
    window.addEventListener('resize', handleResize)

    // Enhanced keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+F: Search (placeholder - requires addon)
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setSearchVisible(prev => !prev)
      }
      
      // F11: Fullscreen
      if (e.key === 'F11') {
        e.preventDefault()
        setIsFullscreen(prev => !prev)
      }
      
      // Ctrl+Plus/Minus: Font size
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        const currentSize = term.options.fontSize || 14
        term.options.fontSize = Math.min(currentSize + 1, 24)
        fitAddon.fit()
      }
      
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault()
        const currentSize = term.options.fontSize || 14
        term.options.fontSize = Math.max(currentSize - 1, 8)
        fitAddon.fit()
      }
      
      // Ctrl+0: Reset font size
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        term.options.fontSize = 14
        fitAddon.fit()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)

    // Connect to WebSocket
    connectWebSocket()

    return () => {
      disposable.dispose()
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('keydown', handleKeyDown)
      
      // Clear timeouts and intervals
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        window.clearInterval(pingIntervalRef.current)
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close()
      }
      
      // Dispose terminal
      term.dispose()
    }
  }, [connectWebSocket])

  // Effect to monitor instance status changes
  useEffect(() => {
    if (instance.status === 'running' && !connected && reconnectAttempts < maxReconnectAttempts) {
      connectWebSocket()
    }
  }, [instance.status, connected, reconnectAttempts, connectWebSocket])

  // Search functionality (simplified without addon)
  const handleSearch = (searchTerm: string) => {
    if (termRef.current && searchTerm) {
      // Basic search functionality - just highlight the term in terminal
      console.log('Searching for:', searchTerm)
      // Note: Full search requires @xterm/addon-search which may not be available
    }
  }

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-cyber-dark' : ''}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyber-dark via-cyber-darker to-cyber-dark border-b border-cyber-neonCyan/30">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
            <span className="text-cyber-neonCyan font-mono text-sm">
              {connected ? `Connected (${sessionId?.slice(-8)})` : 'Disconnected'}
            </span>
          </div>
          
          {stats && (
            <div className="text-xs text-cyber-lightGray space-x-4">
              <span>CPU: {stats.cpu_usage}%</span>
              <span>Memory: {stats.memory_usage}%</span>
              <span>Containers: {stats.containers_count}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Search Toggle */}
          <button
            onClick={() => setSearchVisible(!searchVisible)}
            className="px-2 py-1 text-xs rounded border border-cyber-neonCyan/50 bg-cyber-neonCyan/10 text-cyber-neonCyan hover:bg-cyber-neonCyan/20 transition-all"
            title="Search (Ctrl+Shift+F)"
          >
            🔍
          </button>
          
          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-2 py-1 text-xs rounded border border-cyber-neonCyan/50 bg-cyber-neonCyan/10 text-cyber-neonCyan hover:bg-cyber-neonCyan/20 transition-all"
            title="Fullscreen (F11)"
          >
            {isFullscreen ? '🗗' : '🗖'}
          </button>
          
          {/* Reconnect Button */}
          {!connected && (
            <button
              onClick={connectWebSocket}
              disabled={reconnectAttempts >= maxReconnectAttempts || isConnecting}
              className="px-2 py-1 text-xs rounded border border-cyber-neonGreen/50 bg-cyber-neonGreen/10 text-cyber-neonGreen hover:bg-cyber-neonGreen/20 transition-all disabled:opacity-50"
            >
              {isConnecting ? `🔄 Connecting${reconnectCountdown > 0 ? ` (${reconnectCountdown}s)` : '...'}` : '🔄 Reconnect'}
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {searchVisible && (
        <div className="p-2 bg-cyber-darker border-b border-cyber-neonCyan/30">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search terminal..."
              className="flex-1 px-3 py-1 text-sm bg-cyber-dark border border-cyber-neonCyan/50 rounded text-cyber-lightGray focus:border-cyber-neonCyan focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(e.currentTarget.value)
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement
                handleSearch(input.value)
              }}
              className="px-2 py-1 text-xs rounded border border-cyber-neonCyan/50 bg-cyber-neonCyan/10 text-cyber-neonCyan hover:bg-cyber-neonCyan/20"
            >
              ↑
            </button>
            <button
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling?.previousElementSibling as HTMLInputElement
                handleSearch(input.value)
              }}
              className="px-2 py-1 text-xs rounded border border-cyber-neonCyan/50 bg-cyber-neonCyan/10 text-cyber-neonCyan hover:bg-cyber-neonCyan/20"
            >
              ↓
            </button>
          </div>
        </div>
      )}

      {/* Connection Error */}
      {connectionError && (
        <div className="p-3 bg-red-900/20 border-b border-red-500/30">
          <div className="text-red-400 text-sm font-mono">
            {isConnecting && reconnectCountdown > 0 ? (
              <span>⏳ Connecting in {reconnectCountdown} seconds...</span>
            ) : (
              <span>❌ {connectionError}</span>
            )}
            {reconnectAttempts > 0 && !isConnecting && ` (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`}
          </div>
        </div>
      )}

      {/* Terminal Container */}
      <div 
        ref={containerRef} 
        className="flex-1 bg-cyber-dark cursor-text"
        style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : '500px' }}
        onClick={() => {
          // Focus terminal when clicked
          if (termRef.current) {
            termRef.current.focus()
          }
        }}
        onMouseEnter={() => {
          // Focus terminal on hover for better UX
          if (termRef.current && connected) {
            termRef.current.focus()
          }
        }}
      />
      
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-cyber-darker border-t border-cyber-neonCyan/30 text-xs text-cyber-lightGray">
        <div className="flex items-center space-x-4">
          <span>Instance: {instance.name}</span>
          <span>Status: {instance.status}</span>
          {connected && termRef.current && (
            <span>Size: {termRef.current.cols}×{termRef.current.rows}</span>
          )}
        </div>
        <div>
          <span>Shortcuts: Ctrl+Shift+F (Search) | F11 (Fullscreen) | Ctrl+/- (Font)</span>
        </div>
      </div>
    </div>
  )
} 