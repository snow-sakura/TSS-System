"""Test Result Analyzer Agent"""

from typing import Any, Dict, List

from knowledge.vector_store import knowledge_store
from prompts.bug_analysis import BUG_ANALYSIS_PROMPT
from prompts.report_summary import REPORT_SUMMARY_PROMPT


class TestAnalyzerAgent:
    """Agent responsible for analyzing test results"""
    
    def __init__(self):
        self.name = "Test Result Analyst"
        self.role = "Test Analyzer"
        self.goal = "Analyze test results and identify patterns"
        self.backstory = """Data analyst specializing in software quality metrics. 
        You analyze test results to find trends, identify flaky tests, and suggest 
        improvements."""
    
    def analyze_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze test results"""
        analysis = {
            "summary": self._generate_summary(results),
            "patterns": self._identify_patterns(results),
            "issues": self._identify_issues(results),
            "recommendations": self._generate_recommendations(results)
        }
        
        return analysis
    
    def _generate_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary statistics"""
        return {
            "total": results.get("total", 0),
            "passed": results.get("passed", 0),
            "failed": results.get("failed", 0),
            "errors": results.get("errors", 0),
            "pass_rate": results.get("pass_rate", "0%")
        }
    
    def _identify_patterns(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify patterns in test results"""
        patterns = []
        
        test_results = results.get("results", [])
        
        # Group by status
        status_groups = {}
        for result in test_results:
            status = result.get("status", "unknown")
            if status not in status_groups:
                status_groups[status] = []
            status_groups[status].append(result)
        
        # Identify patterns
        for status, tests in status_groups.items():
            if len(tests) > 1:
                patterns.append({
                    "type": "status_group",
                    "status": status,
                    "count": len(tests),
                    "tests": [t.get("name", "") for t in tests[:5]]
                })
        
        return patterns
    
    def _identify_issues(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify issues from test results"""
        issues = []
        
        test_results = results.get("results", [])
        
        # Check for failures
        failed_tests = [t for t in test_results if t.get("status") == "failed"]
        if failed_tests:
            issues.append({
                "type": "test_failures",
                "severity": "high",
                "count": len(failed_tests),
                "tests": [t.get("name", "") for t in failed_tests[:5]],
                "message": f"{len(failed_tests)} tests failed"
            })
        
        # Check for errors
        error_tests = [t for t in test_results if t.get("status") == "error"]
        if error_tests:
            issues.append({
                "type": "test_errors",
                "severity": "critical",
                "count": len(error_tests),
                "tests": [t.get("name", "") for t in error_tests[:5]],
                "message": f"{len(error_tests)} tests had errors"
            })
        
        # Check for low pass rate
        pass_rate = results.get("pass_rate", "0%")
        if isinstance(pass_rate, str):
            pass_rate_value = float(pass_rate.replace('%', ''))
        else:
            pass_rate_value = pass_rate
        
        if pass_rate_value < 80:
            issues.append({
                "type": "low_pass_rate",
                "severity": "medium",
                "pass_rate": pass_rate,
                "message": f"Pass rate {pass_rate} is below 80%"
            })
        
        return issues
    
    def _generate_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []
        
        issues = self._identify_issues(results)
        
        for issue in issues:
            if issue["type"] == "test_failures":
                recommendations.append("Investigate and fix failing tests")
                recommendations.append("Check for environmental issues")
            
            elif issue["type"] == "test_errors":
                recommendations.append("Fix test errors immediately")
                recommendations.append("Check test dependencies")
            
            elif issue["type"] == "low_pass_rate":
                recommendations.append("Review test implementation")
                recommendations.append("Check test data and fixtures")
        
        # General recommendations
        recommendations.extend([
            "Review test coverage regularly",
            "Update test patterns in knowledge base",
            "Consider adding more edge case tests"
        ])
        
        return list(set(recommendations))
    
    def analyze_failures(self, failed_tests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze test failures in detail"""
        analysis = {
            "total_failures": len(failed_tests),
            "failure_categories": {},
            "root_causes": [],
            "fix_suggestions": []
        }
        
        # Categorize failures
        for test in failed_tests:
            message = test.get("message", "")
            
            # Simple categorization
            if "assert" in message.lower():
                category = "assertion_error"
            elif "timeout" in message.lower():
                category = "timeout"
            elif "connection" in message.lower():
                category = "connection_error"
            else:
                category = "other"
            
            if category not in analysis["failure_categories"]:
                analysis["failure_categories"][category] = []
            analysis["failure_categories"][category].append(test.get("name", ""))
        
        # Generate root causes and suggestions
        for category, tests in analysis["failure_categories"].items():
            if category == "assertion_error":
                analysis["root_causes"].append("Test assertions are failing")
                analysis["fix_suggestions"].append("Review expected vs actual values")
            elif category == "timeout":
                analysis["root_causes"].append("Tests are timing out")
                analysis["fix_suggestions"].append("Increase timeout or optimize test")
            elif category == "connection_error":
                analysis["root_causes"].append("Connection issues")
                analysis["fix_suggestions"].append("Check server availability")
        
        return analysis
    
    def update_knowledge_base(self, analysis: Dict[str, Any]) -> bool:
        """Update knowledge base with analysis results"""
        try:
            # Add analysis to test results
            knowledge_store.add_test_result({
                "id": f"analysis-{len(knowledge_store.get_stats().get('test_results', [])) + 1}",
                "message": f"Analysis: {analysis.get('summary', {}).get('pass_rate', 'N/A')} pass rate",
                "metadata": {
                    "type": "analysis",
                    "summary": analysis.get("summary", {}),
                    "issues": analysis.get("issues", [])
                }
            })
            return True
        except Exception as e:
            print(f"Failed to update knowledge base: {e}")
            return False
    
    def generate_analysis_report(self, analysis: Dict[str, Any]) -> str:
        """Generate analysis report"""
        report = f"""Test Analysis Report
{'=' * 50}

Summary:
  Total: {analysis['summary']['total']}
  Passed: {analysis['summary']['passed']}
  Failed: {analysis['summary']['failed']}
  Errors: {analysis['summary']['errors']}
  Pass Rate: {analysis['summary']['pass_rate']}

Issues Found:
"""
        
        for issue in analysis.get('issues', []):
            report += f"  - [{issue['severity']}] {issue['message']}\n"
        
        report += "\nRecommendations:\n"
        for rec in analysis.get('recommendations', []):
            report += f"  * {rec}\n"
        
        return report


# Agent instance
analyzer_agent = TestAnalyzerAgent()
