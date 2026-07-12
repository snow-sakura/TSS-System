"""Test runner tool for executing pytest tests"""

import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.config import settings


class TestRunnerTool:
    """Tool for running pytest tests"""
    
    def __init__(self):
        self.project_root = settings.project_root
        self.tests_dir = settings.tests_dir
        self.reports_dir = settings.reports_dir
    
    def run_pytest(
        self,
        test_path: Optional[str] = None,
        markers: Optional[str] = None,
        verbose: bool = True,
        capture_output: bool = True
    ) -> Dict[str, Any]:
        """Run pytest with specified options"""
        cmd = [sys.executable, "-m", "pytest"]
        
        if test_path:
            cmd.append(test_path)
        else:
            cmd.append(str(self.tests_dir))
        
        if markers:
            cmd.extend(["-m", markers])
        
        if verbose:
            cmd.append("-v")
        
        cmd.extend(["--tb=short", "-q"])
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=capture_output,
                text=True,
                cwd=str(self.project_root),
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
    
    def run_specific_test(self, test_file: str, test_function: Optional[str] = None) -> Dict[str, Any]:
        """Run a specific test file or function"""
        test_path = test_file
        if test_function:
            test_path = f"{test_file}::{test_function}"
        
        return self.run_pytest(test_path=test_path)
    
    def run_with_markers(self, markers: str) -> Dict[str, Any]:
        """Run tests with specific markers"""
        return self.run_pytest(markers=markers)
    
    def run_api_tests(self) -> Dict[str, Any]:
        """Run API tests specifically"""
        return self.run_pytest(test_path="tests/api", markers="api")
    
    def run_unit_tests(self) -> Dict[str, Any]:
        """Run unit tests specifically"""
        return self.run_pytest(test_path="tests/unit", markers="unit")
    
    def run_integration_tests(self) -> Dict[str, Any]:
        """Run integration tests specifically"""
        return self.run_pytest(test_path="tests/integration", markers="integration")


# Tool instance
test_runner_tool = TestRunnerTool()
