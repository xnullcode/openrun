import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type AIProvider = 'openai' | 'groq' | 'anthropic' | 'gemini' | 'openrouter' | 'cerebras' | 'mistral' | 'huggingface' | 'cloudflare' | 'deepseek' | 'github' | 'nvidia' | 'custom';
export type AIMode = 'help' | 'code';
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'system_alert';
  content: string;
  hiddenContext?: string;
  attachments?: string[];
}

export interface Snippet {
  id: string;
  name: string;
  code: string;
  language?: string;
  pinned: boolean;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface Workspace {
  id: string;
  name: string;
  activeLanguage: 'cpp' | 'java';
  javaCode: string;
  cppCode: string;
  url: string;
  problemDescription: any;
  testCases: TestCase[];
}

interface AIChatContextType {
  // Workspace State
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
  activeWorkspaceId: string;
  setActiveWorkspaceId: React.Dispatch<React.SetStateAction<string>>;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  activeWorkspace: Workspace;

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

  // Auto Send
  autoSendPrompt: string;
  setAutoSendPrompt: React.Dispatch<React.SetStateAction<string>>;

  // Clipboard
  clipboardSnippets: Snippet[];
  setClipboardSnippets: React.Dispatch<React.SetStateAction<Snippet[]>>;

  // Editor Reference
  editorRef: React.MutableRefObject<any> | null;
  setEditorRef: (ref: React.MutableRefObject<any>) => void;

  // Generation Status
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;

  // UI Font Size
  uiFontSize: number;
  setUiFontSize: React.Dispatch<React.SetStateAction<number>>;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export const DEFAULT_JAVA_CODE = `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Read your input here
        // e.g. int n = scanner.nextInt();
        
        System.out.println("Hello, OpenRun!");
    }
}`;

export const DEFAULT_CPP_CODE = `#include <iostream>
#include <vector>

using namespace std;

class Solution {
public:
    int solve(int n) {
        // Your code here
        return n;
    }
};`;

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
    models: [
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.6-27b',
      'groq/compound',
      'groq/compound-mini'
    ] 
  },
  anthropic: {
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20240620',
    models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
  },
  gemini: {
    name: 'Google Gemini (AI Studio)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-3.6-flash',
    models: [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ]
  },
  openrouter: {
    name: 'OpenRouter (Free Tier)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/free',
    models: [
      'openrouter/free',
      'qwen/qwen3-coder:free',
      'moonshotai/kimi-k2.6:free',
      'google/gemma-4-26b-a4b-it:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'minimax/minimax-m2.5:free',
      'nousresearch/hermes-3-llama-3.1-405b:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'liquid/lfm-2.5-1.2b-thinking:free'
    ]
  },
  cerebras: {
    name: 'Cerebras',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'gpt-oss-120b',
    models: ['gpt-oss-120b', 'gemma-4-31b', 'zai-glm-4.7']
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMode, setChatMode] = useState<AIMode>('help');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('openrun_ai_messages');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  const [attachedSnippets, setAttachedSnippets] = useState<string[]>([]);
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem('openrun_workspaces');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migration from old Workspace to new Workspace format
          return parsed.map(p => ({
            id: p.id,
            name: p.name,
            activeLanguage: p.activeLanguage || p.language || 'cpp',
            javaCode: p.javaCode !== undefined ? p.javaCode : (p.language === 'java' ? p.code : DEFAULT_JAVA_CODE),
            cppCode: p.cppCode !== undefined ? p.cppCode : (p.language === 'cpp' ? p.code : DEFAULT_CPP_CODE),
            url: p.url || '',
            problemDescription: p.problemDescription || '',
            testCases: p.testCases || [{ input: '', expectedOutput: '' }]
          }));
        }
      } catch (e) {}
    }
    // Fallback to old keys or default
    return [
      {
        id: '1',
        name: '1',
        activeLanguage: (localStorage.getItem('openrun_language') as 'java' | 'cpp') || 'cpp',
        javaCode: localStorage.getItem('openrun_java_code') || DEFAULT_JAVA_CODE,
        cppCode: localStorage.getItem('openrun_cpp_code') || DEFAULT_CPP_CODE,
        url: '',
        problemDescription: localStorage.getItem('openrun_desc') || '',
        testCases: JSON.parse(localStorage.getItem('openrun_testcases') || '[{"input":"","expectedOutput":""}]')
      },
      {
        id: '2',
        name: '2',
        activeLanguage: 'java',
        javaCode: DEFAULT_JAVA_CODE,
        cppCode: DEFAULT_CPP_CODE,
        url: '',
        problemDescription: '',
        testCases: [{ input: '', expectedOutput: '' }]
      },
      {
        id: '3',
        name: '3',
        activeLanguage: 'cpp',
        javaCode: DEFAULT_JAVA_CODE,
        cppCode: DEFAULT_CPP_CODE,
        url: '',
        problemDescription: '',
        testCases: [{ input: '', expectedOutput: '' }]
      }
    ];
  });
  
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('openrun_active_workspace') || '1';
  });

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  const updateWorkspace = (id: string, updates: Partial<Workspace>) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const [clipboardSnippets, setClipboardSnippets] = useState<Snippet[]>([]);
  const [editorRef, setEditorRef] = useState<React.MutableRefObject<any> | null>(null);
  
  const [autoSendPrompt, setAutoSendPrompt] = useState('');
  const [uiFontSize, setUiFontSize] = useState<number>(() => {
    return parseInt(localStorage.getItem('openrun_ui_fontsize') || '14');
  });

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

    // API key is handled by the provider effect below
  }, []);

  // Update apiKey when provider changes
  useEffect(() => {
    const key = localStorage.getItem(`openrun_ai_key_${provider}`);
    setApiKey(key || '');
  }, [provider]);

  useEffect(() => {
    localStorage.setItem('openrun_workspaces', JSON.stringify(workspaces));
  }, [workspaces]);

  useEffect(() => {
    localStorage.setItem('openrun_active_workspace', activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    localStorage.setItem('openrun_ai_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('openrun_ui_fontsize', uiFontSize.toString());
  }, [uiFontSize]);

  const value = {
    workspaces, setWorkspaces,
    activeWorkspaceId, setActiveWorkspaceId,
    updateWorkspace, activeWorkspace,
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
    clipboardSnippets, setClipboardSnippets,
    editorRef, setEditorRef,
    autoSendPrompt, setAutoSendPrompt,
    isGenerating, setIsGenerating,
    uiFontSize, setUiFontSize
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
