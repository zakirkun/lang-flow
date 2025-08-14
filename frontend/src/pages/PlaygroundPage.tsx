import React, { useState, useEffect } from 'react'
import { PlaygroundInstance, PlaygroundStats } from '../types'
import { 
  getPlaygroundInstances, 
  createPlaygroundInstance, 
  deletePlaygroundInstance,
  extendPlaygroundInstance,
  getPlaygroundStats
} from '../api'
import PlaygroundFileManager from '../components/PlaygroundFileManager'
import PlaygroundInstanceCard from '../components/PlaygroundInstanceCard'
import CreatePlaygroundModal from '../components/CreatePlaygroundModal'

export default function PlaygroundPage() {
  const [instances, setInstances] = useState<PlaygroundInstance[]>([])
  const [selectedInstance, setSelectedInstance] = useState<PlaygroundInstance | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [instanceStats, setInstanceStats] = useState<Record<string, PlaygroundStats>>({})

  // Load instances on mount
  useEffect(() => {
    loadInstances()
    // Refresh instances every 30 seconds
    const interval = setInterval(loadInstances, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load stats for running instances
  useEffect(() => {
    const runningInstances = instances.filter(i => i.status === 'running')
    if (runningInstances.length > 0) {
      loadStats(runningInstances)
      // Refresh stats every 10 seconds for running instances
      const interval = setInterval(() => loadStats(runningInstances), 10000)
      return () => clearInterval(interval)
    }
  }, [instances])

  const loadInstances = async () => {
    try {
      setError(null)
      const data = await getPlaygroundInstances()
      setInstances(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instances')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (runningInstances: PlaygroundInstance[]) => {
    const statsPromises = runningInstances.map(async (instance) => {
      try {
        const stats = await getPlaygroundStats(instance.id)
        return { instanceId: instance.id, stats }
      } catch {
        return null
      }
    })

    const results = await Promise.all(statsPromises)
    const newStats: Record<string, PlaygroundStats> = {}
    
    results.forEach((result) => {
      if (result) {
        newStats[result.instanceId] = result.stats
      }
    })

    setInstanceStats(newStats)
  }

  const handleCreateInstance = async (name?: string, duration_hours: number = 4) => {
    try {
      setError(null)
      await createPlaygroundInstance(name, duration_hours)
      setShowCreateModal(false)
      await loadInstances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create instance')
    }
  }

  const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm('Are you sure you want to delete this playground instance?')) {
      return
    }

    try {
      setError(null)
      await deletePlaygroundInstance(instanceId)
      if (selectedInstance?.id === instanceId) {
        setSelectedInstance(null)
      }
      await loadInstances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete instance')
    }
  }

  const handleExtendInstance = async (instanceId: string, hours: number = 2) => {
    try {
      setError(null)
      await extendPlaygroundInstance(instanceId, hours)
      await loadInstances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend instance')
    }
  }

  const formatUptime = (createdAt: string) => {
    const now = new Date()
    const created = new Date(createdAt)
    const diff = now.getTime() - created.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()
    
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${hours}h ${minutes}m`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 border border-slate-800 rounded-lg bg-cyber-panel/20">
          <span className="text-2xl animate-spin">🐳</span>
          <div>
            <h2 className="text-xl font-semibold text-cyber-neonCyan">Virtual Playground</h2>
            <p className="text-sm text-gray-400">Loading Docker environments...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin text-4xl">⚡</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-800 rounded-lg bg-cyber-panel/20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐳</span>
          <div>
            <h2 className="text-xl font-semibold text-cyber-neonCyan">Virtual Playground</h2>
            <p className="text-sm text-gray-400">Docker-in-Docker isolated environments for testing</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadInstances()}
            className="px-3 py-1 text-sm rounded border border-slate-700 bg-cyber-panel/60 text-gray-300 hover:text-cyber-neonCyan hover:shadow-neonCyan transition-all"
            title="Refresh Instances"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg border border-cyber-neonGreen bg-cyber-neonGreen/10 text-cyber-neonGreen hover:shadow-neonGreen transition-all font-medium"
          >
            ✨ New Playground
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-red-800 bg-red-900/20 rounded-lg text-red-400">
          <div className="flex items-center gap-2">
            <span>❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Instances List */}
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-cyber-neonYellow">
              Active Instances ({instances.length})
            </h3>
          </div>

          {instances.length === 0 ? (
            <div className="border border-slate-800 rounded-lg p-8 text-center bg-cyber-panel/10">
              <div className="text-4xl mb-4">🐳</div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">No Playground Instances</h3>
              <p className="text-sm text-gray-400 mb-4">
                Create your first Docker-in-Docker environment to start experimenting
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-lg border border-cyber-neonGreen bg-cyber-neonGreen/10 text-cyber-neonGreen hover:shadow-neonGreen transition-all"
              >
                ✨ Create Playground
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((instance) => (
                <PlaygroundInstanceCard
                  key={instance.id}
                  instance={instance}
                  stats={instanceStats[instance.id]}
                  isSelected={selectedInstance?.id === instance.id}
                  onSelect={setSelectedInstance}
                  onDelete={handleDeleteInstance}
                  onExtend={handleExtendInstance}
                  formatUptime={formatUptime}
                  formatTimeRemaining={formatTimeRemaining}
                />
              ))}
            </div>
          )}
        </div>

        {/* Terminal/Details Panel */}
        <div className="xl:col-span-2">
          {selectedInstance ? (
            <PlaygroundFileManager
              instance={selectedInstance}
              stats={instanceStats[selectedInstance.id]}
            />
          ) : (
            <div className="bg-cyber-panel rounded-lg border border-cyber-neonCyan/30 p-8">
              <h3 className="text-xl font-medium text-gray-300 mb-2">Select a Playground Instance</h3>
              <p className="text-gray-400 mb-4">
                Choose an instance from the list to access its file manager and browse files
              </p>
              <div className="text-sm text-gray-500">
                💡 File manager features: Browse directories, edit files, upload/download, create new files and folders
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePlaygroundModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateInstance}
        />
      )}
    </div>
  )
} 