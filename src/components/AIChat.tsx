import { motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { GeminiService, ChatMessage } from '../services/gemini'

interface AIChatProps {
  onBack: () => void;
  onClose: () => void;
  isTheaterMode?: boolean;
  onTheaterModeChange?: (enabled: boolean) => void;
}

export function AIChat({ onBack, onClose, isTheaterMode = false, onTheaterModeChange }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      content: 'Hello! How can I help you today?',
      role: 'assistant'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const geminiService = useRef(new GeminiService());

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      content: inputMessage,
      role: 'user'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Get response from Gemini
      const response = await geminiService.current.sendMessage(inputMessage);
      
      const aiMessage: ChatMessage = {
        content: response,
        role: 'assistant'
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const ModelIndicator = () => (
    <div className="model-indicator">
      gemini
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 flex flex-col overflow-hidden"
    >
      {/* Chat Header */}
      <div 
        className="flex items-center justify-between px-2.5 py-2 shrink-0 border-b border-white/10"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <button
            onClick={onBack}
            className="text-white/50 hover:text-white/90 transition-colors p-1.5 rounded-full
                     hover:bg-blue-900/20 active:bg-blue-900/30"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div 
            className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800
                       flex items-center justify-center text-base shadow-lg"
            data-tauri-drag-region
          >
            ◎
          </div>
          <div data-tauri-drag-region>
            <h2 className="text-blue-50/90 text-sm font-medium">Agent Leo</h2>
            <p className="text-blue-100/40 text-[10px]">{isTheaterMode ? 'Theater Mode' : 'AI Assistant'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => onTheaterModeChange?.(!isTheaterMode)}
            className="text-white/50 hover:text-white/90 transition-colors p-1.5 rounded-full
                     hover:bg-blue-900/20 active:bg-blue-900/30"
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
            className="text-white/50 hover:text-white/90 transition-colors p-1.5 rounded-full
                     hover:bg-blue-900/20 active:bg-blue-900/30"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3
                    scrollbar-thin scrollbar-track-blue-900/5 
                    scrollbar-thumb-blue-900/10 hover:scrollbar-thumb-blue-900/20
                    scrollbar-thumb-rounded">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {message.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800
                           flex items-center justify-center text-base shrink-0 shadow-lg">
                ◎
              </div>
            )}
            <div className={`${
              message.role === 'assistant' 
                ? 'bg-gradient-to-br from-blue-500/20 via-blue-600/20 to-blue-700/20 text-white/90 border border-blue-500/30' 
                : 'bg-blue-950/50 text-white/90 border border-blue-500/20'
              } rounded-2xl ${
                message.role === 'assistant' ? 'rounded-tl-sm' : 'rounded-tr-sm'
              } p-2.5 shadow-lg text-sm max-w-[80%] break-words backdrop-blur-sm relative`}
            >
              {message.role === 'assistant' && (
                <div className="message pr-16">
                  <ModelIndicator />
                  <span className="text-white/90">
                    {message.content}
                  </span>
                </div>
              )}
              {message.role === 'user' && (
                <div className="message text-white/90">
                  {message.content}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800
                         flex items-center justify-center text-base shrink-0 shadow-lg">
              ◎
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 via-blue-600/20 to-blue-700/20
                         rounded-2xl rounded-tl-sm p-2.5 text-white/90
                         shadow-lg text-sm border border-blue-500/30 backdrop-blur-sm">
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
      <div className="p-2 relative">
        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/60 via-blue-500/40 to-blue-600/60 
                         rounded-xl blur-md opacity-75" />
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex items-center gap-2 bg-black/50 rounded-lg p-2 backdrop-blur-sm border border-blue-500/30"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none outline-none text-white/90 
                       placeholder:text-white/40 text-sm px-2"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="w-7 h-7 rounded-full 
                       bg-gradient-to-br from-blue-600 to-blue-800
                       flex items-center justify-center text-white/90
                       hover:from-blue-500 hover:to-blue-700 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg"
            >
              ↑
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  )
}
