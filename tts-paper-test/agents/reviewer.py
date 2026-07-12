"""Test Review Agent"""

from typing import Any, Dict, List

from knowledge.vector_store import knowledge_store
from prompts.test_review import TEST_REVIEW_PROMPT


class TestReviewerAgent:
    """Agent responsible for reviewing test quality"""
    
    def __init__(self):
        self.name = "Test Quality Reviewer"
        self.role = "Test Reviewer"
        self.goal = "Review test quality and suggest improvements"
        self.backstory = """QA expert with focus on test coverage, edge cases, 
        and code quality. You review tests critically and provide actionable feedback."""
    
    def review_test_code(self, test_code: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Review test code and provide feedback"""
        review = {
            "quality_score": 0,
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
            "missing_scenarios": [],
            "overall_assessment": ""
        }
        
        # Analyze test code
        lines = test_code.split('\n')
        
        # Check for test functions
        test_functions = [l for l in lines if l.strip().startswith('def test_')]
        review["test_count"] = len(test_functions)
        
        # Check for assertions
        assertions = [l for l in lines if 'assert' in l]
        review["assertion_count"] = len(assertions)
        
        # Check for docstrings
        docstrings = [l for l in lines if '"""' in l or "'''" in l]
        review["docstring_count"] = len(docstrings)
        
        # Check for fixtures
        fixtures = [l for l in lines if '@pytest.fixture' in l]
        review["fixture_count"] = len(fixtures)
        
        # Calculate quality score
        score = 0
        if test_functions:
            score += 30
        if assertions:
            score += 30
        if docstrings:
            score += 20
        if fixtures:
            score += 20
        
        review["quality_score"] = min(score, 100)
        
        # Identify strengths
        if len(test_functions) >= 3:
            review["strengths"].append("Good number of test functions")
        if len(assertions) >= len(test_functions):
            review["strengths"].append("Good assertion coverage")
        if docstrings:
            review["strengths"].append("Tests have documentation")
        
        # Identify weaknesses
        if len(test_functions) < 3:
            review["weaknesses"].append("Insufficient test functions")
        if len(assertions) < len(test_functions):
            review["weaknesses"].append("Missing assertions in some tests")
        if not docstrings:
            review["weaknesses"].append("No test documentation")
        
        # Generate suggestions
        review["suggestions"] = self._generate_suggestions(review)
        
        # Identify missing scenarios
        review["missing_scenarios"] = self._identify_missing_scenarios(test_code)
        
        # Overall assessment
        if review["quality_score"] >= 80:
            review["overall_assessment"] = "Good quality test code"
        elif review["quality_score"] >= 60:
            review["overall_assessment"] = "Acceptable quality, room for improvement"
        else:
            review["overall_assessment"] = "Needs significant improvement"
        
        return review
    
    def _generate_suggestions(self, review: Dict[str, Any]) -> List[str]:
        """Generate improvement suggestions"""
        suggestions = []
        
        if review["test_count"] < 5:
            suggestions.append("Add more test functions to improve coverage")
        
        if review["assertion_count"] < review["test_count"]:
            suggestions.append("Add assertions to all test functions")
        
        if review["docstring_count"] < review["test_count"]:
            suggestions.append("Add docstrings to document test purpose")
        
        if review["fixture_count"] == 0:
            suggestions.append("Consider using fixtures for test setup")
        
        suggestions.extend([
            "Add edge case tests",
            "Add negative test scenarios",
            "Consider using parameterized tests",
            "Add performance assertions if applicable"
        ])
        
        return suggestions
    
    def _identify_missing_scenarios(self, test_code: str) -> List[str]:
        """Identify missing test scenarios"""
        missing = []
        
        # Check for common missing scenarios
        if "error" not in test_code.lower():
            missing.append("Error handling tests")
        
        if "edge" not in test_code.lower():
            missing.append("Edge case tests")
        
        if "boundary" not in test_code.lower():
            missing.append("Boundary value tests")
        
        if "security" not in test_code.lower():
            missing.append("Security tests")
        
        if "performance" not in test_code.lower():
            missing.append("Performance tests")
        
        return missing
    
    def compare_with_patterns(self, test_code: str, patterns: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compare test code with known patterns"""
        comparison = {
            "matching_patterns": [],
            "missing_patterns": [],
            "recommendations": []
        }
        
        # Simple pattern matching
        for pattern in patterns:
            pattern_desc = pattern.get("description", "").lower()
            
            # Check if pattern is covered
            if any(keyword in test_code.lower() for keyword in pattern_desc.split()[:3]):
                comparison["matching_patterns"].append(pattern)
            else:
                comparison["missing_patterns"].append(pattern)
        
        # Generate recommendations
        if comparison["missing_patterns"]:
            comparison["recommendations"].append(
                f"Consider adding tests for {len(comparison['missing_patterns'])} missing patterns"
            )
        
        return comparison
    
    def generate_review_report(self, review: Dict[str, Any]) -> str:
        """Generate a review report"""
        report = f"""Test Review Report
{'=' * 50}

Quality Score: {review['quality_score']}/100

Strengths:
"""
        
        for strength in review.get('strengths', []):
            report += f"  + {strength}\n"
        
        report += "\nWeaknesses:\n"
        for weakness in review.get('weaknesses', []):
            report += f"  - {weakness}\n"
        
        report += "\nSuggestions:\n"
        for suggestion in review.get('suggestions', []):
            report += f"  * {suggestion}\n"
        
        if review.get('missing_scenarios'):
            report += "\nMissing Scenarios:\n"
            for scenario in review['missing_scenarios']:
                report += f"  ! {scenario}\n"
        
        report += f"\nOverall Assessment: {review['overall_assessment']}\n"
        
        return report


# Agent instance
reviewer_agent = TestReviewerAgent()
