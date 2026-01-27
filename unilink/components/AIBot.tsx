
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { Message } from '../types';
import { getAIResponse } from '../services/gemini';

const AIBot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am the UniDrop Sourcing & Logistics Agent. I can help you analyze inventory, suggest marketing copy, or optimize campus delivery routes. What is on your mind?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await getAIResponse(messages, input);
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "The Sourcing Agent is currently navigating heavy campus traffic. Please try again in a few seconds." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
            Sourcing Agent
          </h1>
          <p className="text-sm font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">
            Intelligent Hub Intelligence
          </p>
        </div>
        <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
          <Sparkles size={24} />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
        {/* Chat History */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div className={`max-w-[80%] px-6 py-4 rounded-3xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-50 text-indigo-900 rounded-tr-none' 
                  : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin" />
              </div>
              <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-3xl rounded-tl-none">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-slate-50 bg-slate-50/50">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask for sourcing tips or market trends..."
              className="w-full px-8 py-5 pr-16 bg-white rounded-3xl shadow-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold transition-all"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIBot;
