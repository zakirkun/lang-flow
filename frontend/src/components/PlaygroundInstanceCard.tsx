import React from 'react'
import { PlaygroundInstance, PlaygroundStats } from '../types'
import { refreshPlaygroundStatus } from '../api'

interface Props {
  instance: PlaygroundInstance
  stats?: PlaygroundStats
  isSelected: boolean
  onSelect: (instance: PlaygroundInstance) => void
  onDelete: (instanceId: string) => void
  onExtend: (instanceId: string, hours: number) => void
  formatUptime: (createdAt: string) => string
  formatTimeRemaining: (expiresAt: string) => string
}

export default function PlaygroundInstanceCard({
  instance,
  stats,
  isSelected,
  onSelect,
  onDelete,
  onExtend,
  formatUptime,
  formatTimeRemaining
}: Props) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-cyber-neonGreen'
      case 'creating': return 'text-cyber-neonYellow'
      case 'installing': return 'text-cyber-neonCyan'
      case 'stopped': return 'text-gray-400'
      case 'error': return 'text-red-400'
      case 'expired': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '✅'
      case 'creating': return '⏳'
      case 'installing': return '📦'
      case 'stopped': return '⏸️'
      case 'error': return '❌'
      case 'expired': return '⏰'
      default: return '❓'
    }
  }

  const timeRemaining = formatTimeRemaining(instance.expires_at)
  const isExpired = timeRemaining === 'Expired'
  const isLowTime = !isExpired && timeRemaining.includes('0h') && parseInt(timeRemaining) < 30

  return (
    <div
      onClick={() => onSelect(instance)}
      className={`
        border rounded-lg p-4 cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-cyber-neonCyan bg-cyber-neonCyan/10 shadow-neonCyan'
          : 'border-slate-700 bg-cyber-panel/40 hover:border-cyber-neonCyan/50 hover:shadow-neonCyan/30'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getStatusIcon(instance.status)}</span>
          <div>
            <h4 className="font-medium text-gray-200 truncate max-w-32" title={instance.name}>
              {instance.name}
            </h4>
            <p className="text-xs text-gray-400">ID: {instance.id}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {instance.status === 'running' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onExtend(instance.id, 2)
              }}
              className="px-2 py-1 text-xs rounded border border-slate-600 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonGreen hover:border-cyber-neonGreen transition-all"
              title="Extend by 2 hours"
            >
              +2h
            </button>
          )}
          {(instance.status === 'installing' || instance.status === 'error') && (
            <button
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  await refreshPlaygroundStatus(instance.id)
                  // Trigger refresh of parent component
                  window.location.reload()
                } catch (error) {
                  console.error('Failed to refresh status:', error)
                }
              }}
              className="px-2 py-1 text-xs rounded border border-cyan-600 bg-cyber-neonCyan/20 text-cyber-neonCyan hover:bg-cyber-neonCyan/40 transition-all"
              title="Refresh status"
            >
              🔄
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(instance.id)
            }}
            className="px-2 py-1 text-xs rounded border border-red-800 bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-all"
            title="Delete instance"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${getStatusColor(instance.status)}`}>
          {instance.status.charAt(0).toUpperCase() + instance.status.slice(1)}
        </span>
        <span className="text-xs text-gray-400">
          {formatUptime(instance.created_at)} uptime
        </span>
      </div>

      {/* Time Remaining */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Time remaining:</span>
          <span className={`font-medium ${isExpired ? 'text-red-400' : isLowTime ? 'text-cyber-neonYellow' : 'text-cyber-neonGreen'}`}>
            {timeRemaining}
          </span>
        </div>
        {!isExpired && (
          <div className="w-full bg-slate-700 rounded-full h-1 mt-1">
            <div
              className={`h-1 rounded-full transition-all duration-300 ${
                isLowTime ? 'bg-cyber-neonYellow' : 'bg-cyber-neonGreen'
              }`}
              style={{
                width: `${Math.max(5, Math.min(100, (new Date(instance.expires_at).getTime() - Date.now()) / (4 * 60 * 60 * 1000) * 100))}%`
              }}
            />
          </div>
        )}
      </div>

      {/* Ports */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="text-center p-1 rounded bg-slate-800/50">
          <div className="text-gray-400">SSH</div>
          <div className="text-cyber-neonCyan font-mono">{instance.ssh_port}</div>
        </div>
        <div className="text-center p-1 rounded bg-slate-800/50">
          <div className="text-gray-400">Docker</div>
          <div className="text-cyber-neonGreen font-mono">{instance.docker_port}</div>
        </div>
        <div className="text-center p-1 rounded bg-slate-800/50">
          <div className="text-gray-400">Web</div>
          <div className="text-cyber-neonYellow font-mono">{instance.web_port}</div>
        </div>
      </div>

      {/* Stats (if available) */}
      {stats && instance.status === 'running' && (
        <div className="border-t border-slate-700 pt-2 mt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">CPU:</span>
              <span className={`ml-1 font-medium ${stats.cpu_usage > 80 ? 'text-red-400' : stats.cpu_usage > 50 ? 'text-cyber-neonYellow' : 'text-cyber-neonGreen'}`}>
                {stats.cpu_usage.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-400">Memory:</span>
              <span className={`ml-1 font-medium ${stats.memory_usage > 80 ? 'text-red-400' : stats.memory_usage > 50 ? 'text-cyber-neonYellow' : 'text-cyber-neonGreen'}`}>
                {stats.memory_usage.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-400">Containers:</span>
              <span className="ml-1 font-medium text-cyber-neonCyan">{stats.containers_count}</span>
            </div>
            <div>
              <span className="text-gray-400">Network:</span>
              <span className="ml-1 font-medium text-gray-300">
                {(stats.network_rx / 1024 / 1024).toFixed(1)}MB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {instance.status === 'running' && (
        <div className="border-t border-slate-700 pt-2 mt-2">
          <div className="flex items-center gap-2 text-xs">
            <a
              href={`http://localhost:${instance.web_port}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-1 rounded border border-cyber-neonYellow/50 text-cyber-neonYellow hover:bg-cyber-neonYellow/10 transition-all"
            >
              🌐 Web
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(`ssh root@localhost -p ${instance.ssh_port}`)
              }}
              className="px-2 py-1 rounded border border-cyber-neonCyan/50 text-cyber-neonCyan hover:bg-cyber-neonCyan/10 transition-all"
              title="Copy SSH command"
            >
              📋 SSH
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 