import { Workflow, RunResult, PlaygroundInstance, PlaygroundStats, PlaygroundCommand } from './types'

const API_BASE = '/api'

// Workflows API
export async function listWorkflows(): Promise<Workflow[]> {
  const response = await fetch(`${API_BASE}/workflows/`)
  if (!response.ok) throw new Error('Failed to fetch workflows')
  return response.json()
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const response = await fetch(`${API_BASE}/workflows/${id}`)
  if (!response.ok) throw new Error('Failed to fetch workflow')
  return response.json()
}

export async function createWorkflow(workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>): Promise<Workflow> {
  // Generate ID on frontend since backend expects it
  const workflowWithId = {
    ...workflow,
    id: crypto.randomUUID()
  }
  
  const response = await fetch(`${API_BASE}/workflows/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowWithId)
  })
  if (!response.ok) throw new Error('Failed to create workflow')
  return response.json()
}

export async function updateWorkflow(workflow: Workflow): Promise<Workflow> {
  const response = await fetch(`${API_BASE}/workflows/${workflow.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow)
  })
  if (!response.ok) throw new Error('Failed to update workflow')
  return response.json()
}

export async function deleteWorkflow(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflows/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error('Failed to delete workflow')
}

// Alias for backward compatibility
export const getWorkflows = listWorkflows

// Runs API
export async function startRun(workflowId: string): Promise<{ status: string; run_id: string }> {
  const response = await fetch(`${API_BASE}/runs/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow_id: workflowId })
  })
  if (!response.ok) throw new Error('Failed to start run')
  return response.json()
}

export async function getRun(runId: string): Promise<RunResult> {
  const response = await fetch(`${API_BASE}/runs/${runId}`)
  if (!response.ok) throw new Error('Failed to fetch run')
  return response.json()
}

export async function listRuns(): Promise<RunResult[]> {
  const response = await fetch(`${API_BASE}/runs/`)
  if (!response.ok) throw new Error('Failed to fetch runs')
  return response.json()
}

export function runsWsUrl(runId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${API_BASE}/runs/ws/${runId}`
}


// Report generation APIs
export async function generateReport(runId: string): Promise<{ status: string; message: string; report_id: string; filename: string; download_url: string }> {
  const res = await fetch(`${API_BASE}/reports/generate/${runId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) throw new Error('Failed to generate report')
  return res.json()
}

export async function getReportStatus(runId: string): Promise<{ has_report: boolean; reports: any[] }> {
  const res = await fetch(`${API_BASE}/reports/status/${runId}`)
  if (!res.ok) throw new Error('Failed to get report status')
  return res.json()
}

export async function listReports(): Promise<{ reports: any[] }> {
  const res = await fetch(`${API_BASE}/reports/list`)
  if (!res.ok) throw new Error('Failed to list reports')
  return res.json()
}

export async function downloadReport(filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reports/download/${filename}`)
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
  const res = await fetch(`${API_BASE}/reports/delete/${filename}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete report')
} 

// Playground API
export async function getPlaygroundInstances(): Promise<PlaygroundInstance[]> {
  const response = await fetch(`${API_BASE}/playground/`)
  if (!response.ok) throw new Error('Failed to fetch playground instances')
  return response.json()
}

export async function createPlaygroundInstance(name?: string, duration_hours: number = 4): Promise<PlaygroundInstance> {
  const response = await fetch(`${API_BASE}/playground/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, duration_hours })
  })
  if (!response.ok) throw new Error('Failed to create playground instance')
  return response.json()
}

export async function getPlaygroundInstance(instanceId: string): Promise<PlaygroundInstance> {
  const response = await fetch(`${API_BASE}/playground/${instanceId}`)
  if (!response.ok) throw new Error('Failed to fetch playground instance')
  return response.json()
}

export async function deletePlaygroundInstance(instanceId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/playground/${instanceId}`, {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error('Failed to delete playground instance')
}

export async function extendPlaygroundInstance(instanceId: string, hours: number): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/playground/${instanceId}/extend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hours })
  })
  if (!response.ok) throw new Error('Failed to extend instance')
  return response.json()
}

export async function refreshPlaygroundStatus(instanceId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/playground/${instanceId}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) throw new Error('Failed to refresh instance status')
  return response.json()
}

export async function cleanupOrphanedContainers(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/playground/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) throw new Error('Failed to cleanup orphaned containers')
  return response.json()
}

export async function executePlaygroundCommand(instanceId: string, command: PlaygroundCommand): Promise<{ status: string; output: string; command: string }> {
  const response = await fetch(`${API_BASE}/playground/${instanceId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  })
  if (!response.ok) throw new Error('Failed to execute command')
  return response.json()
}

export async function getPlaygroundStats(instanceId: string): Promise<PlaygroundStats> {
  const response = await fetch(`${API_BASE}/playground/${instanceId}/stats`)
  if (!response.ok) throw new Error('Failed to fetch playground stats')
  return response.json()
}

export function playgroundTerminalWsUrl(instanceId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${API_BASE}/playground/${instanceId}/terminal`
}

export async function uploadPlaygroundFile(instanceId: string, filePath: string, content: string): Promise<void> {
  const response = await fetch(`${API_BASE}/playground/${instanceId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_path: filePath, content })
  })
  if (!response.ok) throw new Error('Failed to upload file')
}

export async function listPlaygroundFiles(instanceId: string, path: string = '/playground'): Promise<{ status: string; path: string; files: string[] }> {
  const response = await fetch(`${API_BASE}/playground/${instanceId}/files?path=${encodeURIComponent(path)}`)
  if (!response.ok) throw new Error('Failed to list files')
  return response.json()
} 