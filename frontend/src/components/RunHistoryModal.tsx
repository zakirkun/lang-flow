import React from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (runId: string) => void
  workflowId: string
}

export default function RunHistoryModal({ open, onClose, onSelect, workflowId }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-cyber-panel border border-slate-800 rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-medium text-cyber-neonCyan mb-4">Run History</h3>
        <p className="text-gray-400 text-sm mb-4">
          Feature coming soon. For now, use the Workflow Detail page to view run history.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-white"
        >
          Close
        </button>
      </div>
    </div>
  )
}