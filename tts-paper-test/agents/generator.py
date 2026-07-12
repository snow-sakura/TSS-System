"""Test Code Generator Agent"""

from typing import Any, Dict, List, Optional

from core.config import settings
from knowledge.vector_store import knowledge_store
from prompts.test_generation import TEST_GENERATION_PROMPT


class TestGeneratorAgent:
    """Agent responsible for generating test code"""
    
    def __init__(self):
        self.name = "Test Code Generator"
        self.role = "Test Generator"
        self.goal = "Generate high-quality pytest test code"
        self.backstory = """Python testing expert proficient in pytest, hypothesis, 
        and property-based testing. You generate clean, maintainable, and comprehensive 
        test code."""
    
    def generate_test_code(
        self,
        test_scenario: Dict[str, Any],
        system_info: Dict[str, Any],
        similar_patterns: List[Dict[str, Any]] = None
    ) -> str:
        """Generate test code for a scenario"""
        # Build context
        context = {
            "scenario": test_scenario,
            "system_info": system_info,
            "patterns": similar_patterns or []
        }
        
        # Generate test based on type
        test_type = test_scenario.get("type", "api")
        
        if test_type == "api":
            return self._generate_api_test(context)
        elif test_type == "business":
            return self._generate_business_test(context)
        elif test_type == "security":
            return self._generate_security_test(context)
        else:
            return self._generate_generic_test(context)
    
    def _generate_api_test(self, context: Dict[str, Any]) -> str:
        """Generate API test code"""
        scenario = context["scenario"]
        endpoint = scenario.get("endpoint", "/api/test")
        method = scenario.get("method", "GET").upper()
        
        test_code = f'''"""Test for {scenario.get('name', 'API endpoint')}"""

import pytest


class Test{scenario.get('name', 'API').replace(' ', '')}:
    """Test suite for {scenario.get('name', 'API endpoint')}"""
    
    def test_{scenario.get('name', 'endpoint').lower().replace(' ', '_')}_success(
        self, api_client, setup_test_data
    ):
        """Test successful {scenario.get('name', 'API call')}"""
        response = api_client.{method.lower()}("{endpoint}")
        assert response["status_code"] == 200
    
    def test_{scenario.get('name', 'endpoint').lower().replace(' ', '_')}_unauthorized(
        self, api_client
    ):
        """Test unauthorized access"""
        response = api_client.{method.lower()}("{endpoint}")
        assert response["status_code"] in [401, 403]
'''
        return test_code
    
    def _generate_business_test(self, context: Dict[str, Any]) -> str:
        """Generate business logic test code"""
        scenario = context["scenario"]
        
        test_code = f'''"""Test for {scenario.get('name', 'Business logic')}"""

import pytest


class Test{scenario.get('name', 'Business').replace(' ', '')}:
    """Test suite for {scenario.get('name', 'Business logic')}"""
    
    def test_{scenario.get('name', 'business').lower().replace(' ', '_')}_happy_path(
        self, api_client, setup_test_data
    ):
        """Test happy path for {scenario.get('name', 'business logic')}"""
        # TODO: Implement happy path test
        pass
    
    def test_{scenario.get('name', 'business').lower().replace(' ', '_')}_edge_cases(
        self, api_client, setup_test_data
    ):
        """Test edge cases for {scenario.get('name', 'business logic')}"""
        # TODO: Implement edge case tests
        pass
    
    def test_{scenario.get('name', 'business').lower().replace(' ', '_')}_error_handling(
        self, api_client, setup_test_data
    ):
        """Test error handling for {scenario.get('name', 'business logic')}"""
        # TODO: Implement error handling tests
        pass
'''
        return test_code
    
    def _generate_security_test(self, context: Dict[str, Any]) -> str:
        """Generate security test code"""
        scenario = context["scenario"]
        
        test_code = f'''"""Security test for {scenario.get('name', 'Security')}"""

import pytest


class Test{scenario.get('name', 'Security').replace(' ', '')}:
    """Security test suite for {scenario.get('name', 'Security')}"""
    
    def test_{scenario.get('name', 'security').lower().replace(' ', '_')}_authentication(
        self, api_client, setup_test_data
    ):
        """Test authentication mechanisms"""
        # Test valid credentials
        response = api_client.post("/api/login", json={{
            "username": "admin",
            "password": "admin123"
        }})
        assert response["status_code"] == 200
    
    def test_{scenario.get('name', 'security').lower().replace(' ', '_')}_authorization(
        self, api_client, setup_test_data
    ):
        """Test authorization mechanisms"""
        # Test unauthorized access
        response = api_client.get("/api/users")
        assert response["status_code"] in [401, 403]
    
    def test_{scenario.get('name', 'security').lower().replace(' ', '_')}_input_validation(
        self, api_client, setup_test_data
    ):
        """Test input validation"""
        # Test SQL injection
        response = api_client.post("/api/login", json={{
            "username": "' OR '1'='1",
            "password": "test"
        }})
        assert response["status_code"] in [400, 401]
'''
        return test_code
    
    def _generate_generic_test(self, context: Dict[str, Any]) -> str:
        """Generate generic test code"""
        scenario = context["scenario"]
        
        test_code = f'''"""Test for {scenario.get('name', 'Feature')}"""

import pytest


class Test{scenario.get('name', 'Feature').replace(' ', '')}:
    """Test suite for {scenario.get('name', 'Feature')}"""
    
    def test_{scenario.get('name', 'feature').lower().replace(' ', '_')}_basic(
        self, api_client, setup_test_data
    ):
        """Basic test for {scenario.get('name', 'feature')}"""
        # TODO: Implement basic test
        pass
'''
        return test_code
    
    def generate_test_file(
        self,
        test_name: str,
        scenarios: List[Dict[str, Any]],
        system_info: Dict[str, Any]
    ) -> str:
        """Generate a complete test file"""
        imports = '''"""AI-generated test file"""

import pytest
'''
        
        # Generate test classes for each scenario
        test_classes = []
        for scenario in scenarios:
            test_code = self.generate_test_code(scenario, system_info)
            test_classes.append(test_code)
        
        # Combine all parts
        full_test = imports + "\n\n" + "\n\n".join(test_classes)
        
        return full_test
    
    def enhance_with_hypothesis(self, test_code: str) -> str:
        """Enhance test code with Hypothesis property-based testing"""
        hypothesis_import = "from hypothesis import given, strategies as st\n"
        
        if "from hypothesis" not in test_code:
            # Add import after other imports
            test_code = test_code.replace(
                "import pytest",
                "import pytest\n" + hypothesis_import
            )
        
        return test_code


# Agent instance
generator_agent = TestGeneratorAgent()
