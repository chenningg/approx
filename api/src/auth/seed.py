"""Seeds a demo user for local development."""

from loguru import logger
from sqlalchemy import select

from src.db import async_session_factory

from src.auth.models import AuthUser
from src.auth.utils import hash_password


async def seed_admin_users() -> None:
    async with async_session_factory() as session:
        admin_email = "approx_admin@test.com"

        # Seed admin users
        existing = await session.scalar(
            select(AuthUser).where(AuthUser.email == admin_email)
        )

        if existing is not None:
            logger.info("[AUTH] Database seeding: Admin user already exists.")
            return

        auth_user = AuthUser(
            email=admin_email,
            username="approx_admin",
            password_hash=hash_password("approx_admin"),
        )
        session.add(auth_user)
        logger.info("[AUTH] Database seeding: Added default admin user to database.")

        await session.commit()
