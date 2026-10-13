from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status

from src.auth.dtos import VerifyResponse
from src.config import config
from src.redis import RedisDep


async def get_auth_user(
    redis: RedisDep,
    approx_sid: Annotated[str | None, Cookie()] = None,
) -> VerifyResponse:
    """Resolve the current session user, or raise 401.

    When auth is disabled, always returns a synthetic demo user.
    """
    if not config.auth_enabled:
        return VerifyResponse(
            email="auth_disabled@htx.gov.sg", username="auth_disabled"
        )

    if not approx_sid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, missing or expired session",
        )

    session = await redis.get(f"auth:{approx_sid}")
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, missing or expired session",
        )

    return VerifyResponse.model_validate_json(session)


AuthUserDep = Annotated[VerifyResponse, Depends(get_auth_user)]
