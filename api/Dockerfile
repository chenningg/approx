FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim

# Build context is the repo root (compose sets context: ..), because the
# laya-client dependency is a path dep at laya/sdk/python.
WORKDIR /app/api
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY api/pyproject.toml api/uv.lock api/README.md ./
COPY api/src ./src
# uv.lock resolves laya-client from ../laya/sdk/python relative to the project dir.
COPY laya/sdk/python /app/laya/sdk/python

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

EXPOSE 8000
CMD ["uv", "run", "fastapi", "run", "--host", "0.0.0.0", "--port", "8000"]