"""Test Generation Crew - Coordinates planning and generation agents"""

from typing import Any, Dict, List

from agents.planner import planner_agent
from agents.generator import generator_agent
from agents.reviewer import reviewer_agent
from knowledge.vector_store import knowledge_store


class TestGenerationCrew:
    """Crew responsible for generating tests"""
    
    def __init__(self):
        self.planner = planner_agent
        self.generator = generator_agent
        self.reviewer = reviewer_agent
    
    def execute(self, system_info: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the test generation workflow"""
        print("Test Generation Crew: Starting execution...")
        
        # Phase 1: Planning
        print("  Phase 1: Creating test plan...")
        test_plan = self.planner.create_test_plan(system_info)
        
        # Phase 2: Generation
        print("  Phase 2: Generating test code...")
        generated_tests = []
        
        for scenario in test_plan.get("test_scenarios", []):
            # Search for similar patterns
            similar_patterns = knowledge_store.search_test_patterns(
                scenario.get("name", ""),
                n_results=3
            )
            
            # Generate test code
            test_code = self.generator.generate_test_code(
                scenario,
                system_info,
                similar_patterns
            )
            
            generated_tests.append({
                "scenario": scenario,
                "code": test_code,
                "patterns_used": similar_patterns
            })
        
        # Phase 3: Review
        print("  Phase 3: Reviewing generated tests...")
        review_results = []
        
        for test in generated_tests:
            review = self.reviewer.review_test_code(test["code"])
            review_results.append({
                "scenario": test["scenario"]["name"],
                "review": review
            })
        
        # Combine results
        result = {
            "test_plan": test_plan,
            "generated_tests": generated_tests,
            "reviews": review_results,
            "summary": self._generate_summary(generated_tests, review_results)
        }
        
        print("Test Generation Crew: Execution complete!")
        return result
    
    def _generate_summary(
        self,
        tests: List[Dict[str, Any]],
        reviews: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate execution summary"""
        total_tests = len(tests)
        avg_score = 0
        
        if reviews:
            scores = [r["review"]["quality_score"] for r in reviews]
            avg_score = sum(scores) / len(scores) if scores else 0
        
        return {
            "total_tests_generated": total_tests,
            "average_quality_score": round(avg_score, 2),
            "scenarios_covered": [t["scenario"]["name"] for t in tests]
        }


# Crew instance
test_generation_crew = TestGenerationCrew()
