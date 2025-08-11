import React, { useEffect, useState } from 'react'
import { listRuns } from '../api'
import type { RunResult } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (runId: string) => void
  workflowId?: string
}

export default function RunHistoryModal({ open, onClose, onSelect, workflowId }: Props) {
  const [runs, setRuns] = useState<RunResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    listRuns()
      .then((allRuns) => {
        // Filter runs by workflow ID if provided
        const filteredRuns = workflowId 
          ? allRuns.filter(run => run.workflow_id === workflowId)
          : allRuns
        setRuns(filteredRuns)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, workflowId])

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${!open ? 'hidden' : ''}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-cyber-panel border border-slate-700 rounded-lg shadow-neonCyan w-[720px] max-h-[80vh] overflow-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-medium text-cyber-neonCyan">Run History</h3>
            {workflowId && (
              <p className="text-xs text-gray-400 mt-1">
                Showing runs for workflow: {workflowId.slice(0, 8)}...
              </p>
            )}
          </div>
          <button className="text-sm text-gray-400 hover:text-white" onClick={onClose}>✕ Close</button>
        </div>
        
        {loading && <div className="text-cyber-neonCyan">Loading…</div>}
        {error && <div className="text-cyber-neonPink">{error}</div>}
        
        <div className="border border-slate-800 rounded bg-cyber-panel/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cyber-panel/60">
              <tr>
                <th className="text-left px-3 py-2 border-b border-slate-700 text-cyber-neonCyan font-medium">Run ID</th>
                {!workflowId && (
                  <th className="text-left px-3 py-2 border-b border-slate-700 text-cyber-neonCyan font-medium">Workflow</th>
                )}
                <th className="text-left px-3 py-2 border-b border-slate-700 text-cyber-neonCyan font-medium">Status</th>
                <th className="text-left px-3 py-2 border-b border-slate-700 text-cyber-neonCyan font-medium">Started</th>
                <th className="text-left px-3 py-2 border-b border-slate-700 text-cyber-neonCyan font-medium">Duration</th>
                <th className="text-left px-3 py-2 border-b border-slate-700 text-cyber-neonCyan font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const duration = r.finished_at 
                  ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)
                  : null
                
                return (
                  <tr key={r.run_id} className="odd:bg-cyber-panel/20 even:bg-cyber-panel/40 hover:bg-cyber-panel/60">
                    <td className="px-3 py-2 border-b border-slate-800 font-mono text-xs text-gray-300">{r.run_id}</td>
                    {!workflowId && (
                      <td className="px-3 py-2 border-b border-slate-800 text-gray-200 font-mono text-xs">
                        {r.workflow_id.slice(0, 8)}...
                      </td>
                    )}
                    <td className="px-3 py-2 border-b border-slate-800">
                      <span className={`capitalize px-2 py-0.5 rounded text-xs ${
                        r.status === 'running' ? 'bg-yellow-900/50 text-cyber-neonYellow border border-yellow-800' :
                        r.status === 'success' ? 'bg-green-900/50 text-cyber-neonGreen border border-green-800' :
                        'bg-red-900/50 text-cyber-neonPink border border-red-800'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 border-b border-slate-800 text-gray-300 text-xs">
                      {new Date(r.started_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-800 text-gray-300 text-xs font-mono">
                      {duration ? `${duration}s` : '-'}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-800">
                      <button 
                        className="px-2 py-1 text-xs rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonCyan hover:shadow-neonCyan" 
                        onClick={() => { onSelect(r.run_id); onClose(); }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
              {runs.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-3 text-gray-500 text-center" colSpan={workflowId ? 5 : 6}>
                    {workflowId ? 'No runs found for this workflow' : 'No runs found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {runs.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
            <span>Total: {runs.length} runs</span>
            <div className="flex gap-4">
              <span>Success: {runs.filter(r => r.status === 'success').length}</span>
              <span>Error: {runs.filter(r => r.status === 'error').length}</span>
              <span>Running: {runs.filter(r => r.status === 'running').length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 