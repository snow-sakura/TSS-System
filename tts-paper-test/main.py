"""TSS Paper Test - Main Entry Point"""

import sys
import argparse
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from agents.skills_integration import skills_integration
from agents.flows.test_flow import test_flow
from knowledge.vector_store import knowledge_store


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="TSS Paper Test - AI-Powered Testing System"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Test generation command
    gen_parser = subparsers.add_parser("generate", help="Generate tests")
    gen_parser.add_argument("--module", type=str, help="Specific module to test")
    
    # Test execution command
    exec_parser = subparsers.add_parser("execute", help="Execute tests")
    exec_parser.add_argument("--type", type=str, help="Test type (api, unit, all)")
    
    # Test analysis command
    analysis_parser = subparsers.add_parser("analyze", help="Analyze results")
    analysis_parser.add_argument("--period", type=str, help="Analysis period")
    
    # Knowledge update command
    knowledge_parser = subparsers.add_parser("knowledge", help="Update knowledge base")
    knowledge_parser.add_argument("--type", type=str, help="Update type (patterns, bugs, all)")
    
    # Full cycle command
    subparsers.add_parser("full-cycle", help="Run full test cycle")
    
    # Stats command
    subparsers.add_parser("stats", help="Show knowledge base statistics")
    
    # Verify command
    subparsers.add_parser("verify", help="Verify Skills functionality")
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        return
    
    # Execute command
    if args.command == "generate":
        result = skills_integration.test_generation(args.module)
        print("\nResult:", result.get("summary", {}))
    
    elif args.command == "execute":
        result = skills_integration.test_execution(args.type)
        print("\nResult:", result.get("summary", {}))
    
    elif args.command == "analyze":
        result = skills_integration.test_analysis(args.period)
        print("\nResult:", result.get("summary", {}))
    
    elif args.command == "knowledge":
        result = skills_integration.knowledge_update(args.type)
        print("\nResult:", result)
    
    elif args.command == "full-cycle":
        result = skills_integration.full_test_cycle()
        report = result.get("final_report", {})
        print("\nFinal Report:", report.get("summary", {}))
    
    elif args.command == "stats":
        stats = knowledge_store.get_stats()
        print("\nKnowledge Base Statistics:")
        print(f"  Test Patterns: {stats['test_patterns']}")
        print(f"  Bug Knowledge: {stats['bug_knowledge']}")
        print(f"  Test Results: {stats['test_results']}")
    
    elif args.command == "verify":
        from scripts.verify_skills import main as verify_main
        verify_main()


if __name__ == "__main__":
    main()
