import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Download, Plus, Trash2, CheckCircle, XCircle, Cpu, Columns, Rows } from 'lucide-react';
import axios from 'axios';
import { Group, Panel, Separator } from 'react-resizable-panels';

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
  const [activeTab, setActiveTab] = useState<'tests' | 'results'>('tests');
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  
  // Layout state
  const [layoutOrientation, setLayoutOrientation] = useState<"horizontal" | "vertical">("horizontal");

  useEffect(() => {
    localStorage.setItem('openrun_code', code);
  }, [code]);

  useEffect(() => {
    localStorage.setItem('openrun_testcases', JSON.stringify(testCases));
  }, [testCases]);

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
        setActiveCaseIndex(0);
        setActiveTab('tests');
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
  const totalRuntime = results.reduce((acc, curr) => acc + curr.executionTimeMs, 0);
  const globalStatus = results.length > 0 ? (results[0].testCaseIndex === -1 ? "Error" : (allPassed ? "Accepted" : "Wrong Answer")) : "";

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-textMain overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg text-white">
            <Cpu size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">OpenRun</h1>
        </div>

        <div className="flex items-center gap-4 flex-1 max-w-2xl ml-8">
          <div className="flex-1 flex gap-2">
            <input 
              type="text" 
              placeholder="Paste LeetCode/Problem URL to scrape..." 
              className="input-field flex-1"
              value={scrapeUrl}
              onChange={e => setScrapeUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScrape()}
            />
            <button 
              onClick={handleScrape}
              disabled={isScraping || !scrapeUrl}
              className="btn-primary bg-secondary hover:bg-gray-700 text-white"
            >
              <Download size={16} />
              {isScraping ? 'Scraping...' : 'Scrape'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg">
            <button
              onClick={() => setLayoutOrientation("horizontal")}
              className={`p-1.5 rounded-md transition-colors ${layoutOrientation === "horizontal" ? "bg-primary text-white" : "text-textMuted hover:text-white"}`}
              title="Side by Side"
            >
              <Columns size={16} />
            </button>
            <button
              onClick={() => setLayoutOrientation("vertical")}
              className={`p-1.5 rounded-md transition-colors ${layoutOrientation === "vertical" ? "bg-primary text-white" : "text-textMuted hover:text-white"}`}
              title="Top and Bottom"
            >
              <Rows size={16} />
            </button>
          </div>

          <button 
            onClick={handleRun}
            disabled={isLoading}
            className="btn-primary"
          >
            <Play size={16} fill="currentColor" />
            {isLoading ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </header>

      {/* Main Content with Resizable Panels */}
      <div className="flex-1 flex overflow-hidden">
        <Group orientation={layoutOrientation} className="w-full h-full">
          {/* Editor Panel */}
          <Panel defaultSize={50} minSize={20} className="flex flex-col bg-background">
            <div className="h-10 bg-surface border-b border-border flex items-center px-4 text-sm font-medium text-textMuted shrink-0">
              Solution.java
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="java"
                theme="vs-dark"
                value={code}
                onChange={(val: string | undefined) => setCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  padding: { top: 16 }
                }}
              />
            </div>
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
          <Panel defaultSize={50} minSize={20} className="flex flex-col bg-background">
            {/* Tabs Header */}
            <div className="h-10 bg-surface border-b border-border flex shrink-0">
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
              {activeTab === 'tests' && (
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                  {/* Test Case Tab Navigation */}
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 shrink-0">
                    {testCases.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveCaseIndex(idx)}
                        className={`px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${activeCaseIndex === idx ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:bg-neutral-800'}`}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                    <button 
                      onClick={addTestCase}
                      className="px-3 py-1 text-sm font-medium rounded-md text-neutral-400 hover:bg-neutral-800 transition-colors flex items-center justify-center"
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
                          className="w-full bg-neutral-800/50 rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary text-white resize-y min-h-[100px]"
                          value={currentTest.input}
                          onChange={e => updateTestCase(activeCaseIndex, 'input', e.target.value)}
                          placeholder="Enter input..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-neutral-400">Expected Output</label>
                        <textarea
                          className="w-full bg-neutral-800/50 rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary text-white resize-y min-h-[100px]"
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
                        <h2 className={`text-2xl font-bold ${globalStatus === 'Accepted' ? 'text-green-500' : 'text-red-500'}`}>{globalStatus}</h2>
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
                            className={`px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-2 ${safeResultIndex === idx ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:bg-neutral-800'}`}
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
                              <pre className="w-full bg-neutral-800/50 rounded-md p-3 text-sm font-mono text-red-300 overflow-x-auto whitespace-pre-wrap min-h-[100px]">{currentResult.error}</pre>
                            </div>
                          )}
                          {!currentResult.error && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Input</label>
                                <pre className="w-full bg-neutral-800/50 rounded-md p-3 text-sm font-mono text-white overflow-x-auto whitespace-pre-wrap min-h-[60px]">{testCases[safeResultIndex]?.input || "N/A"}</pre>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Output</label>
                                <pre className="w-full bg-neutral-800/50 rounded-md p-3 text-sm font-mono text-white overflow-x-auto whitespace-pre-wrap min-h-[60px]">{currentResult.output || <span className="text-gray-600 italic">No output</span>}</pre>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Expected</label>
                                <pre className="w-full bg-neutral-800/50 rounded-md p-3 text-sm font-mono text-white overflow-x-auto whitespace-pre-wrap min-h-[60px]">{currentResult.expectedOutput || <span className="text-gray-600 italic">None</span>}</pre>
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
        </Group>
      </div>
    </div>
  );
}

export default App;
