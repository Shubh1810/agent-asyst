// src/App.tsx
import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { motion, AnimatePresence } from 'framer-motion'
import { BackgroundGradient } from './ui/background-gradient'
import './App.css'

const WINDOW_SIZES = {
  COLLAPSED: { width: 48, height: 48 },
  EXPANDED: { width: 320, height: 380 }, // Increased to accommodate border and margin
  CHAT: { width: 300, height: 500 }
} as const

function App() {
  const [isDragging, setIsDragging] = useState(false)
  const [windowPos, setWindowPos] = useState({ x: 20, y: 20 })
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

      // Calculate new position with boundaries
      const newX = Math.max(0, Math.min(screenWidth - 48, windowPos.x + dx))
      const newY = Math.max(0, Math.min(screenHeight - 48, windowPos.y + dy))

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

    // Calculate center position for expanded view
    const screenWidth = window.screen.width
    const screenHeight = window.screen.height
    const expandedWidth = WINDOW_SIZES.EXPANDED.width
    const expandedHeight = WINDOW_SIZES.EXPANDED.height

    // Calculate new position to center the expanded window
    const expandedX = Math.max(0, Math.min(
      screenWidth - expandedWidth,
      windowPos.x - (expandedWidth - WINDOW_SIZES.COLLAPSED.width) / 2
    ))
    const expandedY = Math.max(0, Math.min(
      screenHeight - expandedHeight,
      windowPos.y - (expandedHeight - WINDOW_SIZES.COLLAPSED.height) / 2
    ))

    // Set new size and position
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
      <motion.div className="w-full h-full" onMouseDown={handleMouseDown}>
        <AnimatePresence mode="wait">
          {isChatOpen ? (
            // -----------------
            // CHAT VIEW
            // -----------------
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
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full bg-blue-500/20 
                               flex items-center justify-center text-lg"
                  >
                    ◎
                  </div>
                  <span className="text-white/90 font-medium">AI Assistant</span>
                </div>
                <button
                  onClick={handleCloseChat}
                  className="text-white/50 hover:text-white/90 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full bg-blue-500/20 
                               flex items-center justify-center text-lg shrink-0"
                  >
                    ◎
                  </div>
                  <div className="bg-white/10 rounded-2xl rounded-tl-sm p-3 text-white/90 text-sm">
                    Hello! How can I help you today?
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl p-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none outline-none text-white/90 
                             placeholder:text-white/50 text-sm px-2"
                  />
                  <button
                    className="w-8 h-8 rounded-full bg-blue-500/20 
                               flex items-center justify-center text-white/90
                               hover:bg-blue-500/30 transition-colors"
                  >
                    ��
                  </button>
                </div>
              </div>
            </motion.div>
          ) : isExpanded ? (
            // -----------------
            // EXPANDED MENU
            // -----------------
            <motion.div
              ref={expandedMenuRef}
              key="expanded"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="expanded-menu"
            >
              <BackgroundGradient 
                className="p-6 min-w-[300px]"
                containerClassName="p-[3px] rounded-[28px]"
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
                    >
                      <div className="icon-wrapper">
                        {icon}
                      </div>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </BackgroundGradient>
            </motion.div>
          ) : (
            // -----------------
            // COLLAPSED (CIRCLE) BUTTON
            // -----------------
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