"""Run AI agents for test generation"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.config import settings
from agents.tools.knowledge_retriever import knowledge_retriever_tool


def main():
    """Main function to run agents"""
    print("TSS Paper Test - AI Agent Runner")
    print("=" * 50)
    
    # Check knowledge base stats
    stats = knowledge_retriever_tool.get_stats()
    print(f"\nKnowledge Base Stats:")
    print(f"  Test Patterns: {stats['test_patterns']}")
    print(f"  Bug Knowledge: {stats['bug_knowledge']}")
    print(f"  Test Results: {stats['test_results']}")
    
    print("\nTo run agents, use the Skills:")
    print("  /test-generation - Generate tests")
    print("  /test-execution - Execute tests")
    print("  /full-test-cycle - Run full cycle")


if __name__ == "__main__":
    main()
