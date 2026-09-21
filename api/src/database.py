from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from src.config import config

engine = create_async_engine(config.database_url)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class DbBase(DeclarativeBase):
    pass


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as async_session:
        yield async_session


# Session dependency
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
