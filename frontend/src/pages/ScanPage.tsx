import React, { useEffect, useState } from 'react'
import type { Workflow, StepLog } from '../types'
import WorkflowViewer from '../components/WorkflowViewer'
import RunView from '../components/RunView'
import Dashboard from '../components/Dashboard'
import RunHistoryModal from '../components/RunHistoryModal'
import { startRun, getWorkflow } from '../api'

export default function ScanPage({ workflowId }: { workflowId?: string }) {
  const [workflow, setWorkflow] = useState<Workflow>({ id: crypto.randomUUID(), name: 'New Pentest', description: '', steps: [] })
  const [runId, setRunId] = useState<string | undefined>(undefined)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepId, setCurrentStepId] = useState<string | undefined>(undefined)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [logs, setLogs] = useState<StepLog[]>([])

  useEffect(() => {
    if (!workflowId) return
    setLoading(true)
    setError(null)
    getWorkflow(workflowId)
      .then((wf) => {
        setWorkflow(wf)
        setError(null)
      })
      .catch((e) => {
        setError(`Failed to load workflow: ${e.message}`)
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
    if (!wf.id || wf.steps.length === 0) {
      alert('No workflow steps to execute')
      return
    }
    
    try {
      setIsRunning(true)
      setCurrentStepId(undefined)
      setCompletedSteps([])
      setLogs([])
      
      const res = await startRun(wf.id)
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
    if (workflowId && workflow.steps.length > 0 && !loading && !error && !isRunning) {
      handleStart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, workflow.id, workflow.steps.length, loading, error])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyber-neonCyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-cyber-neonCyan">Loading workflow...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <div className="border border-red-800 bg-red-900/20 rounded-lg p-6 text-center">
          <div className="text-cyber-neonPink text-lg font-medium mb-2">Failed to Load Workflow</div>
          <div className="text-gray-300">{error}</div>
          <button 
            className="mt-4 px-4 py-2 rounded border border-slate-700 bg-cyber-panel/60 text-gray-200 hover:text-white hover:shadow-neonCyan"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyber-neonCyan animate-pulse"></div>
          <h2 className="text-2xl font-bold text-cyber-neonCyan">Security Scan Monitor</h2>
        </div>
        <div className="flex gap-2">
          {/* <button 
            className="px-4 py-2 rounded border border-slate-700 bg-cyber-panel/60 text-gray-200 hover:text-white hover:shadow-neonCyan transition-all"
            onClick={() => setHistoryOpen(true)}
          >
            📊 History
          </button> */}
          {!isRunning ? (
            <button 
              className="px-4 py-2 rounded border border-green-800 bg-green-900/30 text-cyber-neonGreen hover:shadow-neonGreen transition-all disabled:opacity-50"
              onClick={handleStart}
              disabled={workflow.steps.length === 0}
            >
              ▶️ Start Scan
            </button>
          ) : (
            <button 
              className="px-4 py-2 rounded border border-red-800 bg-red-900/30 text-cyber-neonPink hover:shadow-neonPink transition-all"
              onClick={handleStop}
            >
              ⏹️ Stop Scan
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Workflow Viewer */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyber-neonGreen animate-pulse"></span>
              Workflow Process
            </h3>
            <WorkflowViewer 
              workflow={workflow} 
              currentStepId={currentStepId}
              completedSteps={completedSteps}
            />
          </div>
        </div>

        {/* Right Column - Logs and Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Log Viewer */}
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyber-neonYellow animate-ping"></span>
              Real-time Execution Logs
            </h3>
            <div className="border border-slate-800 rounded-lg bg-cyber-panel/30 p-4">
              <RunView 
                runId={runId} 
                onLogsUpdate={(newLogs) => setLogs(newLogs)}
              />
            </div>
          </div>

          {/* Dashboard */}
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyber-neonPink animate-pulse"></span>
              Scan Statistics
            </h3>
            <div className="border border-slate-800 rounded-lg bg-cyber-panel/30 p-4">
              <Dashboard workflowId={workflow.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Run History Modal */}
      <RunHistoryModal 
        open={historyOpen} 
        onClose={() => setHistoryOpen(false)} 
        onSelect={(rid) => {
          setRunId(rid)
          setIsRunning(false)
        }}
        workflowId={workflow.id}
      />
    </div>
  )
} 