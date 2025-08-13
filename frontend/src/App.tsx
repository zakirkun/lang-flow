import React, { useState } from 'react'
import WorkflowList from './components/WorkflowList'
import WorkflowForm from './components/WorkflowForm'
import WorkflowDetail from './components/WorkflowDetail'
import Terminal from './components/Terminal'
import Dashboard from './components/Dashboard'
import ScanPage from './pages/ScanPage'
import PlaygroundPage from './pages/PlaygroundPage'
import CreateWorkflowPage from './pages/CreateWorkflowPage'
import { Workflow } from './types'

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'workflows' | 'create' | 'scan' | 'terminal' | 'dashboard' | 'playground'>('home')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>(undefined)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [viewingWorkflow, setViewingWorkflow] = useState<Workflow | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRunNavigate = (workflowId: string) => {
    setSelectedWorkflowId(workflowId)
    setActiveTab('scan')
  }

  const handleCreateWorkflow = () => {
    setEditingWorkflow(null)
    setViewingWorkflow(null)
    setActiveTab('create')
  }

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setViewingWorkflow(null)
    setActiveTab('create')
  }

  const handleViewWorkflow = (workflow: Workflow) => {
    console.log('Viewing workflow:', workflow)
    setViewingWorkflow(workflow)
    setEditingWorkflow(null)
    // Stay on workflows tab but show detail view
  }

  const handleBackToWorkflows = () => {
    setViewingWorkflow(null)
    setEditingWorkflow(null)
    setActiveTab('workflows')
  }

  const handleWorkflowSaved = () => {
    setEditingWorkflow(null)
    setViewingWorkflow(null)
    setRefreshKey(prev => prev + 1) // Force refresh
    setActiveTab('workflows')
  }

  const handleWorkflowDeleted = () => {
    setRefreshKey(prev => prev + 1) // Force refresh
    setViewingWorkflow(null)
  }

  const tabs = [
    { id: 'home', label: '🏠 Home', icon: '🏠' },
    { id: 'workflows', label: '⚡ Workflows', icon: '🔧' },
    { id: 'create', label: '✨ Create', icon: '✨' },
    { id: 'scan', label: '🔍 Scan', icon: '🎯' },
    { id: 'terminal', label: '💻 Terminal', icon: '⌨️' },
    { id: 'playground', label: '🐳 Playground', icon: '🎮' },
    { id: 'dashboard', label: '📊 Dashboard', icon: '📈' }
  ] as const

  // Enhanced Home Page
  const HomePage = () => (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="text-8xl animate-pulse">🚀</div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyber-neonCyan via-cyber-neonGreen to-cyber-neonPink bg-clip-text text-transparent">
            LangFlow
          </h1>
          <p className="text-xl text-gray-300 mb-2">AI-Powered Security Automation Platform</p>
          <p className="text-lg text-gray-400 mb-8">
            Build, execute, and monitor sophisticated penetration testing workflows with AI assistance
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={handleCreateWorkflow}
              className="px-8 py-3 bg-cyber-neonGreen text-cyber-bg rounded-lg font-semibold hover:shadow-neonGreen transition-all transform hover:scale-105 flex items-center gap-2"
            >
              ✨ Create Workflow
            </button>
            <button
              onClick={() => setActiveTab('workflows')}
              className="px-8 py-3 border border-cyber-neonCyan bg-cyber-neonCyan/10 text-cyber-neonCyan rounded-lg font-semibold hover:shadow-neonCyan transition-all transform hover:scale-105 flex items-center gap-2"
            >
              ⚡ Browse Workflows
            </button>
            <button
              onClick={() => setActiveTab('playground')}
              className="px-8 py-3 border border-cyber-neonYellow bg-cyber-neonYellow/10 text-cyber-neonYellow rounded-lg font-semibold hover:shadow-neonYellow transition-all transform hover:scale-105 flex items-center gap-2"
            >
              🐳 Virtual Lab
            </button>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            icon: '🤖',
            title: 'AI-Powered Analysis',
            description: 'Leverage advanced AI models to analyze scan results, identify vulnerabilities, and generate actionable insights.',
            color: 'from-blue-500 to-cyan-500',
            action: () => setActiveTab('create')
          },
          {
            icon: '⚡',
            title: 'Automated Workflows',
            description: 'Create sophisticated automation workflows combining command execution, AI analysis, and reporting.',
            color: 'from-green-500 to-emerald-500',
            action: () => setActiveTab('workflows')
          },
          {
            icon: '🐳',
            title: 'Virtual Playground',
            description: 'Isolated Docker-in-Docker environments for safe testing and experimentation with security tools.',
            color: 'from-purple-500 to-pink-500',
            action: () => setActiveTab('playground')
          },
          {
            icon: '💻',
            title: 'Interactive Terminal',
            description: 'Full-featured web terminal with command history, auto-completion, and real-time execution.',
            color: 'from-yellow-500 to-orange-500',
            action: () => setActiveTab('terminal')
          },
          {
            icon: '📊',
            title: 'Analytics Dashboard',
            description: 'Comprehensive monitoring and visualization of scan results, trends, and security metrics.',
            color: 'from-red-500 to-pink-500',
            action: () => setActiveTab('dashboard')
          },
          {
            icon: '🔍',
            title: 'Real-time Scanning',
            description: 'Execute workflows with live log streaming, progress tracking, and instant feedback.',
            color: 'from-indigo-500 to-purple-500',
            action: () => {
              // Check if there are any workflows to run
              setActiveTab('workflows') // Navigate to workflows to select one to run
            }
          }
        ].map((feature, index) => (
          <div
            key={index}
            onClick={feature.action}
            className="group bg-cyber-panel border border-slate-800 rounded-xl p-6 cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-cyber-neonCyan/20"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`text-3xl p-3 rounded-lg bg-gradient-to-br ${feature.color} bg-opacity-20 group-hover:scale-110 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-200 group-hover:text-cyber-neonCyan transition-colors">
                {feature.title}
              </h3>
            </div>
            <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
              {feature.description}
            </p>
            <div className="mt-4 flex items-center text-cyber-neonCyan opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-sm font-medium">Explore →</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="bg-cyber-panel border border-slate-800 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-cyber-neonCyan mb-6">🎯 Quick Start Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: '🔍 Basic Reconnaissance',
              description: 'Essential information gathering workflow',
              difficulty: 'Beginner',
              time: '15-30 min'
            },
            {
              name: '🌐 Web Vulnerability Scan',
              description: 'Comprehensive web application testing',
              difficulty: 'Intermediate', 
              time: '45-60 min'
            },
            {
              name: '🔒 Network Security Audit',
              description: 'Advanced network infrastructure assessment',
              difficulty: 'Advanced',
              time: '60-90 min'
            }
          ].map((template, index) => (
            <div
              key={index}
              onClick={handleCreateWorkflow}
              className="border border-slate-700 rounded-lg p-4 cursor-pointer hover:border-cyber-neonCyan hover:bg-cyber-panel/50 transition-all"
            >
              <h4 className="font-medium text-gray-200 mb-2">{template.name}</h4>
              <p className="text-sm text-gray-400 mb-3">{template.description}</p>
              <div className="flex items-center justify-between text-xs">
                <span className={`px-2 py-1 rounded ${
                  template.difficulty === 'Beginner' ? 'bg-green-900 text-green-400' :
                  template.difficulty === 'Intermediate' ? 'bg-yellow-900 text-yellow-400' :
                  'bg-red-900 text-red-400'
                }`}>
                  {template.difficulty}
                </span>
                <span className="text-gray-500">⏱️ {template.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cyber-bg text-gray-100 font-mono">
      {/* Header */}
      <div className="border-b border-slate-800 bg-cyber-panel/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl animate-pulse">🚀</div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyber-neonCyan via-cyber-neonGreen to-cyber-neonPink bg-clip-text text-transparent">
                  LangFlow
                </h1>
                <p className="text-sm text-gray-400">AI-Powered Security Automation</p>
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <nav className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-4 py-2 rounded-lg border transition-all duration-200 text-sm font-medium
                    flex items-center gap-2 min-w-fit
                    ${activeTab === tab.id
                      ? 'border-cyber-neonCyan bg-cyber-neonCyan/10 text-cyber-neonCyan shadow-neonCyan'
                      : 'border-slate-700 bg-cyber-panel/40 text-gray-300 hover:border-cyber-neonCyan/50 hover:text-cyber-neonCyan hover:shadow-neonCyan/30'
                    }
                  `}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label.split(' ')[1]}</span>
                  <span className="sm:hidden">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'home' && <HomePage />}

        {activeTab === 'workflows' && (
          <div className="space-y-6">
            {viewingWorkflow ? (
              // Show workflow detail view
              <WorkflowDetail 
                workflow={viewingWorkflow} 
                onBack={() => setViewingWorkflow(null)}
              />
            ) : (
              // Show workflow list
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <h2 className="text-2xl font-semibold text-cyber-neonCyan">Workflow Manager</h2>
                      <p className="text-gray-400">Manage your automation workflows</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateWorkflow}
                    className="px-6 py-2 bg-cyber-neonGreen text-cyber-bg rounded-lg font-medium hover:shadow-neonGreen transition-all flex items-center gap-2"
                  >
                    ✨ New Workflow
                  </button>
                </div>
                <WorkflowList 
                  key={refreshKey} // Force re-render when workflows change
                  onRun={handleRunNavigate}
                  onCreate={handleCreateWorkflow}
                  onEdit={handleEditWorkflow}
                  onView={handleViewWorkflow}
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✨</span>
                <div>
                  <h2 className="text-2xl font-semibold text-cyber-neonGreen">
                    {editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
                  </h2>
                  <p className="text-gray-400">
                    {editingWorkflow ? 'Modify your existing workflow' : 'Build your AI-powered security automation'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('workflows')}
                className="px-4 py-2 border border-slate-700 bg-cyber-panel/40 text-gray-300 rounded-lg hover:border-slate-600 hover:text-gray-100 transition-all"
              >
                ← Back to Workflows
              </button>
            </div>
            <CreateWorkflowPage
              workflowId={editingWorkflow?.id}
              onBack={() => setActiveTab('workflows')}
              onSave={handleWorkflowSaved}
            />
          </div>
        )}

        {activeTab === 'scan' && (
          <ScanPage workflowId={selectedWorkflowId} />
        )}

        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 border border-slate-800 rounded-lg bg-cyber-panel/20">
              <span className="text-2xl">💻</span>
              <div>
                <h2 className="text-xl font-semibold text-cyber-neonYellow">Interactive Terminal</h2>
                <p className="text-sm text-gray-400">Execute commands in real-time</p>
              </div>
            </div>
            <Terminal />
          </div>
        )}

        {activeTab === 'playground' && (
          <PlaygroundPage />
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 border border-slate-800 rounded-lg bg-cyber-panel/20">
              <span className="text-2xl">📊</span>
              <div>
                <h2 className="text-xl font-semibold text-cyber-neonPink">Analytics Dashboard</h2>
                <p className="text-sm text-gray-400">Monitor your scanning activities</p>
              </div>
            </div>
            <Dashboard />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 bg-cyber-panel/20 backdrop-blur mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span>🚀</span>
              <span>LangFlow v1.0.0 - AI-Powered Security Automation</span>
            </div>
            <div className="flex items-center gap-4">
              <span>🔒 Secure</span>
              <span>⚡ Fast</span>
              <span>🤖 AI-Powered</span>
              <span>🐳 Containerized</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App 