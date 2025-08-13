import React, { useEffect, useState } from 'react'
import type { Workflow } from '../types'
import { listWorkflows, deleteWorkflow } from '../api'

interface Props {
  onCreate: () => void
  onEdit: (wf: Workflow) => void
  onRun: (workflowId: string) => void
  onView: (wf: Workflow) => void
}

export default function WorkflowList({ onCreate, onEdit, onRun, onView }: Props) {
  const [items, setItems] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await listWorkflows()
      setItems(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the workflow "${name}"? This action cannot be undone.`)) {
      return
    }
    
    try {
      await deleteWorkflow(id)
      refresh()
    } catch (error) {
      console.error('Failed to delete workflow:', error)
      setError('Failed to delete workflow')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-200">Workflows</h3>
        {/* <button className="px-3 py-1.5 rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonGreen hover:shadow-neonGreen text-sm" onClick={onCreate}>+ New Workflow</button> */}
      </div>
      {loading && <p className="text-gray-400">Loading…</p>}
      {error && <p className="text-cyber-neonPink">{error}</p>}
      <ul className="divide-y divide-slate-800 border border-slate-800 rounded bg-cyber-panel/30">
        {items.map((wf) => (
          <li key={wf.id} className="p-4 hover:bg-cyber-panel/60 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-medium text-gray-200 truncate">{wf.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-slate-800 rounded text-xs text-gray-400">
                      {wf.steps.length} steps
                    </span>
                  </div>
                </div>
                {wf.description && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">{wf.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Created: {new Date(wf.created_at).toLocaleDateString()}</span>
                  {wf.updated_at && wf.updated_at !== wf.created_at && (
                    <span>Updated: {new Date(wf.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button 
                  className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonCyan hover:shadow-neonCyan transition-all" 
                  onClick={() => onView(wf)}
                  title="View workflow details"
                >
                  📖 View
                </button>
                <button 
                  className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-200 hover:text-white hover:shadow-neonCyan transition-all" 
                  onClick={() => onEdit(wf)}
                  title="Edit workflow"
                >
                  ✏️ Edit
                </button>
                <button 
                  className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonGreen hover:shadow-neonGreen transition-all" 
                  onClick={() => onRun(wf.id)}
                  title="Run workflow"
                >
                  ▶️ Run
                </button>
                <button 
                  className="px-3 py-1 text-sm rounded border border-red-800 bg-cyber-panel/60 text-cyber-neonPink hover:shadow-neonPink transition-all" 
                  onClick={() => handleDelete(wf.id, wf.name)}
                  title="Delete workflow"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 && !loading && (
          <li className="p-8 text-center">
            <div className="text-4xl mb-4 opacity-50">⚡</div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Workflows Yet</h3>
            <p className="text-gray-400 mb-4">Create your first automation workflow to get started</p>
            <button
              onClick={onCreate}
              className="px-4 py-2 bg-cyber-neonGreen text-cyber-bg rounded-lg font-medium hover:shadow-neonGreen transition-all"
            >
              ✨ Create First Workflow
            </button>
          </li>
        )}
      </ul>
    </div>
  )
} 