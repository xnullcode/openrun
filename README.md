# OpenRun

OpenRun is a web-based code execution environment and AI coding assistant for Java and C++. It combines browser-based code editing, competitive programming problem importing, and real-time LLM interaction. Developers can write code, run test cases against compiled binaries, import problem details directly from popular competitive programming platforms via URLs, and receive streaming AI feedback without leaving the editor.

> **Note**: The AI Coding Assistant operates on a "Bring Your Own Key" (BYOK) model. You must provide your own API key (e.g., Gemini, Groq, OpenAI) in the settings panel to enable AI features. API keys are stored securely in your browser's local storage.

## Interesting Techniques

- **Real-Time Stream Processing**: Uses the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) to parse [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) word-by-word, rendering AI responses immediately without waiting for complete network payloads.
- **Persistent State Management**: Employs the [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) to cache code buffers, custom test cases, active settings, and chat history locally across browser reloads and language switches.
- **Multi-Workspace Environment**: Provides a tabbed workspace system allowing users to juggle multiple isolated coding problems simultaneously with independent code states, languages, and test execution results.
- **Text Selection Detection**: Uses [Window.getSelection()](https://developer.mozilla.org/en-US/docs/Web/API/Window/getSelection) to track user text highlights in the editor and display contextual floating AI prompts dynamically over the highlighted range.
- **Isolated Process Harness Injection**: Compiles Java and C++ source files dynamically by injecting test harnesses and wrapping user code into executable entry points, capturing execution metrics and mapping compiler errors back to original line numbers via `asyncio` subprocess pipelines.
- **Sanitized HTML Rendering**: Sanitizes imported problem descriptions with [DOMPurify](https://github.com/cure53/DOMPurify) before injecting HTML into the DOM via React, protecting against cross-site scripting vulnerabilities.

## Technologies and Libraries

- **[@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)**: React wrapper for the [Monaco Editor](https://microsoft.github.io/monaco-editor/), providing syntax highlighting, error markers, and code completion.
- **[react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)**: Flexible panel components for building configurable multi-pane workspace layouts.
- **[React-Rnd](https://github.com/bokuweb/react-rnd)**: Draggable and resizable container component used for floating windows like the AI Chat interface.
- **[DOMPurify](https://github.com/cure53/DOMPurify)**: Security library for sanitizing HTML before rendering.
- **[Lucide React](https://lucide.dev/)**: Icon library for React components.
- **[FastAPI](https://fastapi.tiangolo.com/)**: Asynchronous Python web framework for handling compilation requests and streaming AI responses.
- **[Beautiful Soup 4](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)**: HTML parsing library used in [`scraper.py`](./scraper.py) to extract problem constraints, inputs, and sample test cases from imported URLs.
- **[KaTeX / React Markdown](https://katex.org/)**: Integrates `remark-math` and `rehype-katex` with `react-markdown` to provide flawless, native LaTeX math rendering in the AI chat output.
- **Fonts**: Configured to render code using [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) and [Fira Code](https://fonts.google.com/specimen/Fira+Code).

## Project Structure

```text
.
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       └── context/
├── Dockerfile
├── docker-compose.yml
├── executor.py
├── main.py
├── openrun.sh
├── requirements.txt
└── scraper.py
```

- [`frontend/src/components/`](./frontend/src/components/): UI components including [`AIChat.tsx`](./frontend/src/components/AIChat.tsx) for floating/docked chat and [`Timer.tsx`](./frontend/src/components/Timer.tsx) for session timing.
- [`frontend/src/context/`](./frontend/src/context/): React context providers, such as [`AIChatContext.tsx`](./frontend/src/context/AIChatContext.tsx), managing global AI provider settings, messages, and snippet attachments.
- [`executor.py`](./executor.py): Handles code harness injection, temp file generation, C++/Java compilation, and process execution.
- [`main.py`](./main.py): FastAPI backend entry point that handles REST endpoints, streaming responses, and AI prompt assembly.
- [`scraper.py`](./scraper.py): Asynchronous web parser for extracting problem descriptions and test cases from provided competitive programming URLs.