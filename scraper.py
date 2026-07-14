import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from typing import Dict, Any

async def scrape_problem(url: str) -> Dict[str, Any]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        await Stealth().apply_stealth_async(page)
        
        try:
            await page.goto(url, wait_until="networkidle", timeout=15000)
            
            title = await page.title()
            
            # Try some common leetcode classes or fallback to general description
            description_elem = await page.query_selector('.elfjS')
            if not description_elem:
                description_elem = await page.query_selector('[data-track-load="description_content"]')
                
            if description_elem:
                description_html = await description_elem.inner_html()
                description_text = await description_elem.inner_text()
            else:
                description_html = "<i>Description parsing heuristic failed for this URL.</i>"
                description_text = "Description parsing heuristic failed for this URL."

            # Find test cases - typically inside <pre> tags
            pre_tags = await page.query_selector_all('pre')
            test_cases = []
            
            for pre in pre_tags:
                text = await pre.inner_text()
                if "Input:" in text and "Output:" in text:
                    parts = text.split("Output:")
                    if len(parts) >= 2:
                        input_part = parts[0].replace("Input:", "").strip()
                        output_part = parts[1].split("Explanation:")[0].strip()
                        test_cases.append({
                            "input": input_part,
                            "expectedOutput": output_part
                        })

            return {
                "success": True,
                "title": title,
                "description_html": description_html,
                "description_text": description_text,
                "test_cases": test_cases
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            await browser.close()
