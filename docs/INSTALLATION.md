# AGENTSHIELD — Installation & Operations

## Prerequisites
- Node 20+ and npm (frontend) · Python 3.11+ (backend) · modern browser.

## Frontend
```bash
npm install
npm run dev       # dev server
npm run build     # type-check + production bundle
npm run preview   # serve dist/ locally
```

## Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # optional
pip install fastapi 'uvicorn[standard]' sqlalchemy pydantic passlib python-jose \
            python-multipart httpx pytest reportlab
uvicorn app.main:app --port 8000   # auto-creates + seeds SQLite at backend/data/agentshield.db
```
Then open the frontend with `VITE_API_TARGET=http://localhost:8000` (or point the SPA at the
backend WS endpoint `/ws/events`) to exercise the full-stack mode.

### Backend smoke
```bash
python -m pytest tests/ -q
curl localhost:8000/api/health
```

## Reset / reseed
- UI: Settings → Demo Lifecycle → Factory-reset demo data.
- Backend: `rm backend/data/agentshield.db` and restart (startup reseeds).

## Optional Ollama (local LLM variations)
```bash
ollama pull qwen3:4b
export AGENTSHIELD_OLLAMA_URL=http://localhost:11434
uvicorn app.main:app --port 8000
```
Health endpoint reports `ai_mode: ollama+fallback` vs `deterministic-fallback`. The app is
fully functional without Ollama; nothing is ever sent to a paid API.

## Ports
- 5173 frontend dev · 8000 backend · 11434 Ollama (optional)

## Troubleshooting
- 401s after switching demo users → Settings → logout, sign in again (8h session expiry).
- ChatGPT? No. Telemetry? None. Everything stays on localhost or in your browser.
