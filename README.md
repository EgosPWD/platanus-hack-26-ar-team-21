# Verenice — Platanus Hack 26 · team-21

<img src="./project-logo.png" alt="Verenice logo" width="200" />

**Track:** 🗼 Vertical AI · **Producción:** [verenice.online](https://verenice.online)

> El equipo de marketing autónomo que cualquier microemprendedor latinoamericano puede pagar.

Verenice es un agente de IA que reemplaza al equipo de marketing que los microemprendedores no pueden pagar. Lee las ventas reales de la tienda en vivo, detecta qué producto está creciendo, genera cinco creatividades editando las fotos del catálogo real, escribe el copy en español argentino, arma la campaña en Meta Ads, y le pide aprobación al dueño del negocio por WhatsApp antes de publicar nada. Verenice nunca actúa sin aprobación humana.

**Dos mil dólares de equipo, contra treinta de suscripción. Mismo resultado, una fracción del costo.**

## Equipo

- Juan José Cordeiro Íñiguez ([@maycrodev](https://github.com/maycrodev))
- Luis Adolfo Sardina Zeballos ([@EgosPWD](https://github.com/EgosPWD))
- Alvaro Fabián Baldiviezo Rodríguez ([@AlvaroThg](https://github.com/AlvaroThg))

## Cómo funciona el loop
Verenice lee ventas reales de Shopify
↓
Detecta producto ganador con reasoning visible (LangGraph + Claude)
↓
Genera 5 creatividades image-to-image (preserva el producto real)
↓
Notifica al merchant por WhatsApp con link al dashboard
↓
Merchant aprueba / rechaza / modifica desde el dashboard
↓
Si aprueba → Verenice crea campaña real en Meta Ads (siempre PAUSED)
↓
WhatsApp de confirmación con link directo al Ads Manager


El último click — el de activar la campaña — lo da siempre el merchant.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Zustand, TanStack Query |
| Backend | FastAPI, Python 3.12, SQLAlchemy async, Alembic, Pydantic v2 |
| Agente | LangGraph + LangChain con Claude Sonnet 4.6 |
| Generación de imágenes | Gemini Image (image-to-image) vía OpenRouter |
| WhatsApp | Evolution API self-hosted |
| Publicidad | Meta Marketing API (facebook-business SDK) |
| Datos | Shopify Admin API |
| Auth + DB + Storage | Supabase (Postgres + Auth + Storage) |
| Deploy | Dokploy en VPS, dominio en verenice.online |

## Levantar el proyecto en local

Necesitás: **Python 3.12+**, **uv** (o pip + venv), **Node 20+**, **pnpm**, y proyecto de **Supabase** con Postgres.

### 1) Variables de entorno

```bashcp backend/.env.example backend/.env
cp front/.env.local.example front/.env.local

Editá `backend/.env` con como mínimo:

```bashSupabase
DATABASE_URL=postgresql+asyncpg://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...
SUPABASE_JWT_SECRET=...
SUPABASE_STORAGE_BUCKET=vera-creativesAnthropic (agente)
ANTHROPIC_API_KEY=sk-ant-...
AGENT_MODEL=claude-sonnet-4-6
AGENT_COOLDOWN_DAYS=0OpenRouter (generación de imágenes)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_IMAGE_MODEL=google/gemini-3.1-flash-image-preview
USE_OPENROUTER_MOCK=falseShopify
SHOPIFY_SHOP_DOMAIN=tu-tienda.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_...
USE_SHOPIFY_MOCK=falseMeta Ads
META_APP_ID=...
META_APP_SECRET=...
META_ACCESS_TOKEN=...           # System User Token, no expira
META_AD_ACCOUNT_ID=act_...      # cuenta en sandbox para hackathon
META_API_VERSION=v21.0
USE_META_MOCK=falseEvolution API (WhatsApp)
EVOLUTION_API_URL=https://tu-evolution.tld
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE_NAME=Vera
EVOLUTION_FROM_NUMBER=...
USE_WHATSAPP_MOCK=falseFrontend URL (para los links de WhatsApp)
FRONTEND_BASE_URL=http://localhost:3000
CORS_ORIGINS=["http://localhost:3000","https://verenice.online"]

Y `front/.env.local`:

```bashNEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:8000

### 2) Backend (terminal A)

```bashcd backend
uv venv && source .venv/bin/activate     # Windows: ..venv\Scripts\Activate.ps1
uv pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000

Verificación: `curl http://localhost:8000/health` → `{"status":"ok"}`.

### 3) Frontend (terminal B)

```bashcd front
pnpm install
pnpm dev

Verificación: abrir [http://localhost:3000](http://localhost:3000).

### 4) Toggles de mock

Cada integración tiene cliente real + mock con la misma interfaz, controlado por env. Para desarrollo offline:

```bashUSE_SHOPIFY_MOCK=true
USE_META_MOCK=true
USE_OPENROUTER_MOCK=true
USE_WHATSAPP_MOCK=true

Con todos los mocks activos el flujo end-to-end funciona sin pegarle a un solo servicio externo.

## Probar el flujo completo

1. Login en `verenice.online` (o local).
2. Conectar Shopify desde `/settings` (o usar credenciales del seed).
3. Ir a `/dashboard` → click en **"Pedirle a Vera que mire ahora"**.
4. Esperar el reasoning del agente — aparece en `/proposals/[id]` con streaming visible paso a paso.
5. Esperar la generación de las 5 creatividades (~60-90 segundos con Gemini real).
6. WhatsApp llega al merchant.
7. Click en el link del WhatsApp → entra a la propuesta.
8. **Aprobar** → Verenice crea campaña real en Meta Ads en estado pausado.
9. Confirmación por WhatsApp con link al Ads Manager.

Tiempo total end-to-end: ~90-150 segundos.

## Estado del proyecto

| Capa | Estado | Funcionalidad |
|---|---|---|
| 1 — Cimientos | ✅ | Auth, dashboard, middleware, Supabase |
| 2 — Catálogo | ✅ | Sync Shopify + ventas + dashboard con métricas |
| 3 — Agente | ✅ | LangGraph con reasoning visible en voseo argentino |
| 4 — Creatividades | ✅ | Generación image-to-image con Gemini, 5 variantes |
| 5 — Aprobación humana | ✅ | Endpoints approve/reject/modify + WhatsApp via Evolution |
| 6 — Meta Ads | ✅ | Publicación real en estado pausado, sandbox account |
| 7 — Google Ads | ⏳ | Backlog post-hackathon |

## Decisiones de diseño relevantes

**Image-to-image, no text-to-image.** Verenice no genera fotos desde cero. Toma la primera foto del catálogo del producto y la edita preservando exactamente el producto. Esto evita el problema clásico de IA generativa donde el "vestido rojo" generado no es el vestido que el merchant tiene en stock.

**Aprobación humana es safety por código, no por buena voluntad.** Las campañas en Meta Ads se crean con `status="PAUSED"` hardcoded en tres lugares (Campaign, AdSet, Ad). No hay path en el código que cree una campaña activa.

**Approve y publish son independientes.** Si Meta falla durante la creación de campaña, la propuesta sigue aprobada. La publicación queda en `failed` con error_message claro y se puede reintentar.

**Cuenta en sandbox para el demo.** La cuenta de Meta Ads está en modo sandbox: las campañas se crean reales, aparecen en el Ads Manager, pero no salen al feed ni gastan presupuesto. Esto permite demostrar el flujo completo sin riesgo.

**Reasoning visible es el diferencial de UX.** El razonamiento del agente se muestra paso a paso en la UI con efecto typing en tiempo real. Esto convierte la IA de caja negra en compañero de trabajo que explica sus decisiones.

## Estructura del repobackend/
app/
api/              # endpoints FastAPI
core/             # config, security, deps
db/               # modelos SQLAlchemy y session
integrations/     # clientes reales y mocks (Shopify, Meta, OpenRouter, Evolution)
publishers/       # capa abstracta para publicar campañas
schemas/          # Pydantic models
services/         # lógica de negocio (notifier, image_gen, etc.)
agent/            # LangGraph del agente Vera
alembic/            # migraciones
pyproject.tomlfront/
src/
app/              # Next.js App Router
(app)/          # rutas autenticadas
(auth)/         # login, signup
components/
brand/          # Wordmark, logo system
proposals/      # cards, modal, reasoning view
campaigns/      # campaign cards
ui/             # shadcn/ui primitivos
lib/              # api client, supabase, utils
package.jsondocker-compose.yml    # backend + front para Dokploy

## Mas contexto

Toda la fuente de verdad del proyecto vive en [CLAUDE.md](./CLAUDE.md). Si el código contradice ese archivo, manda el archivo.

## Demo

[verenice.online](https://verenice.online) — cuenta de demo disponible bajo pedido al equipo.