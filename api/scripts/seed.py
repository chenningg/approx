"""Seed a demo user for local development.

Usage (from api/):
    uv run python -m scripts.seed
    EMAIL=me@example.com PASSWORD=secret uv run python -m scripts.seed
"""

import asyncio
import os

from sqlalchemy import select

from src.database import Base, async_session_factory, engine
from src.models import User
from src.security import hash_password

DEFAULT_EMAIL = "demo@approx.dev"
DEFAULT_PASSWORD = "password123"


async def seed() -> None:
    email = os.environ.get("EMAIL", DEFAULT_EMAIL).lower()
    password = os.environ.get("PASSWORD", DEFAULT_PASSWORD)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is not None:
            user.password_hash = hash_password(password)
            print(f"Updated password for existing user {email}")
        else:
            session.add(User(email=email, password_hash=hash_password(password)))
            print(f"Created user {email}")
        await session.commit()

    await engine.dispose()
    print(f"Seed complete. Log in with: {email} / {password}")


if __name__ == "__main__":
    asyncio.run(seed())