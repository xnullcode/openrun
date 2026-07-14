import asyncio
import os
import tempfile
import uuid
import time
import shutil
from typing import List, Dict, Any

async def execute_java_code(code: str, test_cases: List[Dict[str, str]]) -> Dict[str, Any]:
    run_id = str(uuid.uuid4())
    temp_dir = os.path.join(tempfile.gettempdir(), f"openrun_{run_id}")
    os.makedirs(temp_dir, exist_ok=True)

    main_file_path = os.path.join(temp_dir, "Solution.java")
    with open(main_file_path, "w") as f:
        f.write(code)
    
    try:
        # Compile
        compile_process = await asyncio.create_subprocess_exec(
            "javac", "Solution.java",
            cwd=temp_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        try:
            compile_stdout, compile_stderr = await asyncio.wait_for(compile_process.communicate(), timeout=5.0)
        except asyncio.TimeoutError:
            compile_process.kill()
            return {"success": False, "error": "Compilation Timeout"}

        if compile_process.returncode != 0:
            return {"success": False, "error": compile_stderr.decode().strip(), "type": "Compilation Error"}

        # Execute test cases
        results = []
        for index, tc in enumerate(test_cases):
            input_data = tc.get("input", "")
            expected_output = tc.get("expectedOutput", "")
            
            start_time = time.time()
            exec_process = await asyncio.create_subprocess_exec(
                "java", "Solution",
                cwd=temp_dir,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            try:
                exec_stdout, exec_stderr = await asyncio.wait_for(
                    exec_process.communicate(input=input_data.encode()), 
                    timeout=2.0
                )
                exec_time = time.time() - start_time
                
                output = exec_stdout.decode().strip()
                error_output = exec_stderr.decode().strip()
                
                passed = output == expected_output.strip() if expected_output else True
                
                results.append({
                    "testCaseIndex": index,
                    "passed": passed,
                    "output": output,
                    "expectedOutput": expected_output,
                    "error": error_output,
                    "executionTimeMs": round(exec_time * 1000, 2),
                    "memoryUsed": "N/A"
                })
                
            except asyncio.TimeoutError:
                exec_process.kill()
                results.append({
                    "testCaseIndex": index,
                    "passed": False,
                    "output": "",
                    "expectedOutput": expected_output,
                    "error": "Time Limit Exceeded (Timeout > 2.0s)",
                    "executionTimeMs": 2000,
                    "memoryUsed": "N/A"
                })

        return {"success": True, "results": results}
        
    finally:
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)
