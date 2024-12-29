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
  // Calculate window sizes based on screen dimensions
  const getResponsiveSize = () => {
    // We don't need to manually scale anymore since Tauri handles it
    return {
      COLLAPSED: BASE_SIZES.COLLAPSED,
      EXPANDED: BASE_SIZES.EXPANDED,
      CHAT: BASE_SIZES.CHAT
    }
  }

  const WINDOW_SIZES = getResponsiveSize()
  const [isDragging, setIsDragging] = useState(false)
  const [windowPos, setWindowPos] = useState({ 
    x: window.screen.width - WINDOW_SIZES.COLLAPSED.width - 20, // Better default position
    y: 100 
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  const dragStartRef = useRef({ x: 0, y: 0 })
  const expandedMenuRef = useRef<HTMLDivElement>(null)
  const transitioningRef = useRef(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isExpanded) return // Prevent dragging in expanded state
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && !isExpanded) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y

      // Get screen dimensions
      const screenWidth = window.screen.width
      const screenHeight = window.screen.height
      
      // Add padding from screen edges
      const SCREEN_PADDING = 20

      // Calculate new position with boundaries and padding
      const newX = Math.max(
        SCREEN_PADDING, 
        Math.min(screenWidth - WINDOW_SIZES.COLLAPSED.width - SCREEN_PADDING, 
        windowPos.x + dx)
      )
      const newY = Math.max(
        SCREEN_PADDING, 
        Math.min(screenHeight - WINDOW_SIZES.COLLAPSED.height - SCREEN_PADDING, 
        windowPos.y + dy)
      )

      setWindowPos({ x: newX, y: newY })
      invoke('move_window', { x: newX, y: newY })
      dragStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

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
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isDragging, windowPos, isExpanded])

  const handleExpand = async () => {
    if (transitioningRef.current) return
    transitioningRef.current = true

    const screenWidth = window.screen.width
    const screenHeight = window.screen.height
    const expandedWidth = WINDOW_SIZES.EXPANDED.width
    const expandedHeight = WINDOW_SIZES.EXPANDED.height

    // Calculate position to ensure menu is fully visible
    let expandedX = windowPos.x - (expandedWidth - WINDOW_SIZES.COLLAPSED.width)
    let expandedY = windowPos.y - (expandedHeight / 4)

    // Screen edge padding
    const SCREEN_PADDING = 16

    // Adjust if too close to screen edges
    if (expandedX < SCREEN_PADDING) expandedX = SCREEN_PADDING
    if (expandedY < SCREEN_PADDING) expandedY = SCREEN_PADDING
    if (expandedX + expandedWidth > screenWidth - SCREEN_PADDING) {
      expandedX = screenWidth - expandedWidth - SCREEN_PADDING
    }
    if (expandedY + expandedHeight > screenHeight - SCREEN_PADDING) {
      expandedY = screenHeight - expandedHeight - SCREEN_PADDING
    }

    await invoke('set_window_size', { 
      width: expandedWidth,
      height: expandedHeight
    })
    await invoke('move_window', { x: expandedX, y: expandedY })
    setIsExpanded(true)
  }

  const handleCollapse = async () => {
    if (transitioningRef.current) return
    transitioningRef.current = true

    setIsExpanded(false)
    await invoke('set_window_size', { width: 48, height: 48 })
    await invoke('move_window', { x: windowPos.x, y: windowPos.y })
    // No more setTimeout; rely on onAnimationComplete in the collapsed motion.
  }

  const handleClick = async () => {
    if (isDragging || transitioningRef.current) return
    if (isExpanded) {
      await handleCollapse()
    } else {
      await handleExpand()
    }
  }

  const handleSiriClick = async () => {
    setIsChatOpen(true)
    await handleCollapse()
    await invoke('set_window_size', { width: 300, height: 500 })
  }

  const handleCloseChat = async () => {
    setIsChatOpen(false)
    await invoke('set_window_size', { width: 48, height: 48 })
  }

  const handleBack = async () => {
    // First collapse the assistive touch menu
    await handleCollapse()

    // Use browser's native history
    window.history.back()
  }

  return (
    <div className="app-container">
      <motion.div 
        className="w-full h-full bg-transparent" 
        style={{ background: 'transparent' }}
        onMouseDown={handleMouseDown}
      >
        <AnimatePresence mode="wait">
          {isChatOpen ? (
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
            <motion.div
              ref={expandedMenuRef}
              key="expanded"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="expanded-menu"
              onAnimationComplete={() => {
                transitioningRef.current = false
              }}
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
            <motion.button
              key="collapsed"
              className="circular-button"
              onClick={handleClick}
              whileHover={{ scale: 1.05 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onAnimationComplete={() => {
                transitioningRef.current = false
              }}
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