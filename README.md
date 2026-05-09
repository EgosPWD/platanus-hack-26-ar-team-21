# Vera — Platanus Hack 26 · team-21

<img src="./project-logo.png" alt="Project Logo" width="160" />

**Track:** 🗼 Vertical AI

> Vera es tu equipo de marketing, mientras dormís. Lee las ventas reales de la tienda, detecta el producto ganador, genera nuevas creatividades y propone campañas — siempre con aprobación humana.

## Equipo

- Juan José Cordeiro Íñiguez ([@maycrodev](https://github.com/maycrodev))
- Luis Adolfo Sardina Zeballos ([@EgosPWD](https://github.com/EgosPWD))
- Alvaro Fabián Baldiviezo Rodríguez ([@AlvaroThg](https://github.com/AlvaroThg))

## Levantar el proyecto en menos de 5 minutos

Necesitás: **Python 3.11+**, **uv** (o pip + venv), **Node 20+** y **pnpm**, y un proyecto de **Supabase** con un Postgres listo.

### 1) Variables de entorno

```bash
cp backend/.env.example backend/.env
cp front/.env.local.example front/.env.local
# Editar ambos archivos con las credenciales reales de Supabase.
```

Mínimo a completar:

- `backend/.env`: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`.
- `front/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL=http://localhost:8000`.

### 2) Backend (terminal A)

```bash
cd backend
uv venv && source .venv/bin/activate     # en Windows: .\.venv\Scripts\Activate.ps1
uv pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Verificación: `curl http://localhost:8000/health` → `{"status":"ok"}`.

### 3) Frontend (terminal B)

```bash
cd front
pnpm install
pnpm dev
```

Verificación: abrir `http://localhost:3000`.

### 4) Probar el flujo de la Capa 1

1. Ir a `http://localhost:3000` → click en **Empezar**.
2. Crear una cuenta (email + password). Si Supabase tiene confirmación por mail, confirmar y volver a `/login`.
3. Tras el login redirige a `/dashboard` y muestra **"Hola, {business_name}"**.
4. Cerrar sesión desde el sidebar y entrar a `/dashboard` → debe redirigir a `/login`.

## Estructura

Toda la fuente de verdad del proyecto vive en [CLAUDE.md](./CLAUDE.md). Si el código contradice ese archivo, manda el archivo.

```
backend/   — FastAPI + SQLAlchemy + Alembic + LangGraph (próximas capas)
front/     — Next.js 15 (App Router) + Tailwind + shadcn/ui + Supabase
```

## Estado

- ✅ Capa 1: cimientos (auth, dashboard vacío, /health, /me).
- ⏳ Capa 2: productos y ventas mock.
- ⏳ Capa 3: agente Vera con LangGraph.
- ⏳ Capa 4: publicador (Mock Meta Ads / WhatsApp Broadcast).
