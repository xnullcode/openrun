import asyncio
import json
import urllib.request
import re
from typing import Dict, Any

def fetch_leetcode_graphql(title_slug: str) -> Dict[str, Any]:
    req = urllib.request.Request(
        'https://leetcode.com/graphql',
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        data=json.dumps({
            "query": "query{question(titleSlug:\"" + title_slug + "\"){title content exampleTestcases codeSnippets{langSlug code}}}"
        }).encode('utf-8')
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read())

def fetch_tuf_api(title_slug: str) -> Dict[str, Any]:
    req = urllib.request.Request(
        f'https://backend-go.takeuforward.org/api/v2/plus/problem/{title_slug}?subjectSlug=dsa',
        method='GET',
        headers={
            'Origin': 'https://takeuforward.org',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read())

async def scrape_problem(url: str) -> Dict[str, Any]:
    try:
        is_tuf = "takeuforward.org" in url
        title_slug = url.strip('/').split('?')[0].split('/')[-1]
        
        title = ""
        description_html = ""
        description_text = ""
        test_cases = []
        starting_code_java = ""
        starting_code_cpp = ""

        if is_tuf:
            data = await asyncio.to_thread(fetch_tuf_api, title_slug)
            prob_data = data.get('data', {})
            if not prob_data:
                raise ValueError("TUF problem data not found.")
                
            title = prob_data.get('problem_name', 'Unknown Title')
            content = prob_data.get('problem_statement', '')
            
            for i in range(1, 10):
                ex_key = f'example{i}'
                if ex_key in prob_data and prob_data[ex_key]:
                    content += f"<h3>Example {i}:</h3>\n" + prob_data[ex_key] + "\n"
                    
            if 'constraints' in prob_data and prob_data['constraints']:
                content += f"<h3>Constraints:</h3>\n" + prob_data['constraints'] + "\n"
                
            description_html = content
            description_text = re.sub(r'<[^>]+>', '', content)
            
            starting_code_java = prob_data.get('publicJava', '')
            starting_code_cpp = prob_data.get('publicCpp', prob_data.get('publicC++', prob_data.get('publicCPP', '')))
            
            outputs = []
            for i in range(1, 10):
                ex_key = f'example{i}'
                if ex_key in prob_data and prob_data[ex_key]:
                    match = re.search(r'Output:<\/strong>\s*(.*?)(<|\n|$)', prob_data[ex_key])
                    if match:
                        out_val = match.group(1).strip()
                        out_val = re.sub(r'<[^>]+>', '', out_val).strip()
                        outputs.append(out_val)
                    else:
                        outputs.append("")
                        
            tc_data = prob_data.get('testcases', [])
            for i, tc in enumerate(tc_data):
                if i >= len(outputs):
                    outputs.append("")
                
                inputs_dict = tc.get('inputs', {})
                tc_input = '\n'.join(str(v).replace(" ", "") for v in inputs_dict.values())
                
                test_cases.append({
                    "input": tc_input,
                    "expectedOutput": outputs[i]
                })
                
        else: # Leetcode
            data = await asyncio.to_thread(fetch_leetcode_graphql, title_slug)
            question = data.get('data', {}).get('question')
            if not question:
                raise ValueError("Question data not found.")
                
            title = question.get('title', 'Unknown Title')
            content = question.get('content', '')
            description_html = content
            description_text = re.sub(r'<[^>]+>', '', content)
            
            snippets = question.get('codeSnippets', [])
            for snip in (snippets or []):
                if snip.get('langSlug') == 'java':
                    starting_code_java = snip.get('code', '')
                elif snip.get('langSlug') == 'cpp':
                    starting_code_cpp = snip.get('code', '')
            
            outputs = []
            for match in re.finditer(r'Output:<\/strong>\s*(.*?)(<|\n)', content):
                outputs.append(match.group(1).strip())
                
            raw_testcases = question.get('exampleTestcases', '')
            lines = raw_testcases.strip().split('\n')
            
            if outputs and lines and len(outputs) > 0:
                lines_per_tc = len(lines) // len(outputs)
                for i in range(len(outputs)):
                    tc_input = '\n'.join(lines[i*lines_per_tc : (i+1)*lines_per_tc])
                    test_cases.append({
                        "input": tc_input,
                        "expectedOutput": outputs[i]
                    })
            else:
                test_cases.append({"input": "", "expectedOutput": ""})
                    
        return {
            "success": True,
            "title": title,
            "description_html": description_html,
            "description_text": description_text,
            "test_cases": test_cases,
            "starting_code_java": starting_code_java,
            "starting_code_cpp": starting_code_cpp
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }
