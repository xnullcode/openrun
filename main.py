from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from executor import execute_java_code
from scraper import scrape_problem
import os

app = FastAPI(title="OpenRun Online Judge")

class TestCase(BaseModel):
    input: str
    expectedOutput: str

class ExecuteRequest(BaseModel):
    code: str
    testCases: List[TestCase]

class ScrapeRequest(BaseModel):
    url: str

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

# Serve Frontend static files
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {"message": "Frontend not built yet. Run 'npm run build' in frontend directory."}
