# Vera — Backend

API de Vera, el agente de marketing autónomo. Está construida con FastAPI, SQLAlchemy async y Supabase para auth.

## Levantarlo en 3 comandos

```bash
cd backend
cp .env.example .env   # completar con tus credenciales de Supabase
uv venv && source .venv/bin/activate && uv pip install -e .
alembic upgrade head && uvicorn app.main:app --reload --port 8000
```

En Windows con PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
uv venv; .\.venv\Scripts\Activate.ps1; uv pip install -e .
alembic upgrade head; uvicorn app.main:app --reload --port 8000
```

## Verificación rápida

- `GET http://localhost:8000/health` → `{"status": "ok"}`
- `GET http://localhost:8000/me` con un Bearer token de Supabase válido → devuelve (o crea) el merchant del usuario.
- `python -m app.db.seed` → carga el merchant de demo (no pisa nada si ya existe).

## Estructura

Ver `CLAUDE.md` en la raíz del repo para el árbol completo y las reglas de cada capa.
