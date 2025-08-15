import React, { useState, useEffect } from 'react'
import { PlaygroundInstance } from '../types'
import { getPlaygroundInstances } from '../api'

interface Props {
  selectedInstanceId?: string
  onInstanceSelect: (instanceId: string | undefined) => void
  disabled?: boolean
}

export default function PlaygroundSelector({ selectedInstanceId, onInstanceSelect, disabled = false }: Props) {
  const [instances, setInstances] = useState<PlaygroundInstance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInstances()
  }, [])

  const loadInstances = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPlaygroundInstances()
      // Only show running instances
      const runningInstances = data.filter(instance => instance.status === 'running')
      setInstances(runningInstances)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playground instances')
    } finally {
      setLoading(false)
    }
  }

  const handleInstanceSelect = (instanceId: string | undefined) => {
    onInstanceSelect(instanceId)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="animate-spin text-xs">⚡</div>
        <span>Loading playgrounds...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-400">
        <span>❌ {error}</span>
        <button 
          onClick={loadInstances}
          className="ml-2 text-cyber-neonCyan hover:text-cyber-neonCyan/80 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-300">Execution Environment:</span>
        <button
          onClick={() => handleInstanceSelect(undefined)}
          disabled={disabled}
          className={`
            px-3 py-1 text-xs rounded border transition-all
            ${selectedInstanceId === undefined
              ? 'border-cyber-neonGreen bg-cyber-neonGreen/20 text-cyber-neonGreen'
              : 'border-slate-600 bg-cyber-panel/40 text-gray-400 hover:border-slate-500 hover:text-gray-300'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          🖥️ Host System
        </button>
      </div>

      {instances.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 font-medium">🐳 Available Playgrounds:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {instances.map((instance) => (
              <button
                key={instance.id}
                onClick={() => handleInstanceSelect(instance.id)}
                disabled={disabled}
                className={`
                  p-3 rounded-lg border transition-all text-left
                  ${selectedInstanceId === instance.id
                    ? 'border-cyber-neonCyan bg-cyber-neonCyan/20 text-cyber-neonCyan'
                    : 'border-slate-700 bg-cyber-panel/40 text-gray-300 hover:border-slate-600 hover:bg-cyber-panel/60'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{instance.name}</span>
                  <span className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400">
                    Running
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  ID: {instance.id.slice(0, 8)}...
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Created: {new Date(instance.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {instances.length === 0 && (
        <div className="text-xs text-gray-500 bg-cyber-panel/20 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span>🐳</span>
            <span className="font-medium">No Running Playgrounds</span>
          </div>
          <p>Create a playground instance from the Playground tab to run workflows in isolated environments.</p>
        </div>
      )}

      {selectedInstanceId && (
        <div className="text-xs text-cyber-neonCyan bg-cyber-neonCyan/10 border border-cyber-neonCyan/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span>✅</span>
            <span className="font-medium">Selected Execution Environment</span>
          </div>
          <div className="text-cyber-neonCyan">
            🐳 Playground: {selectedInstanceId.slice(0, 8)}...
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Commands will execute in this isolated Docker environment
          </div>
        </div>
      )}

      {selectedInstanceId === undefined && (
        <div className="text-xs text-cyber-neonGreen bg-cyber-neonGreen/10 border border-cyber-neonGreen/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span>✅</span>
            <span className="font-medium">Selected Execution Environment</span>
          </div>
          <div className="text-cyber-neonGreen">
            🖥️ Host System
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Commands will execute on the host system
          </div>
        </div>
      )}
    </div>
  )
} 