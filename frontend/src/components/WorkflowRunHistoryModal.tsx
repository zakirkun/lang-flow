import React, { useEffect, useState } from 'react'
import { listRuns, generateReport, getReportStatus, downloadReport } from '../api'
import type { RunResult } from '../types'

interface Props {
  workflowId: string
  workflowName: string
  isOpen: boolean
  onClose: () => void
}

export default function WorkflowRunHistoryModal({ workflowId, workflowName, isOpen, onClose }: Props) {
  const [runs, setRuns] = useState<RunResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<RunResult | null>(null)
  const [generatingReport, setGeneratingReport] = useState<string | null>(null)
  const [reportStatuses, setReportStatuses] = useState<Record<string, any>>({})

  useEffect(() => {
    if (isOpen) {
      fetchRunHistory()
    }
  }, [isOpen, workflowId])

  useEffect(() => {
    if (runs.length > 0) {
      checkReportStatuses()
    }
  }, [runs])

  async function fetchRunHistory() {
    setLoading(true)
    setError(null)
    try {
      const allRuns = await listRuns()
      // Filter runs for this specific workflow
      const workflowRuns = allRuns.filter(run => run.workflow_id === workflowId)
      // Sort by started_at descending (newest first)
      workflowRuns.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      setRuns(workflowRuns)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function checkReportStatuses() {
    const statuses: Record<string, any> = {}
    for (const run of runs) {
      try {
        const status = await getReportStatus(run.run_id)
        statuses[run.run_id] = status
      } catch (err) {
        // Ignore errors for individual status checks
        statuses[run.run_id] = { has_report: false, reports: [] }
      }
    }
    setReportStatuses(statuses)
  }

  async function handleGenerateReport(runId: string) {
    setGeneratingReport(runId)
    try {
      const result = await generateReport(runId)
      
      // Update report status for this run
      const updatedStatus = await getReportStatus(runId)
      setReportStatuses(prev => ({
        ...prev,
        [runId]: updatedStatus
      }))
      
      // Show success message (you could add a toast notification here)
      alert(`Report generated successfully! File: ${result.filename}`)
      
    } catch (err: any) {
      alert(`Failed to generate report: ${err.message}`)
    } finally {
      setGeneratingReport(null)
    }
  }

  async function handleDownloadReport(filename: string) {
    try {
      await downloadReport(filename)
    } catch (err: any) {
      alert(`Failed to download report: ${err.message}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime).getTime()
    const end = endTime ? new Date(endTime).getTime() : Date.now()
    const duration = Math.floor((end - start) / 1000)
    
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'running': return '🔄'
      default: return '⏳'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-cyber-neonGreen border-green-800 bg-green-900/20'
      case 'error': return 'text-cyber-neonPink border-red-800 bg-red-900/20'
      case 'running': return 'text-cyber-neonCyan border-cyan-800 bg-cyan-900/20'
      default: return 'text-gray-400 border-slate-700 bg-slate-900/20'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-6xl mx-4 max-h-[90vh] bg-cyber-panel border border-slate-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-cyber-panel/80">
          <div>
            <h2 className="text-xl font-bold text-cyber-neonCyan">📊 Run History</h2>
            <p className="text-gray-300 mt-1">
              Workflow: <span className="text-cyber-neonGreen">{workflowName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonPink hover:border-cyber-neonPink transition-all"
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[70vh]">
          {/* Run List */}
          <div className="w-1/2 border-r border-slate-800 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-200">Recent Runs ({runs.length})</h3>
                <button
                  onClick={fetchRunHistory}
                  disabled={loading}
                  className="px-3 py-1 text-xs rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonCyan transition-all disabled:opacity-50"
                >
                  🔄 Refresh
                </button>
              </div>

              {loading && (
                <div className="text-center py-8">
                  <div className="text-cyber-neonCyan">🔄 Loading...</div>
                </div>
              )}

              {error && (
                <div className="text-center py-8">
                  <div className="text-cyber-neonPink">❌ {error}</div>
                </div>
              )}

              {!loading && !error && runs.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-400">📭 No runs found for this workflow</div>
                </div>
              )}

              <div className="space-y-2">
                {runs.map((run) => (
                  <div
                    key={run.run_id}
                    onClick={() => setSelectedRun(run)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedRun?.run_id === run.run_id
                        ? 'border-cyber-neonCyan bg-cyber-neonCyan/10'
                        : 'border-slate-700 bg-cyber-panel/30 hover:bg-cyber-panel/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getStatusIcon(run.status)}</span>
                        <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(run.status)}`}>
                          {run.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDuration(run.started_at, run.finished_at)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-300 mb-1">
                      ID: <span className="font-mono text-cyber-neonCyan">{run.run_id.substring(0, 8)}...</span>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Started: {formatDate(run.started_at)}
                    </div>
                    
                    {run.finished_at && (
                      <div className="text-xs text-gray-500">
                        Finished: {formatDate(run.finished_at)}
                      </div>
                    )}
                    
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs text-gray-400">
                        Steps completed: {run.logs.filter(log => log.status === 'success').length}/{run.logs.length}
                      </div>
                      <div className="flex items-center gap-1">
                        {reportStatuses[run.run_id]?.has_report && (
                          <span className="text-xs px-2 py-1 rounded border border-green-800 bg-green-900/20 text-green-400">
                            📄 {reportStatuses[run.run_id].reports.length} report(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Run Details */}
          <div className="w-1/2 overflow-y-auto">
            {selectedRun ? (
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="font-medium text-gray-200 mb-2">Run Details</h3>
                  <div className="bg-cyber-panel/30 rounded-lg p-4 border border-slate-700">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Run ID:</span>
                        <div className="font-mono text-cyber-neonCyan">{selectedRun.run_id}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <div className={`font-medium ${
                          selectedRun.status === 'success' ? 'text-cyber-neonGreen' :
                          selectedRun.status === 'error' ? 'text-cyber-neonPink' :
                          selectedRun.status === 'running' ? 'text-cyber-neonCyan' : 'text-gray-300'
                        }`}>
                          {getStatusIcon(selectedRun.status)} {selectedRun.status.toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400">Started:</span>
                        <div className="text-gray-300">{formatDate(selectedRun.started_at)}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Duration:</span>
                        <div className="text-gray-300">
                          {formatDuration(selectedRun.started_at, selectedRun.finished_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Actions */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-200 mb-3">📄 Report Generation</h4>
                  <div className="bg-cyber-panel/30 rounded-lg p-4 border border-slate-700">
                    {reportStatuses[selectedRun.run_id]?.has_report ? (
                      <div className="space-y-3">
                        <div className="text-sm text-green-400 mb-2">
                          ✅ {reportStatuses[selectedRun.run_id].reports.length} report(s) available
                        </div>
                        {reportStatuses[selectedRun.run_id].reports.map((report: any, index: number) => (
                          <div key={index} className="flex items-center justify-between bg-green-900/10 border border-green-800/30 rounded p-3">
                            <div className="text-sm">
                              <div className="text-gray-200 font-medium">{report.filename}</div>
                              <div className="text-xs text-gray-400">
                                Generated: {new Date(report.created).toLocaleString('id-ID')}
                              </div>
                              <div className="text-xs text-gray-400">
                                Size: {(report.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownloadReport(report.filename)}
                              className="px-3 py-1 text-sm rounded border border-green-700 bg-green-900/30 text-green-400 hover:shadow-green-400/50 transition-all"
                            >
                              📥 Download
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleGenerateReport(selectedRun.run_id)}
                          disabled={generatingReport === selectedRun.run_id}
                          className="w-full px-4 py-2 text-sm rounded border border-cyber-neonCyan bg-cyber-neonCyan/20 text-cyber-neonCyan hover:shadow-neonCyan transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generatingReport === selectedRun.run_id ? '🔄 Generating...' : '📄 Generate New Report'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-gray-400 mb-3">No reports generated yet</div>
                        <button
                          onClick={() => handleGenerateReport(selectedRun.run_id)}
                          disabled={generatingReport === selectedRun.run_id}
                          className="px-4 py-2 text-sm rounded border border-cyber-neonGreen bg-cyber-neonGreen/20 text-cyber-neonGreen hover:shadow-neonGreen transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                        >
                          {generatingReport === selectedRun.run_id ? (
                            <>🔄 Generating Report...</>
                          ) : (
                            <>📄 Generate PDF Report</>
                          )}
                        </button>
                        <div className="text-xs text-gray-500 mt-2">
                          AI-powered formal report with ChatGPT analysis
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step Logs */}
                <div>
                  <h4 className="font-medium text-gray-200 mb-3">Step Execution Log</h4>
                  <div className="space-y-3">
                    {selectedRun.logs.map((log, index) => (
                      <div
                        key={log.step_id}
                        className="border border-slate-700 rounded-lg bg-cyber-panel/20 p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-200">
                              {index + 1}. {log.step_name}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(log.status)}`}>
                              {log.status.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {log.step_type === 'ai' ? '🤖' : log.step_type === 'command' ? '⚡' : '📧'}
                          </span>
                        </div>
                        
                        {log.started_at && (
                          <div className="text-xs text-gray-500 mb-1">
                            Started: {formatDate(log.started_at)}
                          </div>
                        )}
                        
                        {log.output && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-400 mb-1">Output:</div>
                            <div className="bg-slate-900/50 rounded p-2 text-xs font-mono text-gray-300 max-h-32 overflow-y-auto">
                              {log.output}
                            </div>
                          </div>
                        )}
                        
                        {log.error && (
                          <div className="mt-2">
                            <div className="text-xs text-red-400 mb-1">Error:</div>
                            <div className="bg-red-900/20 border border-red-800 rounded p-2 text-xs font-mono text-red-300">
                              {log.error}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <div>Select a run to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}