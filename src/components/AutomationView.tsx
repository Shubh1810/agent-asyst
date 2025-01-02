import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { motion } from 'framer-motion'
import { CardSpotlight } from '../ui/card-spotlight'
import cursorLogo from '../assets/cursor-logo.png'

interface AutomationViewProps {
  onClose: () => void
}

interface AutomationAction {
  id: string
  title: string
  description: string
  icon: string | JSX.Element
  action: () => Promise<void>
  isEnabled?: boolean
  shortcut?: string
  keywords?: string[]
}

export function AutomationView({ onClose }: AutomationViewProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Helper function to handle automation actions
  const handleAction = async (action: () => Promise<void>) => {
    setIsLoading(true)
    try {
      await action()
    } catch (error) {
      console.error('Automation action failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Define automation actions
  const automationActions: AutomationAction[] = [
    {
      id: 'cursor',
      title: 'Open Cursor',
      description: 'Launch Cursor code editor',
      icon: <img src={cursorLogo} alt="Cursor" className="w-8 h-8" />,
      action: async () => {
        await invoke('automate_mac', { 
          action: 'open_app', 
          params: 'Cursor' 
        })
        await invoke('set_window_visible', { visible: false })
      },
      shortcut: '⌘ + Space',
      keywords: ['cursor', 'code', 'editor', 'ide']
    },
    {
      id: 'screenshot',
      title: 'Take Screenshot',
      description: 'Capture screen area',
      icon: '📸',
      action: async () => {
        await invoke('automate_mac', { 
          action: 'screenshot',
          params: 'selection'
        })
      },
      shortcut: '⌘ + Shift + 4',
      keywords: ['screenshot', 'capture', 'screen', 'image']
    },
    {
      id: 'clipboard',
      title: 'Smart Clipboard',
      description: 'AI-powered clipboard manager',
      icon: '📋',
      action: async () => {
        await invoke('automate_mac', {
          action: 'clipboard_manager',
          params: 'toggle'
        })
      },
      shortcut: '⌘ + Shift + V',
      keywords: ['clipboard', 'copy', 'paste', 'manager']
    },
    {
      id: 'dictation',
      title: 'Voice Dictation',
      description: 'Convert speech to text',
      icon: '🎙️',
      action: async () => {
        await invoke('automate_mac', {
          action: 'dictation',
          params: 'start'
        })
      },
      shortcut: 'Fn Fn',
      keywords: ['voice', 'dictation', 'speech', 'text']
    },
    {
      id: 'translate',
      title: 'Quick Translate',
      description: 'Translate selected text',
      icon: '🌐',
      action: async () => {
        await invoke('automate_mac', {
          action: 'translate',
          params: 'selection'
        })
      },
      shortcut: '⌘ + T',
      keywords: ['translate', 'language', 'text']
    },
    {
      id: 'summarize',
      title: 'AI Summarize',
      description: 'Summarize selected text',
      icon: '✨',
      action: async () => {
        await invoke('automate_mac', {
          action: 'summarize',
          params: 'selection'
        })
      },
      shortcut: '⌘ + S',
      keywords: ['summarize', 'ai', 'text']
    }
  ]

  // Filter automation actions based on search
  const filteredActions = automationActions.filter(item => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase().trim()
    
    const keywords = item.keywords || []
    return (
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      keywords.some(k => k.toLowerCase().includes(query))
    )
  })

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <div>
            <h2 className="text-rose-50/90 text-sm font-medium">Automation</h2>
            <p className="text-rose-100/40 text-[10px]">Quick actions & workflows</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-rose-100/60 hover:text-rose-100/90 transition-colors p-1.5 rounded-full
                     hover:bg-rose-900/20 active:bg-rose-900/30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2.5 pb-2
                    scrollbar-thin scrollbar-track-rose-900/5 
                    scrollbar-thumb-rose-900/10 hover:scrollbar-thumb-rose-900/20
                    scrollbar-thumb-rounded">
        {/* Search Bar */}
        <div className="relative mb-2.5">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-900/60 via-rose-800/40 to-rose-900/60 
                         rounded-xl blur-md opacity-90" />
          <div className="search-container relative flex items-center">
            <span className="absolute left-2.5 text-rose-100/40">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search automations..."
              className="w-full bg-black/90 border border-rose-900/40 rounded-lg 
                       pl-8 pr-3 py-1.5 text-[11px] text-rose-50/90 
                       placeholder-rose-200/30 relative z-10
                       focus:border-rose-900/60 focus:ring-1 focus:ring-rose-900/50
                       transition-colors duration-200"
            />
          </div>
        </div>

        {/* Grid of Actions */}
        <div className="grid grid-cols-2 gap-2">
          {filteredActions.map((item) => (
            <CardSpotlight
              key={item.id}
              onClick={() => {
                setSelectedAction(item.id)
                handleAction(item.action)
              }}
              className={`
                p-2.5 rounded-xl text-left
                bg-black/80 hover:bg-black/90
                border border-red-900/30
                transition-all duration-300
                group relative
                hover:scale-[1.02] active:scale-[0.98]
                ${selectedAction === item.id && isLoading ? 'animate-pulse' : ''}
                ${item.isEnabled === false ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              radius={100}
              color="rgba(136, 19, 19, 0.2)"
            >
              <div className="flex items-start gap-2.5 relative z-20">
                <div className="w-7 h-7 flex items-center justify-center text-base
                               bg-gradient-to-br from-red-950/90 to-black/60
                               rounded-lg border border-red-900/30
                               group-hover:from-red-900/90 group-hover:to-black/70
                               transition-all duration-300">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <h3 className="text-red-50/90 font-medium text-xs truncate mb-0.5">{item.title}</h3>
                  <p className="text-red-200/40 text-[10px] truncate">{item.description}</p>
                </div>
              </div>

              {/* Hover effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r 
                            from-red-900/10 via-red-800/5 to-red-900/10 
                            opacity-0 group-hover:opacity-100 transition-all duration-300" />
            </CardSpotlight>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-red-900/20">
          <p className="text-red-200/30 text-[10px] text-center">
            {filteredActions.length === 0 ? (
              'No matching automations found'
            ) : (
              'More automation features coming soon...'
            )}
          </p>
        </div>
      </div>
    </motion.div>
  )
} 