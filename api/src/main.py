from contextlib import asynccontextmanager

from src.auth.routes import auth_router
from src.auth.seed import seed_admin_users
from src.config import config
from src.datasets.routes import datasets_router
from src.db import DbBase, db_engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables
    async with db_engine.begin() as conn:
        # Create all tables
        await conn.run_sync(DbBase.metadata.create_all)

    # Seed admin users
    await seed_admin_users()

    yield

    # Close database connection
    await db_engine.dispose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(datasets_router)


@app.get("/")
async def root():
    return {"message": "Hello World"}
