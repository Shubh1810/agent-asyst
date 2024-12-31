import { motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string;
  content: string;
  role: 'assistant' | 'user';
  timestamp: Date;
}

interface AIChatProps {
  onClose: () => void;
  isTheaterMode?: boolean;
  onTheaterModeChange?: (enabled: boolean) => void;
}

export function AIChat({ onClose, isTheaterMode = false, onTheaterModeChange }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! How can I help you today?',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response (replace with actual API call later)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'This is a simulated response. Connecting to an LLM API for real responses!',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <motion.div
      key="chat"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="w-full h-full bg-black/45 backdrop-blur-xl
                 rounded-3xl border border-yellow-100/90 overflow-hidden
                 flex flex-col absolute inset-0"
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-950/90 via-red-950 to-orange-950
                         flex items-center justify-center text-base shadow-lg">
            ◎
          </div>
          <span className="text-white/90 font-medium text-sm">
            <strong>Agent Leo</strong> {isTheaterMode ? 'Theater' : 'BETA'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => onTheaterModeChange?.(!isTheaterMode)}
            className="text-white/50 hover:text-white/90 transition-colors p-1.5"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isTheaterMode ? "Exit theater mode" : "Enter theater mode"}
          >
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {isTheaterMode ? (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              ) : (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              )}
            </svg>
          </motion.button>
          <motion.button
            onClick={onClose}
            className="text-white/50 hover:text-white/90 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
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
          </motion.button>
        </div>
      </div>

      {/* Main Chat Content */}
      <motion.div
        layout
        className="flex-1 flex flex-col relative"
        animate={isTheaterMode ? {
          scale: 1.05,
          transition: {
            type: "spring",
            bounce: 0.15,
            duration: 0.5
          }
        } : {
          scale: 1
        }}
      >
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 
                      scrollbar-thin scrollbar-track-white/10 
                      scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
          {messages.map((message) => (
            <div 
              key={message.id}
              className={`flex items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-950/90 via-red-950 to-orange-950
                             flex items-center justify-center text-base shrink-0 shadow-lg">
                  ◎
                </div>
              )}
              <div className={`${
                message.role === 'assistant' 
                  ? 'bg-gradient-to-br from-stone-50 to-amber-100 text-slate-800' 
                  : 'bg-red-950/50 text-white'
                } rounded-2xl ${
                  message.role === 'assistant' ? 'rounded-tl-sm' : 'rounded-tr-sm'
                } p-2.5 shadow-lg text-sm ${
                  message.role === 'assistant' ? 'font-bold' : ''
                } max-w-[80%]`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-950/90 via-red-950 to-orange-950
                           flex items-center justify-center text-base shrink-0 shadow-lg">
                ◎
              </div>
              <div className="bg-gradient-to-br from-stone-50 to-amber-100
                           rounded-2xl rounded-tl-sm p-2.5 text-slate-800
                           shadow-lg text-sm font-bold">
                <motion.div
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  ...
                </motion.div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-3 border-t border-white/10">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-white/10 rounded-xl p-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none outline-none text-white/90 
                       placeholder:text-white/50 text-sm px-2"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="w-7 h-7 rounded-full 
                       bg-gradient-to-br from-red-950 to-red-900
                       flex items-center justify-center text-white/90
                       hover:from-red-900 hover:to-red-800 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg"
            >
              ↑
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  )
}
