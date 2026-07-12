"""Skills Integration - Connects Skills with Agents"""

import sys
from pathlib import Path
from typing import Any, Dict, Optional

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from agents.flows.test_flow import test_flow
from agents.crews.test_generation_crew import test_generation_crew
from agents.crews.test_execution_crew import test_execution_crew
from agents.crews.analysis_crew import analysis_crew
from knowledge.vector_store import knowledge_store
from core.config import settings


class SkillsIntegration:
    """Integration layer between Skills and Agents"""
    
    def __init__(self):
        self.test_flow = test_flow
        self.generation_crew = test_generation_crew
        self.execution_crew = test_execution_crew
        self.analysis_crew = analysis_crew
    
    # ===== Test Generation Skill =====
    
    def test_generation(self, module: Optional[str] = None) -> Dict[str, Any]:
        """Execute test-generation skill"""
        print("Executing /test-generation skill...")
        
        system_info = self._get_system_info_for_module(module)
        
        result = self.generation_crew.execute(system_info)
        
        # Save generated tests
        self._save_generated_tests(result)
        
        return result
    
    # ===== Test Execution Skill =====
    
    def test_execution(self, test_type: Optional[str] = None) -> Dict[str, Any]:
        """Execute test-execution skill"""
        print("Executing /test-execution skill...")
        
        # Check if server is running
        from agents.tools.api_client import api_client_tool
        if not api_client_tool.check_health():
            return {
                "error": "TSS server is not running",
                "message": "Please start the server first: python tts-paper-system/main.py"
            }
        
        # Execute tests
        result = self.execution_crew.execute()
        
        return result
    
    # ===== Test Analysis Skill =====
    
    def test_analysis(self, period: Optional[str] = None) -> Dict[str, Any]:
        """Execute test-analysis skill"""
        print("Executing /test-analysis skill...")
        
        # Get test results from knowledge base
        stats = knowledge_store.get_stats()
        
        # Create mock test results for analysis
        test_results = {
            "total": stats.get("test_results", 0),
            "passed": int(stats.get("test_results", 0) * 0.9),  # Assume 90% pass rate
            "failed": int(stats.get("test_results", 0) * 0.1),
            "errors": 0,
            "pass_rate": "90.0%"
        }
        
        result = self.analysis_crew.execute(test_results)
        
        return result
    
    # ===== Knowledge Update Skill =====
    
    def knowledge_update(self, update_type: Optional[str] = None) -> Dict[str, Any]:
        """Execute knowledge-update skill"""
        print("Executing /knowledge-update skill...")
        
        stats = knowledge_store.get_stats()
        
        result = {
            "action": "knowledge_update",
            "before": stats,
            "status": "completed"
        }
        
        # Run initialization script if needed
        if update_type == "all" or update_type is None:
            from scripts.init_knowledge import main as init_main
            init_main()
        
        # Get updated stats
        stats_after = knowledge_store.get_stats()
        result["after"] = stats_after
        result["changes"] = {
            "patterns_added": stats_after.get("test_patterns", 0) - stats.get("test_patterns", 0),
            "bugs_added": stats_after.get("bug_knowledge", 0) - stats.get("bug_knowledge", 0)
        }
        
        return result
    
    # ===== Full Test Cycle Skill =====
    
    def full_test_cycle(self) -> Dict[str, Any]:
        """Execute full-test-cycle skill"""
        print("Executing /full-test-cycle skill...")
        
        result = self.test_flow.run_full_cycle()
        
        return result
    
    # ===== Helper Methods =====
    
    def _get_system_info_for_module(self, module: Optional[str] = None) -> Dict[str, Any]:
        """Get system info for a specific module"""
        base_info = {
            "name": "TSS - Ticket Sales System",
            "type": "web_application",
            "base_url": settings.tss.base_url,
            "api_base": settings.tss.api_base
        }
        
        if module:
            module_map = {
                "auth": {
                    "modules": ["authentication"],
                    "endpoints": ["/api/login", "/api/register"]
                },
                "destinations": {
                    "modules": ["destinations"],
                    "endpoints": ["/api/destinations"]
                },
                "users": {
                    "modules": ["users"],
                    "endpoints": ["/api/users"]
                },
                "tickets": {
                    "modules": ["tickets"],
                    "endpoints": ["/api/tickets"]
                },
                "dashboard": {
                    "modules": ["dashboard"],
                    "endpoints": ["/api/dashboard"]
                }
            }
            
            if module in module_map:
                base_info.update(module_map[module])
            else:
                base_info["modules"] = [module]
                base_info["endpoints"] = []
        else:
            base_info["modules"] = [
                "authentication",
                "destinations",
                "users",
                "tickets",
                "dashboard"
            ]
            base_info["endpoints"] = [
                "/api/login",
                "/api/register",
                "/api/destinations",
                "/api/users",
                "/api/tickets",
                "/api/dashboard"
            ]
        
        return base_info
    
    def _save_generated_tests(self, generation_result: Dict[str, Any]) -> None:
        """Save generated tests to files"""
        generated_tests = generation_result.get("generated_tests", [])
        
        for i, test in enumerate(generated_tests):
            scenario = test.get("scenario", {})
            code = test.get("code", "")
            
            # Create filename
            test_name = scenario.get("name", f"test_{i}").lower().replace(" ", "_")
            filename = f"test_{test_name}.py"
            
            # Save to tests/generated/
            filepath = settings.tests_dir / "generated" / filename
            filepath.parent.mkdir(parents=True, exist_ok=True)
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(code)
            
            print(f"  Saved: {filename}")


# Skills integration instance
skills_integration = SkillsIntegration()
