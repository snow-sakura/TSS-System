"""Test Planning Agent"""

from typing import Any, Dict, List, Optional

from core.config import settings
from knowledge.vector_store import knowledge_store


class TestPlannerAgent:
    """Agent responsible for creating test plans"""
    
    def __init__(self):
        self.name = "Test Planning Specialist"
        self.role = "Test Planner"
        self.goal = "Analyze the system and create comprehensive test plans"
        self.backstory = """Expert in software testing strategy with deep knowledge 
        of TSS system. You excel at identifying test scenarios, prioritizing test cases, 
        and creating efficient test strategies."""
    
    def analyze_system(self, system_info: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the system under test"""
        analysis = {
            "modules": [],
            "endpoints": [],
            "business_logic": [],
            "risks": []
        }
        
        # Extract information from system_info
        if "endpoints" in system_info:
            analysis["endpoints"] = system_info["endpoints"]
        
        if "modules" in system_info:
            analysis["modules"] = system_info["modules"]
        
        return analysis
    
    def create_test_plan(self, system_info: Dict[str, Any]) -> Dict[str, Any]:
        """Create a test plan based on system analysis"""
        # Analyze system
        analysis = self.analyze_system(system_info)
        
        # Search for similar patterns
        similar_patterns = knowledge_store.search_test_patterns(
            " ".join(analysis.get("modules", [])),
            n_results=5
        )
        
        # Search for related bugs
        related_bugs = knowledge_store.search_bug_knowledge(
            " ".join(analysis.get("modules", [])),
            n_results=3
        )
        
        # Create test plan
        test_plan = {
            "id": "plan-001",
            "name": "TSS System Test Plan",
            "description": "Comprehensive test plan for TSS system",
            "test_types": ["api", "integration", "performance"],
            "priority": 1,
            "modules": analysis.get("modules", []),
            "endpoints": analysis.get("endpoints", []),
            "similar_patterns": similar_patterns,
            "related_bugs": related_bugs,
            "test_scenarios": self._generate_test_scenarios(analysis),
            "estimated_duration": self._estimate_duration(analysis)
        }
        
        return test_plan
    
    def _generate_test_scenarios(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate test scenarios based on analysis"""
        scenarios = []
        
        # API test scenarios
        for endpoint in analysis.get("endpoints", []):
            scenarios.append({
                "type": "api",
                "name": f"Test {endpoint}",
                "priority": "high",
                "description": f"Test endpoint {endpoint}"
            })
        
        # Business logic scenarios
        scenarios.extend([
            {
                "type": "business",
                "name": "Test purchase flow",
                "priority": "high",
                "description": "Test complete ticket purchase flow"
            },
            {
                "type": "business",
                "name": "Test user management",
                "priority": "medium",
                "description": "Test user CRUD operations"
            },
            {
                "type": "security",
                "name": "Test authentication",
                "priority": "high",
                "description": "Test login, logout, session management"
            }
        ])
        
        return scenarios
    
    def _estimate_duration(self, analysis: Dict[str, Any]) -> float:
        """Estimate test execution duration"""
        base_duration = 60.0  # Base duration in seconds
        endpoint_count = len(analysis.get("endpoints", []))
        module_count = len(analysis.get("modules", []))
        
        return base_duration + (endpoint_count * 10) + (module_count * 15)
    
    def prioritize_tests(self, test_scenarios: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Prioritize test scenarios"""
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        
        return sorted(
            test_scenarios,
            key=lambda x: priority_order.get(x.get("priority", "low"), 3)
        )


# Agent instance
planner_agent = TestPlannerAgent()
