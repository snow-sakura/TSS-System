"""Simple verification of core functionality"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def verify_core_modules():
    """Verify core modules can be imported"""
    print("=" * 60)
    print("TSS Paper Test - Simple Verification")
    print("=" * 60)
    
    results = []
    
    # Test 1: Core config
    print("\n1. Testing core config...")
    try:
        from core.config import settings
        print(f"  ✓ Config loaded: {settings.tss.base_url}")
        results.append(True)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        results.append(False)
    
    # Test 2: Core models
    print("\n2. Testing core models...")
    try:
        from core.models import TestResult, TestStatus, TestType
        print(f"  ✓ Models imported successfully")
        results.append(True)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        results.append(False)
    
    # Test 3: Core exceptions
    print("\n3. Testing core exceptions...")
    try:
        from core.exceptions import TTSTestError, AgentError
        print(f"  ✓ Exceptions imported successfully")
        results.append(True)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        results.append(False)
    
    # Test 4: Prompts
    print("\n4. Testing prompts...")
    try:
        from prompts.test_generation import TEST_GENERATION_PROMPT
        from prompts.test_review import TEST_REVIEW_PROMPT
        from prompts.bug_analysis import BUG_ANALYSIS_PROMPT
        from prompts.report_summary import REPORT_SUMMARY_PROMPT
        print(f"  ✓ All prompts imported successfully")
        results.append(True)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        results.append(False)
    
    # Test 5: Agent configs
    print("\n5. Testing agent configs...")
    try:
        import json
        config_dir = project_root / "agents" / "config"
        configs = list(config_dir.glob("*.jsonc"))
        print(f"  ✓ Found {len(configs)} agent configs")
        for config in configs:
            print(f"    - {config.name}")
        results.append(True)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        results.append(False)
    
    # Test 6: Skills
    print("\n6. Testing skills...")
    try:
        skills_dir = project_root / ".mimocode" / "skills"
        skills = list(skills_dir.iterdir())
        print(f"  ✓ Found {len(skills)} skills")
        for skill in skills:
            if skill.is_dir():
                skill_md = skill / "SKILL.md"
                if skill_md.exists():
                    print(f"    - {skill.name}")
        results.append(True)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        results.append(False)
    
    # Test 7: Knowledge patterns
    print("\n7. Testing knowledge patterns...")
    try:
        patterns_dir = project_root / "knowledge" / "test_patterns"
        patterns = list(patterns_dir.glob("*.md"))
        print(f"  ✓ Found {len(patterns)} pattern files")
        for pattern in patterns:
            print(f"    - {pattern.name}")
        results.append(True)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        results.append(False)
    
    # Test 8: Test files
    print("\n8. Testing test files...")
    try:
        tests_dir = project_root / "tests"
        test_files = list(tests_dir.rglob("test_*.py"))
        print(f"  ✓ Found {len(test_files)} test files")
        for test in test_files:
            print(f"    - {test.relative_to(project_root)}")
        results.append(True)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        results.append(False)
    
    # Summary
    print("\n" + "=" * 60)
    print("Verification Summary")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n✓ All core modules verified successfully!")
        print("\nAvailable Features:")
        print("  ✓ Configuration management")
        print("  ✓ Data models")
        print("  ✓ Exception handling")
        print("  ✓ Prompt templates")
        print("  ✓ Agent configurations")
        print("  ✓ Skills definitions")
        print("  ✓ Knowledge patterns")
        print("  ✓ Test files")
        print("\nNote: Some features require chromadb to be installed.")
        print("Install with: pip install chromadb")
    else:
        print(f"\n✗ {total - passed} verifications failed")
    
    print("=" * 60)
    
    return passed == total


if __name__ == "__main__":
    success = verify_core_modules()
    sys.exit(0 if success else 1)
