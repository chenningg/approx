from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    session_id: str
    email: EmailStr
    username: str

class VerifyResponse(BaseModel):
    email: EmailStr
    username: str