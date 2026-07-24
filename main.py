from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from executor import execute_java_code
from scraper import scrape_problem
import os
import requests
import asyncio
import time

app = FastAPI(title="OpenRun Online Judge")

class TestCase(BaseModel):
    input: str
    expectedOutput: str

class ExecuteRequest(BaseModel):
    code: str
    testCases: List[TestCase]

class ScrapeRequest(BaseModel):
    url: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    baseUrl: str
    model: str
    apiKey: str
    messages: List[ChatMessage]
    problemDescription: Optional[str] = None
    editorCode: Optional[str] = None
    chatMode: Optional[str] = "help"

@app.post("/api/execute")
async def api_execute(req: ExecuteRequest):
    test_cases_dict = [{"input": tc.input, "expectedOutput": tc.expectedOutput} for tc in req.testCases]
    result = await execute_java_code(req.code, test_cases_dict)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Execution failed"))
    return result

@app.post("/api/scrape")
async def api_scrape(req: ScrapeRequest):
    print(f"Received scrape request for URL: {req.url}")
    try:
        result = await scrape_problem(req.url)
        if not result.get("success"):
            print(f"Scraping failed: {result.get('error')}")
            raise HTTPException(status_code=400, detail=result.get("error", "Scraping failed"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unhandled exception during scrape: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    def stream_generator():
        url = req.baseUrl
        # If it doesn't end with chat/completions, append it.
        if not url.endswith("/chat/completions"):
            url = url.rstrip("/") + "/chat/completions"
            
        headers = {
            "Authorization": f"Bearer {req.apiKey}",
            "Content-Type": "application/json"
        }
        
        # Load system prompt
        system_prompt = ""
        prompt_path = os.path.join(os.path.dirname(__file__), "ai_coding_assistant_system_prompt.md")
        if os.path.exists(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()

        # Build dynamic context
        context_str = f"\n\n--- DYNAMIC CONTEXT ---\nUSER IS CURRENTLY IN: {req.chatMode.upper()} MODE\n"
        
        if req.problemDescription:
            context_str += f"\nPROBLEM DESCRIPTION:\n{req.problemDescription}\n"
            
        if req.editorCode:
            context_str += f"\nCURRENT EDITOR CODE:\n```java\n{req.editorCode}\n```\n"

        final_system_prompt = system_prompt + context_str

        # Filter out frontend-only messages like system_alert
        api_messages = []
        api_messages.append({"role": "system", "content": final_system_prompt})
        
        for m in req.messages:
            if m.role in ["user", "assistant"]:
                api_messages.append({"role": m.role, "content": m.content})
        
        payload = {
            "model": req.model,
            "messages": api_messages,
            "stream": True
        }
        
        try:
            with requests.post(url, json=payload, headers=headers, timeout=60, stream=True) as response:
                if response.status_code != 200:
                    yield f"data: {{\"error\": \"API Error: {response.text}\"}}\n\n"
                    return
                buffer = b""
                for chunk in response.iter_content(chunk_size=None):
                    if chunk:
                        buffer += chunk
                        while b"\n" in buffer:
                            line, buffer = buffer.split(b"\n", 1)
                            line = line.strip()
                            if line:
                                yield line.decode('utf-8') + "\n\n"
                                time.sleep(0.03)
        except Exception as e:
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"

    return StreamingResponse(
        stream_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# Serve Frontend static files
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {"message": "Frontend not built yet. Run 'npm run build' in frontend directory."}
