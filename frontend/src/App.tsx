import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import Editor from '@monaco-editor/react';
import { Play, Download, Plus, Minus, Trash2, CheckCircle, XCircle, Cpu, Columns, Rows, RotateCcw, Sun, Moon, Settings, BookOpen, Sparkles, Type } from 'lucide-react';
import axios from 'axios';
import { Group, Panel, Separator } from 'react-resizable-panels';
import Timer from './components/Timer';
import AIChat, { DockedAIChat } from './components/AIChat';
import { useAIChat, DEFAULT_CPP_CODE, DEFAULT_JAVA_CODE, type TestCase } from './context/AIChatContext';

interface TestResult {
  testCaseIndex: number;
  passed: boolean;
  output: string;
  expectedOutput: string;
  error: string;
  executionTimeMs: number;
  memoryUsed: string;
}

function App() {
  const { 
    workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId, updateWorkspace, activeWorkspace,
    isDocked, setEditorRef, setIsChatOpen, isAIEnabled, setIsAIEnabled, setAttachedSnippets, 
    setAutoSendPrompt, isGenerating, uiFontSize, setUiFontSize 
  } = useAIChat();
  const language = activeWorkspace.activeLanguage;
  const code = language === 'java' ? activeWorkspace.javaCode : activeWorkspace.cppCode;
  
  const setCode = (val: string) => {
    if (language === 'java') {
      updateWorkspace(activeWorkspaceId, { javaCode: val });
    } else {
      updateWorkspace(activeWorkspaceId, { cppCode: val });
    }
  };
  
  const testCases = activeWorkspace.testCases;
  const setTestCases = (val: TestCase[]) => updateWorkspace(activeWorkspaceId, { testCases: val });
  
  const setLanguage = (val: 'java' | 'cpp') => updateWorkspace(activeWorkspaceId, { activeLanguage: val });
  
  const scrapeUrl = activeWorkspace.url;
  const setScrapeUrl = (val: string) => updateWorkspace(activeWorkspaceId, { url: val });
  
  const problemDescription = activeWorkspace.problemDescription;

  const [results, setResults] = useState<TestResult[]>([]);
  const [activeTab, setActiveTab] = useState<'description' | 'tests' | 'results' | 'ai'>('description');
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const editorRef = useRef<any>(null);

  const [selectionPopup, setSelectionPopup] = useState<{ x: number, y: number, text: string, source: 'editor' | 'dom' } | null>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    setEditorRef(editorRef);

    const updateEditorPopup = () => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = editor.getModel()?.getValueInRange(selection);
        const domNode = editor.getDomNode();
        if (text && domNode) {
          const pos = editor.getScrolledVisiblePosition(selection.getStartPosition());
          if (pos) {
            const rect = domNode.getBoundingClientRect();
            setSelectionPopup({
              x: rect.left + pos.left,
              y: rect.top + pos.top,
              text,
              source: 'editor'
            });
            return;
          }
        }
      }
      setSelectionPopup(prev => prev?.source === 'editor' ? null : prev);
    };

    editor.onDidChangeCursorSelection(updateEditorPopup);
    editor.onDidScrollChange(updateEditorPopup);
  };

  useEffect(() => {
    const handleDOMSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionPopup(prev => prev?.source === 'dom' ? null : prev);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setSelectionPopup(prev => prev?.source === 'dom' ? null : prev);
        return;
      }

      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;

      const element = anchorNode.nodeType === Node.ELEMENT_NODE 
        ? (anchorNode as Element) 
        : anchorNode.parentElement;

      const container = element?.closest('.aichat-content') || element?.closest('.problem-description');
      if (container && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (rect.bottom < containerRect.top || rect.top > containerRect.bottom || rect.width === 0) {
          setSelectionPopup(prev => prev?.source === 'dom' ? null : prev);
        } else {
          setSelectionPopup({
            x: rect.left + rect.width / 2,
            y: rect.top,
            text,
            source: 'dom'
          });
        }
      } else {
        setSelectionPopup(prev => prev?.source === 'dom' ? null : prev);
      }
    };

    const handleMouseUp = () => {
      setTimeout(handleDOMSelection, 20);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('selectionchange', handleDOMSelection);
    window.addEventListener('scroll', handleDOMSelection, true);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
      document.removeEventListener('selectionchange', handleDOMSelection);
      window.removeEventListener('scroll', handleDOMSelection, true);
    };
  }, []);

  const handleAskAI = () => {
    if (selectionPopup) {
      setAttachedSnippets(prev => [...prev, selectionPopup.text]);
      if (isDocked) {
        setActiveTab('ai');
      } else {
        setIsChatOpen(true);
      }
      setSelectionPopup(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleOptimizeAI = () => {
    if (!isAIEnabled || isGenerating) return;
    const currentCode = editorRef?.current?.getValue();
    if (currentCode) {
      setAttachedSnippets(prev => [...prev, currentCode]);
      setAutoSendPrompt("I've got this solution working, but I want to optimize it further. Could you analyze the current time and space complexity, and then guide me step-by-step on how to optimize it? Please provide the optimized code with normal, clear comments explaining the changes.\n\nCRITICAL: Do NOT generate any `main` class, `main` object, or `int main()` function. Please provide ONLY the raw solution class/function logic!");
      if (isDocked) {
        setActiveTab('ai');
      } else {
        setIsChatOpen(true);
      }
    }
  };

  useEffect(() => {
    if (isDocked && isAIEnabled) {
      setActiveTab('ai');
    } else if (activeTab === 'ai') {
      setActiveTab('description');
    }
  }, [isDocked, isAIEnabled]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  
  // Layout & Settings state
  const [layoutOrientation, setLayoutOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('openrun_theme') as 'light' | 'dark') || 'dark');
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('openrun_fontsize') || '14'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showToolsPane, setShowToolsPane] = useState(() => localStorage.getItem('openrun_show_tools') !== 'false');

  useEffect(() => {
    localStorage.setItem('openrun_show_tools', showToolsPane.toString());
  }, [showToolsPane]);

  useEffect(() => {
    localStorage.setItem('openrun_fontsize', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setLayoutOrientation("vertical");
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('openrun_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleResetAll = () => {
    if (window.confirm("FACTORY RESET: Are you sure you want to reset all workspaces, settings, and chat history? This cannot be undone.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleRun = async () => {
    setIsLoading(true);
    setResults([]);
    setActiveTab('results');
    setActiveCaseIndex(0); // Reset to first case on new run
    try {
      const res = await axios.post('/api/execute', { code, testCases, language });
      if (res.data.success) {
        setResults(res.data.results);
      }
    } catch (err: any) {
      setResults([{
        testCaseIndex: -1,
        passed: false,
        output: '',
        expectedOutput: '',
        error: err.response?.data?.detail || err.message || "Unknown error",
        executionTimeMs: 0,
        memoryUsed: 'N/A'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    setIsScraping(true);
    try {
      const res = await axios.post('/api/scrape', { url: scrapeUrl });
      if (res.data.success && res.data.test_cases && res.data.test_cases.length > 0) {
        
        const updates: Partial<any> = {
          testCases: res.data.test_cases
        };

        if (res.data.starting_code_java) {
          updates.javaCode = res.data.starting_code_java;
        }
        if (res.data.starting_code_cpp) {
          updates.cppCode = res.data.starting_code_cpp;
        }
        if (res.data.description_html) {
          updates.problemDescription = res.data.description_html;
        }

        updateWorkspace(activeWorkspaceId, updates);
        setActiveCaseIndex(0);
        setActiveTab('description');
      } else {
        alert("No test cases found or scraping failed.");
      }
    } catch (err: any) {
      alert("Scraping error: " + (err.response?.data?.detail || err.message || err));
    } finally {
      setIsScraping(false);
    }
  };

  const addTestCase = () => {
    const newIdx = testCases.length;
    setTestCases([...testCases, { input: '', expectedOutput: '' }]);
    setActiveCaseIndex(newIdx);
  };

  const removeTestCase = (index: number) => {
    const newTc = [...testCases];
    newTc.splice(index, 1);
    
    // Always keep at least one empty test case for UX, or just allow 0.
    // Leetcode allows 0 but better to keep 1. Let's allow 0 for simplicity.
    if (newTc.length === 0) {
      setTestCases([{ input: '', expectedOutput: '' }]);
      setActiveCaseIndex(0);
    } else {
      setTestCases(newTc);
      if (activeCaseIndex >= newTc.length) {
        setActiveCaseIndex(newTc.length - 1);
      }
    }
  };

  const updateTestCase = (index: number, field: keyof TestCase, value: string) => {
    const newTc = [...testCases];
    newTc[index][field] = value;
    setTestCases(newTc);
  };

  // Safe index resolution for rendering
  const currentTest = testCases[activeCaseIndex] || testCases[0];
  
  // Results derivation
  const safeResultIndex = activeCaseIndex < results.length ? activeCaseIndex : 0;
  const currentResult = results[safeResultIndex];
  const allPassed = results.every(r => r.passed);
  const hasExpectedOutput = results.some(r => r.expectedOutput && r.expectedOutput.trim() !== "");
  const totalRuntime = results.reduce((acc, curr) => acc + curr.executionTimeMs, 0);
  const globalStatus = results.length > 0 
    ? (results[0].testCaseIndex === -1 
        ? "Error" 
        : (allPassed 
            ? (hasExpectedOutput ? "Accepted" : "Output Generated") 
            : "Wrong Answer")) 
    : "";

  const editorPanelContent = (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 text-sm font-medium text-textMuted shrink-0">
        
        {/* Left: Language Selector */}
        <div className="flex items-center gap-1 bg-secondary p-1 rounded-md border border-border">
          <button 
            onClick={() => setLanguage('java')}
            className={`px-3 py-1 rounded-sm text-xs font-bold transition-all ${language === 'java' ? 'bg-primary text-white dark:text-[#1a2e60] shadow-sm' : 'text-textMuted hover:text-textMain'}`}
          >
            Java
          </button>
          <button 
            onClick={() => setLanguage('cpp')}
            className={`px-3 py-1 rounded-sm text-xs font-bold transition-all ${language === 'cpp' ? 'bg-primary text-white dark:text-[#1a2e60] shadow-sm' : 'text-textMuted hover:text-textMain'}`}
          >
            C++
          </button>
        </div>

        {/* Center: Workspace Tabs (Material You Style) */}
        <div className="hidden sm:flex items-center gap-1.5 p-1 bg-black/10 dark:bg-white/5 rounded-full px-2 mx-2">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => setActiveWorkspaceId(w.id)}
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 ${w.id === activeWorkspaceId ? 'bg-primary text-white dark:text-[#1a2e60] shadow-md' : 'text-textMuted hover:bg-black/5 dark:hover:bg-white/10 hover:text-textMain'}`}
            >
              {w.name}
            </button>
          ))}
          <button
            onClick={() => {
              const newId = Date.now().toString();
              const newName = (workspaces.length + 1).toString();
              setWorkspaces([...workspaces, {
                id: newId,
                name: newName,
                activeLanguage: 'cpp',
                javaCode: DEFAULT_JAVA_CODE,
                cppCode: DEFAULT_CPP_CODE,
                url: '',
                problemDescription: '',
                testCases: [{ input: '', expectedOutput: '' }]
              }]);
              setActiveWorkspaceId(newId);
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-textMuted hover:bg-black/5 dark:hover:bg-white/10 hover:text-textMain transition-all ml-0.5"
            title="New Workspace"
          >
            <Plus size={16} />
          </button>

          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to reset this workspace? This will clear its code and test cases.")) {
                updateWorkspace(activeWorkspaceId, {
                  javaCode: DEFAULT_JAVA_CODE,
                  cppCode: DEFAULT_CPP_CODE,
                  testCases: [{ input: '', expectedOutput: '' }],
                  problemDescription: '',
                  url: ''
                });
                setScrapeUrl('');
              }
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-textMuted hover:bg-black/5 dark:hover:bg-white/10 hover:text-textMain transition-all ml-0.5"
            title="Reset Current Workspace"
          >
            <RotateCcw size={14} />
          </button>
          
          {workspaces.length > 2 && (
            <button
              onClick={() => {
                const newWorkspaces = workspaces.filter(w => w.id !== activeWorkspaceId);
                const renumbered = newWorkspaces.map((w, i) => ({ ...w, name: (i + 1).toString() }));
                setWorkspaces(renumbered);
                setActiveWorkspaceId(renumbered[0].id);
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-400/10 hover:text-red-500 transition-all ml-0.5"
              title="Delete Current Workspace"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Right: Font Size */}
        <div className="flex items-center gap-1.5 bg-secondary px-2 py-1 rounded-md">
          <button onClick={() => setFontSize(f => Math.max(10, f - 1))} className="hover:text-textMain transition-colors" title="Decrease Font Size">
            <Minus size={14} />
          </button>
          <span className="w-5 text-center text-xs text-textMain select-none">{fontSize}</span>
          <button onClick={() => setFontSize(f => Math.min(30, f + 1))} className="hover:text-textMain transition-colors" title="Increase Font Size">
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={code}
          onChange={(val: string | undefined) => setCode(val || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: fontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            padding: { top: 16 },
            mouseWheelZoom: true,
            automaticLayout: true
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-textMain overflow-hidden font-sans">
      {/* Header */}
      <header className="py-2 min-h-[56px] border-b border-border bg-surface px-2 md:px-6 flex flex-wrap md:flex-nowrap items-center justify-between gap-y-3 shadow-md z-50 shrink-0">
        
        {/* Left side: Logo */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="bg-primary p-1.5 rounded-lg text-surface dark:text-[#1a2e60]">
            <Cpu size={18} />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-textMain hidden min-[414px]:block">OpenRun</h1>
        </div>

        {/* Center: URL Input */}
        <div className="flex items-center w-full md:w-auto md:flex-1 md:max-w-lg md:mx-6 order-last md:order-none shrink-0 md:shrink">
          <div className="flex-1 flex gap-1 bg-secondary border border-border p-1 rounded-lg">
            <input 
              type="text" 
              placeholder="Paste LeetCode/takeUforward URL" 
              className="bg-transparent border-none text-textMain placeholder:text-textMuted focus:ring-0 text-sm flex-1 px-3 py-1 outline-none min-w-[150px]"
              value={scrapeUrl}
              onChange={e => setScrapeUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScrape()}
            />
            <button 
              onClick={handleScrape}
              disabled={isScraping || !scrapeUrl}
              className="bg-primary hover:opacity-90 text-surface dark:text-[#1a2e60] rounded-md px-3 py-1.5 flex items-center justify-center transition-colors disabled:opacity-50 min-w-[32px]"
              title="Scrape Problem"
            >
              {isScraping ? (
                 <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                 <Download size={14} />
              )}
            </button>
          </div>
        </div>

        {/* Right side: Action Buttons */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          <Timer />

          <button 
            onClick={handleResetAll}
            className="p-1.5 rounded-lg text-textMuted hover:text-textMain hover:bg-secondary transition-colors h-9 w-9 flex items-center justify-center ml-1"
            title="Factory Reset (Clear all data)"
          >
            <RotateCcw size={16} />
          </button>

          <div className="relative flex items-center h-9">
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`p-1.5 rounded-lg transition-colors h-9 w-9 flex items-center justify-center ${isSettingsOpen ? 'bg-secondary text-textMain' : 'text-textMuted hover:text-textMain hover:bg-secondary'}`} title="Settings">
              <Settings size={16} />
            </button>
            {/* Settings Dropdown (Material You Style) */}
            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)}></div>
                <div className="fixed sm:absolute top-[70px] sm:top-full left-1/2 sm:left-auto right-auto sm:right-0 -translate-x-1/2 sm:translate-x-0 sm:mt-2 w-[95vw] sm:w-[320px] max-w-[350px] bg-[#1c1d21] rounded-[24px] p-4 shadow-2xl z-50 border border-white/5">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Theme Toggle */}
                    <button 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={`flex flex-col items-start p-4 rounded-[20px] transition-colors ${theme === 'dark' ? 'bg-primary text-white dark:text-[#1a2e60]' : 'bg-[#303034] text-white hover:bg-[#3a3a3f]'}`}
                    >
                      <div className="mb-2">{theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}</div>
                      <span className="font-medium text-sm">Theme</span>
                      <span className="text-xs opacity-70">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                    </button>

                    {/* Layout Toggle */}
                    <button 
                      onClick={() => setLayoutOrientation(layoutOrientation === 'horizontal' ? 'vertical' : 'horizontal')}
                      className={`flex flex-col items-start p-4 rounded-[20px] transition-colors ${layoutOrientation === 'vertical' ? 'bg-primary text-white dark:text-[#1a2e60]' : 'bg-[#303034] text-white hover:bg-[#3a3a3f]'}`}
                    >
                      <div className="mb-2">{layoutOrientation === 'horizontal' ? <Columns size={20} /> : <Rows size={20} />}</div>
                      <span className="font-medium text-sm">Layout</span>
                      <span className="text-xs opacity-70">{layoutOrientation === 'horizontal' ? 'Side-by-Side' : 'Top & Bottom'}</span>
                    </button>

                    {/* Tools Pane Toggle */}
                    <button 
                      onClick={() => setShowToolsPane(!showToolsPane)}
                      className={`flex flex-col items-start p-4 rounded-[20px] transition-colors col-span-1 ${showToolsPane ? 'bg-primary text-white dark:text-[#1a2e60]' : 'bg-[#303034] text-white hover:bg-[#3a3a3f]'}`}
                    >
                      <div className="mb-2"><BookOpen size={20} /></div>
                      <span className="font-medium text-sm">Tools Pane</span>
                      <span className="text-xs opacity-70">{showToolsPane ? 'Enabled' : 'Disabled'}</span>
                    </button>

                    {/* AI Mode Toggle */}
                    <button 
                      onClick={() => setIsAIEnabled(!isAIEnabled)}
                      className={`flex flex-col items-start p-4 rounded-[20px] transition-colors ${isAIEnabled ? 'bg-primary text-white dark:text-[#1a2e60]' : 'bg-[#303034] text-white hover:bg-[#3a3a3f]'}`}
                    >
                      <div className="mb-2"><Sparkles size={20} /></div>
                      <span className="font-medium text-sm">AI Chat</span>
                      <span className="text-xs opacity-70">{isAIEnabled ? 'Enabled' : 'Disabled'}</span>
                    </button>

                    {/* Text Font Size Control */}
                    <div className="col-span-2 flex items-center justify-between p-3.5 rounded-[20px] bg-[#303034] text-white">
                      <div className="flex items-center gap-2">
                        <Type size={18} className="text-blue-400" />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">Text Font Size</span>
                          <span className="text-xs opacity-70">Chat & Description</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl">
                        <button 
                          onClick={() => setUiFontSize(s => Math.max(12, s - 1))}
                          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                          title="Decrease Text Font Size"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-5 text-center text-xs font-bold">{uiFontSize}</span>
                        <button 
                          onClick={() => setUiFontSize(s => Math.min(22, s + 1))}
                          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                          title="Increase Text Font Size"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={handleOptimizeAI}
            disabled={isGenerating}
            className={`group h-9 w-9 ml-0.5 rounded-lg flex items-center justify-center transition-colors border ${isGenerating ? 'bg-secondary/10 border-border/20 opacity-50 cursor-not-allowed' : 'bg-secondary/20 hover:bg-primary/10 border-border hover:border-primary/50 text-textMain'}`}
            title={isGenerating ? "AI is busy..." : "Guide & Optimize"}
          >
            <Sparkles size={16} className={`text-primary ${!isGenerating && 'group-hover:text-blue-400 transition-colors'}`} />
          </button>

          <button 
            onClick={handleRun}
            disabled={isLoading}
            className="bg-primary hover:opacity-90 text-surface dark:text-[#1a2e60] h-9 px-3 md:px-4 ml-0.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
               <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
               <Play size={14} fill="currentColor" />
            )}
            <span className="hidden md:inline font-medium text-sm">{isLoading ? 'Running' : 'Run'}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {showToolsPane ? (
          <Group 
            key={`${layoutOrientation}-${showToolsPane}`}
            orientation={layoutOrientation} 
            className="w-full h-full"
          >
            {/* Editor Panel */}
            <Panel defaultSize={50} minSize={20} className="flex flex-col bg-background">
              {editorPanelContent}
            </Panel>

            <Separator 
              className={`transition-colors flex items-center justify-center group ${
                layoutOrientation === "horizontal" 
                  ? "w-2 h-full bg-surface border-x border-border hover:bg-primary/20 cursor-col-resize active:bg-primary/40" 
                  : "h-2 w-full bg-surface border-y border-border hover:bg-primary/20 cursor-row-resize active:bg-primary/40"
              }`}
            >
              <div className={`${layoutOrientation === "horizontal" ? "h-8 w-1" : "w-8 h-1"} bg-gray-600 rounded-full group-hover:bg-primary transition-colors`} />
            </Separator>

            {/* Right/Bottom Pane - Test Cases & Results */}
            {/* Right/Bottom Pane - Test Cases & Results */}
            <Panel defaultSize={50} minSize={20} className="flex flex-col bg-background">
            {/* Tabs Header */}
            <div className="h-10 bg-surface border-b border-border flex shrink-0">
              <button 
                className={`flex-1 text-sm font-medium transition-colors ${activeTab === 'description' ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-white'}`}
                onClick={() => setActiveTab('description')}
              >
                Description
              </button>
              <button 
                className={`flex-1 text-sm font-medium transition-colors ${activeTab === 'tests' ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-white'}`}
                onClick={() => setActiveTab('tests')}
              >
                Testcases
              </button>
              <button 
                className={`flex-1 text-sm font-medium transition-colors ${activeTab === 'results' ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-white'}`}
                onClick={() => setActiveTab('results')}
              >
                Test Result
              </button>
              {isAIEnabled && isDocked && (
                <button 
                  className={`flex-1 text-sm font-medium transition-colors ${activeTab === 'ai' ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-white'}`}
                  onClick={() => setActiveTab('ai')}
                >
                  AI Chat
                </button>
              )}
            </div>

            {/* Pane Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab === 'description' && (
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar problem-description text-sm text-textMain" style={{ fontSize: `${uiFontSize}px` }}>
                  {problemDescription ? (
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(problemDescription) }} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-textMuted">
                      <p>Scrape a problem to see its description here.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'ai' && isDocked && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <DockedAIChat />
                </div>
              )}

              {activeTab === 'tests' && (
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                  {/* Test Case Tab Navigation */}
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 shrink-0">
                    {testCases.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveCaseIndex(idx)}
                        className={`px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${activeCaseIndex === idx ? 'bg-primary/20 text-primary' : 'text-textMuted hover:bg-secondary/50'}`}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                    <button 
                      onClick={addTestCase}
                      className="px-3 py-1 text-sm font-medium rounded-md text-textMuted hover:bg-secondary/50 transition-colors flex items-center justify-center"
                      title="Add Test Case"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Active Test Case Content */}
                  {currentTest && (
                    <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-2 custom-scrollbar">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-textMain">Test Case {activeCaseIndex + 1}</h4>
                        <button 
                          onClick={() => removeTestCase(activeCaseIndex)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 text-xs"
                          title="Delete Test Case"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-textMuted">Input</label>
                        <textarea
                          className="w-full bg-secondary rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textMain resize-y min-h-[100px]"
                          value={currentTest.input}
                          onChange={e => updateTestCase(activeCaseIndex, 'input', e.target.value)}
                          placeholder="Enter input..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-textMuted">Expected Output</label>
                        <textarea
                          className="w-full bg-secondary rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textMain resize-y min-h-[100px]"
                          value={currentTest.expectedOutput}
                          onChange={e => updateTestCase(activeCaseIndex, 'expectedOutput', e.target.value)}
                          placeholder="Enter expected output..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'results' && (
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-textMuted space-y-4">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p>Compiling and Executing...</p>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-textMuted">
                      <p>Run your code to see results here.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                      {/* Global Results Status */}
                      <div className="mb-4 shrink-0">
                        <h2 className={`text-2xl font-bold ${globalStatus === 'Accepted' ? 'text-green-600 dark:text-green-500' : globalStatus === 'Output Generated' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-500'}`}>{globalStatus}</h2>
                        {globalStatus !== "Error" && (
                          <p className="text-sm text-textMuted mt-1">Runtime: {totalRuntime} ms</p>
                        )}
                      </div>
                      
                      {/* Results Tab Navigation */}
                      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 shrink-0">
                        {results.map((res, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setActiveCaseIndex(idx)}
                            className={`px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-2 ${safeResultIndex === idx ? 'bg-primary/20 text-primary' : 'text-textMuted hover:bg-secondary/50'}`}
                          >
                            {res.passed ? <CheckCircle size={14} className="text-green-600 dark:text-green-500" /> : <XCircle size={14} className="text-red-600 dark:text-red-500" />}
                            {res.testCaseIndex === -1 ? 'Execution Error' : `Case ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                      
                      {/* Active Result Content */}
                      {currentResult && (
                        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-2 custom-scrollbar">
                          {currentResult.error && (
                            <div className="space-y-1">
                              <label className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wider font-semibold">Error / Stderr</label>
                              <pre className="w-full bg-secondary rounded-md p-3 text-sm font-mono text-red-600 dark:text-red-400 overflow-x-auto whitespace-pre-wrap min-h-[100px]">{currentResult.error}</pre>
                            </div>
                          )}
                          {!currentResult.error && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-textMuted font-semibold uppercase tracking-wider">Input</label>
                                <pre className="w-full bg-secondary rounded-md p-3 text-sm font-mono text-textMain overflow-x-auto whitespace-pre-wrap min-h-[60px]">{testCases[safeResultIndex]?.input || "N/A"}</pre>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-textMuted font-semibold uppercase tracking-wider">Output</label>
                                <pre className="w-full bg-secondary rounded-md p-3 text-sm font-mono text-textMain overflow-x-auto whitespace-pre-wrap min-h-[60px]">{currentResult.output || <span className="text-textMuted italic">No output</span>}</pre>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-textMuted font-semibold uppercase tracking-wider">Expected</label>
                                <pre className="w-full bg-secondary rounded-md p-3 text-sm font-mono text-textMain overflow-x-auto whitespace-pre-wrap min-h-[60px]">{currentResult.expectedOutput || <span className="text-textMuted italic">None</span>}</pre>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Active Result Content End */}
            </div>
          </Panel>
        </Group>
      ) : (
        editorPanelContent
      )}
    </div>

      {/* Ask AI Popup */}
      {selectionPopup && (
        <div 
          className="fixed z-[100] transform -translate-x-1/2 -translate-y-full"
          style={{ left: Math.max(80, Math.min(window.innerWidth - 80, selectionPopup.x)), top: selectionPopup.y - 10 }}
        >
          <button
            onClick={handleAskAI}
            disabled={isGenerating}
            className={`flex items-center gap-2 bg-surface border shadow-2xl rounded-full px-3 py-1.5 text-xs font-bold text-textMain transition-all ${isGenerating ? 'opacity-50 border-border/30 cursor-not-allowed' : 'border-border hover:bg-secondary hover:opacity-90'}`}
          >
            <Sparkles size={14} className="text-primary" />
            {isGenerating ? "AI is busy..." : "Ask AI"}
          </button>
        </div>
      )}

      <AIChat />
    </div>
  );
}

export default App;
