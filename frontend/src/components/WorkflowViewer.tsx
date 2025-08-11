import React from 'react'
import type { Workflow } from '../types'

interface Props {
  workflow: Workflow
  currentStepId?: string
  completedSteps?: string[]
}

export default function WorkflowViewer({ workflow, currentStepId, completedSteps = [] }: Props) {
  return (
    <div className="space-y-4">
      {/* Workflow Header */}
      <div className="border border-slate-800 rounded-lg bg-cyber-panel/40 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-cyber-neonCyan animate-pulse"></div>
          <h3 className="text-lg font-semibold text-cyber-neonCyan">{workflow.name}</h3>
        </div>
        {workflow.description && (
          <p className="text-gray-300 text-sm">{workflow.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="px-2 py-1 rounded bg-slate-800 text-gray-400">
            Steps: {workflow.steps.length}
          </span>
          <span className="px-2 py-1 rounded bg-green-900/50 text-cyber-neonGreen">
            Completed: {completedSteps.length}
          </span>
          <span className="px-2 py-1 rounded bg-slate-800 text-gray-400 font-mono">
            ID: {workflow.id.slice(0, 8)}...
          </span>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Execution Flow</h4>
        <div className="space-y-2">
          {workflow.steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id)
            const isCurrent = currentStepId === step.id
            const isUpcoming = !isCompleted && !isCurrent
            
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                  isCompleted
                    ? 'border-green-800 bg-green-900/20 shadow-neonGreen/20'
                    : isCurrent
                    ? 'border-cyber-neonYellow bg-yellow-900/20 shadow-neonYellow/30 animate-pulse'
                    : 'border-slate-700 bg-cyber-panel/30'
                }`}
              >
                {/* Step Number/Status */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCompleted
                    ? 'bg-green-900/50 text-cyber-neonGreen border border-green-800'
                    : isCurrent
                    ? 'bg-yellow-900/50 text-cyber-neonYellow border border-yellow-800'
                    : 'bg-slate-800 text-gray-400 border border-slate-700'
                }`}>
                  {isCompleted ? '✓' : index + 1}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className={`font-medium truncate ${
                      isCompleted
                        ? 'text-cyber-neonGreen'
                        : isCurrent
                        ? 'text-cyber-neonYellow'
                        : 'text-gray-300'
                    }`}>
                      {step.name}
                    </h5>
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                      step.type === 'ai'
                        ? 'bg-green-900/50 text-cyber-neonGreen border border-green-800'
                        : step.type === 'command'
                        ? 'bg-pink-900/50 text-cyber-neonPink border border-pink-800'
                        : 'bg-yellow-900/50 text-cyber-neonYellow border border-yellow-800'
                    }`}>
                      {step.type === 'ai' ? '🤖 AI' : step.type === 'command' ? '⚡ CMD' : '📧 REPORT'}
                    </span>
                  </div>
                  
                  {/* Step Details */}
                  <div className="text-xs text-gray-400 truncate">
                    {step.type === 'ai' 
                      ? `Prompt: ${step.prompt?.slice(0, 60)}${(step.prompt?.length || 0) > 60 ? '...' : ''}`
                      : `Command: ${step.command?.slice(0, 60)}${(step.command?.length || 0) > 60 ? '...' : ''}`
                    }
                  </div>
                </div>

                {/* Step Status Indicator */}
                <div className="flex-shrink-0">
                  {isCompleted && (
                    <div className="w-2 h-2 rounded-full bg-cyber-neonGreen animate-pulse"></div>
                  )}
                  {isCurrent && (
                    <div className="w-2 h-2 rounded-full bg-cyber-neonYellow animate-ping"></div>
                  )}
                  {isUpcoming && (
                    <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="border border-slate-800 rounded-lg bg-cyber-panel/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">Progress</span>
          <span className="text-sm text-cyber-neonCyan font-mono">
            {completedSteps.length} / {workflow.steps.length}
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-cyber-neonCyan to-cyber-neonGreen h-2 rounded-full transition-all duration-500 shadow-neonCyan/50"
            style={{
              width: `${workflow.steps.length > 0 ? (completedSteps.length / workflow.steps.length) * 100 : 0}%`,
            }}
          ></div>
        </div>
      </div>
    </div>
  )
} 