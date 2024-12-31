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
}

export function AIChat({ onClose }: AIChatProps) {
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
      className="w-full h-full bg-black/50 backdrop-blur-xl
                 rounded-3xl border border-white/10 overflow-hidden
                 flex flex-col absolute inset-0"
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-500/20 
                         flex items-center justify-center text-base">
            ◎
          </div>
          <span className="text-white/90 font-medium text-sm"><strong>Agent Leo</strong> BETA</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white/90 transition-colors"
        >
          ✕
        </button>
      </div>

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
              <div className="w-7 h-7 rounded-full bg-blue-500/20 
                           flex items-center justify-center text-base shrink-0">
                ◎
              </div>
            )}
            <div className={`${
              message.role === 'assistant' 
                ? 'bg-gradient-to-br from-stone-50 to-amber-100 text-slate-800' 
                : 'bg-blue-500/10 text-white'
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
            <div className="w-7 h-7 rounded-full bg-blue-500/20 
                         flex items-center justify-center text-base shrink-0">
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
                     bg-gradient-to-br from-red-900 to-red-800
                     flex items-center justify-center text-white/90
                     hover:from-red-800 hover:to-red-700 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-lg"
          >
            ↑
          </button>
        </form>
      </div>
    </motion.div>
  )
}
