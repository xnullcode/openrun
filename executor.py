import asyncio
import os
import tempfile
import uuid
import time
import shutil
import re
from typing import List, Dict, Any

def inject_harness(code: str) -> tuple[str, str, int]:
    if "public static void main" in code:
        return code, "Solution", 0

    match = re.search(r"public\s+([A-Za-z0-9_\[\]<>]+)\s+([A-Za-z0-9_]+)\s*\((.*?)\)", code)
    if not match:
        return code, "Solution", 0
        
    return_type, method_name, params_str = match.groups()
    params = [p.strip() for p in params_str.split(",") if p.strip()]
    
    clean_user_code = re.sub(r"public\s+class\s+Solution", "class Solution", code)
    
    parse_blocks = []
    args = []
    
    for i, p in enumerate(params):
        parts = p.split()
        if len(parts) >= 2:
            p_type = parts[0]
            p_name = parts[-1]
        else:
            continue
            
        args.append(p_name)
        
        if p_type == "int[]":
            parse_blocks.append(f"""
        if (!sc.hasNextLine()) return;
        String raw_{p_name} = sc.nextLine().trim();
        String cleaned_{p_name} = raw_{p_name}.replaceAll("[\\\\[\\\\]\\\\s]", "");
        int[] {p_name};
        if (cleaned_{p_name}.isEmpty()) {{
            {p_name} = new int[0];
        }} else {{
            String[] tokens_{p_name} = cleaned_{p_name}.split(",");
            {p_name} = new int[tokens_{p_name}.length];
            for (int j = 0; j < tokens_{p_name}.length; j++) {{
                {p_name}[j] = Integer.parseInt(tokens_{p_name}[j].trim());
            }}
        }}""")
        elif p_type == "int":
            parse_blocks.append(f"""
        if (!sc.hasNextLine()) return;
        int {p_name} = Integer.parseInt(sc.nextLine().trim());
        """)
        elif p_type == "String":
            parse_blocks.append(f"""
        if (!sc.hasNextLine()) return;
        String {p_name} = sc.nextLine().trim();
        """)
        else:
            parse_blocks.append(f"""
        if (!sc.hasNextLine()) return;
        String {p_name} = sc.nextLine().trim();
        """)

    parse_logic = "\n".join(parse_blocks)
    args_list = ", ".join(args)
    
    if return_type == "void":
        invoke_logic = f"solver.{method_name}({args_list});\n        System.out.println(\"null\");"
    elif "[]" in return_type:
        invoke_logic = f"{return_type} result = solver.{method_name}({args_list});\n        System.out.println(Arrays.toString(result));"
    else:
        invoke_logic = f"{return_type} result = solver.{method_name}({args_list});\n        System.out.println(result);"

    harness_header = f"""import java.util.*;
import java.io.*;

public class Main {{
    public static void main(String[] args) {{
        Scanner sc = new Scanner(System.in);
        {parse_logic}
        
        Solution solver = new Solution();
        {invoke_logic}
    }}
}}

"""
    line_offset = harness_header.count("\n")
    harness = harness_header + clean_user_code + "\n"
    return harness, "Main", line_offset

async def execute_java_code(code: str, test_cases: List[Dict[str, str]]) -> Dict[str, Any]:
    run_id = str(uuid.uuid4())
    temp_dir = os.path.join(tempfile.gettempdir(), f"openrun_{run_id}")
    os.makedirs(temp_dir, exist_ok=True)

    final_code, main_class, line_offset = inject_harness(code)
    
    main_file_path = os.path.join(temp_dir, f"{main_class}.java")
    with open(main_file_path, "w") as f:
        f.write(final_code)
    
    def map_line_numbers(text: str) -> str:
        if not text:
            return text
        def replace_line(match):
            line_num = int(match.group(1))
            mapped_line = line_num - line_offset
            if mapped_line > 0:
                return f"Solution.java:{mapped_line}"
            return f"{main_class}.java:{line_num}"
        return re.sub(rf"{main_class}\.java:(\d+)", replace_line, text)
    
    try:
        # Compile
        compile_process = await asyncio.create_subprocess_exec(
            "javac", f"{main_class}.java",
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
            error_output = compile_stderr.decode().strip()
            mapped_error = map_line_numbers(error_output)
            return {"success": False, "error": mapped_error, "type": "Compilation Error"}

        # Execute test cases
        results = []
        for index, tc in enumerate(test_cases):
            input_data = tc.get("input", "")
            expected_output = tc.get("expectedOutput", "")
            
            start_time = time.time()
            exec_process = await asyncio.create_subprocess_exec(
                "java", main_class,
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
                mapped_error = map_line_numbers(error_output)
                
                passed = output == expected_output.strip() if expected_output else True
                
                results.append({
                    "testCaseIndex": index,
                    "passed": passed,
                    "output": output,
                    "expectedOutput": expected_output,
                    "error": mapped_error,
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

def inject_harness_cpp(code: str) -> tuple[str, str, int]:
    if "int main(" in code:
        return code, "main", 0

    match = re.search(r"(?:public:\s*)?([A-Za-z0-9_\[\]<>\*\&]+)\s+([A-Za-z0-9_]+)\s*\((.*?)\)", code)
    if not match:
        return code, "main", 0
        
    return_type, method_name, params_str = match.groups()
    params = [p.strip() for p in params_str.split(",") if p.strip()]
    
    parse_blocks = []
    args = []
    
    for i, p in enumerate(params):
        parts = p.split()
        if len(parts) >= 2:
            p_name = parts[-1].replace('&', '').replace('*', '')
            p_type = " ".join(parts[:-1]).replace('&', '')
        else:
            continue
            
        args.append(p_name)
        
        if "vector<int>" in p_type.replace(" ", ""):
            parse_blocks.append(f"""
        if (!getline(cin, line)) return 0;
        vector<int> {p_name};
        {{
            string clean;
            for(char c : line) if(c != '[' && c != ']' && c != ' ') clean += c;
            if(!clean.empty()) {{
                stringstream ss(clean);
                string token;
                while(getline(ss, token, ',')) {p_name}.push_back(stoi(token));
            }}
        }}""")
        elif "int" in p_type:
            parse_blocks.append(f"""
        if (!getline(cin, line)) return 0;
        int {p_name} = stoi(line);
        """)
        elif "string" in p_type:
            parse_blocks.append(f"""
        if (!getline(cin, line)) return 0;
        string {p_name} = line;
        """)
        else:
            parse_blocks.append(f"""
        if (!getline(cin, line)) return 0;
        string {p_name} = line;
        """)

    parse_logic = "\n".join(parse_blocks)
    args_list = ", ".join(args)
    
    if return_type == "void":
        invoke_logic = f"solver.{method_name}({args_list});\n        cout << \"null\" << endl;"
    elif "vector" in return_type.replace(" ", ""):
        invoke_logic = f"""
        auto result = solver.{method_name}({args_list});
        cout << "[";
        for (size_t i = 0; i < result.size(); ++i) {{
            cout << result[i] << (i + 1 == result.size() ? "" : ", ");
        }}
        cout << "]" << endl;
        """
    else:
        invoke_logic = f"auto result = solver.{method_name}({args_list});\n        cout << result << endl;"

    harness_header = f"""#include <iostream>
#include <vector>
#include <string>
#include <sstream>

using namespace std;

"""
    
    harness_footer = f"""

int main() {{
    string line;
    {parse_logic}
    
    Solution solver;
    {invoke_logic}
    
    return 0;
}}
"""
    
    line_offset = harness_header.count("\n")
    harness = harness_header + code + harness_footer
    return harness, "main", line_offset

async def execute_cpp_code(code: str, test_cases: List[Dict[str, str]]) -> Dict[str, Any]:
    run_id = str(uuid.uuid4())
    temp_dir = os.path.join(tempfile.gettempdir(), f"openrun_cpp_{run_id}")
    os.makedirs(temp_dir, exist_ok=True)

    final_code, main_class, line_offset = inject_harness_cpp(code)
    
    main_file_path = os.path.join(temp_dir, f"{main_class}.cpp")
    out_file_path = os.path.join(temp_dir, f"{main_class}")
    with open(main_file_path, "w") as f:
        f.write(final_code)
    
    def map_line_numbers(text: str) -> str:
        if not text:
            return text
        def replace_line(match):
            line_num = int(match.group(1))
            mapped_line = line_num - line_offset
            if mapped_line > 0:
                return f"Solution.cpp:{mapped_line}"
            return f"Solution.cpp:{line_num}"
        return re.sub(rf"{main_class}\.cpp:(\d+)", replace_line, text)
    
    try:
        # Compile
        compile_process = await asyncio.create_subprocess_exec(
            "g++", "-O2", "-std=c++17", f"{main_class}.cpp", "-o", main_class,
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
            error_output = compile_stderr.decode().strip()
            mapped_error = map_line_numbers(error_output)
            return {"success": False, "error": mapped_error, "type": "Compilation Error"}

        # Execute test cases
        results = []
        for index, tc in enumerate(test_cases):
            input_data = tc.get("input", "")
            expected_output = tc.get("expectedOutput", "")
            
            start_time = time.time()
            try:
                run_process = await asyncio.create_subprocess_exec(
                    f"./{main_class}",
                    cwd=temp_dir,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await asyncio.wait_for(
                    run_process.communicate(input=input_data.encode()),
                    timeout=2.0
                )
                
                execution_time = (time.time() - start_time) * 1000
                
                out_str = stdout.decode().strip()
                err_str = stderr.decode().strip()
                
                if run_process.returncode != 0:
                    results.append({
                        "testCase": index + 1,
                        "passed": False,
                        "output": out_str,
                        "expectedOutput": expected_output,
                        "error": map_line_numbers(err_str) or f"Runtime Error (Exit Code {run_process.returncode})",
                        "executionTimeMs": round(execution_time),
                        "memoryUsed": "N/A"
                    })
                else:
                    passed = (out_str == expected_output.strip())
                    results.append({
                        "testCase": index + 1,
                        "passed": passed,
                        "output": out_str,
                        "expectedOutput": expected_output,
                        "error": None if passed else "Output Mismatch",
                        "executionTimeMs": round(execution_time),
                        "memoryUsed": "N/A"
                    })
                    
            except asyncio.TimeoutError:
                run_process.kill()
                results.append({
                    "testCase": index + 1,
                    "passed": False,
                    "output": "",
                    "expectedOutput": expected_output,
                    "error": "Time Limit Exceeded (Timeout > 2.0s)",
                    "executionTimeMs": 2000,
                    "memoryUsed": "N/A"
                })

        return {"success": True, "results": results}
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

