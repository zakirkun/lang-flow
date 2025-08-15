import React, { useEffect, useState } from 'react'
import type { Workflow, StepLog } from '../types'
import WorkflowViewer from '../components/WorkflowViewer'
import RunView from '../components/RunView'
import Dashboard from '../components/Dashboard'
import RunHistoryModal from '../components/RunHistoryModal'
import PlaygroundSelector from '../components/PlaygroundSelector'
import { startRun, getWorkflow } from '../api'

export default function ScanPage({ workflowId }: { workflowId?: string }) {
  const [workflow, setWorkflow] = useState<Workflow>({ 
    id: crypto.randomUUID(), 
    name: 'New Pentest', 
    description: '', 
    steps: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  
  const [runId, setRunId] = useState<string | undefined>(undefined)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepId, setCurrentStepId] = useState<string | undefined>(undefined)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [logs, setLogs] = useState<StepLog[]>([])
  const [workflowLoaded, setWorkflowLoaded] = useState(false)
  const [selectedPlaygroundId, setSelectedPlaygroundId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!workflowId) return
    setLoading(true)
    setError(null)
    setWorkflowLoaded(false)
    getWorkflow(workflowId)
      .then((wf) => {
        setWorkflow(wf)
        setWorkflowLoaded(true)
        setError(null)
      })
      .catch((e) => {
        setError(`Failed to load workflow: ${e.message}`)
        setWorkflowLoaded(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [workflowId])

  // Listen for log updates to track progress
  useEffect(() => {
    // This will be called when RunView receives new logs
    // We need to track the current step and completed steps
    const completed: string[] = []
    let current: string | undefined = undefined

    for (const log of logs) {
      if (log.status === 'success') {
        if (!completed.includes(log.step_id)) {
          completed.push(log.step_id)
        }
      } else if (log.status === 'running') {
        current = log.step_id
      }
    }

    setCompletedSteps(completed)
    setCurrentStepId(current)
  }, [logs])

  async function handleStart() {
    const wf = workflow
    
    // Fix: Check if workflowId exists and workflow was properly loaded
    if (!workflowId) {
      alert('No workflow selected. Please select a workflow from the Workflows tab.')
      return
    }
    
    if (!workflowLoaded || !wf.id || wf.steps.length === 0) {
      alert('No workflow steps to execute or workflow not properly loaded')
      return
    }
    
    try {
      setIsRunning(true)
      setCurrentStepId(undefined)
      setCompletedSteps([])
      setLogs([])
      
      const res = await startRun(wf.id, selectedPlaygroundId)
      setRunId(res.run_id)
    } catch (e: any) {
      alert(`Failed to start scan: ${e.message}`)
      setIsRunning(false)
    }
  }

  async function handleStop() {
    setIsRunning(false)
    setCurrentStepId(undefined)
    // Note: In a real implementation, you'd want to send a stop signal to the backend
  }

  // Auto-start when workflowId provided and steps exist (but not if loading)
  useEffect(() => {
    if (workflowId && workflow.steps.length > 0 && !loading && !error && !isRunning && workflowLoaded) {
      handleStart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, workflow.id, workflow.steps.length, loading, error, workflowLoaded])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 border border-slate-800 rounded-lg bg-cyber-panel/20">
          <span className="text-2xl animate-spin">⚡</span>
          <div>
            <h2 className="text-xl font-semibold text-cyber-neonCyan">Loading Workflow</h2>
            <p className="text-sm text-gray-400">Please wait...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 border border-red-800 rounded-lg bg-red-900/20">
          <span className="text-2xl">❌</span>
          <div>
            <h2 className="text-xl font-semibold text-red-400">Error Loading Workflow</h2>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-800 rounded-lg bg-cyber-panel/20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <h2 className="text-xl font-semibold text-cyber-neonCyan">Workflow Execution</h2>
            <p className="text-sm text-gray-400">
              {workflowLoaded ? `Executing: ${workflow.name}` : 'Select a workflow to execute'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistoryOpen(true)}
            className="px-4 py-2 border border-slate-700 bg-cyber-panel/40 text-gray-300 rounded-lg hover:border-slate-600 hover:text-gray-100 transition-all"
          >
            📊 Run History
          </button>
        </div>
      </div>

      {workflowLoaded && (
        <>
          {/* Workflow Information */}
          <div className="bg-cyber-panel border border-slate-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚡</span>
              <div>
                <h3 className="text-lg font-semibold text-cyber-neonCyan">{workflow.name}</h3>
                <p className="text-sm text-gray-400">{workflow.description || 'No description'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-cyber-panel/40 border border-slate-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Steps</div>
                <div className="text-lg font-semibold text-cyber-neonGreen">{workflow.steps.length}</div>
              </div>
              <div className="bg-cyber-panel/40 border border-slate-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Created</div>
                <div className="text-sm font-medium text-gray-300">
                  {new Date(workflow.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="bg-cyber-panel/40 border border-slate-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Last Updated</div>
                <div className="text-sm font-medium text-gray-300">
                  {new Date(workflow.updated_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Playground Selection */}
            <div className="border-t border-slate-700 pt-4">
              <PlaygroundSelector
                selectedInstanceId={selectedPlaygroundId}
                onInstanceSelect={setSelectedPlaygroundId}
                disabled={isRunning}
              />
            </div>
          </div>

          {/* Execution Controls */}
          <div className="bg-cyber-panel border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-cyber-neonYellow">Execution Control</h3>
              <div className="flex items-center gap-2">
                {isRunning && (
                  <span className="text-sm text-cyber-neonYellow bg-cyber-neonYellow/10 px-3 py-1 rounded-full">
                    ⚡ Running...
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={!workflowLoaded || workflow.steps.length === 0}
                  className="px-6 py-3 bg-cyber-neonGreen text-cyber-bg rounded-lg font-medium hover:shadow-neonGreen transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  🚀 Start Execution
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all flex items-center gap-2"
                >
                  ⏹️ Stop Execution
                </button>
              )}
              
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Environment:</span>
                {selectedPlaygroundId ? (
                  <span className="text-cyber-neonCyan bg-cyber-neonCyan/10 px-2 py-1 rounded border border-cyber-neonCyan/30">
                    🐳 Playground {selectedPlaygroundId.slice(0, 8)}...
                  </span>
                ) : (
                  <span className="text-cyber-neonGreen bg-cyber-neonGreen/10 px-2 py-1 rounded border border-cyber-neonGreen/30">
                    🖥️ Host System
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="bg-cyber-panel border border-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-cyber-neonCyan mb-4">Workflow Steps</h3>
            <WorkflowViewer workflow={workflow} />
          </div>

          {/* Execution Results */}
          {runId && (
            <div className="bg-cyber-panel border border-slate-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-cyber-neonPink">Real-time Execution Monitor</h3>
                <div className="flex items-center gap-2 text-sm">
                  {isRunning && (
                    <span className="flex items-center gap-2 text-cyber-neonYellow">
                      <div className="w-2 h-2 bg-cyber-neonYellow rounded-full animate-pulse"></div>
                      Live Execution
                    </span>
                  )}
                  {selectedPlaygroundId && (
                    <span className="text-cyber-neonCyan bg-cyber-neonCyan/10 px-2 py-1 rounded border border-cyber-neonCyan/30">
                      🐳 Playground {selectedPlaygroundId.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
              <RunView 
                runId={runId} 
                onLogsUpdate={setLogs}
                onStatusUpdate={(status) => {
                  if (status === 'success' || status === 'error') {
                    setIsRunning(false)
                  } else if (status === 'running') {
                    setIsRunning(true)
                  }
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Run History Modal */}
      {historyOpen && (
        <RunHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onSelect={(runId) => setRunId(runId)}
          workflowId={workflowId || ''}
        />
      )}
    </div>
  )
} 