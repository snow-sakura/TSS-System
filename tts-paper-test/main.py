"""TSS Paper Test - Main Entry Point"""

import sys
import argparse
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="TSS Paper Test - AI-Powered Testing System"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Web server command
    subparsers.add_parser("web", help="Start web server")
    
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
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        return
    
    # Execute command
    if args.command == "web":
        from backend.app import app, socketio
        print("Starting TSS AI测试平台 Web Server...")
        print("Access: http://localhost:5001")
        print("Default login: admin / admin123")
        socketio.run(app, host="0.0.0.0", port=5001, debug=True, allow_unsafe_werkzeug=True)
    
    else:
        # 其他命令需要导入完整模块
        try:
            from agents.skills_integration import skills_integration
            from agents.flows.test_flow import test_flow
            from knowledge.vector_store import knowledge_store
        except ImportError as e:
            print(f"Error: Missing dependency - {e}")
            print("Please install required packages: pip install chromadb sentence-transformers crewai")
            return
        
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


if __name__ == "__main__":
    main()
