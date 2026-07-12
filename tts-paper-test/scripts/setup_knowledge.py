"""Setup knowledge base with initial data"""

import json
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from knowledge.vector_store import knowledge_store


def setup_test_patterns():
    """Setup initial test patterns"""
    patterns = [
        {
            "id": "pattern-001",
            "description": "API认证测试：验证Token有效性、过期、权限等场景",
            "metadata": {"category": "auth", "type": "api"}
        },
        {
            "id": "pattern-002",
            "description": "输入验证测试：检查SQL注入、XSS、边界值等安全问题",
            "metadata": {"category": "security", "type": "api"}
        },
        {
            "id": "pattern-003",
            "description": "并发测试：验证多用户同时操作时的数据一致性",
            "metadata": {"category": "concurrency", "type": "integration"}
        },
        {
            "id": "pattern-004",
            "description": "错误处理测试：验证各种异常场景的错误响应",
            "metadata": {"category": "error", "type": "api"}
        },
        {
            "id": "pattern-005",
            "description": "业务流程测试：验证完整购票流程的正确性",
            "metadata": {"category": "business", "type": "integration"}
        }
    ]
    
    for pattern in patterns:
        knowledge_store.add_test_pattern(pattern)
        print(f"Added pattern: {pattern['id']}")


def setup_bug_knowledge():
    """Setup initial bug knowledge"""
    bugs = [
        {
            "id": "bug-001",
            "description": "并发购票导致库存不一致，可能出现超卖现象",
            "metadata": {"severity": "high", "category": "concurrency"}
        },
        {
            "id": "bug-002",
            "description": "登录会话未正确失效，登出后仍可访问受保护资源",
            "metadata": {"severity": "high", "category": "security"}
        },
        {
            "id": "bug-003",
            "description": "分页查询边界条件处理不当，参数为0或负数时出错",
            "metadata": {"severity": "medium", "category": "input_validation"}
        }
    ]
    
    for bug in bugs:
        knowledge_store.add_bug_knowledge(bug)
        print(f"Added bug: {bug['id']}")


def main():
    """Main function to setup knowledge base"""
    print("Setting up knowledge base...")
    print("=" * 50)
    
    print("\n1. Setting up test patterns...")
    setup_test_patterns()
    
    print("\n2. Setting up bug knowledge...")
    setup_bug_knowledge()
    
    print("\n3. Checking stats...")
    stats = knowledge_store.get_stats()
    print(f"  Test Patterns: {stats['test_patterns']}")
    print(f"  Bug Knowledge: {stats['bug_knowledge']}")
    print(f"  Test Results: {stats['test_results']}")
    
    print("\nKnowledge base setup complete!")


if __name__ == "__main__":
    main()
