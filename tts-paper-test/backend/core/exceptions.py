"""自定义异常"""

from fastapi import HTTPException, status


class TSSException(Exception):
    """基础异常"""
    def __init__(self, message: str = "操作失败"):
        self.message = message
        super().__init__(self.message)


class AuthenticationError(TSSException):
    """认证失败"""
    def __init__(self, message: str = "用户名或密码错误"):
        super().__init__(message)


class NotFoundError(TSSException):
    """资源不存在"""
    def __init__(self, resource: str = "资源"):
        super().__init__(f"{resource}不存在")


class PermissionDeniedError(TSSException):
    """权限不足"""
    def __init__(self, message: str = "权限不足"):
        super().__init__(message)


class AIServiceError(TSSException):
    """AI服务异常"""
    def __init__(self, message: str = "AI服务暂时不可用"):
        super().__init__(message)


def not_found_exception(resource: str = "资源"):
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{resource}不存在",
    )


def unauthorized_exception(message: str = "未授权"):
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )
