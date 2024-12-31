// src/App.tsx
import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { motion, AnimatePresence } from 'framer-motion'
import { BackgroundGradient } from './ui/background-gradient'
import './App.css'
import { AIChat } from './components/AIChat'
import { CardSpotlight } from './ui/card-spotlight'
import { cn } from './lib/utilts'

// Base sizes in logical pixels (will be scaled by Tauri)
const BASE_SIZES = {
  COLLAPSED: { width: 48, height: 48 },
  EXPANDED: { width: 280, height: 340 }, // Optimized base size
  CHAT: { width: 320, height: 480 }
} as const

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

  // --- Refs ---
  const expandedMenuRef = useRef<HTMLDivElement>(null)
  const transitioningRef = useRef(false)
  const isDraggingRef = useRef(false)

  // For storing the pointer’s offset from the window’s top-left corner
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  // For pointer capture
  const capturedElementRef = useRef<HTMLDivElement | null>(null)

  // For requestAnimationFrame-based window updates
  const requestFrameRef = useRef<number | null>(null)
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null)

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

  // --- Pointer-based dragging ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isExpanded) return

    const element = e.currentTarget
    element.setPointerCapture(e.pointerId)
    capturedElementRef.current = element

    isDraggingRef.current = true

    // Calculate offset so window doesn't "jump" to pointer's top-left corner
    dragOffsetRef.current = {
      x: e.clientX - windowPos.x,
      y: e.clientY - windowPos.y
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || isExpanded) return

    // Next position = pointer minus initial offset
    const newX = e.clientX - dragOffsetRef.current.x
    const newY = e.clientY - dragOffsetRef.current.y

    // Update UI immediately for a crisp follow
    setWindowPos({ x: newX, y: newY })

    // Queue the Tauri move
    pendingPositionRef.current = { x: newX, y: newY }

    // Use requestAnimationFrame to avoid spamming Tauri
    if (!requestFrameRef.current) {
      requestFrameRef.current = requestAnimationFrame(() => {
        requestFrameRef.current = null
        if (pendingPositionRef.current) {
          invoke('move_window', pendingPositionRef.current)
            .catch(error => console.error('Failed to move window:', error))
          pendingPositionRef.current = null
        }
      })
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (capturedElementRef.current) {
      capturedElementRef.current.releasePointerCapture(e.pointerId)
      capturedElementRef.current = null
    }
    isDraggingRef.current = false
    
    // Ensure window is still visible after drag
    invoke('set_window_visible', { visible: true })
      .catch(error => console.error('Failed to show window:', error))
  }

  // Clean up pointer capture and any pending requestAnimationFrame on unmount
  useEffect(() => {
    // Ensure window is visible on start
    invoke('set_window_visible', { visible: true })
      .catch(error => console.error('Failed to show window:', error))

    return () => {
      // Clean up any pending operations before unmount
      if (requestFrameRef.current) {
        cancelAnimationFrame(requestFrameRef.current)
        requestFrameRef.current = null
      }
      if (capturedElementRef.current) {
        capturedElementRef.current.releasePointerCapture(0)
        capturedElementRef.current = null
      }
    }
  }, [])

  // --- Expand & Collapse ---
  const handleExpand = async () => {
    if (transitioningRef.current) return
    transitioningRef.current = true

    const expandedWidth = WINDOW_SIZES.EXPANDED.width
    const expandedHeight = WINDOW_SIZES.EXPANDED.height
    const collapsedWidth = WINDOW_SIZES.COLLAPSED.width
    const collapsedHeight = WINDOW_SIZES.COLLAPSED.height

    // Calculate expansion from the exact center of the button
    const expandedX = windowPos.x - (expandedWidth - collapsedWidth) / 2
    const expandedY = windowPos.y - (expandedHeight - collapsedHeight) / 2

    // 1) Resize to expanded
    await invoke('set_window_size', { width: expandedWidth, height: expandedHeight })
    // 2) Position so the center remains consistent
    await invoke('move_window', { x: expandedX, y: expandedY })
    
    // Update local state
    setWindowPos({ x: expandedX, y: expandedY })
    setIsExpanded(true)
    transitioningRef.current = false
  }

  const handleCollapse = async () => {
    if (transitioningRef.current) return
    transitioningRef.current = true

    // We'll hide the expanded UI *after* resizing to avoid the rectangular glitch.
    // So do *not* call setIsExpanded(false) yet.

    const expandedWidth = WINDOW_SIZES.EXPANDED.width
    const expandedHeight = WINDOW_SIZES.EXPANDED.height
    const collapsedWidth = WINDOW_SIZES.COLLAPSED.width
    const collapsedHeight = WINDOW_SIZES.COLLAPSED.height

    // Calculate the new position that keeps the same center
    const currentCenterX = windowPos.x + expandedWidth / 2
    const currentCenterY = windowPos.y + expandedHeight / 2
    
    const collapsedX = currentCenterX - collapsedWidth / 2
    const collapsedY = currentCenterY - collapsedHeight / 2

    // 1) First resize the Tauri window
    await invoke('set_window_size', { width: collapsedWidth, height: collapsedHeight })
    // 2) Then move the Tauri window to keep center aligned
    await invoke('move_window', { x: collapsedX, y: collapsedY })

    // 3) Now that the OS sees 48x48, show the small circle UI
    setIsExpanded(false)
    setWindowPos({ x: collapsedX, y: collapsedY })
    transitioningRef.current = false
  }

  // --- Menu Button Clicks ---
  const handleClick = async () => {
    if (isDraggingRef.current || transitioningRef.current) return

    if (isExpanded) {
      await handleCollapse()
    } else {
      await handleExpand()
    }
  }

  const handleSiriClick = async () => {
    setIsChatOpen(true)
    // Collapse before opening chat
    await handleCollapse()
    await invoke('set_window_size', { width: 300, height: 500 })
  }

  const handleCloseChat = async () => {
    setIsChatOpen(false)
    await invoke('set_window_size', { width: 48, height: 48 })
  }

  const handleBack = async () => {
    await handleCollapse()
    window.history.back()
  }

  // --- Render ---
  return (
    <div className="app-container">
      <motion.div
        className="w-full h-full bg-transparent"
        style={{ background: 'transparent', touchAction: 'none' }} // Prevent touch scrolling
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <AnimatePresence mode="wait">
          {isChatOpen ? (
            <AIChat onClose={handleCloseChat} />
          ) : isExpanded ? (
            // ---------------------------------------
            // Expanded radial menu
            // ---------------------------------------
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
              >
                {/* Top bar with back button */}
                <div className="flex justify-end mb-2 shrink-0">
                  <button
                    onClick={handleBack}
                    className="text-white/70 hover:text-white/90 transition-colors p-1.5 rounded-full close-button"
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
                    {[
                      { 
                        label: <span>LeoAI <strong>BETA</strong></span>,
                        icon: '◎', 
                        onClick: handleSiriClick, 
                        iconType: 'ai-chat',
                        description: 'Smart conversational AI',
                        className: 'relative overflow-hidden'
                      },
                      { 
                        label: <strong>Vision</strong>, 
                        icon: '', 
                        onClick: () => {}, 
                        iconType: 'vision',
                        description: 'Visual recognition & analysis'
                      },
                      { 
                        label: <strong>Voice</strong>, 
                        icon: '🎙', 
                        onClick: () => {}, 
                        iconType: 'voice',
                        description: 'Voice commands & dictation'
                      },
                      { 
                        label: <strong>Workflow</strong>, 
                        icon: '⚡', 
                        onClick: () => {}, 
                        iconType: 'workflow',
                        description: 'Create custom AI workflows'
                      },
                      { 
                        label: <strong>Memory</strong>, 
                        icon: '󰍉',
                        onClick: () => {}, 
                        iconType: 'memory',
                        description: 'Context & learning'
                      },
                      { 
                        label: <strong>Data</strong>, 
                        icon: '', 
                        onClick: () => {}, 
                        iconType: 'data',
                        description: 'Data insights'
                      },
                      { 
                        label: <strong>Create</strong>, 
                        icon: '✨', 
                        onClick: () => {}, 
                        iconType: 'create',
                        description: 'AI content generation'
                      },
                      { 
                        label: 'Automate', 
                        icon: '🤖', 
                        onClick: () => {}, 
                        iconType: 'automate',
                        description: 'Smart task automation'
                      },
                      { 
                        label: 'Settings', 
                        icon: '⚙️', 
                        onClick: () => {}, 
                        iconType: 'settings',
                        description: 'Customize AI behavior'
                      }
                    ].map(({ label, icon, onClick, iconType, description, className }, i) => (
                      <CardSpotlight
                        key={i}
                        radius={100}
                        color="rgba(123, 97, 255, 0.1)"
                        className={cn(
                          "menu-button",
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
                      </CardSpotlight>
                    ))}
                  </div>
                </div>
              </BackgroundGradient>
            </motion.div>
          ) : (
            // ---------------------------------------
            // Collapsed circular button
            // ---------------------------------------
            <motion.button
              key="collapsed"
              className="circular-button"
              onClick={handleClick}
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