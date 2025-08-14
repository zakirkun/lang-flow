import React, { useState } from 'react'

interface Props {
  onClose: () => void
  onCreate: (name?: string, duration_hours?: number) => Promise<void>
}

export default function CreatePlaygroundModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(4)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      await onCreate(name || undefined, duration)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playground')
    } finally {
      setIsCreating(false)
    }
  }

  const durationOptions = [
    { value: 1, label: '1 Hour' },
    { value: 2, label: '2 Hours' },
    { value: 4, label: '4 Hours (Default)' },
    { value: 6, label: '6 Hours' },
    { value: 8, label: '8 Hours' },
    { value: 12, label: '12 Hours' }
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-cyber-panel border border-slate-800 rounded-lg p-6 w-full max-w-md shadow-neonCyan">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐳</span>
            <div>
              <h2 className="text-xl font-semibold text-cyber-neonCyan">Create Playground</h2>
              <p className="text-sm text-gray-400">Set up your Docker-in-Docker environment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isCreating}
            className="text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 border border-red-800 bg-red-900/20 rounded-lg text-red-400 text-sm">
            <div className="flex items-center gap-2">
              <span>❌</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Instance Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Instance Name <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              placeholder="e.g., my-pentest-env"
              className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:border-cyber-neonCyan focus:ring-1 focus:ring-cyber-neonCyan focus:outline-none transition-colors disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for auto-generated name (playground-{'{id}'})
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Session Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              disabled={isCreating}
              className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 focus:border-cyber-neonGreen focus:ring-1 focus:ring-cyber-neonGreen focus:outline-none transition-colors disabled:opacity-50"
            >
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Playground will auto-expire after this duration (can be extended later)
            </p>
          </div>

          {/* Features Info */}
          <div className="bg-cyber-panel/30 border border-slate-700 rounded-lg p-3">
            <h4 className="text-sm font-medium text-cyber-neonYellow mb-2">🎯 What's Included:</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Docker-in-Docker environment</li>
              <li>• Pre-installed security tools</li>
              <li>• SSH access (root:playground)</li>
              <li>• Web-based file manager</li>
              <li>• File editing and management</li>
              <li>• Python, Node.js, Git, and more</li>
            </ul>
          </div>

          {/* Resource Limits Info */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-300 mb-2">📊 Resource Limits:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>• CPU: 1 core</div>
              <div>• Memory: 1GB</div>
              <div>• Storage: 2GB</div>
              <div>• Network: Isolated</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm rounded-lg border border-slate-700 bg-cyber-panel/40 text-gray-300 hover:text-gray-100 hover:border-slate-600 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isCreating}
              className="px-6 py-2 text-sm font-medium rounded-lg border border-cyber-neonGreen bg-cyber-neonGreen/10 text-cyber-neonGreen hover:bg-cyber-neonGreen/20 hover:shadow-neonGreen transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-cyber-neonGreen border-t-transparent rounded-full"></div>
                  Creating...
                </>
              ) : (
                <>
                  ✨ Create Playground
                </>
              )}
            </button>
          </div>
        </form>

        {/* Creation Info */}
        {isCreating && (
          <div className="mt-4 p-3 bg-cyber-neonGreen/10 border border-cyber-neonGreen/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-cyber-neonGreen">
              <div className="animate-spin w-4 h-4 border-2 border-cyber-neonGreen border-t-transparent rounded-full"></div>
              <span>Setting up your playground environment...</span>
            </div>
            <div className="mt-2 text-xs text-gray-400 space-y-1">
              <div>• Pulling Docker images...</div>
              <div>• Installing development tools...</div>
              <div>• Configuring SSH access...</div>
              <div>• Setting up web interface...</div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This may take 1-2 minutes for the first time.
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 