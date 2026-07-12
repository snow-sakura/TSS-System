"""Verify Skills functionality"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def verify_test_generation():
    """Verify test-generation skill"""
    print("\n1. Verifying test-generation skill...")
    
    try:
        from agents.crews.test_generation_crew import test_generation_crew
        from agents.planner import planner_agent
        from agents.generator import generator_agent
        from agents.reviewer import reviewer_agent
        
        print("  ✓ TestGenerationCrew imported successfully")
        print("  ✓ PlannerAgent imported successfully")
        print("  ✓ GeneratorAgent imported successfully")
        print("  ✓ ReviewerAgent imported successfully")
        
        # Test planner
        system_info = {
            "modules": ["auth"],
            "endpoints": ["/api/login"]
        }
        test_plan = planner_agent.create_test_plan(system_info)
        print(f"  ✓ Test plan created: {test_plan['id']}")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def verify_test_execution():
    """Verify test-execution skill"""
    print("\n2. Verifying test-execution skill...")
    
    try:
        from agents.crews.test_execution_crew import test_execution_crew
        from agents.executor import executor_agent
        from agents.analyzer import analyzer_agent
        
        print("  ✓ TestExecutionCrew imported successfully")
        print("  ✓ ExecutorAgent imported successfully")
        print("  ✓ AnalyzerAgent imported successfully")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def verify_test_analysis():
    """Verify test-analysis skill"""
    print("\n3. Verifying test-analysis skill...")
    
    try:
        from agents.crews.analysis_crew import analysis_crew
        from agents.analyzer import analyzer_agent
        from agents.reviewer import reviewer_agent
        
        print("  ✓ AnalysisCrew imported successfully")
        print("  ✓ AnalyzerAgent imported successfully")
        print("  ✓ ReviewerAgent imported successfully")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def verify_knowledge_update():
    """Verify knowledge-update skill"""
    print("\n4. Verifying knowledge-update skill...")
    
    try:
        from knowledge.vector_store import knowledge_store
        
        stats = knowledge_store.get_stats()
        print(f"  ✓ KnowledgeStore imported successfully")
        print(f"  ✓ Test Patterns: {stats['test_patterns']}")
        print(f"  ✓ Bug Knowledge: {stats['bug_knowledge']}")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def verify_full_test_cycle():
    """Verify full-test-cycle skill"""
    print("\n5. Verifying full-test-cycle skill...")
    
    try:
        from agents.flows.test_flow import test_flow
        
        print("  ✓ TestFlow imported successfully")
        
        # Test default system info
        system_info = test_flow._get_default_system_info()
        print(f"  ✓ Default system info: {system_info['name']}")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def main():
    """Main verification function"""
    print("=" * 60)
    print("TSS Paper Test - Skills Verification")
    print("=" * 60)
    
    results = []
    
    results.append(verify_test_generation())
    results.append(verify_test_execution())
    results.append(verify_test_analysis())
    results.append(verify_knowledge_update())
    results.append(verify_full_test_cycle())
    
    print("\n" + "=" * 60)
    print("Verification Summary")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n✓ All Skills verified successfully!")
        print("\nAvailable Skills:")
        print("  /test-generation - Generate tests")
        print("  /test-execution - Execute tests")
        print("  /test-analysis - Analyze results")
        print("  /knowledge-update - Update knowledge")
        print("  /full-test-cycle - Full test cycle")
    else:
        print("\n✗ Some Skills failed verification")
    
    print("=" * 60)


if __name__ == "__main__":
    main()
