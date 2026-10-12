import json
import secrets


from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from src.config import config
from src.db import DbSessionDep
from src.redis import RedisDep

from src.auth.dtos import LoginRequest, LoginResponse
from src.auth.models import AuthUser
from src.auth.utils import verify_password

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/login")
async def login(
    body: LoginRequest, response: Response, db_session: DbSessionDep, redis: RedisDep
) -> LoginResponse:
    result = await db_session.execute(
        select(AuthUser).where(AuthUser.email == body.email.lower().strip())
    )
    auth_user = result.scalar_one_or_none()

    if auth_user is None or not verify_password(body.password, auth_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Else auth user exists, create a session for it
    session_id = secrets.token_urlsafe(32)

    # Store in Redis with expiry configured
    key = f"auth:{session_id}"
    await redis.set(
        key,
        json.dumps({"email": auth_user.email, "username": auth_user.username}),
        ex=config.auth_session_ttl_seconds,
    )

    # Set HTTP only cookie on browser
    response.set_cookie(
        key=config.auth_session_cookie_name,
        value=session_id,
        max_age=config.auth_session_ttl_seconds,
        httponly=True,
        samesite="lax",
        path="/",
    )

    return LoginResponse(
        session_id=session_id, email=auth_user.email, username=auth_user.username
    )
