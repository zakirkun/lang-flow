import React, { useEffect, useMemo, useState } from 'react'
import { listRuns } from '../api'
import type { RunResult } from '../types'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from 'recharts'

interface Props {
  workflowId?: string
}

export default function Dashboard({ workflowId }: Props) {
  const [runs, setRuns] = useState<RunResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
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
  }, [workflowId])

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = { running: 0, success: 0, error: 0 }
    const totalDuration = { success: 0, error: 0, count: 0 }
    const recentRuns: Array<{ date: string; success: number; error: number }> = []
    
    // Group runs by date for trend chart
    const runsByDate: Record<string, { success: number; error: number }> = {}
    
    for (const r of runs) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1
      
      // Calculate duration for completed runs
      if (r.finished_at && (r.status === 'success' || r.status === 'error')) {
        const duration = (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000
        totalDuration[r.status] += duration
        totalDuration.count++
      }
      
      // Group by date
      const date = new Date(r.started_at).toLocaleDateString()
      if (!runsByDate[date]) {
        runsByDate[date] = { success: 0, error: 0 }
      }
      if (r.status === 'success') runsByDate[date].success++
      if (r.status === 'error') runsByDate[date].error++
    }

    // Convert to array and sort by date (last 7 days)
    const sortedDates = Object.keys(runsByDate).sort().slice(-7)
    for (const date of sortedDates) {
      recentRuns.push({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...runsByDate[date]
      })
    }

    const avgDuration = totalDuration.count > 0 
      ? Math.round((totalDuration.success + totalDuration.error) / totalDuration.count)
      : 0

    return {
      counts: [
        { status: 'running', count: byStatus.running, color: '#f5f749' },
        { status: 'success', count: byStatus.success, color: '#39ff14' },
        { status: 'error', count: byStatus.error, color: '#ff3caa' },
      ],
      avgDuration,
      successRate: runs.length > 0 ? Math.round((byStatus.success / runs.length) * 100) : 0,
      recentRuns: recentRuns.length > 0 ? recentRuns : [{ date: 'Today', success: 0, error: 0 }]
    }
  }, [runs])

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-cyber-neonCyan">Scan Statistics</h3>
        {workflowId && (
          <span className="text-xs text-gray-400 bg-cyber-panel/60 px-2 py-1 rounded border border-slate-700">
            Workflow: {workflowId.slice(0, 8)}...
          </span>
        )}
      </div>
      
      {loading && <div className="text-gray-400">Loading statistics…</div>}
      {error && <div className="text-cyber-neonPink">{error}</div>}
      
      {!loading && !error && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-slate-800 rounded p-3 bg-cyber-panel/40 hover:shadow-neonCyan/20">
              <div className="text-sm text-gray-400">Total Runs</div>
              <div className="text-2xl font-semibold text-cyber-neonCyan">{runs.length}</div>
            </div>
            <div className="border border-slate-800 rounded p-3 bg-cyber-panel/40 hover:shadow-neonGreen/20">
              <div className="text-sm text-gray-400">Success Rate</div>
              <div className="text-2xl font-semibold text-cyber-neonGreen">{stats.successRate}%</div>
            </div>
            <div className="border border-slate-800 rounded p-3 bg-cyber-panel/40 hover:shadow-neonYellow/20">
              <div className="text-sm text-gray-400">Running</div>
              <div className="text-2xl font-semibold text-cyber-neonYellow">{stats.counts.find(d => d.status==='running')?.count ?? 0}</div>
            </div>
            <div className="border border-slate-800 rounded p-3 bg-cyber-panel/40 hover:shadow-neonPink/20">
              <div className="text-sm text-gray-400">Avg Duration</div>
              <div className="text-2xl font-semibold text-gray-200">{stats.avgDuration}s</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <div className="border border-slate-800 rounded-lg bg-cyber-panel/30 p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Status Distribution</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.counts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="status" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f1325', 
                        border: '1px solid #475569', 
                        borderRadius: '4px',
                        color: '#e2e8f0'
                      }} 
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#22d3ee"
                      stroke="#22d3ee"
                      strokeWidth={1}
                    />
                    <defs>
                      <linearGradient id="cyberpunkGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#0891b2" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Trend */}
            <div className="border border-slate-800 rounded-lg bg-cyber-panel/30 p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Recent Activity (7 days)</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.recentRuns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f1325', 
                        border: '1px solid #475569', 
                        borderRadius: '4px',
                        color: '#e2e8f0'
                      }} 
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8' }} />
                    <Line 
                      type="monotone" 
                      dataKey="success" 
                      stroke="#39ff14" 
                      strokeWidth={2}
                      dot={{ fill: '#39ff14', strokeWidth: 2, r: 4 }}
                      name="Success"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="error" 
                      stroke="#ff3caa" 
                      strokeWidth={2}
                      dot={{ fill: '#ff3caa', strokeWidth: 2, r: 4 }}
                      name="Error"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* No Data Message */}
          {runs.length === 0 && (
            <div className="text-center py-8 border border-slate-800 rounded-lg bg-cyber-panel/20">
              <div className="text-gray-500">
                {workflowId ? 'No runs found for this workflow yet.' : 'No scan data available yet.'}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Start a scan to see statistics here.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
} 