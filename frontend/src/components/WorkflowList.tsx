import React, { useEffect, useState } from 'react'
import type { Workflow } from '../types'
import { listWorkflows, deleteWorkflow } from '../api'

interface Props {
  onCreate: () => void
  onEdit: (wf: Workflow) => void
  onRun: (workflowId: string) => void
}

export default function WorkflowList({ onCreate, onEdit, onRun }: Props) {
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

  async function handleDelete(id: string) {
    await deleteWorkflow(id)
    refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-200">Workflows</h3>
        <button className="px-3 py-1.5 rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonGreen hover:shadow-neonGreen text-sm" onClick={onCreate}>+ New Workflow</button>
      </div>
      {loading && <p className="text-gray-400">Loading…</p>}
      {error && <p className="text-cyber-neonPink">{error}</p>}
      <ul className="divide-y divide-slate-800 border border-slate-800 rounded bg-cyber-panel/30">
        {items.map((wf) => (
          <li key={wf.id} className="flex items-center gap-2 p-3 hover:bg-cyber-panel/60">
            <span className="min-w-[200px] flex-1 text-gray-200">{wf.name}</span>
            <div className="flex gap-2">
              <button className="px-2 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-200 hover:text-white hover:shadow-neonCyan" onClick={() => onEdit(wf)}>Edit</button>
              <button className="px-2 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonGreen hover:shadow-neonGreen" onClick={() => onRun(wf.id)}>Run</button>
              <button className="px-2 py-1 text-sm rounded border border-red-800 bg-cyber-panel/60 text-cyber-neonPink hover:shadow-neonPink" onClick={() => handleDelete(wf.id)}>Delete</button>
            </div>
          </li>
        ))}
        {items.length === 0 && !loading && (
          <li className="p-3 text-sm text-gray-500">No workflows yet</li>
        )}
      </ul>
    </div>
  )
} 