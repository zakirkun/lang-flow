import React, { useState, useEffect, useRef } from 'react'

interface StreamingResponseProps {
  isStreaming: boolean
  content: string
  onContentUpdate?: (content: string) => void
  placeholder?: string
  className?: string
}

export default function StreamingResponse({ 
  isStreaming, 
  content, 
  onContentUpdate, 
  placeholder = "Waiting for response...",
  className = ""
}: StreamingResponseProps) {
  const [displayContent, setDisplayContent] = useState(content)
  const [cursorVisible, setCursorVisible] = useState(true)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Update display content when content changes
  useEffect(() => {
    setDisplayContent(content)
  }, [content])

  // Blinking cursor effect
  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      setCursorVisible(prev => !prev)
    }, 500)

    return () => clearInterval(interval)
  }, [isStreaming])

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [displayContent])

  // Handle content updates
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setDisplayContent(newContent)
    if (onContentUpdate) {
      onContentUpdate(newContent)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Response Stream</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-cyber-neonYellow bg-cyber-neonYellow/10 px-2 py-1 rounded-full border border-cyber-neonYellow/30">
              <div className="w-2 h-2 bg-cyber-neonYellow rounded-full animate-pulse"></div>
              Streaming
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {isStreaming && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-cyber-neonYellow rounded-full animate-pulse"></div>
              Live
            </span>
          )}
        </div>
      </div>

      {/* Content Container */}
      <div className="relative">
        <div
          ref={containerRef}
          className="min-h-[200px] max-h-[400px] overflow-auto bg-cyber-panel/40 border border-slate-700 rounded-lg p-4"
        >
          {displayContent ? (
            <div className="space-y-2">
              {displayContent.split('\n').map((line, index) => (
                <div key={index} className="text-sm font-mono text-gray-300">
                  {line || '\u00A0'} {/* Non-breaking space for empty lines */}
                </div>
              ))}
              {isStreaming && (
                <span 
                  ref={cursorRef}
                  className={`inline-block w-2 h-5 bg-cyber-neonYellow transition-opacity duration-200 ${
                    cursorVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 opacity-50">📡</div>
              <div className="text-gray-400 mb-2">
                {isStreaming ? 'Receiving response...' : 'No response yet'}
              </div>
              <div className="text-sm text-gray-500">
                {isStreaming ? 'Streaming in progress...' : placeholder}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Lines: {displayContent ? displayContent.split('\n').length : 0}</span>
          <span>Chars: {displayContent.length}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight
              }
            }}
            className="px-3 py-1 text-xs rounded border border-slate-600 bg-cyber-panel/40 text-gray-400 hover:border-slate-500 hover:text-gray-300 transition-all"
            title="Scroll to bottom"
          >
            ⬇️ Bottom
          </button>
          
          <button
            onClick={() => {
              setDisplayContent('')
              if (onContentUpdate) {
                onContentUpdate('')
              }
            }}
            className="px-3 py-1 text-xs rounded border border-slate-600 bg-cyber-panel/40 text-gray-400 hover:border-slate-500 hover:text-gray-300 transition-all"
            title="Clear content"
          >
            🗑️ Clear
          </button>
        </div>
      </div>
    </div>
  )
} 