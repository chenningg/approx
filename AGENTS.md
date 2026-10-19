# AGENTS.md

Two independent subprojects managed via Makefiles at the root and per-subproject. Docker orchestration is optional (each compose runs standalone; the root one `include`s both).

## Commands

| Task | Command |
| --- | --- |
| Everything in Docker (hot reload) | `make dev` (root, foreground) / `make up` (detached) |
| API locally, hot reload | `make -C api dev` (= `uv run fastapi dev`) |
| Frontend locally, HMR | `make -C frontend dev` (= `npm run dev`) |
| Per-sub Docker | `make -C <sub> up` / `down` / `logs` |
| Install deps | `make install` (root) or `make -C <sub> install` |

`make help` lists targets. Docker compose already running? `make dev`/`up` targets need the Docker daemon started (`open -a Docker` on macOS).

## api/ — Python 3.14 + FastAPI with uv
- Managed by uv (`api/uv.lock`, `api/.python-version` picks 3.14). Use `uv ...` from `api/`, never `pip`.
- FastAPI app is `app` in `src/main.py`. `[tool.uv] package = false` (flat layout — the `src` dir is a package named `src`, no `api` package); the entrypoint is set via `[tool.fastapi] entrypoint = "src.main:app"`. Run with `fastapi dev` (hot reload) or `fastapi run`; don't invoke uvicorn directly (`main:app`/`api:app` won't import).
- No tests or linter (ruff not configured) — don't invent `pytest`/`ruff` targets.
- `laya-client` (the HTTP client SDK from `laya/sdk/python`, not the `laya` engine package) is a path dependency: `uv add ../laya/sdk/python` style, resolved via `[tool.uv.sources]`. The api image therefore builds with the **repo root** as context (`api/compose.yaml`: `context: ..`, `dockerfile: api/Dockerfile`) so `uv sync --frozen` finds `laya/sdk/python`; the root `.dockerignore` keeps that context small. Runtime base URL: `config.laya_base_url` / `LAYA_BASE_URL` (host default `http://127.0.0.1:8000`, Docker `http://laya-serve:8000`). The SDK client is blocking — call it off the event loop.

## frontend/ — Vite 8 + React 19 + TS with npm
- `npm run build` is `vite build && tsc -b` — the order matters: **do not revert to `tsc -b && vite build`**. Vite's TanStack Router plugin generates `src/routeTree.gen.ts` during dev/build; tsc must run after it. `routeTree.gen.ts` is generated and committed.
- Lint is `npm run lint` = oxlint (`.oxlintrc.json`), not eslint — do not add eslint configs.
- TS (`tsconfig.app.json`) is strict: `verbatimModuleSyntax` (use `import type`) and `erasableSyntaxOnly` (no enums, namespaces, class parameter properties).
- `vite.config.ts`: `@tanstack/router-plugin` must stay before `@vitejs/plugin-react` (order documented in the file). React Compiler (`reactCompilerPreset`) is enabled via babel. Routing is wired in `src/main.tsx` via `routeTree.gen.ts` + `createRouter`; routes live in `src/routes/`.
- Styling is **Tailwind v4 + shadcn/ui**. Tailwind v4 is wired via the `@tailwindcss/vite` plugin (no `tailwind.config.*`, no postcss config); `src/index.css` imports `tailwindcss` + `tw-animate-css` + `shadcn/tailwind.css` and holds the shadcn theme (CSS variables, `@theme inline`, `.dark` custom variant). Dark mode is forced by `class="dark"` on `<html>` in `index.html`. UI components live in `src/components/ui/` (`button`, `card`, `badge`, ...) — add more with `npx shadcn@latest add <name>`. **Gotcha:** the shadcn CLI doesn't resolve this repo's `@/*` alias and writes new components to a literal `./@/components/ui/` dir — move them into `src/components/ui/` afterwards. Utils: `cn` comes from the `cn` package (re-exported in `src/lib/utils.ts`); deps incl. `class-variance-authority`, `radix-ui`, `lucide-react`. Path alias `@/*` → `./src/*` is set in `tsconfig.app.json` (`baseUrl`/`paths`) and `vite.config.ts`. Headline font is Geist Variable (`@fontsource-variable/geist`).
- Docker: `frontend/compose.yaml` mounts `./src` and vite runs with `--host 0.0.0.0`; local `npm run dev` binds localhost. Port 5173.

## Docker layout
- Root `compose.yaml` `include`s `api/compose.yaml`, `frontend/compose.yaml`, `laya/compose.yaml` (one-shot quickstart) and `laya/compose.http.yaml` (the `laya-serve` HTTP server on `127.0.0.1:8000`, `POST /v1/systemone` + `GET /health`; lazy checkpoint download into the shared `approx_model-cache` volume, `LAYA_PRELOAD=1` to preload, optional `LAYA_API_KEY`). Compose v2.20+; project name `approx`, services `approx-api-1`/`approx-frontend-1`/`approx-laya-serve-1`. Each sub-compose also works standalone from its directory.
- Hot reload in containers relies on bind mounts (`./src:/app/api/src` for api, `./src:/app/src` for frontend) plus container-side watchers (uvicorn `--reload` for api, Vite HMR for frontend). No `--watch`/develop block is needed. All `up`/`dev`/`api-up`/`frontend-up` targets run `docker compose ... --build` so dependency changes in `package*.json`/`uv.lock` are picked up.
- Images: api uses `uv sync --frozen --no-dev` (WORKDIR `/app/api`; non-editable `laya-client` is baked from the build context); frontend uses `node:24-alpine`.