import json
import secrets
import uuid

from redis.asyncio import Redis

from src.config import settings

redis = Redis.from_url(settings.redis_url, decode_responses=True)


def _key(session_id: str) -> str:
    return f"session:{session_id}"


async def create_session(user_id: uuid.UUID) -> str:
    session_id = secrets.token_urlsafe(32)
    await redis.set(_key(session_id), json.dumps({"user_id": str(user_id)}))
    await redis.expire(_key(session_id), settings.session_ttl_seconds)
    return session_id