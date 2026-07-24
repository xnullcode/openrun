import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type AIProvider = 'openai' | 'groq' | 'anthropic' | 'gemini' | 'openrouter' | 'custom';
export type AIMode = 'help' | 'code';
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Snippet {
  id: string;
  name: string;
  code: string;
  language?: string;
  pinned: boolean;
}

interface AIChatContextType {
  // Docking State
  isDocked: boolean;
  setIsDocked: (val: boolean) => void;

  // Settings State
  provider: AIProvider;
  setProvider: (val: AIProvider) => void;
  baseUrl: string;
  setBaseUrl: (val: string) => void;
  model: string;
  setModel: (val: string) => void;
  apiKey: string;
  setApiKey: (val: string) => void;
  isUnlocked: boolean;
  setIsUnlocked: (val: boolean) => void;
  
  // Chat State
  chatMode: AIMode;
  setChatMode: (val: AIMode) => void;
  // Visibility
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  attachedSnippets: string[];
  setAttachedSnippets: React.Dispatch<React.SetStateAction<string[]>>;

  // Clipboard
  clipboardSnippets: Snippet[];
  setClipboardSnippets: React.Dispatch<React.SetStateAction<Snippet[]>>;

  // Editor Reference
  editorRef: React.MutableRefObject<any> | null;
  setEditorRef: (ref: React.MutableRefObject<any>) => void;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export const PROVIDERS: Record<string, { name: string; defaultBaseUrl: string; defaultModel: string; models: string[] }> = {
  openai: { 
    name: 'OpenAI', 
    defaultBaseUrl: 'https://api.openai.com/v1', 
    defaultModel: 'gpt-4o', 
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] 
  },
  groq: { 
    name: 'Groq', 
    defaultBaseUrl: 'https://api.groq.com/openai/v1', 
    defaultModel: 'llama-3.1-70b-versatile', 
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] 
  },
  anthropic: {
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20240620',
    models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
  },
  gemini: {
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-1.5-pro',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro']
  },
  openrouter: {
    name: 'OpenRouter (Free Tier)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
    models: [
      'meta-llama/llama-3.1-8b-instruct:free', 
      'google/gemini-pro:free', 
      'mistralai/mistral-7b-instruct:free',
      'meta-llama/llama-3.1-70b-instruct',
      'anthropic/claude-3.5-sonnet', 
      'openai/gpt-4o'
    ]
  },
  custom: { 
    name: 'Custom', 
    defaultBaseUrl: 'http://localhost:11434/v1', 
    defaultModel: 'llama3', 
    models: ['llama3', 'mistral', 'custom-model'] 
  },
};

export const AIChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [baseUrl, setBaseUrl] = useState(PROVIDERS.openai.defaultBaseUrl);
  const [model, setModel] = useState(PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [chatMode, setChatMode] = useState<AIMode>('help');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachedSnippets, setAttachedSnippets] = useState<string[]>([]);
  const [clipboardSnippets, setClipboardSnippets] = useState<Snippet[]>([]);
  const [editorRef, setEditorRef] = useState<React.MutableRefObject<any> | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem('openrun_ai_provider') as AIProvider;
    if (savedProvider) setProvider(savedProvider);
    const savedBaseUrl = localStorage.getItem('openrun_ai_baseUrl');
    if (savedBaseUrl) setBaseUrl(savedBaseUrl);
    const savedModel = localStorage.getItem('openrun_ai_model');
    if (savedModel) setModel(savedModel);
    
    const savedSnippets = localStorage.getItem('openrun_clipboard');
    if (savedSnippets) {
      try {
        setClipboardSnippets(JSON.parse(savedSnippets));
      } catch (e) {}
    }

    const encryptedKey = localStorage.getItem('openrun_ai_key_enc');
    if (encryptedKey) {
      setIsUnlocked(false);
    } else {
      setIsUnlocked(true);
    }
  }, []);

  const value = {
    isChatOpen, setIsChatOpen,
    isDocked, setIsDocked,
    provider, setProvider,
    baseUrl, setBaseUrl,
    model, setModel,
    apiKey, setApiKey,
    isUnlocked, setIsUnlocked,
    chatMode, setChatMode,
    messages, setMessages,
    attachedSnippets, setAttachedSnippets,
    clipboardSnippets, setClipboardSnippets,
    editorRef, setEditorRef
  };

  return <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>;
};

export const useAIChat = () => {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error('useAIChat must be used within an AIChatProvider');
  }
  return context;
};
