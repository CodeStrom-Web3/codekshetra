"""Authentication & RBAC: PBKDF2 hashing (stdlib), HS256 JWT, role checks."""
import os, hmac, hashlib, secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

SECRET_KEY = os.environ.get("AGENTSHIELD_SECRET", "agentshield-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("AGENTSHIELD_TOKEN_TTL_MIN", "480"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

PBKDF2_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        scheme, iterations, salt, dk_hex = hashed.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def create_access_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode["iat"] = datetime.utcnow()
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


ROLE_RANK = {"GENERAL_USER": 1, "FINANCE_USER": 2, "SECURITY_ANALYST": 3, "ADMIN": 4}


def get_current_user(db: Session = Depends(get_db), token: Optional[str] = Depends(oauth2_scheme)) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or disabled")
    return user


def require_roles(*roles: str):
    def checker(current: User = Depends(get_current_user)) -> User:
        if current.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                f"Role {current.role} is not permitted for this action. Required: {', '.join(roles)}")
        return current
    return checker


ROLE_PERMISSIONS = {
    "ADMIN": ["*"],
    "SECURITY_ANALYST": ["view_all", "run_simulations", "review_approvals", "generate_reports", "view_audit", "toggle_nonmandatory_policies"],
    "FINANCE_USER": ["view_dashboard", "view_simulations", "review_payment_approvals", "view_reports", "view_analytics"],
    "GENERAL_USER": ["view_dashboard", "view_agents", "view_scenarios", "view_simulations"],
}
