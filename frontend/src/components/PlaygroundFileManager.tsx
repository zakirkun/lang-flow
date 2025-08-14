import React, { useEffect, useRef, useState, useCallback } from 'react'
import { PlaygroundInstance, PlaygroundStats } from '../types'
import { 
  listPlaygroundFiles, 
  uploadPlaygroundFile, 
  downloadPlaygroundFile, 
  deletePlaygroundFile, 
  createPlaygroundDirectory 
} from '../api'

interface Props {
  instance: PlaygroundInstance
  stats?: PlaygroundStats
}

interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: string
  permissions?: string
  modified?: string
}

export default function PlaygroundFileManager({ instance, stats }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [currentPath, setCurrentPath] = useState('/playground')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState<'file' | 'directory'>('file')
  const [createName, setCreateName] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Load files when component mounts or path changes
  useEffect(() => {
    loadFiles()
  }, [currentPath, instance.id])

  const loadFiles = async () => {
    if (instance.status !== 'running') {
      setError('Instance is not running')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const result = await listPlaygroundFiles(instance.id, currentPath)
      const parsedFiles = parseFileList(result.files)
      setFiles(parsedFiles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  const parseFileList = (fileLines: string[]): FileItem[] => {
    const items: FileItem[] = []
    
    // Skip the first line (total) and parse each file line
    for (const line of fileLines.slice(1)) {
      if (!line.trim()) continue
      
      const parts = line.trim().split(/\s+/)
      if (parts.length < 9) continue
      
      const permissions = parts[0]
      const size = parts[4]
      const name = parts.slice(8).join(' ')
      
      // Skip . and .. entries
      if (name === '.' || name === '..') continue
      
      const type = permissions.startsWith('d') ? 'directory' : 'file'
      
      items.push({
        name,
        type,
        size: type === 'file' ? formatFileSize(parseInt(size) || 0) : '',
        permissions,
        modified: `${parts[5]} ${parts[6]} ${parts[7]}`
      })
    }
    
    // Sort: directories first, then files, alphabetically
    return items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const navigateToPath = (path: string) => {
    setCurrentPath(path)
    setSelectedFile(null)
    setFileContent('')
    setIsEditing(false)
  }

  const navigateUp = () => {
    if (currentPath === '/') return
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    navigateToPath(parentPath)
  }

  const handleFileClick = async (file: FileItem) => {
    if (file.type === 'directory') {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
      navigateToPath(newPath)
    } else {
      // Load file content for viewing/editing
      setSelectedFile(file.name)
      setLoading(true)
      try {
        const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
        const content = await downloadPlaygroundFile(instance.id, filePath)
        setFileContent(content)
        setIsEditing(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
        setFileContent('')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSaveFile = async () => {
    if (!selectedFile) return
    
    try {
      const filePath = currentPath === '/' ? `/${selectedFile}` : `${currentPath}/${selectedFile}`
      await uploadPlaygroundFile(instance.id, filePath, fileContent)
      setIsEditing(false)
      setError(null)
      // Show success message
      setTimeout(() => setError(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file')
    }
  }

  const handleDeleteFile = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return
    
    try {
      const filePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`
      await deletePlaygroundFile(instance.id, filePath)
      loadFiles() // Refresh file list
      if (selectedFile === fileName) {
        setSelectedFile(null)
        setFileContent('')
        setIsEditing(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }

  const handleCreateItem = async () => {
    if (!createName.trim()) return
    
    try {
      const itemPath = currentPath === '/' ? `/${createName}` : `${currentPath}/${createName}`
      
      if (createType === 'directory') {
        await createPlaygroundDirectory(instance.id, itemPath)
      } else {
        await uploadPlaygroundFile(instance.id, itemPath, '')
      }
      
      setShowCreateModal(false)
      setCreateName('')
      loadFiles() // Refresh file list
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to create ${createType}`)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
        await uploadPlaygroundFile(instance.id, filePath, content)
        loadFiles() // Refresh file list
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload file')
      }
    }
    reader.readAsText(file)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const breadcrumbs = currentPath.split('/').filter(Boolean)

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-cyber-dark' : ''}`}>
      {/* File Manager Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyber-dark via-cyber-darker to-cyber-dark border-b border-cyber-neonCyan/30">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${instance.status === 'running' ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
            <span className="text-cyber-neonCyan font-mono text-sm">
              📁 File Manager
            </span>
          </div>
          
          {stats && (
            <div className="text-xs text-cyber-lightGray space-x-4">
              <span>CPU: {stats.cpu_usage}%</span>
              <span>Memory: {stats.memory_usage}%</span>
              <span>Containers: {stats.containers_count}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-2 py-1 text-xs bg-cyber-dark border border-cyber-neonCyan/50 rounded text-cyber-lightGray focus:border-cyber-neonCyan focus:outline-none"
          />
          
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 text-xs rounded border border-cyber-neonGreen/50 bg-cyber-neonGreen/10 text-cyber-neonGreen hover:bg-cyber-neonGreen/20 transition-all"
            title="Upload File"
          >
            📤 Upload
          </button>
          
          {/* Create Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-2 py-1 text-xs rounded border border-cyber-neonBlue/50 bg-cyber-neonBlue/10 text-cyber-neonBlue hover:bg-cyber-neonBlue/20 transition-all"
            title="Create File/Directory"
          >
            ➕ Create
          </button>
          
          {/* Refresh Button */}
          <button
            onClick={loadFiles}
            className="px-2 py-1 text-xs rounded border border-cyber-neonYellow/50 bg-cyber-neonYellow/10 text-cyber-neonYellow hover:bg-cyber-neonYellow/20 transition-all"
            title="Refresh"
          >
            🔄 Refresh
          </button>
          
          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-2 py-1 text-xs rounded border border-cyber-neonCyan/50 bg-cyber-neonCyan/10 text-cyber-neonCyan hover:bg-cyber-neonCyan/20 transition-all"
            title="Fullscreen (F11)"
          >
            {isFullscreen ? '🗗' : '🗖'}
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center p-2 bg-cyber-darker border-b border-cyber-neonCyan/20">
        <button
          onClick={() => navigateToPath('/playground')}
          className="px-2 py-1 text-xs rounded bg-cyber-neonCyan/10 text-cyber-neonCyan hover:bg-cyber-neonCyan/20 transition-all mr-2"
        >
          🏠 Home
        </button>
        
        {currentPath !== '/playground' && (
          <button
            onClick={navigateUp}
            className="px-2 py-1 text-xs rounded bg-cyber-neonYellow/10 text-cyber-neonYellow hover:bg-cyber-neonYellow/20 transition-all mr-2"
          >
            ⬆️ Up
          </button>
        )}
        
        <div className="flex items-center text-xs text-gray-400">
          <span>/</span>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <button
                onClick={() => navigateToPath('/' + breadcrumbs.slice(0, index + 1).join('/'))}
                className="hover:text-cyber-neonCyan transition-colors px-1"
              >
                {crumb}
              </button>
              {index < breadcrumbs.length - 1 && <span>/</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900/20 border-b border-red-500/30">
          <div className="text-red-400 text-sm font-mono">
            <span>❌ {error}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* File List Panel */}
        <div className="w-1/2 border-r border-cyber-neonCyan/30 flex flex-col">
          <div className="flex-1 overflow-auto bg-cyber-dark">
            {loading ? (
              <div className="p-4 text-center text-cyber-lightGray">
                <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-cyber-neonCyan rounded-full"></div>
                <div className="mt-2">Loading files...</div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-4 text-center text-cyber-lightGray">
                {searchTerm ? 'No files match your search' : 'No files found'}
              </div>
            ) : (
              <div className="divide-y divide-cyber-neonCyan/10">
                {filteredFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 hover:bg-cyber-darker/50 cursor-pointer transition-colors ${
                      selectedFile === file.name ? 'bg-cyber-neonCyan/10 border-l-2 border-cyber-neonCyan' : ''
                    }`}
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-lg">
                        {file.type === 'directory' ? '📁' : '📄'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-cyber-lightGray truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {file.type === 'file' && file.size} {file.modified}
                        </div>
                      </div>
                    </div>
                    
                    {file.type === 'file' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFile(file.name)
                        }}
                        className="px-2 py-1 text-xs rounded border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                        title="Delete File"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* File Content Panel */}
        <div className="w-1/2 flex flex-col">
          {selectedFile ? (
            <>
              {/* File Header */}
              <div className="flex items-center justify-between p-3 bg-cyber-darker border-b border-cyber-neonCyan/30">
                <div className="flex items-center space-x-2">
                  <span className="text-cyber-neonCyan font-mono text-sm">
                    📄 {selectedFile}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveFile}
                        className="px-2 py-1 text-xs rounded border border-cyber-neonGreen/50 bg-cyber-neonGreen/10 text-cyber-neonGreen hover:bg-cyber-neonGreen/20 transition-all"
                      >
                        💾 Save
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-2 py-1 text-xs rounded border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        ❌ Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-2 py-1 text-xs rounded border border-cyber-neonBlue/50 bg-cyber-neonBlue/10 text-cyber-neonBlue hover:bg-cyber-neonBlue/20 transition-all"
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>

              {/* File Content */}
              <div className="flex-1 p-3 bg-cyber-dark overflow-auto">
                {isEditing ? (
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    className="w-full h-full bg-cyber-darker border border-cyber-neonCyan/30 rounded text-cyber-lightGray font-mono text-sm p-3 focus:border-cyber-neonCyan focus:outline-none resize-none"
                    style={{ minHeight: '400px' }}
                  />
                ) : (
                  <pre className="text-cyber-lightGray font-mono text-sm whitespace-pre-wrap">
                    {fileContent || 'Loading...'}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-cyber-dark">
              <div className="text-center text-cyber-lightGray">
                <div className="text-4xl mb-4">📄</div>
                <div className="text-lg font-medium">Select a file to view</div>
                <div className="text-sm text-gray-500 mt-2">
                  Click on a file from the left panel to view its content
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-cyber-darker border-t border-cyber-neonCyan/30 text-xs text-cyber-lightGray">
        <div className="flex items-center space-x-4">
          <span>Instance: {instance.name}</span>
          <span>Status: {instance.status}</span>
          <span>Path: {currentPath}</span>
          <span>Files: {files.length}</span>
        </div>
        <div>
          <span>File Manager - Browse, Edit, Upload & Download Files</span>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        multiple={false}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cyber-panel border border-cyber-neonCyan/50 rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-cyber-neonCyan mb-4">
              Create New {createType === 'file' ? 'File' : 'Directory'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-cyber-lightGray mb-2">Type:</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="file"
                      checked={createType === 'file'}
                      onChange={(e) => setCreateType(e.target.value as 'file' | 'directory')}
                      className="mr-2"
                    />
                    <span className="text-cyber-lightGray">📄 File</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="directory"
                      checked={createType === 'directory'}
                      onChange={(e) => setCreateType(e.target.value as 'file' | 'directory')}
                      className="mr-2"
                    />
                    <span className="text-cyber-lightGray">📁 Directory</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-cyber-lightGray mb-2">Name:</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 bg-cyber-dark border border-cyber-neonCyan/50 rounded text-cyber-lightGray focus:border-cyber-neonCyan focus:outline-none"
                  placeholder={`Enter ${createType} name...`}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateName('')
                }}
                className="px-4 py-2 text-sm rounded border border-gray-500 text-gray-400 hover:bg-gray-500/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateItem}
                disabled={!createName.trim()}
                className="px-4 py-2 text-sm rounded border border-cyber-neonGreen/50 bg-cyber-neonGreen/10 text-cyber-neonGreen hover:bg-cyber-neonGreen/20 transition-all disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 