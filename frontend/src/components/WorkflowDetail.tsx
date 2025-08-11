import React, { useMemo, useState } from 'react'
import ReactFlow, { Background, Controls, MiniMap, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import type { Workflow, PentestStep } from '../types'
import NodeCard from './nodes/NodeCard'
import WorkflowRunHistoryModal from './WorkflowRunHistoryModal'

const nodeTypes = { card: NodeCard }

interface Props {
  workflow: Workflow
  onBack: () => void
}

export default function WorkflowDetail({ workflow, onBack }: Props) {
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Generate nodes and edges from workflow
  const { nodes, edges } = useMemo(() => {
    // Use existing graph if available
    if (workflow.graph?.nodes && workflow.graph.nodes.length > 0) {
      return {
        nodes: workflow.graph.nodes as Node[],
        edges: (workflow.graph.edges as Edge[]) || []
      }
    }

    // Generate nodes from workflow steps
    const generatedNodes: Node[] = workflow.steps.map((step, index) => ({
      id: step.id,
      position: { x: index * 200, y: 100 },
      data: { 
        label: step.name, 
        kind: step.type 
      },
      type: 'card'
    }))

    // Generate sequential edges
    const generatedEdges: Edge[] = []
    for (let i = 0; i < workflow.steps.length - 1; i++) {
      generatedEdges.push({
        id: `edge-${i}`,
        source: workflow.steps[i].id,
        target: workflow.steps[i + 1].id,
        animated: true,
        style: { stroke: '#22d3ee', strokeWidth: 2 }
      })
    }

    return {
      nodes: generatedNodes,
      edges: generatedEdges
    }
  }, [workflow])

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'ai': return '🤖'
      case 'command': return '⚡'
      case 'report': return '📧'
      default: return '📋'
    }
  }

  const getStepColor = (type: string) => {
    switch (type) {
      case 'ai': return 'border-cyber-neonGreen bg-green-900/20 text-cyber-neonGreen'
      case 'command': return 'border-cyber-neonPink bg-pink-900/20 text-cyber-neonPink'
      case 'report': return 'border-cyber-neonYellow bg-yellow-900/20 text-cyber-neonYellow'
      default: return 'border-slate-700 bg-slate-900/20 text-gray-300'
    }
  }

  const renderStepContent = (step: PentestStep) => {
    return (
      <div className="space-y-3">
        {/* Step Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStepIcon(step.type)}</span>
            <h4 className="font-medium text-gray-200">{step.name}</h4>
          </div>
          <span className={`text-xs px-2 py-1 rounded border ${getStepColor(step.type)}`}>
            {step.type.toUpperCase()}
          </span>
        </div>

        {/* Step Description */}
        {step.description && (
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <p className="text-sm text-gray-300 bg-cyber-panel/30 rounded p-2 border border-slate-700">
              {step.description}
            </p>
          </div>
        )}

        {/* AI Step Content */}
        {step.type === 'ai' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">AI Prompt</label>
              <div className="bg-cyber-panel/30 rounded p-3 border border-slate-700">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {step.prompt || 'No prompt specified'}
                </pre>
              </div>
            </div>
            {step.model && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Model</label>
                  <p className="text-sm text-gray-300 bg-cyber-panel/30 rounded p-2 border border-slate-700">
                    {step.model.model}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Provider</label>
                  <p className="text-sm text-gray-300 bg-cyber-panel/30 rounded p-2 border border-slate-700">
                    {step.model.provider}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Command Step Content */}
        {step.type === 'command' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Command</label>
              <div className="bg-cyber-panel/30 rounded p-3 border border-slate-700">
                <pre className="text-sm text-cyber-neonPink whitespace-pre-wrap font-mono">
                  {step.command || 'No command specified'}
                </pre>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Working Directory</label>
                <p className="text-sm text-gray-300 bg-cyber-panel/30 rounded p-2 border border-slate-700">
                  {step.working_dir || 'Default directory'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Timeout</label>
                <p className="text-sm text-gray-300 bg-cyber-panel/30 rounded p-2 border border-slate-700">
                  {step.timeout_seconds || 90} seconds
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Report Step Content */}
        {step.type === 'report' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Subject</label>
                <p className="text-sm text-gray-300 bg-cyber-panel/30 rounded p-2 border border-slate-700">
                  {step.report_config?.subject || 'No subject specified'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Channels</label>
                <p className="text-sm text-gray-300 bg-cyber-panel/30 rounded p-2 border border-slate-700">
                  {step.report_config?.channels?.length || 0} configured
                </p>
              </div>
            </div>
            {step.report_config?.template && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Template</label>
                <div className="bg-cyber-panel/30 rounded p-3 border border-slate-700">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                    {step.report_config.template}
                  </pre>
                </div>
              </div>
            )}
            {step.report_config?.channels && step.report_config.channels.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Report Channels</label>
                <div className="space-y-2">
                  {step.report_config.channels.map((channel, index) => (
                    <div key={index} className="bg-cyber-panel/30 rounded p-2 border border-slate-700">
                      <span className={`text-xs px-2 py-1 rounded border ${
                        channel.type === 'email' ? 'border-blue-800 bg-blue-900/30 text-blue-400' :
                        channel.type === 'telegram' ? 'border-cyan-800 bg-cyan-900/30 text-cyan-400' :
                        'border-green-800 bg-green-900/30 text-green-400'
                      }`}>
                        {channel.type.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Variables */}
        {step.inputs && Object.keys(step.inputs).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Input Variables</label>
            <div className="bg-cyber-panel/30 rounded p-3 border border-slate-700">
              <div className="space-y-2">
                {Object.entries(step.inputs).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="text-cyber-neonCyan font-mono">{key}</span>
                    <span className="text-gray-400">=</span>
                    <span className="text-gray-300 font-mono bg-slate-800/50 px-2 py-1 rounded">
                      {String(value) || 'empty'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={onBack}
          className="text-sm text-cyber-neonCyan hover:underline flex items-center gap-2 group transition-all"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Back to Workflows
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-4 py-2 text-sm rounded-lg border border-cyber-neonYellow bg-cyber-neonYellow/20 text-cyber-neonYellow hover:shadow-neonYellow transition-all flex items-center gap-2"
          >
            📊 Show History
          </button>
          <span className="text-xs px-3 py-1 rounded border border-slate-700 bg-cyber-panel/60 text-gray-400">
            📖 Read Only
          </span>
        </div>
      </div>

      {/* Enhanced Workflow Header */}
      <div className="border border-slate-800 rounded-xl bg-gradient-to-br from-cyber-panel/40 to-cyber-panel/20 backdrop-blur p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-cyber-neonCyan animate-pulse"></div>
              <h2 className="text-3xl font-bold text-cyber-neonCyan">
                {workflow.name}
              </h2>
            </div>
            {workflow.description && (
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                {workflow.description}
              </p>
            )}
            
            {/* Quick Info Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 text-xs rounded-full border border-slate-700 bg-cyber-panel/60 text-gray-400">
                {workflow.steps.length} Total Steps
              </span>
              <span className="px-3 py-1 text-xs rounded-full border border-green-800 bg-green-900/20 text-cyber-neonGreen">
                {workflow.steps.filter(s => s.type === 'ai').length} AI
              </span>
              <span className="px-3 py-1 text-xs rounded-full border border-pink-800 bg-pink-900/20 text-cyber-neonPink">
                {workflow.steps.filter(s => s.type === 'command').length} Command
              </span>
              <span className="px-3 py-1 text-xs rounded-full border border-yellow-800 bg-yellow-900/20 text-cyber-neonYellow">
                {workflow.steps.filter(s => s.type === 'report').length} Report
              </span>
            </div>
          </div>
          
          {/* Metadata Sidebar */}
          <div className="lg:w-80 bg-cyber-panel/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <span>📋</span> Workflow Info
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Workflow ID:</span>
                <span className="text-cyber-neonCyan font-mono text-xs">
                  {workflow.id.substring(0, 8)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Created:</span>
                <span className="text-gray-300">{formatDate(workflow.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Updated:</span>
                <span className="text-gray-300">{formatDate(workflow.updated_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Graph:</span>
                <span className={workflow.graph?.nodes ? 'text-cyber-neonGreen' : 'text-cyber-neonYellow'}>
                  {workflow.graph?.nodes ? '✓ Custom' : '⚡ Auto'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Workflow Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-700/50">
          <div className="bg-green-900/10 border border-green-800/30 rounded-lg p-4 text-center group hover:bg-green-900/20 transition-all">
            <div className="text-3xl text-cyber-neonGreen mb-2 group-hover:scale-110 transition-transform">
              {workflow.steps.filter(s => s.type === 'ai').length}
            </div>
            <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
              <span>🤖</span> AI Steps
            </div>
            <div className="text-xs text-green-400 mt-1">
              Intelligent Analysis
            </div>
          </div>
          <div className="bg-pink-900/10 border border-pink-800/30 rounded-lg p-4 text-center group hover:bg-pink-900/20 transition-all">
            <div className="text-3xl text-cyber-neonPink mb-2 group-hover:scale-110 transition-transform">
              {workflow.steps.filter(s => s.type === 'command').length}
            </div>
            <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
              <span>⚡</span> Command Steps
            </div>
            <div className="text-xs text-pink-400 mt-1">
              System Execution
            </div>
          </div>
          <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-4 text-center group hover:bg-yellow-900/20 transition-all">
            <div className="text-3xl text-cyber-neonYellow mb-2 group-hover:scale-110 transition-transform">
              {workflow.steps.filter(s => s.type === 'report').length}
            </div>
            <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
              <span>📧</span> Report Steps
            </div>
            <div className="text-xs text-yellow-400 mt-1">
              Result Distribution
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-cyber-neonCyan">
          📋 Workflow Steps ({workflow.steps.length})
        </h3>
        
        {workflow.steps.length === 0 ? (
          <div className="border border-slate-800 rounded-lg bg-cyber-panel/20 p-8 text-center">
            <div className="text-gray-400 text-lg mb-2">📝</div>
            <p className="text-gray-400">No steps defined in this workflow</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workflow.steps.map((step, index) => (
              <div 
                key={step.id} 
                className="border border-slate-800 rounded-lg bg-cyber-panel/20 backdrop-blur p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${getStepColor(step.type)}`}>
                    {index + 1}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-700 to-transparent"></div>
                  <span className="text-xs text-gray-500">
                    Step {index + 1} of {workflow.steps.length}
                  </span>
                </div>
                
                {renderStepContent(step)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visual Workflow Graph */}
      {workflow.steps.length > 0 && (
        <div className="border border-slate-800 rounded-lg bg-cyber-panel/20 backdrop-blur overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-cyber-neonCyan">
                🔗 Workflow Graph
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>📊 {nodes.length} nodes</span>
                <span>•</span>
                <span>🔗 {edges.length} connections</span>
              </div>
            </div>
          </div>
          
          <div className="h-80" style={{ background: 'linear-gradient(135deg, #0f1325 0%, #1e293b 100%)' }}>
            <ReactFlow 
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
              defaultEdgeOptions={{
                animated: true,
                style: { stroke: '#22d3ee', strokeWidth: 2 }
              }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag={true}
              zoomOnScroll={true}
              minZoom={0.5}
              maxZoom={2}
            >
              <MiniMap 
                style={{ 
                  backgroundColor: '#0f1325', 
                  border: '1px solid #475569',
                  borderRadius: '4px'
                }}
                nodeStrokeColor="#22d3ee"
                nodeColor="#0f1325"
                maskColor="rgba(15, 19, 37, 0.6)"
              />
              <Controls 
                style={{ 
                  backgroundColor: '#0f1325', 
                  border: '1px solid #475569',
                  borderRadius: '6px'
                }}
              />
              <Background gap={16} size={1} color="#475569" />
            </ReactFlow>
          </div>
          
          <div className="p-3 bg-cyber-panel/30 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-4">
                <span>🔍 Use mouse wheel to zoom</span>
                <span>🖱️ Drag to pan</span>
              </div>
              <div className="flex items-center gap-2">
                {workflow.graph?.nodes ? (
                  <span className="text-cyber-neonGreen">✓ Saved graph layout</span>
                ) : (
                  <span className="text-cyber-neonYellow">⚡ Auto-generated layout</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Run History Modal */}
      <WorkflowRunHistoryModal
        workflowId={workflow.id}
        workflowName={workflow.name}
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </div>
  )
}
