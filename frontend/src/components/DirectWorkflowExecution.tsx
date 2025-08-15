import React, { useState, useEffect } from 'react'
import { Workflow, PlaygroundInstance } from '../types'
import { startRun, getPlaygroundInstances } from '../api'
import PlaygroundSelector from './PlaygroundSelector'

interface Props {
  workflow: Workflow
  onExecutionStarted: (runId: string) => void
  onClose: () => void
}

export default function DirectWorkflowExecution({ workflow, onExecutionStarted, onClose }: Props) {
  const [selectedPlaygroundId, setSelectedPlaygroundId] = useState<string | undefined>(undefined)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playgrounds, setPlaygrounds] = useState<PlaygroundInstance[]>([])

  useEffect(() => {
    // Load available playgrounds
    const loadPlaygrounds = async () => {
      try {
        const instances = await getPlaygroundInstances()
        setPlaygrounds(instances.filter(instance => instance.status === 'running'))
      } catch (err) {
        console.error('Failed to load playgrounds:', err)
      }
    }
    loadPlaygrounds()
  }, [])

  const handleStartExecution = async () => {
    if (!workflow) return

    setIsStarting(true)
    setError(null)

    try {
      const result = await startRun(workflow.id, selectedPlaygroundId)
      onExecutionStarted(result.run_id)
    } catch (err: any) {
      setError(err.message || 'Failed to start workflow execution')
    } finally {
      setIsStarting(false)
    }
  }

  const getExecutionEnvironment = () => {
    if (!selectedPlaygroundId) return 'Host System'
    const playground = playgrounds.find(p => p.id === selectedPlaygroundId)
    return playground ? `Playground: ${playground.name}` : 'Selected Playground'
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-cyber-bg border border-slate-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-cyber-neonGreen">
            🚀 Execute Workflow
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Workflow Info */}
          <div className="bg-cyber-panel/30 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚡</span>
              <div>
                <h4 className="font-medium text-gray-200">{workflow.name}</h4>
                <p className="text-sm text-gray-400">
                  {workflow.steps.length} steps • {workflow.description || 'No description'}
                </p>
              </div>
            </div>
          </div>

          {/* Execution Environment Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              🎯 Execution Environment
            </label>
            <PlaygroundSelector
              selectedInstanceId={selectedPlaygroundId}
              onInstanceSelect={setSelectedPlaygroundId}
              disabled={isStarting}
            />
            <div className="text-xs text-gray-500">
              Selected: <span className="text-cyber-neonCyan">{getExecutionEnvironment()}</span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-cyber-neonPink text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-700 bg-cyber-panel/40 text-gray-300 rounded-lg hover:border-slate-600 hover:text-gray-100 transition-all"
              disabled={isStarting}
            >
              Cancel
            </button>
            <button
              onClick={handleStartExecution}
              disabled={isStarting}
              className="flex-1 px-4 py-2 bg-cyber-neonGreen text-cyber-bg rounded-lg font-medium hover:shadow-neonGreen transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin"></div>
                  Starting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  ▶️ Start Execution
                </span>
              )}
            </button>
          </div>

          {/* Execution Info */}
          <div className="text-xs text-gray-500 text-center pt-2">
            <div className="flex items-center justify-center gap-2">
              <span>⚡</span>
              <span>Execution will start immediately on the selected environment</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 