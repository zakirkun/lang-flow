import React, { useState } from 'react'
import WorkflowForm from './components/WorkflowForm'
import WorkflowList from './components/WorkflowList'
import WorkflowDetail from './components/WorkflowDetail'
import RunView from './components/RunView'
import Terminal from './components/Terminal'
import Dashboard from './components/Dashboard'
import ScanPage from './pages/ScanPage'
import { saveWorkflow } from './api'
import type { Workflow } from './types'

type Tab = 'workflows' | 'terminal' | 'dashboard' | 'scan'

export default function App() {
  const [tab, setTab] = useState<Tab>('workflows')
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [viewing, setViewing] = useState<Workflow | null>(null)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>(undefined)

  async function handleSave(wf: Workflow) {
    await saveWorkflow(wf)
    setEditing(null)
  }

  function handleRunNavigate(workflowId: string) {
    setSelectedWorkflowId(workflowId)
    setTab('scan')
  }

  function handleViewWorkflow(workflow: Workflow) {
    setViewing(workflow)
  }

  function handleBackToList() {
    setEditing(null)
    setViewing(null)
  }

  return (
    <div className="max-w-6xl mx-auto p-4 min-h-full">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-2xl font-semibold text-cyber-neonCyan drop-shadow" style={{ textShadow: '0 0 8px rgba(34,211,238,0.5)' }}>Lang Flow - Pentesting Workflows</h2>
        <nav className="flex gap-3 text-sm">
          {(['workflows','terminal','dashboard'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`px-3 py-1 rounded border bg-cyber-panel/60 backdrop-blur text-gray-200 hover:text-white hover:shadow-neonCyan ${tab===t? 'border-cyber-neonCyan text-white shadow-neonCyan' : 'border-slate-700'}`}
              onClick={() => setTab(t)}
            >{t[0].toUpperCase()+t.slice(1)}</button>
          ))}
        </nav>
      </div>

      <div className="rounded-lg border border-slate-800 bg-cyber-panel/50 p-4 shadow-neonCyan">
        {tab === 'workflows' && (
          <div>
            {viewing ? (
              <WorkflowDetail workflow={viewing} onBack={handleBackToList} />
            ) : !editing ? (
              <div>
                <WorkflowList 
                  onCreate={() => setEditing({ id: crypto.randomUUID(), name: '', description: '', steps: [] })} 
                  onEdit={setEditing} 
                  onRun={handleRunNavigate}
                  onView={handleViewWorkflow}
                />
                <hr className="my-6 border-slate-700" />
                <div className="text-sm text-gray-400">
                  <h3 className="font-medium text-gray-200">How to run</h3>
                  <p>Save a workflow, click Run. The backend returns the run_id; use Run Viewer (WebSocket) for live logs.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button className="text-sm text-cyber-neonCyan hover:underline" onClick={handleBackToList}>{'< Back'}</button>
                <WorkflowForm initial={editing} onSave={handleSave} />
              </div>
            )}
          </div>
        )}

        {tab === 'scan' && (
          <ScanPage workflowId={selectedWorkflowId} />
        )}

        {tab === 'terminal' && (
          <Terminal />
        )}

        {tab === 'dashboard' && (
          <Dashboard />
        )}
      </div>
    </div>
  )
} 