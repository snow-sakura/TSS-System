"""Test Execution Crew - Coordinates execution and analysis agents"""

from typing import Any, Dict, List, Optional

from agents.executor import executor_agent
from agents.analyzer import analyzer_agent
from knowledge.vector_store import knowledge_store


class TestExecutionCrew:
    """Crew responsible for executing tests"""
    
    def __init__(self):
        self.executor = executor_agent
        self.analyzer = analyzer_agent
    
    def execute(
        self,
        test_path: Optional[str] = None,
        markers: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute the test execution workflow"""
        print("Test Execution Crew: Starting execution...")
        
        # Phase 1: Execute tests
        print("  Phase 1: Executing tests...")
        exec_results = self.executor.execute_and_collect(test_path, markers)
        
        # Phase 2: Analyze results
        print("  Phase 2: Analyzing results...")
        analysis = self.analyzer.analyze_results(exec_results)
        
        # Phase 3: Handle failures
        if exec_results.get("failed", 0) > 0:
            print("  Phase 3: Handling failures...")
            failed_tests = [
                r for r in exec_results.get("results", [])
                if r.get("status") == "failed"
            ]
            failure_analysis = self.analyzer.analyze_failures(failed_tests)
            analysis["failure_analysis"] = failure_analysis
        
        # Phase 4: Update knowledge base
        print("  Phase 4: Updating knowledge base...")
        self.analyzer.update_knowledge_base(analysis)
        
        # Generate report
        report = self.executor.generate_report(exec_results)
        
        result = {
            "execution_results": exec_results,
            "analysis": analysis,
            "report": report,
            "summary": self._generate_summary(exec_results, analysis)
        }
        
        print("Test Execution Crew: Execution complete!")
        return result
    
    def _generate_summary(
        self,
        exec_results: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate execution summary"""
        return {
            "total_tests": exec_results.get("total", 0),
            "passed": exec_results.get("passed", 0),
            "failed": exec_results.get("failed", 0),
            "errors": exec_results.get("errors", 0),
            "pass_rate": exec_results.get("pass_rate", "0%"),
            "issues_found": len(analysis.get("issues", [])),
            "recommendations": len(analysis.get("recommendations", []))
        }


# Crew instance
test_execution_crew = TestExecutionCrew()
