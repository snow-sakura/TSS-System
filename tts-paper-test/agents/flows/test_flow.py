"""Main Test Flow - Orchestrates all agents and crews"""

import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional
from pathlib import Path

from agents.crews.test_generation_crew import test_generation_crew
from agents.crews.test_execution_crew import test_execution_crew
from agents.crews.analysis_crew import analysis_crew
from core.config import settings
from core.exceptions import TestExecutionError, AgentError


class TestFlow:
    """Main test flow that orchestrates all testing activities"""
    
    def __init__(self, max_retries: int = 3):
        self.generation_crew = test_generation_crew
        self.execution_crew = test_execution_crew
        self.analysis_crew = analysis_crew
        self.max_retries = max_retries
        self.execution_log = []
    
    def run_full_cycle(self, system_info: Dict[str, Any] = None) -> Dict[str, Any]:
        """Run the complete test cycle with error handling"""
        print("=" * 60)
        print("TSS Paper Test - Full Test Cycle")
        print("=" * 60)
        
        start_time = datetime.now()
        
        # Default system info if not provided
        if system_info is None:
            system_info = self._get_default_system_info()
        
        results = {}
        errors = []
        
        # Phase 1: Generate tests
        print("\n[Phase 1] Generating tests...")
        try:
            generation_result = self._execute_with_retry(
                self.generation_crew.execute,
                system_info,
                "test generation"
            )
            results["generation"] = generation_result
            self._save_generated_tests(generation_result)
            self._log("Test generation completed successfully")
        except Exception as e:
            error_msg = f"Test generation failed: {str(e)}"
            errors.append({"phase": "generation", "error": error_msg})
            self._log(error_msg, "error")
            results["generation"] = {"error": error_msg}
        
        # Phase 2: Execute tests
        print("\n[Phase 2] Executing tests...")
        try:
            execution_result = self._execute_with_retry(
                self.execution_crew.execute,
                None,  # test_path
                None,  # markers
                "test execution"
            )
            results["execution"] = execution_result
            self._log("Test execution completed successfully")
        except Exception as e:
            error_msg = f"Test execution failed: {str(e)}"
            errors.append({"phase": "execution", "error": error_msg})
            self._log(error_msg, "error")
            results["execution"] = {"error": error_msg, "summary": {"total_tests": 0, "passed": 0, "failed": 0, "pass_rate": "0%"}}
        
        # Phase 3: Analyze results
        print("\n[Phase 3] Analyzing results...")
        try:
            analysis_result = self._execute_with_retry(
                self.analysis_crew.execute,
                results.get("execution", {}),
                "result analysis"
            )
            results["analysis"] = analysis_result
            self._log("Result analysis completed successfully")
        except Exception as e:
            error_msg = f"Analysis failed: {str(e)}"
            errors.append({"phase": "analysis", "error": error_msg})
            self._log(error_msg, "error")
            results["analysis"] = {"error": error_msg}
        
        # Generate final report
        print("\n[Phase 4] Generating final report...")
        try:
            final_report = self._generate_final_report(results, errors, start_time)
            results["final_report"] = final_report
            self._save_report(final_report)
            self._log("Final report generated successfully")
        except Exception as e:
            error_msg = f"Report generation failed: {str(e)}"
            self._log(error_msg, "error")
        
        # Print summary
        self._print_summary(results, errors)
        
        return results
    
    def run_generation_only(self, system_info: Dict[str, Any] = None) -> Dict[str, Any]:
        """Run only test generation with error handling"""
        if system_info is None:
            system_info = self._get_default_system_info()
        
        try:
            result = self._execute_with_retry(
                self.generation_crew.execute,
                system_info,
                "test generation"
            )
            self._save_generated_tests(result)
            return result
        except Exception as e:
            return {"error": str(e)}
    
    def run_execution_only(
        self,
        test_path: Optional[str] = None,
        markers: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run only test execution with error handling"""
        try:
            result = self._execute_with_retry(
                self.execution_crew.execute,
                test_path,
                markers,
                "test execution"
            )
            return result
        except Exception as e:
            return {"error": str(e)}
    
    def run_analysis_only(self, test_results: Dict[str, Any]) -> Dict[str, Any]:
        """Run only analysis with error handling"""
        try:
            result = self._execute_with_retry(
                self.analysis_crew.execute,
                test_results,
                "result analysis"
            )
            return result
        except Exception as e:
            return {"error": str(e)}
    
    def _execute_with_retry(self, func, *args, operation_name: str = "operation") -> Any:
        """Execute a function with retry mechanism"""
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                return func(*args)
            except Exception as e:
                last_error = e
                self._log(
                    f"{operation_name} failed (attempt {attempt + 1}/{self.max_retries}): {str(e)}",
                    "warning"
                )
                if attempt < self.max_retries - 1:
                    print(f"  Retrying {operation_name}...")
        
        raise last_error
    
    def _log(self, message: str, level: str = "info") -> None:
        """Log a message"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message
        }
        self.execution_log.append(log_entry)
        
        if level == "error":
            print(f"  [ERROR] {message}")
        elif level == "warning":
            print(f"  [WARNING] {message}")
        else:
            print(f"  [INFO] {message}")
    
    def _get_default_system_info(self) -> Dict[str, Any]:
        """Get default system information"""
        return {
            "name": "TSS - Ticket Sales System",
            "type": "web_application",
            "modules": [
                "authentication",
                "destinations",
                "users",
                "tickets",
                "dashboard"
            ],
            "endpoints": [
                "/api/login",
                "/api/register",
                "/api/destinations",
                "/api/users",
                "/api/tickets",
                "/api/dashboard"
            ],
            "base_url": settings.tss.base_url,
            "api_base": settings.tss.api_base
        }
    
    def _save_generated_tests(self, generation_result: Dict[str, Any]) -> None:
        """Save generated tests to files"""
        generated_tests = generation_result.get("generated_tests", [])
        
        for i, test in enumerate(generated_tests):
            scenario = test.get("scenario", {})
            code = test.get("code", "")
            
            # Create filename
            test_name = scenario.get("name", f"test_{i}").lower().replace(" ", "_")
            filename = f"test_{test_name}.py"
            
            # Save to tests/generated/
            filepath = settings.tests_dir / "generated" / filename
            filepath.parent.mkdir(parents=True, exist_ok=True)
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(code)
            
            print(f"  Saved: {filename}")
    
    def _save_report(self, report: Dict[str, Any]) -> None:
        """Save final report"""
        import json
        
        # Create report filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"final_report_{timestamp}.json"
        
        filepath = settings.reports_dir / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"  Report saved: {filename}")
    
    def _generate_final_report(
        self,
        results: Dict[str, Any],
        errors: List[Dict[str, Any]],
        start_time: datetime
    ) -> Dict[str, Any]:
        """Generate final report combining all results"""
        generation = results.get("generation", {})
        execution = results.get("execution", {})
        analysis = results.get("analysis", {})
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        final_report = {
            "title": "TSS Test Report",
            "timestamp": start_time.isoformat(),
            "duration_seconds": duration,
            "summary": {
                "tests_generated": generation.get("summary", {}).get("total_tests_generated", 0),
                "tests_executed": execution.get("summary", {}).get("total_tests", 0),
                "tests_passed": execution.get("summary", {}).get("passed", 0),
                "tests_failed": execution.get("summary", {}).get("failed", 0),
                "pass_rate": execution.get("summary", {}).get("pass_rate", "N/A"),
                "quality_score": generation.get("summary", {}).get("average_quality_score", 0),
                "errors": len(errors)
            },
            "details": {
                "generation": generation.get("summary", {}),
                "execution": execution.get("summary", {}),
                "analysis": analysis.get("summary", {})
            },
            "recommendations": analysis.get("analysis", {}).get("recommendations", []),
            "issues": analysis.get("analysis", {}).get("issues", []),
            "errors": errors,
            "execution_log": self.execution_log
        }
        
        return final_report
    
    def _print_summary(self, results: Dict[str, Any], errors: List[Dict[str, Any]]) -> None:
        """Print execution summary"""
        print("\n" + "=" * 60)
        print("Execution Summary")
        print("=" * 60)
        
        report = results.get("final_report", {})
        summary = report.get("summary", {})
        
        print(f"\nTests Generated: {summary.get('tests_generated', 0)}")
        print(f"Tests Executed: {summary.get('tests_executed', 0)}")
        print(f"Tests Passed: {summary.get('tests_passed', 0)}")
        print(f"Tests Failed: {summary.get('tests_failed', 0)}")
        print(f"Pass Rate: {summary.get('pass_rate', 'N/A')}")
        print(f"Quality Score: {summary.get('quality_score', 0)}")
        print(f"Duration: {report.get('duration_seconds', 0):.2f} seconds")
        
        if errors:
            print(f"\nErrors: {len(errors)}")
            for error in errors:
                print(f"  - [{error['phase']}] {error['error']}")
        
        print("=" * 60)


# Flow instance
test_flow = TestFlow()
