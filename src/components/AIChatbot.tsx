import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, MessageSquare } from 'lucide-react';
import { botResponses, samplePrompts } from '../data/mockData';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  actionableContext?: string;
}

const initialMessages: Message[] = [
  {
    id: 'm1',
    sender: 'ai',
    text: "Guten Tag! I'm SIEG.AI Copilot, specialized exclusively in admissions and visas for Germany 🇩🇪. You can ask me about Anabin H+ equivalency, Uni-Assist deadlines, Bavarian grade conversion, or language tests.",
    time: '10:00 AM',
  },
];

interface AIChatbotProps {
  externalIsOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({
  externalIsOpen,
  onOpenChange,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const setIsOpen = (val: boolean) => {
    if (onOpenChange) {
      onOpenChange(val);
    } else {
      setInternalIsOpen(val);
    }
  };

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      let replyText =
        botResponses['default'] ||
        "Based on German higher education standards, please consult your target university's examination regulations (Prüfungsordnung) or the Uni-Assist portal.";

      const lower = text.toLowerCase();
      if (lower.includes('bavarian') || lower.includes('gpa') || lower.includes('grade')) {
        replyText = botResponses['bavarian'] || replyText;
      } else if (lower.includes('anabin') || lower.includes('h+') || lower.includes('recognition')) {
        replyText = botResponses['anabin'] || replyText;
      } else if (lower.includes('deadline') || lower.includes('winter') || lower.includes('summer')) {
        replyText = botResponses['deadlines'] || replyText;
      } else if (lower.includes('language') || lower.includes('ielts') || lower.includes('toefl')) {
        replyText = botResponses['language'] || replyText;
      } else if (lower.includes('uni-assist') || lower.includes('uni assist') || lower.includes('vpd')) {
        replyText = botResponses['uni-assist'] || replyText;
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <>
      {/* Floating Pill Trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#E30613] hover:bg-[#E00018] active:bg-[#A00012] text-white px-5 py-3.5 rounded-full shadow-[0_6px_25px_rgba(201,0,22,0.45)] flex items-center gap-2.5 font-bold text-sm transition-all transform hover:scale-105 cursor-pointer border border-red-400/40 group"
          aria-label="Open SIEG.AI Copilot Chat"
        >
          <div className="w-2 h-2 rounded-full bg-[#FFD21C] animate-pulse shadow-[0_0_8px_#FFD21C]" />
          <span>Ask SIEG.AI</span>
          <MessageSquare className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] theme-bg-card border-2 theme-border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="theme-bg-surface p-4 border-b theme-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E30613] text-white flex items-center justify-center font-bold shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black theme-text-main">SIEG.AI Copilot</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 theme-bg-card text-[#FFD21C] border theme-border rounded">
                    ONLINE
                  </span>
                </div>
                <span className="text-[10px] theme-text-muted font-mono">
                  Germany Admissions & Visa Intelligence
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 theme-text-muted hover:theme-text-main rounded-lg hover:theme-bg-subtle transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 theme-bg-main">
            {messages.map((msg) => {
              const isAssistant = msg.sender === 'ai';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                      isAssistant
                        ? 'theme-bg-card theme-border border theme-text-main rounded-tl-xs'
                        : 'bg-[#E30613] text-white rounded-tr-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] theme-text-muted font-mono mt-1 px-1">
                    {msg.time}
                  </span>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs theme-text-muted font-mono p-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E30613] animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFD21C] animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.4s]" />
                <span>SIEG.AI checking German regulations...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sample Prompts */}
          <div className="px-4 py-2 theme-bg-surface border-t theme-border flex gap-2 overflow-x-auto no-scrollbar">
            {samplePrompts.slice(0, 3).map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg theme-bg-card hover:theme-bg-subtle border theme-border text-[11px] font-mono theme-text-muted hover:theme-text-main transition-colors shrink-0 cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 theme-bg-surface border-t theme-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about German requirements, Anabin, GPA..."
                className="flex-1 theme-bg-input border theme-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm theme-text-main focus:outline-none focus:border-[#E30613] transition-colors"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="p-2.5 bg-[#E30613] hover:bg-[#E00018] text-white rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-[#E30613] cursor-pointer"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
