import React, { useState, useEffect } from 'react'
import { createWorkflow, updateWorkflow, getWorkflow } from '../api'
import { Workflow, PentestStep, AIModel } from '../types'
import WorkflowBuilder from '../components/WorkflowBuilder'

// Workflow templates with enhanced descriptions
const WORKFLOW_TEMPLATES = [
  {
    id: 'basic-recon',
    name: '🔍 Basic Reconnaissance',
    description: 'Essential information gathering and initial target assessment',
    category: 'Reconnaissance',
    difficulty: 'Beginner',
    estimatedTime: '15-30 minutes',
    icon: '🔍',
    color: 'from-blue-500 to-cyan-500',
    steps: [
      {
        id: 'domain-info',
        name: 'Domain Information Gathering',
        type: 'command' as const,
        description: 'Collect basic domain information using whois',
        command: 'whois {target_domain}',
        timeout_seconds: 30,
        inputs: { target_domain: 'example.com' }
      },
      {
        id: 'dns-enum',
        name: 'DNS Enumeration',
        type: 'command' as const,
        description: 'Enumerate DNS records and subdomains',
        command: 'nslookup {target_domain} && dig {target_domain} ANY',
        timeout_seconds: 60,
        inputs: { target_domain: 'example.com' }
      },
      {
        id: 'analyze-results',
        name: 'Analyze Reconnaissance Results',
        type: 'ai' as const,
        description: 'AI analysis of gathered reconnaissance data',
        prompt: 'Analyze the following reconnaissance data and identify potential security concerns:\n\nDomain Info: {domain-info.output}\nDNS Records: {dns-enum.output}\n\nProvide a summary of findings and potential attack vectors.',
        model: { provider: 'openai' as const, model: 'gpt-4o-mini' },
        inputs: {}
      }
    ]
  },
  {
    id: 'web-vulnerability-scan',
    name: '🌐 Web Vulnerability Assessment',
    description: 'Comprehensive web application security testing',
    category: 'Web Security',
    difficulty: 'Intermediate',
    estimatedTime: '45-60 minutes',
    icon: '🌐',
    color: 'from-green-500 to-emerald-500',
    steps: [
      {
        id: 'port-scan',
        name: 'Port Discovery',
        type: 'command' as const,
        description: 'Identify open ports and services',
        command: 'nmap -sS -sV -O {target_ip}',
        timeout_seconds: 120,
        inputs: { target_ip: '192.168.1.1' }
      },
      {
        id: 'web-tech-detection',
        name: 'Web Technology Detection',
        type: 'command' as const,
        description: 'Identify web technologies and frameworks',
        command: 'whatweb {target_url}',
        timeout_seconds: 60,
        inputs: { target_url: 'https://example.com' }
      },
      {
        id: 'directory-bruteforce',
        name: 'Directory Enumeration',
        type: 'command' as const,
        description: 'Discover hidden directories and files',
        command: 'gobuster dir -u {target_url} -w /usr/share/wordlists/dirb/common.txt',
        timeout_seconds: 300,
        inputs: { target_url: 'https://example.com' }
      },
      {
        id: 'vulnerability-assessment',
        name: 'AI Vulnerability Assessment',
        type: 'ai' as const,
        description: 'Analyze scan results for potential vulnerabilities',
        prompt: 'Based on the following scan results, identify potential vulnerabilities and security risks:\n\nPort Scan: {port-scan.output}\nWeb Technologies: {web-tech-detection.output}\nDirectories Found: {directory-bruteforce.output}\n\nProvide detailed vulnerability assessment with risk ratings and remediation suggestions.',
        model: { provider: 'openai' as const, model: 'gpt-4o-mini' },
        inputs: {}
      }
    ]
  },
  {
    id: 'network-security-audit',
    name: '🔒 Network Security Audit',
    description: 'Comprehensive network infrastructure security assessment',
    category: 'Network Security',
    difficulty: 'Advanced',
    estimatedTime: '60-90 minutes',
    icon: '🔒',
    color: 'from-purple-500 to-pink-500',
    steps: [
      {
        id: 'network-discovery',
        name: 'Network Discovery',
        type: 'command' as const,
        description: 'Discover live hosts on the network',
        command: 'nmap -sn {network_range}',
        timeout_seconds: 180,
        inputs: { network_range: '192.168.1.0/24' }
      },
      {
        id: 'service-enumeration',
        name: 'Service Enumeration',
        type: 'command' as const,
        description: 'Enumerate services on discovered hosts',
        command: 'nmap -sS -sV -sC {target_hosts}',
        timeout_seconds: 300,
        inputs: { target_hosts: '192.168.1.1-254' }
      },
      {
        id: 'vulnerability-scan',
        name: 'Vulnerability Scanning',
        type: 'command' as const,
        description: 'Scan for known vulnerabilities',
        command: 'nmap --script vuln {target_hosts}',
        timeout_seconds: 600,
        inputs: { target_hosts: '192.168.1.1-254' }
      },
      {
        id: 'security-assessment',
        name: 'Network Security Analysis',
        type: 'ai' as const,
        description: 'Comprehensive analysis of network security posture',
        prompt: 'Analyze the following network security scan results and provide a comprehensive security assessment:\n\nNetwork Discovery: {network-discovery.output}\nService Enumeration: {service-enumeration.output}\nVulnerability Scan: {vulnerability-scan.output}\n\nProvide:\n1. Executive summary of security posture\n2. Critical vulnerabilities found\n3. Risk assessment with CVSS scores\n4. Prioritized remediation roadmap',
        model: { provider: 'openai' as const, model: 'gpt-4o-mini' },
        inputs: {}
      }
    ]
  },
  {
    id: 'custom-workflow',
    name: '⚡ Custom Workflow',
    description: 'Start from scratch and build your own workflow',
    category: 'Custom',
    difficulty: 'Any Level',
    estimatedTime: 'Variable',
    icon: '⚡',
    color: 'from-yellow-500 to-orange-500',
    steps: []
  }
]

interface Props {
  workflowId?: string
  onBack?: () => void
  onSave?: () => void
}

export default function CreateWorkflowPage({ workflowId, onBack, onSave }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<typeof WORKFLOW_TEMPLATES[0] | null>(null)
  const [workflow, setWorkflow] = useState<Partial<Workflow>>({
    id: '',
    name: '',
    description: '',
    steps: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing workflow for editing
  useEffect(() => {
    if (workflowId) {
      const loadWorkflow = async () => {
        try {
          setIsLoading(true)
          const existingWorkflow = await getWorkflow(workflowId)
          setWorkflow(existingWorkflow)
          // Skip template selection when editing
          setCurrentStep(1)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load workflow')
        } finally {
          setIsLoading(false)
        }
      }
      loadWorkflow()
    }
  }, [workflowId])

  const steps = [
    { name: 'Template', icon: '📋', description: 'Choose a starting template' },
    { name: 'Details', icon: '✏️', description: 'Name and description' },
    { name: 'Build', icon: '🔧', description: 'Configure workflow steps' },
    { name: 'Review', icon: '👀', description: 'Review and save' }
  ]

  // Template selection step
  const TemplateSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-cyber-neonCyan mb-2">Choose Your Starting Point</h2>
        <p className="text-gray-400">Select a template to get started quickly, or build from scratch</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {WORKFLOW_TEMPLATES.map((template) => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(template)}
            className={`
              relative group cursor-pointer transition-all duration-300 transform hover:scale-105
              ${selectedTemplate?.id === template.id
                ? 'ring-2 ring-cyber-neonCyan shadow-neonCyan'
                : 'hover:shadow-lg hover:shadow-cyber-neonCyan/20'
              }
            `}
          >
            <div className="bg-cyber-panel border border-slate-800 rounded-xl p-6 h-full">
              {/* Template Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`text-3xl p-3 rounded-lg bg-gradient-to-br ${template.color} bg-opacity-20`}>
                  {template.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-200">{template.name}</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-slate-800 rounded text-gray-400">{template.category}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      template.difficulty === 'Beginner' ? 'bg-green-900 text-green-400' :
                      template.difficulty === 'Intermediate' ? 'bg-yellow-900 text-yellow-400' :
                      'bg-red-900 text-red-400'
                    }`}>
                      {template.difficulty}
                    </span>
                  </div>
                </div>
              </div>

              {/* Template Description */}
              <p className="text-sm text-gray-400 mb-4 line-clamp-3">{template.description}</p>

              {/* Template Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>⏱️ {template.estimatedTime}</span>
                <span>📝 {template.steps.length} steps</span>
              </div>

              {/* Selection Indicator */}
              {selectedTemplate?.id === template.id && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-cyber-neonCyan rounded-full flex items-center justify-center">
                    <span className="text-xs text-cyber-bg">✓</span>
                  </div>
                </div>
              )}

              {/* Hover Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyber-neonCyan/5 to-cyber-neonGreen/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Workflow details step
  const WorkflowDetails = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-cyber-neonCyan mb-2">Workflow Details</h2>
        <p className="text-gray-400">Give your workflow a name and description</p>
      </div>

      <div className="bg-cyber-panel border border-slate-800 rounded-xl p-6 space-y-6">
        {/* Selected Template Info */}
        {selectedTemplate && selectedTemplate.id !== 'custom-workflow' && (
          <div className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-lg">
            <div className={`text-2xl p-3 rounded-lg bg-gradient-to-br ${selectedTemplate.color} bg-opacity-20`}>
              {selectedTemplate.icon}
            </div>
            <div>
              <h4 className="font-medium text-gray-200">Based on: {selectedTemplate.name}</h4>
              <p className="text-sm text-gray-400">{selectedTemplate.description}</p>
            </div>
          </div>
        )}

        {/* Workflow Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Workflow Name *
          </label>
          <input
            type="text"
            value={workflow.name || ''}
            onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
            placeholder={selectedTemplate ? `My ${selectedTemplate.name}` : 'Enter workflow name'}
            className="w-full px-4 py-3 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:border-cyber-neonCyan focus:ring-1 focus:ring-cyber-neonCyan focus:outline-none transition-colors"
          />
        </div>

        {/* Workflow Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={workflow.description || ''}
            onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
            placeholder="Describe what this workflow does and when to use it..."
            rows={4}
            className="w-full px-4 py-3 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:border-cyber-neonGreen focus:ring-1 focus:ring-cyber-neonGreen focus:outline-none transition-colors resize-none"
          />
        </div>

        {/* Auto-fill suggestion */}
        {selectedTemplate && selectedTemplate.id !== 'custom-workflow' && !workflow.name && (
          <button
            onClick={() => setWorkflow({
              ...workflow,
              name: selectedTemplate.name,
              description: selectedTemplate.description
            })}
            className="w-full px-4 py-2 border border-cyber-neonYellow/30 bg-cyber-neonYellow/10 text-cyber-neonYellow rounded-lg hover:bg-cyber-neonYellow/20 transition-colors text-sm"
          >
            ✨ Use template defaults
          </button>
        )}
      </div>
    </div>
  )

  // Build workflow step
  const BuildWorkflow = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-cyber-neonCyan mb-2">Build Your Workflow</h2>
        <p className="text-gray-400">Configure the steps and flow of your workflow</p>
      </div>

      <WorkflowForm 
        workflow={workflow}
        onChange={setWorkflow}
        template={selectedTemplate}
      />
    </div>
  )

  // Review and save step
  const ReviewWorkflow = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-cyber-neonCyan mb-2">Review Your Workflow</h2>
        <p className="text-gray-400">Check everything looks good before saving</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Summary */}
        <div className="bg-cyber-panel border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-cyber-neonGreen mb-4">📋 Workflow Summary</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Name</label>
              <p className="text-gray-200 font-medium">{workflow.name || 'Untitled Workflow'}</p>
            </div>
            
            <div>
              <label className="text-sm text-gray-400">Description</label>
              <p className="text-gray-200">{workflow.description || 'No description provided'}</p>
            </div>
            
            <div>
              <label className="text-sm text-gray-400">Steps</label>
              <p className="text-gray-200">{workflow.steps?.length || 0} configured</p>
            </div>

            {selectedTemplate && selectedTemplate.id !== 'custom-workflow' && (
              <div>
                <label className="text-sm text-gray-400">Based on Template</label>
                <p className="text-gray-200">{selectedTemplate.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Steps Preview */}
        <div className="bg-cyber-panel border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-cyber-neonYellow mb-4">🔧 Workflow Steps</h3>
          
          <div className="space-y-3">
            {workflow.steps && workflow.steps.length > 0 ? (
              workflow.steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <div className="w-6 h-6 bg-cyber-neonCyan rounded-full flex items-center justify-center text-xs text-cyber-bg font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-200 font-medium">{step.name}</p>
                    <p className="text-xs text-gray-400">
                      {step.type === 'ai' ? '🤖 AI Step' : 
                       step.type === 'command' ? '💻 Command' : '📧 Report'}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    step.type === 'ai' ? 'bg-blue-900 text-blue-400' :
                    step.type === 'command' ? 'bg-green-900 text-green-400' :
                    'bg-purple-900 text-purple-400'
                  }`}>
                    {step.type}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No steps configured yet</p>
                <p className="text-sm">Go back to add workflow steps</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  // Handle next step
  const handleNext = () => {
    if (currentStep === 0 && !selectedTemplate) {
      setError('Please select a template to continue')
      return
    }
    
    if (currentStep === 1 && !workflow.name?.trim()) {
      setError('Please enter a workflow name')
      return
    }

    setError(null)
    
    if (currentStep === 1 && selectedTemplate) {
      // Auto-populate steps from template
      setWorkflow({
        ...workflow,
        steps: selectedTemplate.steps.map(step => ({
          ...step,
          id: `${step.id}-${Date.now()}`
        }))
      })
    }
    
    setCurrentStep(currentStep + 1)
  }

  // Handle save workflow
  const handleSave = async () => {
    if (!workflow.name?.trim()) {
      setError('Workflow name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const workflowData: Omit<Workflow, 'id' | 'created_at' | 'updated_at'> = {
        name: workflow.name,
        description: workflow.description || '',
        steps: workflow.steps || []
      }

      if (workflowId) {
        // Get the existing workflow to preserve created_at
        const existingWorkflow = await getWorkflow(workflowId)
        const fullWorkflow: Workflow = {
          ...workflowData,
          id: workflowId,
          created_at: existingWorkflow.created_at, // Preserve original created_at
          updated_at: new Date().toISOString()
        }
        await updateWorkflow(fullWorkflow)
      } else {
        await createWorkflow(workflowData)
      }
      
      // Call the onSave callback to notify parent component
      if (onSave) {
        onSave()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cyber-bg">
      {/* Header */}
      <div className="border-b border-slate-800 bg-cyber-panel/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                title="Back to Workflows"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyber-neonCyan to-cyber-neonGreen bg-clip-text text-transparent">
                  {workflowId ? 'Edit Workflow' : 'Create New Workflow'}
                </h1>
                <p className="text-gray-400">Build your AI-powered security automation</p>
              </div>
            </div>

            {/* Save Button */}
            {currentStep === steps.length - 1 && (
              <button
                onClick={handleSave}
                disabled={isLoading || !workflow.name?.trim()}
                className="px-6 py-2 bg-cyber-neonGreen text-cyber-bg rounded-lg font-medium hover:shadow-neonGreen transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    💾 Save Workflow
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading State for Edit Mode */}
      {workflowId && isLoading && !workflow.name ? (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-cyber-neonCyan border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-400">Loading workflow...</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Progress Steps */}
          <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Only show progress steps if not editing or skip template step */}
            {(!workflowId || currentStep > 0) && (
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center gap-4">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className={`
                        flex items-center gap-3 px-4 py-2 rounded-lg transition-all
                        ${index <= currentStep 
                          ? 'bg-cyber-neonCyan/20 border border-cyber-neonCyan text-cyber-neonCyan' 
                          : 'bg-slate-800/30 border border-slate-700 text-gray-500'
                        }
                      `}>
                        <span className="text-lg">{step.icon}</span>
                        <div className="text-left">
                          <div className="font-medium">{step.name}</div>
                          <div className="text-xs opacity-75">{step.description}</div>
                        </div>
                      </div>
                      {index < steps.length - 1 && (
                        <div className={`w-8 h-0.5 ${index < currentStep ? 'bg-cyber-neonCyan' : 'bg-slate-700'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="max-w-4xl mx-auto mb-6">
                <div className="p-4 border border-red-800 bg-red-900/20 rounded-lg text-red-400">
                  <div className="flex items-center gap-2">
                    <span>❌</span>
                    <span>{error}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step Content */}
            <div className="max-w-7xl mx-auto">
              {currentStep === 0 && <TemplateSelection />}
              {currentStep === 1 && <WorkflowDetails />}
              {currentStep === 2 && <BuildWorkflow />}
              {currentStep === 3 && <ReviewWorkflow />}
            </div>

            {/* Navigation */}
            <div className="flex justify-center mt-12">
              <div className="flex items-center gap-4">
                {currentStep > 0 && (
                  <button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-6 py-2 border border-slate-700 bg-cyber-panel/40 text-gray-300 rounded-lg hover:border-slate-600 hover:text-gray-100 transition-all"
                  >
                    ← Previous
                  </button>
                )}
                
                {currentStep < steps.length - 1 && (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-cyber-neonCyan text-cyber-bg rounded-lg font-medium hover:shadow-neonCyan transition-all"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Enhanced Workflow Form Component
interface WorkflowFormProps {
  workflow: Partial<Workflow>
  onChange: (workflow: Partial<Workflow>) => void
  template?: typeof WORKFLOW_TEMPLATES[0] | null
}

function WorkflowForm({ workflow, onChange, template }: WorkflowFormProps) {
  const [activeStep, setActiveStep] = useState<string | null>(null)

  const addStep = (type: 'ai' | 'command' | 'report') => {
    const newStep: PentestStep = {
      id: `step-${Date.now()}`,
      name: `New ${type} Step`,
      type,
      description: '',
      inputs: {},
      ...(type === 'ai' && {
        prompt: '',
        model: { provider: 'openai', model: 'gpt-4o-mini' }
      }),
      ...(type === 'command' && {
        command: '',
        timeout_seconds: 60
      })
    }

    onChange({
      ...workflow,
      steps: [...(workflow.steps || []), newStep]
    })
    setActiveStep(newStep.id)
  }

  const updateStep = (stepId: string, updates: Partial<PentestStep>) => {
    const updatedSteps = (workflow.steps || []).map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    )
    onChange({ ...workflow, steps: updatedSteps })
  }

  const removeStep = (stepId: string) => {
    const updatedSteps = (workflow.steps || []).filter(step => step.id !== stepId)
    onChange({ ...workflow, steps: updatedSteps })
    if (activeStep === stepId) {
      setActiveStep(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Step Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => addStep('ai')}
          className="px-4 py-2 bg-blue-900/30 border border-blue-800 text-blue-400 rounded-lg hover:bg-blue-900/50 transition-all flex items-center gap-2"
        >
          🤖 Add AI Step
        </button>
        <button
          onClick={() => addStep('command')}
          className="px-4 py-2 bg-green-900/30 border border-green-800 text-green-400 rounded-lg hover:bg-green-900/50 transition-all flex items-center gap-2"
        >
          💻 Add Command Step
        </button>
        <button
          onClick={() => addStep('report')}
          className="px-4 py-2 bg-purple-900/30 border border-purple-800 text-purple-400 rounded-lg hover:bg-purple-900/50 transition-all flex items-center gap-2"
        >
          📧 Add Report Step
        </button>
      </div>

      {/* Steps List */}
      <div className="space-y-4">
        {workflow.steps && workflow.steps.length > 0 ? (
          workflow.steps.map((step, index) => (
            <StepEditor
              key={step.id}
              step={step}
              index={index}
              isActive={activeStep === step.id}
              onToggle={() => setActiveStep(activeStep === step.id ? null : step.id)}
              onUpdate={(updates) => updateStep(step.id, updates)}
              onRemove={() => removeStep(step.id)}
            />
          ))
        ) : (
          <div className="text-center py-12 border border-slate-800 rounded-lg bg-cyber-panel/20">
            <div className="text-4xl mb-4 opacity-50">⚙️</div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Steps Yet</h3>
            <p className="text-gray-400 mb-4">Add your first step to start building your workflow</p>
            {template && template.steps.length > 0 && (
              <button
                onClick={() => onChange({
                  ...workflow,
                  steps: template.steps.map(step => ({
                    ...step,
                    id: `${step.id}-${Date.now()}`
                  }))
                })}
                className="px-4 py-2 border border-cyber-neonYellow/30 bg-cyber-neonYellow/10 text-cyber-neonYellow rounded-lg hover:bg-cyber-neonYellow/20 transition-colors"
              >
                ✨ Use Template Steps ({template.steps.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Workflow Visualization */}
      {workflow.steps && workflow.steps.length > 0 && (
        <div className="bg-cyber-panel border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-cyber-neonCyan mb-4">🔄 Workflow Flow</h3>
          <WorkflowBuilder value={workflow as Workflow} onChange={() => {}} />
        </div>
      )}
    </div>
  )
}

// Step Editor Component
interface StepEditorProps {
  step: PentestStep
  index: number
  isActive: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<PentestStep>) => void
  onRemove: () => void
}

function StepEditor({ step, index, isActive, onToggle, onUpdate, onRemove }: StepEditorProps) {
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'ai': return '🤖'
      case 'command': return '💻'
      case 'report': return '📧'
      default: return '⚙️'
    }
  }

  const getStepColor = (type: string) => {
    switch (type) {
      case 'ai': return 'border-blue-800 bg-blue-900/20'
      case 'command': return 'border-green-800 bg-green-900/20'
      case 'report': return 'border-purple-800 bg-purple-900/20'
      default: return 'border-slate-800 bg-slate-900/20'
    }
  }

  return (
    <div className={`border rounded-xl transition-all ${getStepColor(step.type)} ${
      isActive ? 'shadow-lg shadow-cyber-neonCyan/20' : ''
    }`}>
      {/* Step Header */}
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer hover:bg-cyber-panel/30 transition-colors rounded-t-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-cyber-neonCyan rounded-full flex items-center justify-center text-cyber-bg font-bold text-sm">
              {index + 1}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">{getStepIcon(step.type)}</span>
              <div>
                <h4 className="font-medium text-gray-200">{step.name}</h4>
                <p className="text-sm text-gray-400">{step.type} step</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="p-1 text-red-400 hover:text-red-300 transition-colors"
              title="Remove step"
            >
              🗑️
            </button>
            <span className="text-gray-400">
              {isActive ? '⌄' : '⌃'}
            </span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      {isActive && (
        <div className="p-4 border-t border-slate-700 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Step Name</label>
              <input
                type="text"
                value={step.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 focus:border-cyber-neonCyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <input
                type="text"
                value={step.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Optional description"
                className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 focus:border-cyber-neonGreen focus:outline-none"
              />
            </div>
          </div>

          {/* Step-specific fields */}
          {step.type === 'ai' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">AI Prompt</label>
                <textarea
                  value={step.prompt || ''}
                  onChange={(e) => onUpdate({ prompt: e.target.value })}
                  placeholder="Enter the prompt for the AI model..."
                  rows={4}
                  className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 focus:border-cyber-neonCyan focus:outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Model Provider</label>
                  <select
                    value={step.model?.provider || 'openai'}
                    onChange={(e) => onUpdate({ 
                      model: { 
                        provider: e.target.value as 'openai',
                        model: step.model?.model || 'gpt-4o-mini'
                      } 
                    })}
                    className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 focus:border-cyber-neonCyan focus:outline-none"
                  >
                    <option value="openai">OpenAI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                  <select
                    value={step.model?.model || 'gpt-4o-mini'}
                    onChange={(e) => onUpdate({ 
                      model: { 
                        provider: step.model?.provider as 'openai' || 'openai', 
                        model: e.target.value 
                      } 
                    })}
                    className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 focus:border-cyber-neonCyan focus:outline-none"
                  >
                    <option value="gpt-4o-mini">GPT-4O Mini</option>
                    <option value="gpt-4o">GPT-4O</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step.type === 'command' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Command</label>
                <textarea
                  value={step.command || ''}
                  onChange={(e) => onUpdate({ command: e.target.value })}
                  placeholder="Enter the command to execute..."
                  rows={3}
                  className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 font-mono text-sm focus:border-cyber-neonGreen focus:outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Timeout (seconds)</label>
                  <input
                    type="number"
                    value={step.timeout_seconds || 60}
                    onChange={(e) => onUpdate({ timeout_seconds: parseInt(e.target.value) || 60 })}
                    min="1"
                    max="3600"
                    className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 focus:border-cyber-neonGreen focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Working Directory</label>
                  <input
                    type="text"
                    value={step.working_dir || ''}
                    onChange={(e) => onUpdate({ working_dir: e.target.value })}
                    placeholder="/tmp"
                    className="w-full px-3 py-2 bg-cyber-panel/60 border border-slate-700 rounded-lg text-gray-100 focus:border-cyber-neonGreen focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 