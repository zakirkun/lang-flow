import React from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

export default function NodeCard(props: NodeProps<{ label: string; kind?: 'ai'|'command'|'report' }>) {
  const { data } = props
  const kind = data?.kind ?? 'command'
  const aiStyle = 'border-2 border-cyber-neonGreen bg-gradient-to-br from-green-900/40 to-cyber-panel/60 shadow-neonGreen'
  const commandStyle = 'border-2 border-cyber-neonPink bg-gradient-to-br from-pink-900/40 to-cyber-panel/60 shadow-neonPink'
  const reportStyle = 'border-2 border-cyber-neonYellow bg-gradient-to-br from-yellow-900/40 to-cyber-panel/60 shadow-neonYellow'
  const cardStyle = kind === 'ai' ? aiStyle : kind === 'command' ? commandStyle : reportStyle
  
  return (
    <div className={`rounded-lg ${cardStyle} min-w-[160px] backdrop-blur-sm`}> 
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-cyber-neonCyan !border-2 !border-cyber-panel" 
      />
      <div className="px-3 py-2 text-xs uppercase tracking-wide font-bold text-gray-300">
        {kind === 'ai' ? '🤖 AI' : kind === 'command' ? '⚡ Command' : '📧 Report'}
      </div>
      <div className="px-3 pb-3 text-sm font-medium text-gray-100">
        {data?.label ?? 'Step'}
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-cyber-neonCyan !border-2 !border-cyber-panel" 
      />
    </div>
  )
} 