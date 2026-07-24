import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type AIProvider = 'openai' | 'groq' | 'anthropic' | 'gemini' | 'openrouter' | 'cerebras' | 'mistral' | 'huggingface' | 'cloudflare' | 'deepseek' | 'github' | 'nvidia' | 'custom';
export type AIMode = 'help' | 'code';
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system_alert';
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
  // Master AI Feature State
  isAIEnabled: boolean;
  setIsAIEnabled: React.Dispatch<React.SetStateAction<boolean>>;

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
  problemDescription: any;
  setProblemDescription: React.Dispatch<React.SetStateAction<any>>;

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
    defaultModel: 'llama-3.1-8b-instant', 
    models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama-4-scout', 'qwen-2.5-coder-32b', 'whisper-large-v3'] 
  },
  anthropic: {
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20240620',
    models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
  },
  gemini: {
    name: 'Google Gemini (AI Studio)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']
  },
  openrouter: {
    name: 'OpenRouter (Free Tier)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      'meta-llama/llama-3.3-70b-instruct:free', 
      'deepseek/deepseek-r1:free',
      'qwen/qwen-3-coder:free',
      'google/gemini-2.5-flash:free', 
      'mistralai/mistral-small:free',
      'nvidia/nemotron-4-340b-instruct:free'
    ]
  },
  cerebras: {
    name: 'Cerebras',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama3.3-70b',
    models: ['llama3.3-70b', 'qwen-large']
  },
  mistral: {
    name: 'Mistral',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    models: ['mistral-small-latest', 'ministral-8b-latest', 'mistral-large-latest']
  },
  huggingface: {
    name: 'Hugging Face',
    defaultBaseUrl: 'https://api-inference.huggingface.co/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3']
  },
  cloudflare: {
    name: 'Cloudflare Workers AI',
    defaultBaseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
    defaultModel: '@cf/meta/llama-3.3-70b-instruct',
    models: ['@cf/meta/llama-3.3-70b-instruct', '@cf/qwen/qwen1.5-14b-chat-awq']
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-reasoner',
    models: ['deepseek-reasoner', 'deepseek-chat']
  },
  github: {
    name: 'GitHub Models',
    defaultBaseUrl: 'https://models.inference.ai.azure.com',
    defaultModel: 'DeepSeek-R1',
    models: ['DeepSeek-R1', 'Llama-3.3-70B-Instruct', 'AI21-Jamba-1.5-Mini']
  },
  nvidia: {
    name: 'NVIDIA NIM',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'nvidia/nemotron-4-340b-instruct']
  },
  custom: { 
    name: 'Custom', 
    defaultBaseUrl: 'http://localhost:11434/v1', 
    defaultModel: 'llama3', 
    models: ['llama3', 'mistral', 'custom-model'] 
  },
};

export const AIChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [isDocked, setIsDocked] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [baseUrl, setBaseUrl] = useState(PROVIDERS.openai.defaultBaseUrl);
  const [model, setModel] = useState(PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [chatMode, setChatMode] = useState<AIMode>('help');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachedSnippets, setAttachedSnippets] = useState<string[]>([]);
  const [problemDescription, setProblemDescription] = useState<any>(() => {
    return localStorage.getItem('openrun_desc') || '';
  });
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

    const storedKey = localStorage.getItem('openrun_ai_key');
    if (storedKey) setApiKey(storedKey);
  }, []);

  const value = {
    isAIEnabled, setIsAIEnabled,
    isChatOpen, setIsChatOpen,
    isDocked, setIsDocked,
    provider, setProvider,
    baseUrl, setBaseUrl,
    model, setModel,
    apiKey, setApiKey,
    chatMode, setChatMode,
    messages, setMessages,
    attachedSnippets, setAttachedSnippets,
    problemDescription, setProblemDescription,
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
