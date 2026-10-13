import json
import secrets


from fastapi import APIRouter, HTTPException, Response, HTTPException, status
from sqlalchemy import select
from typing import Annotated
from fastapi import Cookie

from src.config import config
from src.db import DbSessionDep
from src.redis import RedisDep

from src.auth.dtos import LoginRequest, LoginResponse, VerifyResponse
from src.auth.models import AuthUser
from src.auth.utils import verify_password

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/login")
async def login(
    body: LoginRequest, response: Response, db_session: DbSessionDep, redis: RedisDep
) -> LoginResponse:
    # Return a fake session if auth is disabled
    if not config.auth_enabled:
        # Set HTTP only cookie on browser
        response.set_cookie(
            key=config.auth_session_cookie_name,
            value="auth_disabled",
            max_age=config.auth_session_ttl_seconds,
            httponly=True,
            samesite="lax",
            path="/",
        )

        return LoginResponse(
            session_id="auth_disabled",
            email="auth_disabled@htx.gov.sg",
            username="auth_disabled",
        )

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


@auth_router.post("/verify")
async def verify(redis: RedisDep, approx_sid: Annotated[str | None, Cookie()] = None):
    # Always returns true if auth is disabled
    if not config.auth_enabled:
        return VerifyResponse(
            email="auth_disabled@htx.gov.sg", username="auth_disabled"
        )

    if not approx_sid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, missing or expired session",
        )

    # Otherwise we check the cache for the session details
    key = f"auth:{approx_sid}"
    session = redis.get(key)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, missing or expired session",
        )

    session = VerifyResponse.model_validate_json(session)
    return session


@auth_router.post("/logout")
async def logout(
    response: Response,
    redis: RedisDep,
    approx_sid: Annotated[str | None, Cookie()] = None,
):
    # Always delete if auth is disabled
    if not config.auth_enabled:
        response.delete_cookie(
            key=config.auth_session_cookie_name,
            httponly=True,
            samesite="lax",
            path="/",
        )
        return

    if not approx_sid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, missing or expired session",
        )

    # Otherwise log the user out
    key = f"auth:{approx_sid}"
    redis.delete(key)
    response.delete_cookie(
        key=config.auth_session_cookie_name,
        httponly=True,
        samesite="lax",
        path="/",
    )
