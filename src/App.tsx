// src/App.tsx
import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { motion, AnimatePresence } from 'framer-motion'
import { BackgroundGradient } from './ui/background-gradient'
import './App.css'

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
            // ---------------------------------------
            // Chat (expanded to a chat window)
            // ---------------------------------------
            <motion.div
              key="chat"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full h-full bg-black/80 backdrop-blur-xl
                         rounded-3xl border border-white/10 overflow-hidden
                         flex flex-col"
              onAnimationComplete={() => {
                transitioningRef.current = false
              }}
            >
              {/* Chat Header */}
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 
                                 flex items-center justify-center text-base">
                    ◎
                  </div>
                  <span className="text-white/90 font-medium text-sm">AI Assistant</span>
                </div>
                <button
                  onClick={handleCloseChat}
                  className="text-white/50 hover:text-white/90 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 
                                 flex items-center justify-center text-base shrink-0">
                    ◎
                  </div>
                  <div className="bg-white/10 rounded-2xl rounded-tl-sm p-2.5 text-white/90 text-sm">
                    Hello! How can I help you today?
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl p-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none outline-none text-white/90 
                             placeholder:text-white/50 text-sm px-2"
                  />
                  <button
                    className="w-7 h-7 rounded-full bg-blue-500/20 
                               flex items-center justify-center text-white/90
                               hover:bg-blue-500/30 transition-colors"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </motion.div>
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
                className="p-3"
                containerClassName="rounded-[20px] p-[3px]"
                style={{
                  width: WINDOW_SIZES.EXPANDED.width - 6,
                  height: WINDOW_SIZES.EXPANDED.height - 6
                }}
              >
                <div className="menu-grid">
                  {[
                    { label: 'Home', icon: '⌂', onClick: () => {}, iconType: 'home' },
                    { label: 'Back', icon: '↑', onClick: handleBack, iconType: 'back' },
                    { label: 'Menu', icon: '≡', onClick: () => {}, iconType: 'menu' },
                    { label: 'Siri', icon: '◎', onClick: handleSiriClick, iconType: 'siri' },
                    { label: 'Lock', icon: '🔒', onClick: () => {}, iconType: 'lock' },
                    { label: 'Control', icon: '⚙️', onClick: () => {}, iconType: 'control' },
                    { label: 'Volume', icon: '▲', onClick: () => {}, iconType: 'volume' },
                    { label: 'Mute', icon: '▼', onClick: () => {}, iconType: 'mute' },
                    { label: 'Settings', icon: '⚙️', onClick: () => {}, iconType: 'settings' }
                  ].map(({ label, icon, onClick, iconType }, i) => (
                    <button
                      key={i}
                      onClick={onClick}
                      data-icon={iconType}
                      className="menu-button"
                    >
                      <div className="icon-wrapper">
                        {icon}
                      </div>
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
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