import uuid

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select

from src.database import DbSessionDep
from src.models import User
from src.security import verify_password
from src.sessions import create_session

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr


class LoginResponse(BaseModel):
    session_id: str
    user: UserOut


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db_session: DbSessionDep,
) -> LoginResponse:
    result = await db_session.execute(
        select(User).where(User.email == body.email.lower())
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_id = await create_session(user.id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_id,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return LoginResponse(session_id=session_id, user=UserOut.model_validate(user))
