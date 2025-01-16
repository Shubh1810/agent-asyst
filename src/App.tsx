// src/App.tsx
import React, { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn, Event } from '@tauri-apps/api/event'
import { motion, AnimatePresence } from 'framer-motion'
import { BackgroundGradient } from './ui/background-gradient'
import './App.css'
import { AIChat } from './components/AIChat'
import { CardSpotlight } from './ui/card-spotlight'
import { cn } from './lib/utilts'
import { SettingsPanel } from './Settings'
import './fonts.css'
import cursorLogo from './assets/cursor-logo.png'
import lightning from './assets/lightning.png'
import { AutomationView } from './components/AutomationView'

// Base sizes in logical pixels (will be scaled by Tauri)
const BASE_SIZES = {
  COLLAPSED: { width: 70, height: 70 },
  EXPANDED: { width: 280, height: 340 },
  CHAT: { width: 320, height: 480 },
  THEATER: { width: 480, height: 640 }
} as const

type WindowPreset = keyof typeof BASE_SIZES

// Add this new component for the draggable handle
const DraggableHandle = () => (
  <div 
    className="draggable-handle"
    onMouseDown={async (e) => {
      if (e.button === 0) {
        e.preventDefault()
        await invoke('start_drag')
      }
    }}
  >
    <motion.span 
      className="leo-text"
      whileHover={{ 
        scale: 1.1,
        textShadow: [
          "0 0 4px rgba(255,255,255,0.4)",
          "0 0 8px rgba(255,255,255,0.4)",
          "0 0 12px rgba(255,255,255,0.4)",
          "0 0 4px rgba(255,255,255,0.4)"
        ]
      }}
      animate={{
        backgroundPosition: ["0%", "100%", "0%"],
      }}
      transition={{
        backgroundPosition: {
          duration: 3,
          repeat: Infinity,
          ease: "linear"
        },
        scale: {
          type: "spring",
          stiffness: 500,
          damping: 15
        }
      }}
      style={{
        backgroundSize: "200% 100%",
      }}
    >
      LEO
    </motion.span>
  </div>
)

type MenuItem = {
  label: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  iconType: string;
  description: string;
  className?: string;
  keywords: string[];
};

// Add these types
interface AppInfo {
  name: string;
  path: string;
  pid: number;
  icon: string | null;
}

interface WindowInfo {
  app: string;
  name: string;
  id: number;
  icon?: string;
}

// Add event type
interface WindowState {
  timestamp: number;
  active_windows: WindowInfo[];
  active_app: ActiveAppState;
}

// More aggressive scrollbar removal
const noScrollbarStyles = `
  * {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
  *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  .overflow-y-auto, .overflow-x-auto, .overflow-auto {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
  .overflow-y-auto::-webkit-scrollbar, 
  .overflow-x-auto::-webkit-scrollbar, 
  .overflow-auto::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
`;

// Separate type for active app with strict typing
interface ActiveAppState {
  name: string;
  path: string;
  pid: number;
  icon: string | null;
}

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
  const [activeWindows, setActiveWindows] = useState<WindowInfo[]>([])
  const [activeApp, setActiveApp] = useState<AppInfo | null>(null)

  // --- Refs ---
  const expandedMenuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const transitioningRef = useRef(false)
  const isDraggingRef = useRef(false)
  const dragStartTimeRef = useRef<number>(0)

  // Helper function for window resizing with state management
  const resizeWindow = async (preset: WindowPreset) => {
    await invoke('set_window_size', BASE_SIZES[preset])
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
      await resizeWindow(newState.size)
      
      // 2. Update position if needed
      if (newState.position) {
        await invoke('move_window', newState.position)
        setWindowPos(newState.position)
      }

      // 3. Save window state after any change
      await invoke('plugin:window-state|save_state')
    } catch (error) {
      console.error('Failed to transition window state:', error)
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

  useEffect(() => {
    window.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  // Load saved position on mount
  useEffect(() => {
    const initWindow = async () => {
      try {
        // The plugin will automatically restore the previous state
        await invoke('plugin:window-state|restore_state');
        
        // Make window visible after state is restored
        await invoke('set_window_visible', { visible: true });
        
        // Get current position after restore
        const [x, y] = await invoke<[number, number]>('get_webview_window_position');
        setWindowPos({ x, y });
      } catch (error) {
        console.error('Failed to initialize window:', error);
      }
    };

    initWindow();
  }, []);

  // --- Expand & Collapse ---
  const handleExpand = async () => {
    await transitionWindowState({ size: 'EXPANDED' })
    setIsExpanded(true)
  }

  const handleCollapse = async () => {
    await transitionWindowState({ size: 'COLLAPSED' })
    setIsExpanded(false)
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

  const handleBack = async () => {
    await handleCollapse()
    window.history.back()
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
      onClick: () => setIsChatOpen(true), 
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
      label: <strong>Instant Summarize</strong>, 
      icon: <img src={lightning} alt="Lightning" className="w-5 h-5 -rotate-5" />,
      onClick: () => {}, 
      iconType: 'create',
      description: 'AI content generation',
      keywords: ['create', 'generate', 'content', 'creative']
    },
    { 
      label: <strong>Automate</strong>, 
      icon: <img src={cursorLogo} alt="Cursor" className="w-5 h-5" />,
      onClick: handleAutomationClick, 
      iconType: 'automate',
      description: 'Smart task automation',
      keywords: ['automate', 'automation', 'task', 'bot']
    },
    { 
      label: <strong>Settings</strong>, 
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
    
    return queryWords.every(word => {
      const matchesKeyword = item.keywords.some(keyword => 
        keyword.toLowerCase().includes(word) || 
        word.includes(keyword.toLowerCase())
      )
      const matchesDescription = item.description.toLowerCase().includes(word)
      return matchesKeyword || matchesDescription
    })
  })

  // Sort filtered items by relevance
  const sortedFilteredItems = filteredMenuItems.sort((a, b) => {
    if (!searchQuery) return 0
    const getScore = (item: MenuItem) => {
      const query = searchQuery.toLowerCase().trim()
      let score = 0
      // Exact matches in keywords
      if (item.keywords.some(k => k.toLowerCase() === query)) score += 10
      // Partial matches in keywords
      if (item.keywords.some(k => k.toLowerCase().includes(query))) score += 5
      // Matches in description
      if (item.description.toLowerCase().includes(query)) score += 3
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

  // Update position state and save window state when dragging ends
  const handleDragEnd = async () => {
    isDraggingRef.current = false
    try {
      // Get the new position
      const [x, y] = await invoke<[number, number]>('get_webview_window_position')
      setWindowPos({ x, y })
      
      // Save the window state
      await invoke('plugin:window-state|save_state')
    } catch (error) {
      console.error('Failed to save window state:', error)
    }
  }

  // Modify the event listener for better type safety and immediate updates
  useEffect(() => {
    let isSubscribed = true;
    
    async function setupListener() {
      try {
        await listen('window_state_update', (event: any) => {
          if (!isSubscribed) return;
          
          const { active_app } = event.payload;
          console.log('Window state update:', active_app);
          
          if (active_app) {
            setActiveApp({
              name: active_app.name,
              path: active_app.path,
              pid: active_app.pid,
              icon: active_app.icon
            });
          }
        });
      } catch (err) {
        console.error('Error setting up window state listener:', err);
      }
    }

    setupListener();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // New CurrentApp implementation as a memo-ized component for better performance
  const CurrentApp = React.memo(() => {
    console.log('Rendering CurrentApp with:', activeApp?.name);
    
    if (!activeApp) {
      console.log('No active app to render');
      return null;
    }
    
    return (
      <div className="mb-4">
        <div className="px-2">
          <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
            <div className="w-10 h-10 rounded-md overflow-hidden bg-black/20 flex items-center justify-center">
              {activeApp.icon ? (
                <img 
                  src={activeApp.icon}
                  alt={activeApp.name}
                  className="w-full h-full object-contain"
                  loading="eager"
                  onLoad={() => console.log(`Icon loaded for ${activeApp.name}`)}
                  onError={(e) => {
                    console.error(`Failed to load icon for ${activeApp.name}`);
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `
                      <span class="text-lg text-white/30">
                        ${activeApp.name.charAt(0).toUpperCase()}
                      </span>
                    `;
                  }}
                />
              ) : (
                <span className="text-lg text-white/30">
                  {activeApp.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm text-white/90 font-medium truncate">
                {activeApp.name}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-400/90">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  });

  // --- Render ---
  return (
    <div className="app-container">
      <motion.div
        className="w-[64px] h-[64px] flex items-center justify-center bg-transparent"
        style={{ background: 'transparent', touchAction: 'none' }}
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
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
                  width: isTheaterMode ? WINDOW_SIZES.THEATER.width - 6 : WINDOW_SIZES.EXPANDED.width - 6,
                  height: isTheaterMode ? WINDOW_SIZES.THEATER.height - 6 : WINDOW_SIZES.EXPANDED.height - 6,
                  transition: 'width 0.3s ease-in-out, height 0.3s ease-in-out'
                }}
                preset={
                  isAutomationOpen ? 'automation' : 
                  isSettingsOpen ? 'settings' : 
                  isChatOpen ? 'chat' : 
                  'default'
                }
              >
                {!isAutomationOpen && !isSettingsOpen && !isChatOpen && (
                  <>
                    {/* Top bar with search and back button */}
                    <div className="flex items-center justify-between mb-2 shrink-0 gap-2">
                      <div className="flex-1 relative">
                        <div className="search-container relative flex items-center">
                          <DraggableHandle />
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
                      {/* Current App Section Moved to Top */}
                      <CurrentApp />

                      <div className="mt-4 pt-4 border-t border-white/10">
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

                      {/* Add App List Section */}
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="text-xs text-white/50 mb-2 px-2">Active Applications</div>
                        <div className="app-list grid grid-cols-4 gap-2 px-2 overflow-hidden">
                          {activeWindows
                            .filter((window, index, self) => 
                              // Filter unique apps
                              index === self.findIndex(w => w.app === window.app)
                            )
                            .map((window, i) => (
                              <div 
                                key={i}
                                className="app-item flex flex-col items-center justify-center p-2 
                                         bg-black/20 rounded-lg border border-white/5 hover:border-white/10
                                         transition-colors"
                                title={window.app}
                              >
                                {window.icon ? (
                                  <img 
                                    src={window.icon} 
                                    alt={window.app}
                                    className="w-8 h-8 mb-1 rounded-md"
                                  />
                                ) : (
                                  <div className="w-8 h-8 mb-1 rounded-md bg-white/5 flex items-center justify-center">
                                    <span className="text-xs text-white/30">
                                      {window.app.charAt(0)}
                                    </span>
                                  </div>
                                )}
                                <span className="text-[10px] text-white/70 truncate w-full text-center">
                                  {window.app}
                                </span>
                              </div>
                            ))}
                        </div>
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

                {/* AI Chat Panel */}
                <AnimatePresence>
                  {isChatOpen && (
                    <AIChat 
                      onBack={() => {
                        setIsChatOpen(false);
                        setIsExpanded(true);
                      }}
                      onClose={() => {
                        setIsChatOpen(false);
                        setIsTheaterMode(false);
                        handleCollapse();
                      }}
                      isTheaterMode={isTheaterMode}
                      onTheaterModeChange={async (enabled) => {
                        setIsTheaterMode(enabled);
                        await transitionWindowState({
                          size: enabled ? 'THEATER' : 'EXPANDED'
                        });
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Add global no-scrollbar styles */}
                <style>{noScrollbarStyles}</style>
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