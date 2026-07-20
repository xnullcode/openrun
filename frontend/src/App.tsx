import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Download, Plus, Minus, Trash2, CheckCircle, XCircle, Cpu, Columns, Rows, RotateCcw, Sun, Moon, Settings, LayoutTemplate, BookOpen, RefreshCw, X } from 'lucide-react';
import axios from 'axios';
import { Group, Panel, Separator } from 'react-resizable-panels';
import Timer from './components/Timer';

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface TestResult {
  testCaseIndex: number;
  passed: boolean;
  output: string;
  expectedOutput: string;
  error: string;
  executionTimeMs: number;
  memoryUsed: string;
}

const DEFAULT_JAVA_CODE = `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Read your input here
        // e.g. int n = scanner.nextInt();
        
        System.out.println("Hello, OpenRun!");
    }
}`;

function App() {
  const [code, setCode] = useState(() => localStorage.getItem('openrun_code') || DEFAULT_JAVA_CODE);
  const [testCases, setTestCases] = useState<TestCase[]>(() => {
    const saved = localStorage.getItem('openrun_testcases');
    return saved ? JSON.parse(saved) : [{ input: '', expectedOutput: '' }];
  });
  const [results, setResults] = useState<TestResult[]>([]);
  const [activeTab, setActiveTab] = useState<'description' | 'tests' | 'results'>('description');
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [problemDescription, setProblemDescription] = useState(() => localStorage.getItem('openrun_desc') || '');
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

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all code, test cases, and settings? This cannot be undone.")) {
      localStorage.removeItem('openrun_code');
      localStorage.removeItem('openrun_testcases');
      setCode(DEFAULT_JAVA_CODE);
      setTestCases([{ input: '', expectedOutput: '' }]);
      setResults([]);
      setActiveTab('tests');
      setActiveCaseIndex(0);
      setScrapeUrl('');
      setProblemDescription('');
      localStorage.removeItem('openrun_desc');
      setLayoutOrientation("horizontal");
    }
  };

  useEffect(() => {
    localStorage.setItem('openrun_code', code);
  }, [code]);

  useEffect(() => {
    localStorage.setItem('openrun_testcases', JSON.stringify(testCases));
  }, [testCases]);

  useEffect(() => {
    localStorage.setItem('openrun_desc', problemDescription);
  }, [problemDescription]);

  const handleRun = async () => {
    setIsLoading(true);
    setResults([]);
    setActiveTab('results');
    setActiveCaseIndex(0); // Reset to first case on new run
    try {
      const res = await axios.post('/api/execute', { code, testCases });
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
        setTestCases(res.data.test_cases);
        if (res.data.starting_code) {
          setCode(res.data.starting_code);
        }
        if (res.data.description_html) {
          setProblemDescription(res.data.description_html);
        }
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

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-textMain overflow-hidden font-sans">
      {/* Header */}
      <header className="py-2 min-h-[56px] border-b border-border bg-surface px-3 md:px-6 flex flex-wrap md:flex-nowrap items-center justify-between gap-y-3 shadow-md z-10 shrink-0">
        
        {/* Left side: Logo */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="bg-primary p-1.5 rounded-lg text-surface dark:text-[#1a2e60]">
            <Cpu size={18} />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-textMain">OpenRun</h1>
        </div>

        {/* Center: URL Input (Drops to second line on mobile) */}
        <div className="flex items-center w-full md:w-auto md:flex-1 md:max-w-lg md:mx-6 order-last md:order-none shrink-0 md:shrink">
          <div className="flex-1 flex gap-1 bg-secondary border border-border p-1 rounded-lg">
            <input 
              type="text" 
              placeholder="Paste LeetCode/TUF URL..." 
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
            onClick={handleReset}
            className="p-1.5 rounded-lg text-textMuted hover:text-textMain hover:bg-secondary transition-colors h-9 w-9 flex items-center justify-center ml-1"
            title="Reset to default settings & code"
          >
            <RotateCcw size={16} />
          </button>

          <div className="relative">
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`p-1.5 rounded-lg transition-colors h-9 w-9 flex items-center justify-center ${isSettingsOpen ? 'bg-secondary text-textMain' : 'text-textMuted hover:text-textMain hover:bg-secondary'}`} title="Settings">
              <Settings size={16} />
            </button>
            {/* Settings Dropdown (Material You Style) */}
            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-[320px] bg-[#1c1d21] rounded-[24px] p-4 shadow-2xl z-50 border border-white/5">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Theme Toggle */}
                    <button 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={`flex flex-col items-start p-4 rounded-[20px] transition-colors ${theme === 'dark' ? 'bg-primary text-[#1a2e60]' : 'bg-[#303034] text-white hover:bg-[#3a3a3f]'}`}
                    >
                      <div className="mb-2">{theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}</div>
                      <span className="font-medium text-sm">Theme</span>
                      <span className="text-xs opacity-70">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                    </button>

                    {/* Layout Toggle */}
                    <button 
                      onClick={() => setLayoutOrientation(layoutOrientation === 'horizontal' ? 'vertical' : 'horizontal')}
                      className={`flex flex-col items-start p-4 rounded-[20px] transition-colors ${layoutOrientation === 'vertical' ? 'bg-primary text-[#1a2e60]' : 'bg-[#303034] text-white hover:bg-[#3a3a3f]'}`}
                    >
                      <div className="mb-2">{layoutOrientation === 'horizontal' ? <Columns size={20} /> : <Rows size={20} />}</div>
                      <span className="font-medium text-sm">Layout</span>
                      <span className="text-xs opacity-70">{layoutOrientation === 'horizontal' ? 'Side-by-Side' : 'Top & Bottom'}</span>
                    </button>

                    {/* Tools Pane Toggle */}
                    <button 
                      onClick={() => setShowToolsPane(!showToolsPane)}
                      className={`flex flex-col items-start p-4 rounded-[20px] transition-colors col-span-2 ${showToolsPane ? 'bg-primary text-[#1a2e60]' : 'bg-[#303034] text-white hover:bg-[#3a3a3f]'}`}
                    >
                      <div className="mb-2"><BookOpen size={20} /></div>
                      <span className="font-medium text-sm">Tools Pane</span>
                      <span className="text-xs opacity-70">{showToolsPane ? 'Enabled' : 'Disabled'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

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

      {/* Main Content with Resizable Panels */}
      <div className="flex-1 flex overflow-hidden">
        <Group orientation={layoutOrientation} className="w-full h-full">
          {/* Editor Panel */}
          <Panel defaultSize={50} minSize={20} className="flex flex-col bg-background">
            <div className="h-10 bg-surface border-b border-border flex items-center justify-between px-4 text-sm font-medium text-textMuted shrink-0">
              <span>Solution.java</span>
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
                defaultLanguage="java"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                value={code}
                onChange={(val: string | undefined) => setCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: fontSize,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  padding: { top: 16 }
                }}
              />
            </div>
          </Panel>

          {showToolsPane && (
            <>
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
            </div>

            {/* Pane Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab === 'description' && (
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar problem-description text-sm text-gray-300">
                  {problemDescription ? (
                    <div dangerouslySetInnerHTML={{ __html: problemDescription }} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-textMuted">
                      <p>Scrape a problem to see its description here.</p>
                    </div>
                  )}
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
                        <h4 className="text-sm font-medium text-gray-300">Test Case {activeCaseIndex + 1}</h4>
                        <button 
                          onClick={() => removeTestCase(activeCaseIndex)}
                          className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs"
                          title="Delete Test Case"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-neutral-400">Input</label>
                        <textarea
                          className="w-full bg-secondary rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textMain resize-y min-h-[100px]"
                          value={currentTest.input}
                          onChange={e => updateTestCase(activeCaseIndex, 'input', e.target.value)}
                          placeholder="Enter input..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-neutral-400">Expected Output</label>
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
                        <h2 className={`text-2xl font-bold ${globalStatus === 'Accepted' ? 'text-green-500' : globalStatus === 'Output Generated' ? 'text-blue-400' : 'text-red-500'}`}>{globalStatus}</h2>
                        {globalStatus !== "Error" && (
                          <p className="text-sm text-neutral-400 mt-1">Runtime: {totalRuntime} ms</p>
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
                            {res.passed ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                            {res.testCaseIndex === -1 ? 'Execution Error' : `Case ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                      
                      {/* Active Result Content */}
                      {currentResult && (
                        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-2 custom-scrollbar">
                          {currentResult.error && (
                            <div className="space-y-1">
                              <label className="text-xs text-red-400 uppercase tracking-wider font-semibold">Error / Stderr</label>
                              <pre className="w-full bg-secondary rounded-md p-3 text-sm font-mono text-red-500 overflow-x-auto whitespace-pre-wrap min-h-[100px]">{currentResult.error}</pre>
                            </div>
                          )}
                          {!currentResult.error && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Input</label>
                                <pre className="w-full bg-secondary rounded-md p-3 text-sm font-mono text-textMain overflow-x-auto whitespace-pre-wrap min-h-[60px]">{testCases[safeResultIndex]?.input || "N/A"}</pre>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Output</label>
                                <pre className="w-full bg-secondary rounded-md p-3 text-sm font-mono text-textMain overflow-x-auto whitespace-pre-wrap min-h-[60px]">{currentResult.output || <span className="text-gray-500 italic">No output</span>}</pre>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Expected</label>
                                <pre className="w-full bg-secondary rounded-md p-3 text-sm font-mono text-textMain overflow-x-auto whitespace-pre-wrap min-h-[60px]">{currentResult.expectedOutput || <span className="text-gray-500 italic">None</span>}</pre>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
              </Panel>
            </>
          )}
        </Group>
      </div>

    </div>
  );
}

export default App;
