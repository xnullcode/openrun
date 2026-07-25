# OpenRun

OpenRun is a local code execution platform and AI-powered coding assistant. It allows you to write, test, and debug Java and C++ code directly in your browser. The platform includes a web scraper that pulls programming problems from competitive coding platforms like LeetCode and TakeUForward. It also features a context-aware AI chat window that integrates with multiple language models to help you solve problems.

## Interesting Techniques

- **Server-Sent Events (SSE) Parsing**: The application streams AI responses word-by-word instead of waiting for the full network payload. The frontend parses these data chunks in real-time using the native web Streams API. [Read more about the Streams API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API).
- **Persistent Local State**: The frontend heavily utilizes local web storage to maintain independent code histories for both Java and C++. When you switch between languages or refresh the page, the UI and the AI chat context instantly restore your previous working state. [Read more about the Web Storage API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).
- **Dynamic Code Execution**: The backend compiles and runs raw Java and C++ code using system processes in an isolated environment. It parses execution outputs and dynamically maps compile-time errors back to the correct line numbers in your original code. 

## Technologies and Libraries

- **[@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)**: Integrates the Monaco Editor (the engine that powers VS Code) into React, providing professional syntax highlighting, error squiggles, and autocompletion right in the browser.
- **[React-Rnd](https://github.com/bokuweb/react-rnd)**: A resizable and draggable component for React used to build the flexible AI chat pane and tools interface.
- **[FastAPI](https://fastapi.tiangolo.com/)**: A high-performance Python framework used to build the backend API endpoints and manage the asynchronous streaming responses.
- **[Lucide React](https://lucide.dev/)**: Provides the clean, consistent icons used throughout the user interface.
- **[Tailwind CSS](https://tailwindcss.com/)**: Handles all application styling with utility classes.

## Project Structure

```text
.
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       └── context/
├── docker-compose.yml
├── Dockerfile
├── executor.py
├── main.py
└── scraper.py
```

- [`frontend/src/components/`](./frontend/src/components/): Contains the isolated React components that construct the user interface, such as the AI Chatbox and the layout panels.
- [`frontend/src/context/`](./frontend/src/context/): Contains React Context providers, such as the AI configuration state that passes language awareness down to the chat.
- [`executor.py`](./executor.py): Manages the generation of test harnesses and the compilation of Java and C++ code.
- [`main.py`](./main.py): The FastAPI server entry point that handles API routing and AI prompt building.
- [`scraper.py`](./scraper.py): Contains the logic for asynchronously fetching problem descriptions, test cases, and boilerplate code from external APIs.