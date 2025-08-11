export type StepType = 'ai' | 'command' | 'report'

export interface AIModel {
  provider: 'openai'
  model: string
  api_key?: string
}

export interface ReportConfig {
  channels: ReportChannel[]
  template?: string
  subject?: string
}

export type ReportChannel = 
  | { type: 'email'; config: EmailConfig }
  | { type: 'telegram'; config: TelegramConfig }
  | { type: 'slack'; config: SlackConfig }

export interface EmailConfig {
  type: 'email'
  smtp_server: string
  smtp_port: number
  smtp_username: string
  smtp_password: string
  from_email: string
  to_emails: string[]
  use_tls?: boolean
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

export interface PentestStep {
  id: string
  name: string
  type: StepType
  description?: string
  prompt?: string
  model?: AIModel
  command?: string
  working_dir?: string
  timeout_seconds?: number
  inputs?: Record<string, any>
  report_config?: ReportConfig
}

// Lightweight graph type compatible with React Flow serialization
export interface WorkflowGraph {
  nodes?: Array<Record<string, any>>
  edges?: Array<Record<string, any>>
}

export interface Workflow {
  id: string
  name: string
  description?: string
  steps: PentestStep[]
  created_at?: string
  updated_at?: string
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

export {}
