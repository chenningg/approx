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

## frontend/ — Vite 8 + React 19 + TS with npm
- `npm run build` is `vite build && tsc -b` — the order matters: **do not revert to `tsc -b && vite build`**. Vite's TanStack Router plugin generates `src/routeTree.gen.ts` during dev/build; tsc must run after it. `routeTree.gen.ts` is generated and committed.
- Lint is `npm run lint` = oxlint (`.oxlintrc.json`), not eslint — do not add eslint configs.
- TS (`tsconfig.app.json`) is strict: `verbatimModuleSyntax` (use `import type`) and `erasableSyntaxOnly` (no enums, namespaces, class parameter properties).
- `vite.config.ts`: `@tanstack/router-plugin` must stay before `@vitejs/plugin-react` (order documented in the file). React Compiler (`reactCompilerPreset`) is enabled via babel. Routing is wired in `src/main.tsx` via `routeTree.gen.ts` + `createRouter`; routes live in `src/routes/`.
- Components are **Mantine v9** (`@mantine/core`, `@mantine/hooks`); styles come from `@mantine/core/styles.layer.css` imported in `src/index.css`, which uses CSS-first Tailwind v4 with explicit layers (`@layer theme, base, mantine, components, utilities;` + the three `tailwindcss/*.css` pieces). Keep Mantine's layer ahead of Tailwind utilities. `postcss.config.cjs` wires `postcss-preset-mantine` + `postcss-simple-vars`. `<MantineProvider>` wraps the router in `src/main.tsx`; component styles use hashed CSS-module class names (don't search for readable `.mantine-Button-root` — check `.m_<hash>`).
- Docker: `frontend/compose.yaml` mounts `./src` and vite runs with `--host 0.0.0.0`; local `npm run dev` binds localhost. Port 5173.

## Docker layout
- Root `compose.yaml` only `include`s `api/compose.yaml` and `frontend/compose.yaml` (compose v2.20+; project name `approx`, services `approx-api-1`/`approx-frontend-1`). Each sub-compose also works standalone from its directory.
- Hot reload in containers relies on bind mounts (`./src:/app/src`) plus container-side watchers (uvicorn `--reload` for api, Vite HMR for frontend). No `--watch`/develop block is needed.
- Images: api uses `uv sync --frozen --no-dev --editable` (editable so the mounted source is imported); frontend uses `node:24-alpine`.