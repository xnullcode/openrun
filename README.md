# OpenRun

OpenRun is a local execution and testing environment designed for competitive programming and technical interview preparation. It bypasses web-based execution queues by scraping problem constraints and test cases from platforms like LeetCode and TakeUForward, then runs user-submitted code locally using a dynamically injected test harness. It features a resizable, split-pane React frontend that manages code authoring, test case management, and execution results.

## Interesting Techniques

- **Native Audio Synthesis**: The countdown timer generates a beep pattern entirely client-side using the native [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), specifically utilizing an [OscillatorNode](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode) to avoid external audio asset dependencies.
- **Tab Close Protection**: To prevent accidental loss of a running timer, the application intercepts the [beforeunload event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) to trigger a native browser confirmation dialog.
- **Asynchronous Subprocessing**: The backend compiles and executes user code locally without blocking the main event loop by leveraging Python's `asyncio.create_subprocess_exec` to interact with `javac` and `java`.
- **Direct HTML Rendering**: Scraped markdown and HTML problem descriptions are rendered directly into the React DOM using `dangerouslySetInnerHTML`, styled securely via scoped CSS classes.

## Technologies and Libraries

- [Monaco Editor](https://microsoft.github.io/monaco-editor/): The core code editor component, which provides the exact same syntax highlighting, minimap, and editing engine as VS Code.
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels): A React component library used to create the customizable, drag-to-resize split-pane layout between the code editor and the test results.
- [FastAPI](https://fastapi.tiangolo.com/): A modern, high-performance web framework for building the Python backend API that handles the scraping and execution logic.
- [Lucide React](https://lucide.dev/): A clean, SVG-based icon library utilized throughout the frontend interface.
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/): The primary monospace font configured within the editor for optimal code legibility.

## Project Structure

```text
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── executor.py
├── main.py
├── package.json
└── scraper.py
```

### Directory Details

- [`./frontend/`](./frontend/): Contains the entire Vite and React-based user interface.
- [`./frontend/src/components/`](./frontend/src/components/): Houses reusable UI components, such as the `Timer.tsx` module which handles the countdown logic and audio synthesis.
- [`./executor.py`](./executor.py): The core execution engine. It dynamically constructs a Java `Main` class wrapper around the user's code to parse `stdin` and print results to `stdout`.
- [`./scraper.py`](./scraper.py): Handles the data ingestion. It directly queries GraphQL and REST endpoints to extract problem descriptions, boilerplate code, and baseline test cases.
- [`./main.py`](./main.py): The FastAPI entry point that bridges the frontend client with the scraping and execution modules.