"""
TSS AI测试平台 — 认证与安全模块
JWT双Token (access + refresh)
密码加密 bcrypt
验证码生成
"""

import hashlib
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Tuple

import bcrypt
from jose import JWTError, jwt

from backend.app.core.config import settings

# ============================================================
# 密码加密
# ============================================================


def hash_password(password: str) -> str:
    """对密码进行bcrypt加密"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


# ============================================================
# JWT Token
# ============================================================

def create_access_token(data: dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌 (短期)"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """创建刷新令牌 (长期)"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_token_pair(user_id: str, username: str) -> Tuple[str, str]:
    """创建access + refresh token对"""
    subject = str(user_id)
    access_token = create_access_token(
        data={"sub": subject, "username": username}
    )
    refresh_token = create_refresh_token(
        data={"sub": subject, "username": username}
    )
    return access_token, refresh_token


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """解码并验证JWT Token，失败返回None"""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def refresh_access_token(refresh_token: str) -> Optional[Tuple[str, str]]:
    """用refresh token刷新access token"""
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        return None
    user_id = payload.get("sub")
    username = payload.get("username")
    if not user_id or not username:
        return None
    return create_token_pair(user_id, username)


# ============================================================
# 验证码
# ============================================================

class CaptchaGenerator:
    """数学图形验证码生成器"""

    @staticmethod
    def generate_math_captcha() -> dict[str, Any]:
        """生成数学验证码题目和答案"""
        operators = ["+", "-", "×"]
        op = random.choice(operators)

        if op == "+":
            a = random.randint(10, 99)
            b = random.randint(10, 99)
            answer = a + b
        elif op == "-":
            a = random.randint(10, 99)
            b = random.randint(1, a)  # 确保正数
            answer = a - b
        else:  # ×
            a = random.randint(2, 9)
            b = random.randint(2, 9)
            answer = a * b

        question = f"{a} {op} {b} = ?"

        # Token用于验证 (简单哈希)
        token = hashlib.md5(f"{question}:{answer}:{settings.SECRET_KEY}".encode()).hexdigest()[:16]

        return {
            "question": question,
            "token": token,
            "answer": answer  # 仅用于开发调试，生产不返回
        }

    @staticmethod
    def verify_captcha(question: str, answer: int, token: str) -> bool:
        """验证验证码答案"""
        expected_token = hashlib.md5(
            f"{question}:{answer}:{settings.SECRET_KEY}".encode()
        ).hexdigest()[:16]
        return token == expected_token


# ============================================================
# 输入安全
# ============================================================

def sanitize_input(text: str) -> str:
    """XSS过滤：移除危险HTML标签"""
    import re
    dangerous_tags = re.compile(
        r"<(\s*/?\s*)(script|iframe|embed|object|on\w+)[^>]*>",
        re.IGNORECASE
    )
    return dangerous_tags.sub("", text)


def generate_random_string(length: int = 32) -> str:
    """生成随机字符串"""
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))
