"""Test Execution Agent"""

import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.config import settings
from core.models import TestResult, TestStatus


class TestExecutorAgent:
    """Agent responsible for executing tests"""
    
    def __init__(self):
        self.name = "Test Execution Manager"
        self.role = "Test Executor"
        self.goal = "Execute tests reliably and collect comprehensive results"
        self.backstory = """Experienced in test automation and result analysis. 
        You ensure tests run smoothly, capture detailed logs, and provide clear 
        failure reports."""
    
    def execute_pytest(
        self,
        test_path: Optional[str] = None,
        markers: Optional[str] = None,
        verbose: bool = True
    ) -> Dict[str, Any]:
        """Execute pytest tests"""
        cmd = [sys.executable, "-m", "pytest"]
        
        if test_path:
            cmd.append(test_path)
        else:
            cmd.append(str(settings.tests_dir))
        
        if markers:
            cmd.extend(["-m", markers])
        
        if verbose:
            cmd.append("-v")
        
        cmd.extend(["--tb=short", "-q", "--json-report"])
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=str(settings.project_root),
                timeout=300
            )
            
            return {
                "success": result.returncode == 0,
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "command": " ".join(cmd)
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": "Test execution timed out",
                "command": " ".join(cmd)
            }
        except Exception as e:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": str(e),
                "command": " ".join(cmd)
            }
    
    def parse_results(self, stdout: str) -> List[TestResult]:
        """Parse test results from pytest output"""
        results = []
        
        # Simple parsing of pytest output
        lines = stdout.split('\n')
        for line in lines:
            if 'PASSED' in line:
                results.append(TestResult(
                    test_id=line.split('::')[-1] if '::' in line else line,
                    name=line.strip(),
                    type="api",
                    status=TestStatus.PASSED
                ))
            elif 'FAILED' in line:
                results.append(TestResult(
                    test_id=line.split('::')[-1] if '::' in line else line,
                    name=line.strip(),
                    type="api",
                    status=TestStatus.FAILED,
                    message=line
                ))
            elif 'ERROR' in line:
                results.append(TestResult(
                    test_id=line.split('::')[-1] if '::' in line else line,
                    name=line.strip(),
                    type="api",
                    status=TestStatus.ERROR,
                    message=line
                ))
        
        return results
    
    def execute_and_collect(
        self,
        test_path: Optional[str] = None,
        markers: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute tests and collect results"""
        # Execute tests
        exec_result = self.execute_pytest(test_path, markers)
        
        # Parse results
        results = self.parse_results(exec_result.get("stdout", ""))
        
        # Calculate statistics
        total = len(results)
        passed = sum(1 for r in results if r.status == TestStatus.PASSED)
        failed = sum(1 for r in results if r.status == TestStatus.FAILED)
        errors = sum(1 for r in results if r.status == TestStatus.ERROR)
        
        return {
            "success": exec_result["success"],
            "total": total,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "pass_rate": f"{(passed / total * 100):.2f}%" if total > 0 else "0%",
            "results": [r.model_dump() for r in results],
            "stdout": exec_result.get("stdout", ""),
            "stderr": exec_result.get("stderr", "")
        }
    
    def retry_failed_tests(
        self,
        failed_results: List[TestResult],
        max_retries: int = 3
    ) -> List[TestResult]:
        """Retry failed tests"""
        retried_results = []
        
        for result in failed_results:
            for attempt in range(max_retries):
                print(f"Retrying {result.name} (attempt {attempt + 1})...")
                
                # Extract test path from result
                test_path = result.test_id.split('::')[0] if '::' in result.test_id else None
                
                # Execute test
                exec_result = self.execute_pytest(test_path)
                
                if exec_result["success"]:
                    result.status = TestStatus.PASSED
                    result.message = f"Passed on retry {attempt + 1}"
                    break
                else:
                    result.message = f"Failed on retry {attempt + 1}"
            
            retried_results.append(result)
        
        return retried_results
    
    def generate_report(self, results: Dict[str, Any]) -> str:
        """Generate a summary report"""
        report = f"""Test Execution Report
{'=' * 50}

Total Tests: {results['total']}
Passed: {results['passed']}
Failed: {results['failed']}
Errors: {results['errors']}
Pass Rate: {results['pass_rate']}

{'=' * 50}
"""
        
        if results['failed'] > 0:
            report += "\nFailed Tests:\n"
            for result in results['results']:
                if result['status'] == 'failed':
                    report += f"  - {result['name']}\n"
        
        return report


# Agent instance
executor_agent = TestExecutorAgent()
