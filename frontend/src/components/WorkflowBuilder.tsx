import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, { addEdge, applyEdgeChanges, applyNodeChanges, Background, Controls, MiniMap, type Connection, type Edge, type EdgeChange, type Node, type NodeChange } from 'reactflow'
import 'reactflow/dist/style.css'
import type { Workflow, PentestStep } from '../types'
import NodeCard from './nodes/NodeCard'

const nodeTypes = { card: NodeCard }

interface Props {
  value: Workflow
  onChange: (wf: Workflow) => void
}

export default function WorkflowBuilder({ value, onChange }: Props) {
  const [nodes, setNodes] = useState<Node[]>(() => value.steps.map((s, i) => ({ id: s.id, position: { x: i * 180, y: 80 }, data: { label: s.name, type: s.type }, type: 'card' })))
  const [edges, setEdges] = useState<Edge[]>(() => (value.graph?.edges as Edge[]) || [])

  // Keep node list in sync with workflow steps
  useEffect(() => {
    setNodes((prev) => {
      const next: Node[] = []
      const prevMap = new Map(prev.map((n) => [n.id, n]))
      value.steps.forEach((s, i) => {
        const existing = prevMap.get(s.id)
        next.push(
          existing
            ? { ...existing, data: { ...existing.data, label: s.name, type: s.type } }
            : { id: s.id, position: { x: i * 180, y: 80 }, data: { label: s.name, type: s.type }, type: 'card' }
        )
      })
      return next
    })
  }, [value.steps])

  const onConnect = useCallback((params: Edge | Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#22d3ee', strokeWidth: 2 } }, eds)), [])
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])

  const order = useMemo(() => topological(nodes, edges), [nodes, edges])

  const applyOrder = useCallback(() => {
    if (order.length === 0) return
    const idToStep = new Map(value.steps.map(s => [s.id, s] as const))
    const sortedSteps: PentestStep[] = []
    for (const id of order) {
      const s = idToStep.get(id)
      if (s) sortedSteps.push(s)
    }
    for (const s of value.steps) if (!sortedSteps.find(x => x.id === s.id)) sortedSteps.push(s)
    onChange({ ...value, steps: sortedSteps, graph: { nodes, edges } })
  }, [order, value, nodes, edges, onChange])

  function addNode(kind: 'ai' | 'command' | 'report') {
    const id = crypto.randomUUID()
    const name = kind === 'ai' ? 'AI Step' : kind === 'command' ? 'Command Step' : 'Report Step'
    const step: PentestStep = {
      id, 
      name, 
      type: kind, 
      timeout_seconds: kind === 'ai' ? 90 : kind === 'command' ? 120 : 30, 
      inputs: {},
      ...(kind === 'ai' ? { model: { provider: 'openai', model: 'gpt-4o-mini' } } : {}),
      ...(kind === 'report' ? { report_config: { channels: [], template: '', subject: '' } } : {}),
    }
    onChange({ ...value, steps: [...value.steps, step], graph: { nodes: [...nodes, { id, position: { x: 80, y: 80 }, data: { label: name, type: kind }, type: 'card' }], edges } })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button className="px-2 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonCyan hover:shadow-neonCyan" onClick={applyOrder}>Apply Node Order to Steps</button>
        <div className="ml-auto flex gap-2">
          <button className="px-2 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonGreen hover:shadow-neonGreen" onClick={() => addNode('ai')}>+ AI Node</button>
          <button className="px-2 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonPink hover:shadow-neonPink" onClick={() => addNode('command')}>+ Command Node</button>
          <button className="px-2 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-cyber-neonYellow hover:shadow-neonYellow" onClick={() => addNode('report')}>+ Report Node</button>
        </div>
      </div>
      <div className="h-96 border border-slate-800 rounded bg-cyber-panel/20" style={{ background: 'linear-gradient(135deg, #0f1325 0%, #1e293b 100%)' }}>
        <ReactFlow 
          nodeTypes={nodeTypes} 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          onConnect={onConnect} 
          fitView
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#22d3ee', strokeWidth: 2 }
          }}
        >
          <MiniMap 
            style={{ backgroundColor: '#0f1325', border: '1px solid #475569' }}
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
    </div>
  )
}

function topological(nodes: Node[], edges: Edge[]): string[] {
  const adj = new Map<string, Set<string>>()
  const indeg = new Map<string, number>()
  for (const n of nodes) {
    adj.set(n.id, new Set())
    indeg.set(n.id, 0)
  }
  for (const e of edges) {
    const s = String(e.source)
    const t = String(e.target)
    if (!adj.has(s) || !indeg.has(t)) continue
    if (!adj.get(s)!.has(t)) {
      adj.get(s)!.add(t)
      indeg.set(t, (indeg.get(t) || 0) + 1)
    }
  }
  const q: string[] = []
  for (const [id, d] of indeg.entries()) if ((d || 0) === 0) q.push(id)
  const order: string[] = []
  while (q.length) {
    const u = q.shift()!
    order.push(u)
    for (const v of adj.get(u) || []) {
      indeg.set(v, (indeg.get(v) || 0) - 1)
      if ((indeg.get(v) || 0) === 0) q.push(v)
    }
  }
  return order
} 