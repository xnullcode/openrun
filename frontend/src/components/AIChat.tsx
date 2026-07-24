import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Sparkles, X, Send, Settings, Lock, Unlock, Save, Eye, EyeOff, Pin, Trash2, PanelRightClose, PanelLeft } from 'lucide-react';
import { encryptData, decryptData } from '../utils/crypto';
import { useAIChat, type AIProvider } from '../context/AIChatContext';

const PROVIDERS: Record<string, { name: string; defaultBaseUrl: string; defaultModel: string }> = {
  openai: { name: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  groq: { name: 'Groq', defaultBaseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.1-70b-versatile' },
  custom: { name: 'Custom (OpenAI Compatible)', defaultBaseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' },
};

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
    isUnlocked, setIsUnlocked,
    chatMode, setChatMode,
    attachedSnippets, setAttachedSnippets,
    isDocked, setIsDocked,
    editorRef
  } = useAIChat();

  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    localStorage.setItem('openrun_ai_provider', p);
    if (p !== 'custom' && p !== 'anthropic' && p !== 'gemini') {
      setBaseUrl(PROVIDERS[p].defaultBaseUrl);
      setModel(PROVIDERS[p].defaultModel);
      localStorage.setItem('openrun_ai_baseUrl', PROVIDERS[p].defaultBaseUrl);
      localStorage.setItem('openrun_ai_model', PROVIDERS[p].defaultModel);
    }
  };

  const handleUnlock = async () => {
    setErrorMsg('');
    const encryptedKey = localStorage.getItem('openrun_ai_key_enc');
    if (!encryptedKey) {
      setIsUnlocked(true);
      return;
    }
    try {
      const dec = await decryptData(encryptedKey, password);
      setApiKey(dec);
      setIsUnlocked(true);
      setPassword('');
    } catch (e) {
      setErrorMsg('Incorrect password or corrupted data.');
    }
  };

  const handleSaveKey = async () => {
    if (!password) {
      setErrorMsg('You must set a password to encrypt the key.');
      return;
    }
    setErrorMsg('');
    try {
      const enc = await encryptData(apiKey, password);
      localStorage.setItem('openrun_ai_key_enc', enc);
      localStorage.setItem('openrun_ai_baseUrl', baseUrl);
      localStorage.setItem('openrun_ai_model', model);
      setIsUnlocked(true);
      setPassword('');
      setActiveTab('chat');
    } catch (e) {
      setErrorMsg('Failed to encrypt key.');
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('openrun_ai_key_enc');
    setApiKey('');
    setIsUnlocked(true);
  };

  const removeAttachment = (index: number) => {
    setAttachedSnippets(prev => prev.filter((_, i) => i !== index));
  };

  const handleAttachSelection = () => {
    if (editorRef?.current) {
      const selection = editorRef.current.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = editorRef.current.getModel()?.getValueInRange(selection);
        if (text) {
          setAttachedSnippets(prev => [...prev, text]);
        }
      }
    }
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
              <button
                onClick={() => setIsDocked(!isDocked)}
                className="text-xs bg-secondary hover:bg-border text-textMain px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
              >
                {isDocked ? 'Switch to Floating' : 'Switch to Docked'}
              </button>
            </div>
            <p className="text-xs text-textMuted mb-3">Configure your AI provider and model.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1 block">Provider</label>
                <select 
                  value={provider} 
                  onChange={e => handleProviderChange(e.target.value as AIProvider)}
                  className="w-full bg-secondary border-none rounded-lg p-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
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
                  className="w-full bg-secondary border-none rounded-lg p-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1 block">Model</label>
                <input 
                  type="text" 
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-secondary border-none rounded-lg p-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 pb-10">
            <h3 className="font-semibold text-textMain flex items-center gap-2 mb-1">
              <Lock size={16} /> API Security
            </h3>
            <p className="text-xs text-textMuted mb-3">
              Your API key is encrypted with AES-GCM and stored locally. Set a password to encrypt it.
            </p>

            {!isUnlocked && (
              <div className="space-y-3 bg-secondary/50 p-3 rounded-xl border border-border">
                <p className="text-sm font-medium text-textMain mb-2">Unlock your API Key</p>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Session Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-secondary border-none rounded-lg p-2 pr-8 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
                <button 
                  onClick={handleUnlock}
                  className="w-full bg-primary text-white dark:text-[#1a2e60] rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Unlock size={14} /> Unlock Session
                </button>
              </div>
            )}

            {isUnlocked && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1 block">API Key</label>
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-secondary border-none rounded-lg p-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1 block">Encryption Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Set a password to encrypt"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-secondary border-none rounded-lg p-2 pr-8 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                    />
                    <button 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveKey}
                    className="flex-1 bg-primary text-white dark:text-[#1a2e60] rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Save size={14} /> Save & Encrypt
                  </button>
                  {localStorage.getItem('openrun_ai_key_enc') && (
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
            )}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Mode Toggle Header */}
          <div className="flex justify-center p-2 bg-secondary/30 border-b border-border shrink-0 backdrop-blur-sm z-10 relative">
            <div className="flex items-center gap-1 bg-surface p-1 rounded-full border border-border">
              <button 
                onClick={() => setChatMode('help')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${chatMode === 'help' ? 'bg-primary text-white dark:text-[#1a2e60] shadow-sm' : 'text-textMuted hover:text-textMain'}`}
              >
                Help Mode
              </button>
              <button 
                onClick={() => setChatMode('code')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${chatMode === 'code' ? 'bg-primary text-white dark:text-[#1a2e60] shadow-sm' : 'text-textMuted hover:text-textMain'}`}
              >
                Code Mode
              </button>
            </div>
          </div>

          {!isUnlocked ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Lock size={48} className="text-textMuted mb-4 opacity-50" />
              <p className="text-sm font-medium text-textMain mb-2">API Key Locked</p>
              <p className="text-xs text-textMuted mb-4">Please unlock your API key in the settings to start chatting.</p>
              <button 
                onClick={() => setActiveTab('settings')}
                className="bg-secondary hover:bg-border text-textMain px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Go to Settings
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar pb-6">
                <div className="bg-secondary self-start rounded-2xl rounded-tl-sm p-4 max-w-[90%] shadow-sm border border-border flex items-start gap-3">
                  <p className="text-sm text-textMain leading-relaxed pt-1">
                    Hello! I'm your AI coding assistant. I'm currently in <span className="font-bold text-primary">{chatMode === 'help' ? 'Helping Mode' : 'Full Code Mode'}</span>.
                    <br/><br/>
                    Highlight code in the editor and click "Attach Selection" to ask me about it!
                  </p>
                </div>
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

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={handleAttachSelection}
                      className="text-[10px] uppercase tracking-wider font-bold bg-secondary hover:bg-border text-textMuted hover:text-textMain px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                      title="Attach selected code from editor"
                    >
                      <Pin size={10} /> Attach Selection
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-secondary rounded-[24px] p-1.5 pl-4 pr-1.5 border border-border focus-within:border-primary/50 transition-colors shadow-inner">
                    <input 
                      type="text" 
                      placeholder="Ask Anything"
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm text-textMain py-1"
                    />
                    <button className="w-8 h-8 rounded-full bg-primary text-white dark:text-[#1a2e60] flex items-center justify-center hover:scale-105 transition-transform shadow-md">
                      <Send size={14} className="ml-[-2px]" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// The main floating component
export default function AIChat() {
  const [activeTab, setActiveTab] = useState<'chat' | 'clipboard' | 'settings'>('chat');
  const { isDocked, setIsDocked, isChatOpen, setIsChatOpen } = useAIChat();

  const isDraggingRef = useRef(false);
  const [fabPosition, setFabPosition] = useState({ 
    x: window.innerWidth - 80, 
    y: window.innerHeight - 80 
  });

  useEffect(() => {
    const handleResize = () => {
      setFabPosition({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        onDragStart={() => { isDraggingRef.current = false; }}
        onDrag={() => { isDraggingRef.current = true; }}
        onDragStop={(_e, d) => { 
          setFabPosition({ x: d.x, y: d.y });
          // Reset dragging state after a tiny delay so onClick can check it
          setTimeout(() => { isDraggingRef.current = false; }, 50);
        }}
      >
        <button
          onClick={() => {
            if (!isDraggingRef.current) setIsChatOpen(true);
          }}
          className="w-14 h-14 bg-primary text-white dark:text-[#1a2e60] rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-all"
          title="Open AI Assistant"
        >
          <Sparkles size={24} />
        </button>
      </Rnd>
    );
  }

  const defaultWidth = Math.min(380, window.innerWidth - 40);
  const defaultHeight = Math.min(550, window.innerHeight - 100);
  const defaultX = Math.max(20, window.innerWidth - defaultWidth - 24);
  const defaultY = Math.max(20, window.innerHeight - defaultHeight - 24);

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
        <div className="flex items-center gap-2 px-2">
          <Sparkles size={18} className="text-primary" />
          <span className="font-bold text-textMain text-sm">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
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
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={16} className="text-textMuted" />
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
  const { setIsDocked } = useAIChat();
  
  return (
    <div className="flex flex-col h-full w-full bg-surface relative">
      <div className="bg-secondary p-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2 px-2">
          <Sparkles size={18} className="text-primary" />
          <span className="font-bold text-textMain text-sm">AI Assistant</span>
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
        </div>
      </div>
      <ChatInnerContent activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
