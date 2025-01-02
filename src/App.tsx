// src/App.tsx
import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { motion, AnimatePresence } from 'framer-motion'
import { BackgroundGradient } from './ui/background-gradient'
import './App.css'
import { AIChat } from './components/AIChat'
import { CardSpotlight } from './ui/card-spotlight'
import { cn } from './lib/utilts'
import { SettingsPanel } from './Settings'
import './fonts.css'
import cursorLogo from './assets/cursor-logo.png'
import { AutomationView } from './components/AutomationView'

// Base sizes in logical pixels (will be scaled by Tauri)
const BASE_SIZES = {
  COLLAPSED: { width: 48, height: 48 },
  EXPANDED: { width: 280, height: 340 },
  CHAT: { width: 320, height: 480 },
  THEATER: { width: 480, height: 640 }
} as const

type WindowPreset = keyof typeof BASE_SIZES

function App() {
  // Calculate window sizes (Tauri handles DPI scaling)
  const WINDOW_SIZES = BASE_SIZES

  // --- State variables ---
  const [windowPos, setWindowPos] = useState({ 
    x: 20,
    y: 100
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAutomationOpen, setIsAutomationOpen] = useState(false)

  // --- Refs ---
  const expandedMenuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const transitioningRef = useRef(false)
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const capturedElementRef = useRef<HTMLDivElement | null>(null)
  const requestFrameRef = useRef<number | null>(null)
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null)
  const dragStartTimeRef = useRef<number>(0)

  // Helper function for window resizing with state management
  const resizeWindow = async (preset: WindowPreset, forceReflow: boolean = false) => {
    const size = BASE_SIZES[preset]
    await invoke('set_window_size', size)
    
    if (forceReflow) {
      // Force a window reflow by temporarily hiding and showing
      await invoke('set_window_visible', { visible: false })
      await new Promise(resolve => setTimeout(resolve, 16)) // Wait one frame
      await invoke('set_window_visible', { visible: true })
    }
    
    return size
  }

  // Helper for consistent window state transitions
  const transitionWindowState = async (
    newState: { 
      size: WindowPreset, 
      position?: { x: number, y: number },
      forceReflow?: boolean 
    }
  ) => {
    if (transitioningRef.current) return
    transitioningRef.current = true

    try {
      // 1. Resize window first
      await resizeWindow(newState.size, newState.forceReflow)
      
      // 2. Update position if needed
      if (newState.position) {
        await invoke('move_window', newState.position)
        setWindowPos(newState.position)
      }
    } finally {
      transitioningRef.current = false
    }
  }

  // --- Handle outside clicks & blur to collapse menu if expanded ---
  const handleClickOutside = (e: MouseEvent) => {
    if (
      isExpanded &&
      expandedMenuRef.current &&
      !expandedMenuRef.current.contains(e.target as Node) &&
      !transitioningRef.current
    ) {
      handleCollapse()
    }
  }

  const handleWindowBlur = () => {
    if (isExpanded && !transitioningRef.current) {
      handleCollapse()
    }
  }

  useEffect(() => {
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isExpanded])

  // Ensure window is visible on start
  useEffect(() => {
    invoke('set_window_visible', { visible: true })
      .catch(error => console.error('Failed to show window:', error))
  }, [])

  // --- Expand & Collapse ---
  const handleExpand = async () => {
    // Get current window position first
    try {
      const [x, y] = await invoke<[number, number]>('get_webview_window_position')
      const currentPos = { x, y }

      // Calculate center-aligned position for expanded window
      const newPosition = {
        x: currentPos.x - (WINDOW_SIZES.EXPANDED.width - WINDOW_SIZES.COLLAPSED.width) / 2,
        y: currentPos.y - (WINDOW_SIZES.EXPANDED.height - WINDOW_SIZES.COLLAPSED.height) / 2
      }

      // Update state and window
      setWindowPos(newPosition)
      await transitionWindowState({
        size: 'EXPANDED',
        position: newPosition
      })
      setIsExpanded(true)
    } catch (error) {
      console.error('Failed to expand window:', error)
    }
  }

  const handleCollapse = async () => {
    try {
      // Get current window position
      const [x, y] = await invoke<[number, number]>('get_webview_window_position')
      const currentPos = { x, y }

      // Calculate center-aligned position for collapsed window
      const newPosition = {
        x: currentPos.x + (WINDOW_SIZES.EXPANDED.width - WINDOW_SIZES.COLLAPSED.width) / 2,
        y: currentPos.y + (WINDOW_SIZES.EXPANDED.height - WINDOW_SIZES.COLLAPSED.height) / 2
      }

      // Update state and window
      setWindowPos(newPosition)
      await transitionWindowState({
        size: 'COLLAPSED',
        position: newPosition,
        forceReflow: true
      })

      // Only after window is fully resized, update the UI state
      requestAnimationFrame(() => {
        setIsExpanded(false)
      })
    } catch (error) {
      console.error('Failed to collapse window:', error)
    }
  }

  // --- Menu Button Clicks ---
  const handleClick = async () => {
    if (isDraggingRef.current || transitioningRef.current) return
    
    // Only handle click if it's a quick tap (less than 200ms)
    const dragTime = Date.now() - dragStartTimeRef.current
    if (dragTime > 200) return

    if (isExpanded) {
      await handleCollapse()
    } else {
      await handleExpand()
    }
  }

  const handleSiriClick = async () => {
    await handleCollapse()
    await transitionWindowState({ size: 'CHAT' })
    setIsChatOpen(true)
  }

  const handleCloseChat = async () => {
    await transitionWindowState({
      size: 'COLLAPSED',
      forceReflow: true
    })
    setIsChatOpen(false)
  }

  const handleBack = async () => {
    await handleCollapse()
    window.history.back()
  }

  const handleTheaterMode = async (enabled: boolean) => {
    await transitionWindowState({
      size: enabled ? 'THEATER' : 'CHAT'
    })
    setIsTheaterMode(enabled)
  }

  // --- Search functionality ---
  const handleSearchShortcut = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      searchInputRef.current?.focus()
    } else if (e.key === 'Escape') {
      setSearchQuery('')
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  // Settings click handler
  const handleSettingsClick = () => {
    setIsSettingsOpen(true)
  }

  const handleAutomationClick = () => {
    setIsAutomationOpen(true)
  }

  const handleCloseAutomation = () => {
    setIsAutomationOpen(false)
  }

  // Menu items data
  const menuItems = [
    { 
      label: <span>LeoAI <strong>BETA</strong></span>,
      icon: '◎', 
      onClick: handleSiriClick, 
      iconType: 'ai-chat',
      description: 'Smart conversational AI',
      className: 'relative overflow-hidden',
      keywords: ['ai', 'chat', 'assistant', 'help', 'leo']
    },
    { 
      label: <strong>Vision</strong>, 
      icon: '', 
      onClick: () => {}, 
      iconType: 'vision',
      description: 'Visual recognition & analysis',
      keywords: ['vision', 'image', 'recognition', 'visual', 'camera']
    },
    { 
      label: <strong>Voice</strong>, 
      icon: '🎙', 
      onClick: () => {}, 
      iconType: 'voice',
      description: 'Voice commands & dictation',
      keywords: ['voice', 'speech', 'audio', 'microphone', 'dictation']
    },
    { 
      label: <strong>Workflow</strong>, 
      icon: '⚡', 
      onClick: () => {}, 
      iconType: 'workflow',
      description: 'Create custom AI workflows',
      keywords: ['workflow', 'automation', 'process', 'custom']
    },
    { 
      label: <strong>Memory</strong>, 
      icon: '󰍉',
      onClick: () => {}, 
      iconType: 'memory',
      description: 'Context & learning',
      keywords: ['memory', 'context', 'learning', 'history']
    },
    { 
      label: <strong>Data</strong>, 
      icon: '', 
      onClick: () => {}, 
      iconType: 'data',
      description: 'Data insights',
      keywords: ['data', 'analytics', 'insights', 'statistics']
    },
    { 
      label: <strong>Create</strong>, 
      icon: '✨', 
      onClick: () => {}, 
      iconType: 'create',
      description: 'AI content generation',
      keywords: ['create', 'generate', 'content', 'creative']
    },
    { 
      label: 'Automate', 
      icon: <img src={cursorLogo} alt="Cursor" className="w-5 h-5" />,
      onClick: handleAutomationClick, 
      iconType: 'automate',
      description: 'Smart task automation',
      keywords: ['automate', 'automation', 'task', 'bot']
    },
    { 
      label: 'Settings', 
      icon: '⚙️', 
      onClick: handleSettingsClick, 
      iconType: 'settings',
      description: 'Customize AI behavior',
      keywords: ['settings', 'config', 'preferences', 'customize']
    }
  ]

  // Filter menu items based on search query with improved logic
  const filteredMenuItems = menuItems.filter(item => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase().trim()
    
    // Split query into words for better matching
    const queryWords = query.split(/\s+/)
    
    // Check if all query words match any of the item's searchable content
    return queryWords.every(word => {
      const matchesKeyword = item.keywords.some(keyword => 
        keyword.toLowerCase().includes(word) || 
        word.includes(keyword.toLowerCase())
      )
      const matchesDescription = item.description.toLowerCase().includes(word)
      const matchesLabel = typeof item.label === 'string' && 
        item.label.toLowerCase().includes(word)
      
      return matchesKeyword || matchesDescription || matchesLabel
    })
  })

  // Sort filtered items by relevance
  const sortedFilteredItems = filteredMenuItems.sort((a, b) => {
    if (!searchQuery) return 0
    
    // Calculate relevance scores
    const getScore = (item: typeof menuItems[0]) => {
      const query = searchQuery.toLowerCase().trim()
      let score = 0
      
      // Exact matches in keywords
      if (item.keywords.some(k => k.toLowerCase() === query)) score += 10
      
      // Partial matches in keywords
      if (item.keywords.some(k => k.toLowerCase().includes(query))) score += 5
      
      // Matches in description
      if (item.description.toLowerCase().includes(query)) score += 3
      
      // Matches in label
      if (typeof item.label === 'string' && item.label.toLowerCase().includes(query)) score += 4
      
      return score
    }
    
    return getScore(b) - getScore(a)
  })

  // Native window dragging
  const handleStartDrag = async (e: React.MouseEvent) => {
    if (isExpanded) return // Prevent dragging in expanded state
    
    // Only handle left mouse button
    if (e.button === 0) {
      e.preventDefault()
      dragStartTimeRef.current = Date.now()
      isDraggingRef.current = true
      await invoke('start_drag')
    }
  }

  // Load saved position on mount
  useEffect(() => {
    const loadPosition = async () => {
      try {
        // Try to get position from localStorage first
        const savedPos = localStorage.getItem('windowPosition')
        if (savedPos) {
          const pos = JSON.parse(savedPos)
          setWindowPos(pos)
          await invoke('move_window', pos)
        } else {
          // If no saved position, get current window position
          const [x, y] = await invoke<[number, number]>('get_window_position')
          setWindowPos({ x, y })
        }
      } catch (error) {
        console.error('Failed to load window position:', error)
      }
    }
    loadPosition()
  }, [])

  // Save position when it changes
  useEffect(() => {
    localStorage.setItem('windowPosition', JSON.stringify(windowPos))
  }, [windowPos])

  // Update handleDragEnd to save the final position
  const handleDragEnd = async () => {
    isDraggingRef.current = false
    try {
      const [x, y] = await invoke<[number, number]>('get_window_position')
      setWindowPos({ x, y })
    } catch (error) {
      console.error('Failed to update window position:', error)
    }
  }

  // --- Render ---
  return (
    <div className="app-container">
      <motion.div
        className="w-full h-full bg-transparent"
        style={{ background: 'transparent', touchAction: 'none' }}
      >
        <AnimatePresence mode="wait">
          {isChatOpen ? (
            <AIChat 
              onClose={handleCloseChat} 
              isTheaterMode={isTheaterMode}
              onTheaterModeChange={handleTheaterMode}
            />
          ) : isExpanded ? (
            <motion.div
              ref={expandedMenuRef}
              key="expanded"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 0 }}
              className="expanded-menu"
            >
              <BackgroundGradient 
                className="p-3 flex flex-col h-full"
                containerClassName="rounded-[20px] p-[3px]"
                style={{
                  width: WINDOW_SIZES.EXPANDED.width - 6,
                  height: WINDOW_SIZES.EXPANDED.height - 6
                }}
                preset={isAutomationOpen ? 'automation' : isSettingsOpen ? 'settings' : 'default'}
              >
                {!isAutomationOpen && !isSettingsOpen && (
                  <>
                    {/* Top bar with search and back button */}
                    <div 
                      onMouseDown={handleStartDrag}
                      className="flex items-center justify-between mb-2 shrink-0 gap-2 cursor-move"
                    >
                      <div className="flex-1 relative">
                        <div className="search-container relative flex items-center">
                          <span className="mr-dafoe-regular text-white text-lg absolute left-2.5 z-20
                                         top-1/2 transform -translate-y-1/2 pointer-events-none
                                         mix-blend-plus-lighter">
                            LEO
                          </span>
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search features..."
                            className="w-full bg-black/20 border border-white/10 rounded-lg 
                                     pl-14 pr-16 py-1.5 text-[11px] text-white/90 
                                     placeholder-white/30 relative z-10"
                          />
                          <div className="absolute right-3 flex items-center gap-1.5 z-20">
                            <div className="flex items-center justify-center px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                              <span className="text-[10px] text-white/50 font-medium tracking-tight">⌘K</span>
                            </div>
                            <svg
                              className="w-4 h-4 text-white/40"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                              />
                            </svg>
                          </div>
                        </div>
                        {searchQuery && filteredMenuItems.length === 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 p-2
                                        bg-black/50 backdrop-blur-sm rounded-lg border border-white/10
                                        text-white/70 text-xs text-center">
                            No results found for "{searchQuery}"
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleBack}
                        className="text-white/70 hover:text-white/90 transition-colors p-1.5 rounded-full close-button shrink-0"
                      >
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="url(#closeGradient)" 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <defs>
                            <linearGradient id="closeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FF3131" />
                              <stop offset="50%" stopColor="#FF8C00" />
                              <stop offset="100%" stopColor="#FFD700" />
                            </linearGradient>
                          </defs>
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Scrollable content */}
                    <div className="overflow-y-auto flex-1 pr-1">
                      <div className="menu-grid">
                        {sortedFilteredItems.map(({ label, icon, onClick, iconType, className, description }, i) => (
                          <CardSpotlight
                            key={i}
                            radius={100}
                            color="rgba(123, 97, 255, 0.1)"
                            className={cn(
                              "menu-button group",
                              "text-center",
                              className
                            )}
                            onClick={onClick}
                            data-icon={iconType}
                          >
                            <div className="icon-wrapper relative z-20">
                              {icon}
                            </div>
                            <span className="text-xs relative z-20 block">{label}</span>
                            {searchQuery && (
                              <div className="absolute inset-x-0 bottom-0 p-1 bg-black/80 text-[10px] text-white/70
                                            opacity-0 group-hover:opacity-100 transition-opacity duration-200
                                            rounded-b-lg">
                                {description}
                              </div>
                            )}
                          </CardSpotlight>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {/* Settings Panel */}
                <AnimatePresence>
                  {isSettingsOpen && (
                    <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
                  )}
                </AnimatePresence>

                {/* Automation Panel */}
                <AnimatePresence>
                  {isAutomationOpen && (
                    <AutomationView onClose={handleCloseAutomation} />
                  )}
                </AnimatePresence>
              </BackgroundGradient>
            </motion.div>
          ) : (
            <motion.button
              key="collapsed"
              className="circular-button"
              onClick={handleClick}
              onMouseDown={handleStartDrag}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 0 }}
            >
              <div className="button-content" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
export default App
