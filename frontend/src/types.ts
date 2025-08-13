export {}

export interface AIModel {
  provider: 'openai'
  model: string
  api_key?: string
}

export interface EmailConfig {
  type: 'email'
  smtp_server: string
  smtp_port: number
  smtp_username: string
  smtp_password: string
  from_email: string
  to_emails: string[]
  use_tls: boolean
}

export interface TelegramConfig {
  type: 'telegram'
  bot_token: string
  chat_ids: string[]
}

export interface SlackConfig {
  type: 'slack'
  webhook_url: string
  channel?: string
  username?: string
}

export type ReportChannel = 
  | { type: 'email'; config: EmailConfig }
  | { type: 'telegram'; config: TelegramConfig }
  | { type: 'slack'; config: SlackConfig }

export interface ReportConfig {
  channels: ReportChannel[]
  template?: string
  subject?: string
}

export type StepType = 'ai' | 'command' | 'report'

export interface PentestStep {
  id: string
  name: string
  type: StepType
  description?: string
  
  // AI step fields
  prompt?: string
  model?: AIModel
  
  // Command step fields
  command?: string
  working_dir?: string
  timeout_seconds?: number
  
  // Report step fields
  report_config?: ReportConfig
  
  // Inputs/templating
  inputs?: Record<string, any>
}

export interface WorkflowGraph {
  nodes: Array<{
    id: string
    position: { x: number; y: number }
    data: { label: string; type: string }
  }>
  edges: Array<{
    id: string
    source: string
    target: string
  }>
}

export interface Workflow {
  id: string
  name: string
  description?: string
  steps: PentestStep[]
  created_at: string
  updated_at: string
  graph?: WorkflowGraph
}

export interface StepLog {
  step_id: string
  step_name: string
  step_type: StepType
  status: 'pending' | 'running' | 'success' | 'error'
  started_at?: string
  finished_at?: string
  output?: string
  error?: string
}

export interface RunResult {
  run_id: string
  workflow_id: string
  status: 'running' | 'success' | 'error'
  started_at: string
  finished_at?: string
  context: Record<string, any>
  logs: StepLog[]
}

// Virtual Playground Types
export interface PlaygroundInstance {
  id: string
  name: string
  container_id: string
  ssh_port: number
  docker_port: number
  web_port: number
  status: 'creating' | 'running' | 'stopped' | 'error' | 'expired' | 'installing'
  created_at: string
  expires_at: string
  last_activity: string
  terminal_sessions: Record<string, any>
  environment: Record<string, string>
  resource_limits: Record<string, any>
}

export interface PlaygroundStats {
  cpu_usage: number
  memory_usage: number
  memory_limit: number
  disk_usage: number
  network_rx: number
  network_tx: number
  uptime: number
  containers_count: number
}

export interface PlaygroundCommand {
  command: string
  working_dir?: string
  environment?: Record<string, string>
}

export interface PlaygroundTerminalSession {
  session_id: string
  instance_id: string
  created_at: string
  last_activity: string
  status: 'active' | 'inactive' | 'closed'
}
