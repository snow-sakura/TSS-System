"""Authentication API tests - AI Generated"""

import pytest


class TestAuthentication:
    """Authentication API test suite"""
    
    def test_login_success(self, api_client, setup_test_data):
        """Test successful login with valid credentials"""
        response = api_client.post("/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response["status_code"] == 200
    
    def test_login_invalid_password(self, api_client, setup_test_data):
        """Test login with invalid password"""
        response = api_client.post("/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })
        assert response["status_code"] in [400, 401]
    
    def test_login_nonexistent_user(self, api_client, setup_test_data):
        """Test login with nonexistent user"""
        response = api_client.post("/login", json={
            "username": "nonexistent",
            "password": "password"
        })
        assert response["status_code"] in [400, 401]
    
    def test_login_empty_credentials(self, api_client, setup_test_data):
        """Test login with empty credentials"""
        response = api_client.post("/login", json={
            "username": "",
            "password": ""
        })
        assert response["status_code"] in [400, 401]
    
    def test_register_success(self, api_client):
        """Test successful user registration"""
        import time
        unique_username = f"testuser_{int(time.time())}"
        
        response = api_client.post("/register", json={
            "username": unique_username,
            "password": "test123",
            "email": f"{unique_username}@test.com"
        })
        assert response["status_code"] in [200, 201]
    
    def test_register_duplicate_user(self, api_client, setup_test_data):
        """Test registration with duplicate username"""
        response = api_client.post("/register", json={
            "username": "admin",
            "password": "test123",
            "email": "admin@test.com"
        })
        assert response["status_code"] in [400, 409]
