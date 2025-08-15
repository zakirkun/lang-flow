import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { StepLog } from '../types'
import { createExecutionStream } from '../api'
import CSVTable from './CSVTable'

interface StreamEvent {
  type: string
  run_id: string
  data: any
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
  onStatusUpdate?: (status: 'idle' | 'running' | 'success' | 'error') => void
}

export default function RunView({ runId: controlledRunId, onLogsUpdate, onStatusUpdate }: Props) {
  const [uncontrolled, setUncontrolled] = useState('')
  const activeRunId = controlledRunId ?? uncontrolled
  const [logs, setLogs] = useState<StepLog[]>([])
  const [status, setStatus] = useState<'idle'|'running'|'success'|'error'>('idle')
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [stepProgress, setStepProgress] = useState<{ current: number; total: number; name: string } | null>(null)
  const [lastActivity, setLastActivity] = useState<Date | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<boolean>(true)
  const reconnectTimeoutRef = useRef<number | null>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  // Notify parent component when logs change
  useEffect(() => {
    if (onLogsUpdate) {
      onLogsUpdate(logs)
    }
  }, [logs, onLogsUpdate])

  // Notify parent component when status changes
  useEffect(() => {
    if (onStatusUpdate) {
      onStatusUpdate(status)
    }
  }, [status, onStatusUpdate])

  // Reset state when runId changes
  useEffect(() => {
    setLogs([])
    setStatus('idle')
    setConnectionError(null)
    setReconnectAttempts(0)
    setStepProgress(null)
    setLastActivity(null)
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [activeRunId])

  // Server-Sent Events connection logic
  useEffect(() => {
    if (!activeRunId) {
      setConnected(false)
      return
    }

    const connectEventSource = () => {
      console.log(`Connecting to execution stream for run: ${activeRunId}`)
      
      try {
        const eventSource = createExecutionStream(activeRunId)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          console.log(`EventSource connected for run: ${activeRunId}`)
          setConnected(true)
          setConnectionError(null)
          setReconnectAttempts(0)
          setLastActivity(new Date())
        }

        eventSource.onerror = (error) => {
          console.error('EventSource error:', error)
          setConnected(false)
          setConnectionError('Connection error')
          
          // Attempt to reconnect
          if (reconnectAttempts < 5) {
            setConnectionError(`Connection lost. Reconnecting... (${reconnectAttempts + 1}/5)`)
            reconnectTimeoutRef.current = window.setTimeout(() => {
              setReconnectAttempts(prev => prev + 1)
              connectEventSource()
            }, 2000 * Math.pow(2, reconnectAttempts)) // Exponential backoff
          } else {
            setConnectionError('Failed to connect after 5 attempts. Please refresh the page.')
          }
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as StreamEvent
            console.log('Received stream event:', data)
            setLastActivity(new Date())
            
            // Handle different event types
            switch (data.type) {
              case 'connected':
                console.log(`Connection confirmed for run: ${data.run_id}`)
                break
                
              case 'run_started':
                setStatus('running')
                console.log(`Run started: ${data.run_id}`)
                break
                
              case 'step_progress':
                if (data.data) {
                  setStepProgress({
                    current: data.data.current_step,
                    total: data.data.total_steps,
                    name: data.data.step_name
                  })
                }
                break
                
              case 'log':
                if (data.data) {
                  console.log(`Log received for step: ${data.data.step_name}`)
                  const newLog: StepLog = {
                    step_id: data.data.step_id,
                    step_name: data.data.step_name,
                    step_type: data.data.step_type,
                    status: data.data.status,
                    started_at: data.data.started_at,
                    finished_at: data.data.finished_at,
                    output: data.data.output,
                    error: data.data.error,
                    received_at: new Date().toISOString()
                  }
                  
                  setLogs((prev) => {
                    // Check if this log already exists to avoid duplicates
                    const exists = prev.some(log => 
                      log.step_id === newLog.step_id && 
                      log.started_at === newLog.started_at &&
                      log.status === newLog.status
                    )
                    if (exists) return prev
                    return [...prev, newLog]
                  })
                }
                break
                
              case 'run_finished':
                const finalStatus = (data.data?.status as 'success' | 'error') ?? 'success'
                setStatus(finalStatus)
                setStepProgress(null)
                console.log(`Run finished with status: ${finalStatus}`)
                break
                
              case 'error':
                console.error('Stream error:', data.data?.error)
                setConnectionError(`Stream error: ${data.data?.error || 'Unknown error'}`)
                break
                
              case 'heartbeat':
                // Keep connection alive
                break
                
              default:
                console.log('Unknown event type:', data.type)
            }
          } catch (error) {
            console.error('Failed to parse stream event:', error, event.data)
          }
        }
      } catch (error) {
        console.error('Failed to create EventSource:', error)
        setConnectionError(`Failed to create connection: ${error}`)
      }
    }

    connectEventSource()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [activeRunId, reconnectAttempts])

  const toggleAutoScroll = useCallback(() => {
    autoScrollRef.current = !autoScrollRef.current
  }, [])

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      autoScrollRef.current = true
    }
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    setStatus('idle')
    setConnectionError(null)
    setStepProgress(null)
    setLastActivity(null)
  }, [])

  return (
    <div className="space-y-4">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-200">Real-time Execution Monitor</h3>
        <div className="flex items-center gap-2">
          {!controlledRunId && (
            <div className="flex items-center gap-2">
              <input 
                className="border border-slate-700 bg-cyber-panel/60 rounded px-3 py-2 text-gray-100 placeholder-gray-400 text-sm" 
                placeholder="Enter Run ID to view logs" 
                value={uncontrolled} 
                onChange={(e) => setUncontrolled(e.target.value)} 
              />
              {uncontrolled && (
                <button 
                  className="px-3 py-2 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonCyan hover:shadow-neonCyan transition-all"
                  onClick={clearLogs}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          
          <button
            onClick={toggleAutoScroll}
            className={`px-3 py-2 text-xs rounded border transition-all ${
              autoScrollRef.current 
                ? 'border-cyber-neonGreen bg-cyber-neonGreen/20 text-cyber-neonGreen' 
                : 'border-slate-600 bg-cyber-panel/40 text-gray-400'
            }`}
            title={autoScrollRef.current ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            {autoScrollRef.current ? '🔒' : '🔓'} Auto-scroll
          </button>
          
          <button
            onClick={scrollToBottom}
            className="px-3 py-2 text-xs rounded border border-slate-600 bg-cyber-panel/40 text-gray-400 hover:border-slate-500 hover:text-gray-300 transition-all"
            title="Scroll to bottom"
          >
            ⬇️ Bottom
          </button>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
          connected 
            ? 'bg-green-900/50 text-cyber-neonGreen border-green-800' 
            : 'bg-slate-800 text-gray-400 border-slate-700'
        }`}>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
        
        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
          status === 'running' ? 'bg-yellow-900/50 text-cyber-neonYellow border-yellow-800' :
          status === 'success' ? 'bg-green-900/50 text-cyber-neonGreen border-green-800' :
          status === 'error' ? 'bg-red-900/50 text-cyber-neonPink border-red-800' :
          'bg-slate-800 text-gray-400 border-slate-700'
        }`}>
          {status === 'running' ? '⚡ Running' : 
           status === 'success' ? '✅ Success' : 
           status === 'error' ? '❌ Error' : 
           '⏸️ Idle'}
        </span>

        {activeRunId && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-gray-400 border border-slate-700 font-mono">
            🆔 {activeRunId.slice(0, 8)}...
          </span>
        )}

        {lastActivity && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-cyber-panel/40 text-gray-400 border border-slate-700">
            🕒 {lastActivity.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Step Progress Bar */}
      {stepProgress && (
        <div className="bg-cyber-panel/40 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-cyber-neonYellow">
              Step Progress: {stepProgress.current} of {stepProgress.total}
            </span>
            <span className="text-xs text-gray-400">
              {Math.round((stepProgress.current / stepProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-cyber-neonYellow to-cyber-neonGreen h-2 rounded-full transition-all duration-300"
              style={{ width: `${(stepProgress.current / stepProgress.total) * 100}%` }}
            />
          </div>
          <div className="text-sm text-gray-300 mt-2">
            Current: <span className="cyber-neonCyan">{stepProgress.name}</span>
          </div>
        </div>
      )}

      {/* Connection Error */}
      {connectionError && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-cyber-neonPink text-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{connectionError}</span>
          </div>
        </div>
      )}

      {/* Logs Container */}
      <div className="bg-cyber-panel/30 border border-slate-800 rounded-lg">
        <div className="p-3 border-b border-slate-700 bg-cyber-panel/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              Execution Logs ({logs.length} entries)
            </span>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {status === 'running' && (
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-cyber-neonYellow rounded-full animate-pulse"></div>
                  Live
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div 
          ref={logContainerRef}
          className="h-96 overflow-auto p-4 space-y-4"
        >
          {!activeRunId ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 opacity-50">📊</div>
              <div className="text-gray-400 mb-2">No Run Selected</div>
              <div className="text-sm text-gray-500">
                Enter a Run ID above to view real-time execution logs
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 opacity-50">⏳</div>
              <div className="text-gray-400 mb-2">
                {connected ? 'Waiting for execution logs...' : 'Connecting to log stream...'}
              </div>
              <div className="text-sm text-gray-500">
                {connected ? 'Execution will begin shortly' : 'Establishing connection...'}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => {
                const isCSV = !!log.output && looksLikeCSV(log.output)
                const logKey = `${log.step_id}-${log.started_at ?? index}-${log.status}`
                const isLatest = index === logs.length - 1
                
                return (
                  <div 
                    key={logKey} 
                    className={`p-4 rounded-lg border transition-all ${
                      isLatest && status === 'running' 
                        ? 'border-cyber-neonCyan bg-cyber-neonCyan/10' 
                        : 'border-slate-700 bg-cyber-panel/40'
                    }`}
                  >
                    {/* Log Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-cyber-neonCyan">
                          {log.step_name} ({log.step_type})
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          log.status === 'running' ? 'bg-yellow-900/50 text-cyber-neonYellow' :
                          log.status === 'success' ? 'bg-green-900/50 text-cyber-neonGreen' :
                          'bg-red-900/50 text-cyber-neonPink'
                        }`}>
                          {log.status}
                        </span>
                        {isLatest && status === 'running' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-cyber-neonCyan/20 text-cyber-neonCyan border border-cyber-neonCyan/30">
                            🔴 Live
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {log.started_at && (
                          <span>Started: {new Date(log.started_at).toLocaleTimeString()}</span>
                        )}
                        {log.finished_at && (
                          <span>Finished: {new Date(log.finished_at).toLocaleTimeString()}</span>
                        )}
                        {log.received_at && (
                          <span>Received: {new Date(log.received_at).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Log Output */}
                    {log.output && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-2 font-medium">Output:</div>
                        {isCSV ? (
                          <div className="border border-slate-700 rounded bg-cyber-panel/20">
                            <CSVTable csv={log.output} />
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap text-gray-300 bg-cyber-panel/60 p-3 rounded border border-slate-700 text-xs font-mono leading-relaxed">
                            {log.output}
                          </pre>
                        )}
                      </div>
                    )}
                    
                    {/* Log Error */}
                    {log.error && (
                      <div className="mb-3">
                        <div className="text-xs text-red-400 mb-2 font-medium">Error:</div>
                        <pre className="whitespace-pre-wrap text-cyber-neonPink bg-red-900/20 p-3 rounded border border-red-800 text-xs font-mono">
                          {log.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 