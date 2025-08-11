import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { StepLog } from '../types'
import CSVTable from './CSVTable'

interface LiveLogEvent {
  type: 'run_started' | 'log' | 'run_finished' | 'connected'
  run_id: string
  workflow_id?: string
  status?: 'running' | 'success' | 'error'
  finished_at?: string | null
  payload?: StepLog
}

function looksLikeCSV(text: string): boolean {
  const lines = text.trim().split(/\r?\n/) 
  if (lines.length < 2) return false
  const first = lines[0]
  return first.includes(',') && lines.some(l => l.includes(','))
}

interface Props {
  runId?: string
  onLogsUpdate?: (logs: StepLog[]) => void
}

export default function RunView({ runId: controlledRunId, onLogsUpdate }: Props) {
  const [uncontrolled, setUncontrolled] = useState('')
  const activeRunId = controlledRunId ?? uncontrolled
  const [logs, setLogs] = useState<StepLog[]>([])
  const [status, setStatus] = useState<'idle'|'running'|'success'|'error'>('idle')
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  
  const url = useMemo(() => {
    if (!activeRunId) return null
    const base = window.location.origin.replace('http', 'ws')
    return `${base}/api/runs/ws/${activeRunId}`
  }, [activeRunId])

  // Notify parent component when logs change
  useEffect(() => {
    if (onLogsUpdate) {
      onLogsUpdate(logs)
    }
  }, [logs, onLogsUpdate])

  // Reset state when runId changes
  useEffect(() => {
    setLogs([])
    setStatus('idle')
    setConnectionError(null)
    setReconnectAttempts(0)
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [activeRunId])

  // WebSocket connection logic
  useEffect(() => {
    if (!url) {
      setConnected(false)
      return
    }

    const connectWebSocket = () => {
      console.log(`Attempting to connect to WebSocket: ${url}`)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log(`WebSocket connected to ${url}`)
        setConnected(true)
        setConnectionError(null)
        setReconnectAttempts(0)
      }

      ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`)
        setConnected(false)
        wsRef.current = null
        
        // Only attempt reconnect if it wasn't a manual close and we haven't exceeded attempts
        if (event.code !== 1000 && reconnectAttempts < 5) {
          setConnectionError(`Connection lost. Reconnecting... (${reconnectAttempts + 1}/5)`)
          reconnectTimeoutRef.current = window.setTimeout(() => {
            setReconnectAttempts(prev => prev + 1)
            connectWebSocket()
          }, 2000 * Math.pow(2, reconnectAttempts)) // Exponential backoff
        } else if (reconnectAttempts >= 5) {
          setConnectionError('Failed to connect after 5 attempts. Please refresh the page.')
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionError('WebSocket connection error')
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as LiveLogEvent
          console.log('Received WebSocket message:', data)
          
          // Handle connection confirmation
          if (data.type === 'connected') {
            console.log(`Connection confirmed for run: ${data.run_id}`)
            return
          }
          
          if (data.type === 'run_started') {
            setStatus('running')
            console.log(`Run started: ${data.run_id}`)
          }
          
          if (data.type === 'log' && data.payload) {
            console.log(`Log received for step: ${data.payload.step_name}`)
            setLogs((prev) => {
              // Check if this log already exists to avoid duplicates
              const exists = prev.some(log => 
                log.step_id === data.payload!.step_id && 
                log.started_at === data.payload!.started_at &&
                log.status === data.payload!.status
              )
              if (exists) return prev
              return [...prev, data.payload!]
            })
          }
          
          if (data.type === 'run_finished') {
            const finalStatus = (data.status as 'success' | 'error') ?? 'success'
            setStatus(finalStatus)
            console.log(`Run finished with status: ${finalStatus}`)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error, ev.data)
        }
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [url, reconnectAttempts])

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium mb-2 text-gray-200">Run Viewer</h3>
      {!controlledRunId && (
        <div className="flex items-center gap-2 mb-3">
          <input 
            className="border border-slate-700 bg-cyber-panel/60 rounded px-2 py-1 text-gray-100 placeholder-gray-400" 
            placeholder="Enter Run ID to view logs" 
            value={uncontrolled} 
            onChange={(e) => setUncontrolled(e.target.value)} 
          />
          {uncontrolled && (
            <button 
              className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonCyan hover:shadow-neonCyan"
              onClick={() => {
                setLogs([])
                setStatus('idle')
                setConnectionError(null)
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${
          connected 
            ? 'bg-green-900/50 text-cyber-neonGreen border-green-800' 
            : 'bg-slate-800 text-gray-400 border-slate-700'
        }`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        
        <span className={`text-xs px-2 py-0.5 rounded border ${
          status === 'running' ? 'bg-yellow-900/50 text-cyber-neonYellow border-yellow-800' :
          status === 'success' ? 'bg-green-900/50 text-cyber-neonGreen border-green-800' :
          status === 'error' ? 'bg-red-900/50 text-cyber-neonPink border-red-800' :
          'bg-slate-800 text-gray-400 border-slate-700'
        }`}>
          Status: {status}
        </span>

        {activeRunId && (
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-gray-400 border border-slate-700 font-mono">
            ID: {activeRunId.slice(0, 8)}...
          </span>
        )}
      </div>

      {connectionError && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-800 rounded text-cyber-neonPink text-sm">
          {connectionError}
        </div>
      )}

      <div className="h-72 overflow-auto border border-slate-800 rounded p-2 bg-cyber-panel/30">
        {!activeRunId ? (
          <div className="text-sm text-gray-500 text-center py-8">
            Enter a Run ID above to view real-time logs
          </div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            {connected ? 'Waiting for logs...' : 'Connecting to log stream...'}
          </div>
        ) : (
          <ol className="space-y-4">
            {logs.map((log, index) => {
              const isCSV = !!log.output && looksLikeCSV(log.output)
              const logKey = `${log.step_id}-${log.started_at ?? index}-${log.status}`
              
              return (
                <li key={logKey} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-medium text-cyber-neonCyan">
                      {log.step_name} ({log.step_type})
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      log.status === 'running' ? 'bg-yellow-900/50 text-cyber-neonYellow' :
                      log.status === 'success' ? 'bg-green-900/50 text-cyber-neonGreen' :
                      'bg-red-900/50 text-cyber-neonPink'
                    }`}>
                      {log.status}
                    </span>
                    {log.started_at && (
                      <span className="text-xs text-gray-500">
                        {new Date(log.started_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  
                  {log.output && (
                    <div className="ml-2">
                      {isCSV ? (
                        <div className="border border-slate-700 rounded bg-cyber-panel/20">
                          <CSVTable csv={log.output} />
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap text-gray-300 bg-cyber-panel/40 p-2 rounded border border-slate-700 text-xs">
                          {log.output}
                        </pre>
                      )}
                    </div>
                  )}
                  
                  {log.error && (
                    <div className="ml-2">
                      <pre className="whitespace-pre-wrap text-cyber-neonPink bg-red-900/20 p-2 rounded border border-red-800 text-xs">
                        {log.error}
                      </pre>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
} 