import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Sparkles, X, Send, Settings, Save, Pin, Trash2, PanelRightClose, PanelLeft, ChevronDown, Check } from 'lucide-react';
import { useAIChat, type AIProvider, PROVIDERS } from '../context/AIChatContext';

function ModelSelector({ provider, model, setModel }: { provider: string, model: string, setModel: (m: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const models = Array.from(new Set([...(PROVIDERS[provider]?.models || []), model]));
  const providerName = PROVIDERS[provider]?.name.split(' ')[0] || 'AI'; // Extract first word like 'Google' or 'Groq'

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-textMain hover:bg-black/5 dark:hover:bg-white/5 rounded-xl px-2 h-8 transition-colors max-w-full overflow-hidden"
      >
        <div className="text-[14px] flex items-center gap-1 overflow-hidden whitespace-nowrap flex-nowrap shrink">
          <span className="font-normal opacity-80 shrink-0 mt-[1px]">{providerName}</span>
          <span className="font-bold mt-[1px]" title={model}>
            {model.length > 14 ? model.substring(0, 14) + '...' : model}
          </span>
        </div>
        <ChevronDown size={14} className={`text-textMuted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-[100] py-2 flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
          {models.map(m => (
            <button
              key={m}
              onClick={() => { setModel(m); setIsOpen(false); }}
              className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors flex items-center justify-between group"
            >
              <span className="text-sm font-medium text-textMain group-hover:text-primary transition-colors pr-2">{m}</span>
              {m === model && <Check size={16} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatInnerContent({ 
  activeTab, 
  setActiveTab 
}: { 
  activeTab: 'chat' | 'clipboard' | 'settings',
  setActiveTab: React.Dispatch<React.SetStateAction<'chat' | 'clipboard' | 'settings'>>
}) {
  const { 
    provider, setProvider,
    baseUrl, setBaseUrl,
    model, setModel,
    apiKey, setApiKey,
    chatMode, setChatMode,
    attachedSnippets, setAttachedSnippets,
    messages, setMessages,
    problemDescription, editorRef
  } = useAIChat();

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && attachedSnippets.length === 0) return;
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Please configure your API key in Settings first.' }]);
      return;
    }
    
    let content = inputMessage;
    if (attachedSnippets.length > 0) {
      content += "\n\nAttached Code:\n" + attachedSnippets.map(s => "```\n" + s + "\n```").join("\n");
      setAttachedSnippets([]);
    }
    
    const newUserMsg = { role: 'user' as const, content };
    const currentMessages = [...messages, newUserMsg];
    setMessages(currentMessages);
    setInputMessage('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          model,
          apiKey,
          messages: currentMessages,
          problemDescription,
          editorCode: editorRef?.current?.getValue(),
          chatMode
        })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Failed to send message');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setIsSending(false); // Disable bouncing dots as soon as stream starts
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      
      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunkValue = decoder.decode(value, { stream: true });
            const lines = chunkValue.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                if (!dataStr) continue;
                
                try {
                  const data = JSON.parse(dataStr);
                  if (data.error) throw new Error(data.error);
                  
                  const content = data.choices?.[0]?.delta?.content;
                  if (content) {
                    setMessages(prev => {
                      const newMsgs = [...prev];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === 'assistant') {
                        lastMsg.content += content;
                      }
                      return newMsgs;
                    });
                  }
                } catch (e: any) {
                  // Ignore JSON parse errors for incomplete chunks, or handle explicit errors
                  if (e.message && e.message !== 'Unexpected end of JSON input') {
                    throw e;
                  }
                }
              }
            }
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => {
        // If we already started an assistant message, append the error
        if (prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].content === '') {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = `Error: ${e.message}`;
          return newMsgs;
        }
        return [...prev, { role: 'assistant', content: `Error: ${e.message}` }];
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    localStorage.setItem('openrun_ai_provider', p);
    if (PROVIDERS[p]) {
      setBaseUrl(PROVIDERS[p].defaultBaseUrl);
      setModel(PROVIDERS[p].defaultModel);
      localStorage.setItem('openrun_ai_baseUrl', PROVIDERS[p].defaultBaseUrl);
      localStorage.setItem('openrun_ai_model', PROVIDERS[p].defaultModel);
    }
  };

  const handleSaveKey = () => {
    localStorage.setItem('openrun_ai_key', apiKey);
    localStorage.setItem('openrun_ai_baseUrl', baseUrl);
    localStorage.setItem('openrun_ai_model', model);
    setActiveTab('chat');
  };

  const handleClearKey = () => {
    localStorage.removeItem('openrun_ai_key');
    setApiKey('');
  };

  const removeAttachment = (index: number) => {
    setAttachedSnippets(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
      {activeTab === 'settings' && (
        <div className="flex-1 bg-surface p-5 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-textMain flex items-center gap-2">
                <Settings size={16} /> Configuration
              </h3>
            </div>
            <p className="text-xs text-textMuted mb-3">Configure your AI provider and model.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1 block">Provider</label>
                <select 
                  value={provider} 
                  onChange={e => handleProviderChange(e.target.value as AIProvider)}
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-lg p-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                >
                  {Object.entries(PROVIDERS).map(([key, val]) => (
                    <option key={key} value={key}>{val.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1 block">Base URL</label>
                <input 
                  type="text" 
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-lg p-2 text-sm text-textMain placeholder-textMuted/70 focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1 block">Model</label>
                <input 
                  type="text" 
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-lg p-2 text-sm text-textMain placeholder-textMuted/70 focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 pb-10">
            <h3 className="font-semibold text-textMain flex items-center gap-2 mb-1">
              API Key Settings
            </h3>
            <p className="text-xs text-textMuted mb-3">
              Your API key is stored locally in your browser's localStorage.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1 block">API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-lg p-2 text-sm text-textMain placeholder-textMuted/70 focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={handleSaveKey}
                  className="flex-1 bg-primary text-white dark:text-[#1a2e60] rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Save size={14} /> Save Configuration
                </button>
                {localStorage.getItem('openrun_ai_key') && (
                  <button 
                    onClick={handleClearKey}
                    className="px-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg py-2 text-sm font-semibold transition-colors flex items-center justify-center"
                    title="Clear saved key"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Mode Toggle Header */}
          <div className="flex justify-center p-2 bg-secondary/30 border-b border-border shrink-0 backdrop-blur-sm z-10 relative">
            <div className="flex items-center gap-1 bg-surface p-1 rounded-full border border-border">
              <button 
                onClick={() => {
                  if (chatMode !== 'help') {
                    setChatMode('help');
                    setMessages(prev => {
                      const lastMsg = prev[prev.length - 1];
                      if (lastMsg && lastMsg.role === 'system_alert' && lastMsg.content.startsWith('Switched to ')) {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, content: 'Switched to Help Mode' };
                        return newMsgs;
                      }
                      return [...prev, { role: 'system_alert', content: 'Switched to Help Mode' }];
                    });
                  }
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${chatMode === 'help' ? 'bg-primary text-white dark:text-[#1a2e60] shadow-sm' : 'text-textMuted hover:text-textMain'}`}
              >
                Help Mode
              </button>
              <button 
                onClick={() => {
                  if (chatMode !== 'code') {
                    setChatMode('code');
                    setMessages(prev => {
                      const lastMsg = prev[prev.length - 1];
                      if (lastMsg && lastMsg.role === 'system_alert' && lastMsg.content.startsWith('Switched to ')) {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, content: 'Switched to Code Mode' };
                        return newMsgs;
                      }
                      return [...prev, { role: 'system_alert', content: 'Switched to Code Mode' }];
                    });
                  }
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${chatMode === 'code' ? 'bg-primary text-white dark:text-[#1a2e60] shadow-sm' : 'text-textMuted hover:text-textMain'}`}
              >
                Code Mode
              </button>
            </div>
          </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar pb-6">
                <div className="bg-secondary self-start rounded-2xl rounded-tl-sm p-4 max-w-[90%] shadow-sm border border-border flex items-start gap-3">
                  <p className="text-sm text-textMain leading-relaxed pt-1">
                    Hello! I'm your AI coding assistant. I'm currently in <span className="font-bold text-primary">{chatMode === 'help' ? 'Helping Mode' : 'Full Code Mode'}</span>.
                    <br/><br/>
                    Highlight code in the editor to ask me about it!
                  </p>
                </div>
                {messages.map((m, idx) => {
                  if (m.role === 'system_alert') {
                    return (
                      <div key={idx} className="flex justify-center my-1">
                        <span className="text-[11px] font-medium text-textMuted bg-secondary/50 px-3 py-1 rounded-full border border-border/50">
                          {m.content}
                        </span>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={idx} className={`${m.role === 'user' ? 'bg-primary text-white dark:text-[#1a2e60] self-end rounded-tr-sm' : 'bg-secondary text-textMain self-start rounded-tl-sm'} rounded-2xl p-4 max-w-[90%] shadow-sm flex items-start gap-3`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                        {m.content}
                      </div>
                    </div>
                  );
                })}
                {isSending && (
                  <div className="bg-secondary self-start rounded-2xl rounded-tl-sm p-4 max-w-[90%] shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-textMuted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-textMuted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-textMuted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-surface border-t border-border shrink-0 flex flex-col gap-2">
                
                {/* Attachments UI */}
                {attachedSnippets.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {attachedSnippets.map((snippet, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-lg px-2 py-1.5 max-w-[200px] shrink-0">
                        <Pin size={12} className="shrink-0" />
                        <span className="text-xs font-medium truncate">{snippet.slice(0, 30)}...</span>
                        <button onClick={() => removeAttachment(idx)} className="hover:text-red-500 shrink-0 ml-1 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}


                  <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-[24px] p-1.5 pl-4 pr-1.5 border border-border focus-within:border-primary/50 transition-colors shadow-inner">
                    <input 
                      type="text" 
                      placeholder="Ask anything"
                      value={inputMessage}
                      onChange={e => setInputMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm text-textMain placeholder-textMuted/70 py-1"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={isSending}
                      className="w-8 h-8 rounded-full bg-primary text-white dark:text-[#1a2e60] flex items-center justify-center hover:scale-105 transition-transform shadow-md disabled:opacity-50"
                    >
                      <Send size={14} className="ml-[-2px]" />
                    </button>
                  </div>
              </div>
        </div>
      )}
    </div>
  );
}

// The main floating component
export default function AIChat() {
  const [activeTab, setActiveTab] = useState<'chat' | 'clipboard' | 'settings'>('chat');
  const { isAIEnabled, isDocked, setIsDocked, isChatOpen, setIsChatOpen, provider, model, setModel } = useAIChat();

  const dragStartPos = useRef({ x: 0, y: 0 });
  const getFabOffset = () => window.innerWidth <= 768 ? 70 : 80;
  
  const [fabPosition, setFabPosition] = useState({ 
    x: window.innerWidth - getFabOffset(), 
    y: window.innerHeight - getFabOffset() 
  });

  useEffect(() => {
    let timeoutId: any;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setFabPosition({ 
          x: window.innerWidth - getFabOffset(), 
          y: window.innerHeight - getFabOffset() 
        });
      }, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // If AI is entirely disabled, hide everything
  if (!isAIEnabled) return null;

  // If docked, we hide the floating window entirely
  if (isDocked) return null;

  if (!isChatOpen) {
    return (
      <Rnd
        key="fab"
        position={fabPosition}
        enableResizing={false}
        bounds="window"
        className="z-50"
        onDragStart={(_e, d) => { dragStartPos.current = { x: d.x, y: d.y }; }}
        onDragStop={(_e, d) => { 
          setFabPosition({ x: d.x, y: d.y });
          const dist = Math.abs(d.x - dragStartPos.current.x) + Math.abs(d.y - dragStartPos.current.y);
          if (dist < 10) {
            setIsChatOpen(true);
          }
        }}
      >
        <button
          className="w-14 h-14 bg-primary text-white dark:text-[#1a2e60] rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-all"
          title="Open AI Assistant"
        >
          <Sparkles size={24} />
        </button>
      </Rnd>
    );
  }

  const isMobile = window.innerWidth <= 768;
  const defaultWidth = isMobile ? window.innerWidth - 20 : 380;
  const defaultHeight = isMobile ? window.innerHeight - 40 : 550;
  const defaultX = Math.max(10, window.innerWidth - defaultWidth - (isMobile ? 10 : 24));
  const defaultY = Math.max(10, window.innerHeight - defaultHeight - (isMobile ? 10 : 24));

  return (
    <Rnd
      key="chat-window"
      default={{
        x: defaultX,
        y: defaultY,
        width: defaultWidth,
        height: defaultHeight,
      }}
      minWidth={300}
      minHeight={400}
      bounds="window"
      dragHandleClassName="drag-handle"
      className="z-50 bg-surface border border-border rounded-[24px] shadow-2xl overflow-hidden"
    >
      <div className="flex flex-col w-full h-full">
        {/* Floating Header */}
        <div className="drag-handle bg-secondary p-3 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-border shrink-0">
        <div className="flex items-center gap-1 px-2">
          <Sparkles size={18} className="text-primary shrink-0 mr-1" />
          <ModelSelector provider={provider} model={model} setModel={setModel} />
        </div>
        <div className="flex items-center gap-1 px-1">
          <button 
            onClick={() => setIsDocked(true)}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Dock to Tabs"
          >
            <PanelLeft size={16} className="text-textMuted" />
          </button>
          <button 
            onClick={() => setActiveTab(t => t === 'settings' ? 'chat' : 'settings')}
            className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${activeTab === 'settings' ? 'bg-black/10 dark:bg-white/10' : ''}`}
            title="Settings"
          >
            <Settings size={16} className="text-textMuted" />
          </button>
          <button 
            onClick={() => setIsChatOpen(false)}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 hover:text-red-500 dark:hover:text-red-500 transition-colors"
            title="Close to FAB"
          >
            <X size={16} className="text-textMuted group-hover:text-red-500" />
          </button>
        </div>
      </div>

        {/* Inner Content */}
        <ChatInnerContent activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </Rnd>
  );
}

// The docked component (rendered by App.tsx)
export function DockedAIChat() {
  const [activeTab, setActiveTab] = useState<'chat' | 'clipboard' | 'settings'>('chat');
  const { setIsDocked, setIsChatOpen, provider, model, setModel } = useAIChat();
  
  return (
    <div className="h-full flex flex-col bg-background relative border-l border-border z-10 w-full min-w-[300px]">
      <div className="h-12 border-b border-border flex items-center justify-between px-3 bg-surface shrink-0">
        <div className="flex items-center gap-1 px-1">
          <Sparkles size={16} className="text-primary shrink-0 mr-1" />
          <ModelSelector provider={provider} model={model} setModel={setModel} />
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsDocked(false)}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Undock to Floating Window"
          >
            <PanelRightClose size={16} className="text-textMuted" />
          </button>
          <button 
            onClick={() => setActiveTab(t => t === 'settings' ? 'chat' : 'settings')}
            className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${activeTab === 'settings' ? 'bg-black/10 dark:bg-white/10' : ''}`}
            title="Settings"
          >
            <Settings size={16} className="text-textMuted" />
          </button>
          <button 
            onClick={() => {
              setIsDocked(false);
              setIsChatOpen(false);
            }}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 hover:text-red-500 dark:hover:text-red-500 transition-colors"
            title="Close to FAB"
          >
            <X size={16} className="text-textMuted group-hover:text-red-500" />
          </button>
        </div>
      </div>
      <ChatInnerContent activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
