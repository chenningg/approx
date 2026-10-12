from typing import Annotated

from src.config import config
from fastapi import Depends
from loguru import logger
from redis.asyncio import Redis

redis = Redis.from_url(config.redis_url, decode_responses=True)


def get_redis():
    if redis:
        return redis
    else:
        logger.error("Redis cache not configured, erroring out.")
        raise RuntimeError("Redis cache not configured.")


# Redis dependency
RedisDep = Annotated[Redis, Depends(get_redis)]
