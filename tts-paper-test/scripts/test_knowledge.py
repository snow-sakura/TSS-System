"""Test knowledge base functionality"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from knowledge.vector_store import knowledge_store


def test_search_patterns():
    """Test searching for test patterns"""
    print("\n1. Testing pattern search...")
    
    queries = [
        "认证测试",
        "SQL注入",
        "购票流程",
        "分页查询"
    ]
    
    for query in queries:
        results = knowledge_store.search_test_patterns(query, n_results=2)
        print(f"\n  Query: '{query}'")
        if results:
            for i, result in enumerate(results, 1):
                print(f"    {i}. {result['content'][:100]}...")
        else:
            print("    No results found")


def test_search_bugs():
    """Test searching for bug knowledge"""
    print("\n2. Testing bug knowledge search...")
    
    queries = [
        "并发问题",
        "安全漏洞",
        "库存"
    ]
    
    for query in queries:
        results = knowledge_store.search_bug_knowledge(query, n_results=2)
        print(f"\n  Query: '{query}'")
        if results:
            for i, result in enumerate(results, 1):
                print(f"    {i}. {result['content'][:100]}...")
        else:
            print("    No results found")


def test_stats():
    """Test knowledge base statistics"""
    print("\n3. Knowledge base statistics...")
    stats = knowledge_store.get_stats()
    print(f"  Test Patterns: {stats['test_patterns']}")
    print(f"  Bug Knowledge: {stats['bug_knowledge']}")
    print(f"  Test Results: {stats['test_results']}")


def main():
    """Main test function"""
    print("=" * 60)
    print("TSS Paper Test - Knowledge Base Test")
    print("=" * 60)
    
    test_stats()
    test_search_patterns()
    test_search_bugs()
    
    print("\n" + "=" * 60)
    print("Knowledge base test complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
