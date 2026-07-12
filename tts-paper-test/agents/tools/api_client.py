"""API client tool for testing TSS system"""

from typing import Any, Dict, Optional

import requests

from core.config import settings


class APIClientTool:
    """Tool for making API requests to TSS system"""
    
    def __init__(self):
        self.base_url = settings.tss.api_base
        self.session = requests.Session()
        self._authenticated = False
    
    def authenticate(self, username: str = None, password: str = None) -> bool:
        """Authenticate with the TSS system"""
        username = username or settings.tss.admin_username
        password = password or settings.tss.admin_password
        
        try:
            response = self.session.post(
                f"{self.base_url}/login",
                json={"username": username, "password": password},
                timeout=10
            )
            if response.status_code == 200:
                self._authenticated = True
                return True
            return False
        except requests.RequestException:
            return False
    
    def get(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make GET request"""
        url = f"{self.base_url}{endpoint}"
        response = self.session.get(url, **kwargs)
        return {
            "status_code": response.status_code,
            "json": response.json() if response.headers.get("content-type", "").startswith("application/json") else None,
            "text": response.text
        }
    
    def post(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make POST request"""
        url = f"{self.base_url}{endpoint}"
        response = self.session.post(url, **kwargs)
        return {
            "status_code": response.status_code,
            "json": response.json() if response.headers.get("content-type", "").startswith("application/json") else None,
            "text": response.text
        }
    
    def put(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make PUT request"""
        url = f"{self.base_url}{endpoint}"
        response = self.session.put(url, **kwargs)
        return {
            "status_code": response.status_code,
            "json": response.json() if response.headers.get("content-type", "").startswith("application/json") else None,
            "text": response.text
        }
    
    def delete(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make DELETE request"""
        url = f"{self.base_url}{endpoint}"
        response = self.session.delete(url, **kwargs)
        return {
            "status_code": response.status_code,
            "json": response.json() if response.headers.get("content-type", "").startswith("application/json") else None,
            "text": response.text
        }
    
    def check_health(self) -> bool:
        """Check if TSS system is running"""
        try:
            response = self.session.get(f"{settings.tss.base_url}/login", timeout=5)
            return response.status_code == 200
        except requests.RequestException:
            return False


# Tool instance
api_client_tool = APIClientTool()
