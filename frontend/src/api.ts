import type { Workflow, RunResult } from './types'

const BASE = '' // use Vite proxy

export async function listWorkflows(): Promise<Workflow[]> {
  const res = await fetch(`${BASE}/api/workflows/`)
  if (!res.ok) throw new Error('Failed to list workflows')
  return res.json()
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const res = await fetch(`${BASE}/api/workflows/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export async function saveWorkflow(workflow: Workflow): Promise<Workflow> {
  const method = await exists(workflow.id) ? 'PUT' : 'POST'
  const url = method === 'PUT' ? `${BASE}/api/workflows/${workflow.id}` : `${BASE}/api/workflows/`
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  })
  if (!res.ok) throw new Error('Save failed')
  return res.json()
}

async function exists(id: string): Promise<boolean> {
  try {
    await getWorkflow(id)
    return true
  } catch {
    return false
  }
}

export async function deleteWorkflow(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/workflows/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

export async function startRun(
  workflowId: string,
  context: Record<string, any> = {}
): Promise<{ status: string; run_id: string }>
{
  const res = await fetch(`${BASE}/api/runs/start/${workflowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
  })
  if (!res.ok) throw new Error('Failed to start')
  return res.json()
}

export async function getRun(runId: string): Promise<RunResult> {
  const res = await fetch(`${BASE}/api/runs/${runId}`)
  if (!res.ok) throw new Error('Run not found')
  return res.json()
}

export async function listRuns(): Promise<RunResult[]> {
  const res = await fetch(`${BASE}/api/runs/`)
  if (!res.ok) throw new Error('Failed to list runs')
  return res.json()
}

export function runsWsUrl(runId: string): string {
  const base = window.location.origin.replace('http', 'ws')
  return `${base}/api/runs/ws/${runId}`
}

// Report generation APIs
export async function generateReport(runId: string): Promise<{ status: string; message: string; report_id: string; filename: string; download_url: string }> {
  const res = await fetch(`${BASE}/api/reports/generate/${runId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) throw new Error('Failed to generate report')
  return res.json()
}

export async function getReportStatus(runId: string): Promise<{ has_report: boolean; reports: any[] }> {
  const res = await fetch(`${BASE}/api/reports/status/${runId}`)
  if (!res.ok) throw new Error('Failed to get report status')
  return res.json()
}

export async function listReports(): Promise<{ reports: any[] }> {
  const res = await fetch(`${BASE}/api/reports/list`)
  if (!res.ok) throw new Error('Failed to list reports')
  return res.json()
}

export async function downloadReport(filename: string): Promise<void> {
  const res = await fetch(`${BASE}/api/reports/download/${filename}`)
  if (!res.ok) throw new Error('Failed to download report')
  
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

export async function deleteReport(filename: string): Promise<void> {
  const res = await fetch(`${BASE}/api/reports/delete/${filename}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete report')
} 