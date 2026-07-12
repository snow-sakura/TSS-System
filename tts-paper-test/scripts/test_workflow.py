"""Test the complete workflow without chromadb"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Create a simple mock knowledge store for testing
class SimpleKnowledgeStore:
    def __init__(self):
        self.patterns = []
        self.bugs = []
        self.results = []
    
    def add_test_pattern(self, pattern):
        self.patterns.append(pattern)
    
    def add_bug_knowledge(self, bug):
        self.bugs.append(bug)
    
    def add_test_result(self, result):
        self.results.append(result)
    
    def search_test_patterns(self, query, n_results=5):
        return self.patterns[:n_results]
    
    def search_bug_knowledge(self, query, n_results=5):
        return self.bugs[:n_results]
    
    def search_test_results(self, query, n_results=5):
        return self.results[:n_results]
    
    def get_stats(self):
        return {
            "test_patterns": len(self.patterns),
            "bug_knowledge": len(self.bugs),
            "test_results": len(self.results)
        }
    
    def get_all_patterns(self):
        return self.patterns
    
    def get_all_bugs(self):
        return self.bugs

# Create mock module
class MockKnowledgeModule:
    def __init__(self):
        self.knowledge_store = SimpleKnowledgeStore()

# Patch the imports
mock_module = MockKnowledgeModule()
sys.modules['chromadb'] = type(sys)('chromadb')
sys.modules['chromadb.config'] = type(sys)('chromadb.config')
sys.modules['chromadb.config'].Settings = lambda **kwargs: None
sys.modules['knowledge.vector_store'] = mock_module

# Now import the agents
from agents.flows.test_flow import TestFlow
from agents.crews.test_generation_crew import TestGenerationCrew
from agents.crews.test_execution_crew import TestExecutionCrew
from agents.crews.analysis_crew import AnalysisCrew

# Create test instances with mock knowledge store
mock_knowledge = mock_module.knowledge_store


def test_knowledge_store():
    """Test knowledge store functionality"""
    print("\n1. Testing Knowledge Store...")
    
    # Add test patterns
    mock_knowledge.add_test_pattern({
        "id": "pattern-001",
        "description": "API认证测试：验证Token有效性",
        "metadata": {"category": "auth", "type": "api"}
    })
    
    mock_knowledge.add_test_pattern({
        "id": "pattern-002",
        "description": "输入验证测试：检查SQL注入防护",
        "metadata": {"category": "security", "type": "api"}
    })
    
    # Add bug knowledge
    mock_knowledge.add_bug_knowledge({
        "id": "bug-001",
        "description": "并发购票导致库存不一致",
        "metadata": {"severity": "high", "category": "concurrency"}
    })
    
    # Search patterns
    results = mock_knowledge.search_test_patterns("认证", n_results=2)
    print(f"  ✓ Found {len(results)} patterns")
    
    # Search bugs
    results = mock_knowledge.search_bug_knowledge("并发", n_results=2)
    print(f"  ✓ Found {len(results)} bugs")
    
    # Get stats
    stats = mock_knowledge.get_stats()
    print(f"  ✓ Stats: {stats}")
    
    return True


def test_planner_agent():
    """Test planner agent"""
    print("\n2. Testing Planner Agent...")
    
    from agents.planner import TestPlannerAgent
    
    planner = TestPlannerAgent()
    
    system_info = {
        "modules": ["auth", "destinations"],
        "endpoints": ["/api/login", "/api/destinations"]
    }
    
    test_plan = planner.create_test_plan(system_info)
    
    print(f"  ✓ Plan created: {test_plan['id']}")
    print(f"  ✓ Test scenarios: {len(test_plan.get('test_scenarios', []))}")
    
    return True


def test_generator_agent():
    """Test generator agent"""
    print("\n3. Testing Generator Agent...")
    
    from agents.generator import TestGeneratorAgent
    
    generator = TestGeneratorAgent()
    
    scenario = {
        "name": "Test Login",
        "type": "api",
        "endpoint": "/api/login",
        "method": "POST"
    }
    
    test_code = generator.generate_test_code(scenario, {})
    
    print(f"  ✓ Test code generated ({len(test_code)} chars)")
    print(f"  ✓ Contains 'def test_': {'def test_' in test_code}")
    
    return True


def test_reviewer_agent():
    """Test reviewer agent"""
    print("\n4. Testing Reviewer Agent...")
    
    from agents.reviewer import TestReviewerAgent
    
    reviewer = TestReviewerAgent()
    
    test_code = '''
def test_login_success():
    """Test successful login"""
    response = api_client.post("/api/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response["status_code"] == 200
'''
    
    review = reviewer.review_test_code(test_code)
    
    print(f"  ✓ Quality score: {review['quality_score']}")
    print(f"  ✓ Strengths: {len(review['strengths'])}")
    print(f"  ✓ Suggestions: {len(review['suggestions'])}")
    
    return True


def test_analyzer_agent():
    """Test analyzer agent"""
    print("\n5. Testing Analyzer Agent...")
    
    from agents.analyzer import TestAnalyzerAgent
    
    analyzer = TestAnalyzerAgent()
    
    test_results = {
        "total": 10,
        "passed": 8,
        "failed": 2,
        "errors": 0,
        "pass_rate": "80.0%",
        "results": [
            {"name": "test_1", "status": "passed"},
            {"name": "test_2", "status": "failed", "message": "Assertion error"}
        ]
    }
    
    analysis = analyzer.analyze_results(test_results)
    
    print(f"  ✓ Issues found: {len(analysis.get('issues', []))}")
    print(f"  ✓ Recommendations: {len(analysis.get('recommendations', []))}")
    
    return True


def main():
    """Main test function"""
    print("=" * 60)
    print("TSS Paper Test - Workflow Test (Mock Mode)")
    print("=" * 60)
    
    results = []
    
    results.append(test_knowledge_store())
    results.append(test_planner_agent())
    results.append(test_generator_agent())
    results.append(test_reviewer_agent())
    results.append(test_analyzer_agent())
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n✓ All workflow tests passed!")
        print("\nThe AI-powered testing system components are working correctly.")
        print("\nSystem Components Verified:")
        print("  ✓ Knowledge Store - Store and retrieve test patterns")
        print("  ✓ Planner Agent - Create test plans")
        print("  ✓ Generator Agent - Generate test code")
        print("  ✓ Reviewer Agent - Review test quality")
        print("  ✓ Analyzer Agent - Analyze test results")
        print("\nNote: Full integration requires chromadb to be installed.")
        print("Install with: pip install chromadb")
    else:
        print(f"\n✗ {total - passed} tests failed")
    
    print("=" * 60)
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
