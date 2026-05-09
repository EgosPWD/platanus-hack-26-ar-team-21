from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/vera"
    )

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    ANTHROPIC_API_KEY: str = ""
    REPLICATE_API_TOKEN: str = ""

    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""

    # Shopify (Admin API + custom app token)
    SHOPIFY_API_KEY: str = ""
    SHOPIFY_API_SECRET: str = ""
    SHOPIFY_SHOP_DOMAIN: str = ""
    SHOPIFY_ADMIN_TOKEN: str = ""

    # Meta Ads (development mode / sandbox)
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_ACCESS_TOKEN: str = ""
    META_AD_ACCOUNT_ID: str = ""
    META_API_VERSION: str = "v21.0"
    META_DEFAULT_COUNTRY: str = "AR"
    META_DEFAULT_AGE_MIN: int = 18
    META_DEFAULT_AGE_MAX: int = 65
    # Hard switch: si es False NO publicar. Esto NO se cambia sin auditoría.
    # Toda creación de campaign/adset/ad pasa status="PAUSED" sí o sí —
    # esta flag adicional es defensa en profundidad.
    META_CAMPAIGNS_ALWAYS_PAUSED: bool = True

    # OpenRouter (generación de imágenes con FLUX.2)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_IMAGE_MODEL: str = "black-forest-labs/flux.2-klein-4b"

    # Supabase Storage
    SUPABASE_STORAGE_BUCKET: str = "vera-creatives"

    # Generación de creatividades
    CREATIVE_COUNT: int = 5
    CREATIVE_ASPECT_RATIO: str = "1:1"

    # WhatsApp (Evolution API)
    EVOLUTION_API_URL: str = ""
    EVOLUTION_API_KEY: str = ""
    EVOLUTION_INSTANCE_NAME: str = "Vera"
    EVOLUTION_FROM_NUMBER: str = ""

    # URL pública del frontend (para armar links en mensajes de WhatsApp)
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # Toggles de rollback (ver CLAUDE.md §11)
    USE_SHOPIFY_MOCK: bool = False
    USE_META_MOCK: bool = False
    USE_REPLICATE_MOCK: bool = False
    USE_OPENROUTER_MOCK: bool = False
    USE_WHATSAPP_MOCK: bool = False

    # Agente Vera — heurísticas para "valer la pena proponer"
    AGENT_MODEL: str = "claude-sonnet-4-6"
    AGENT_MIN_SALES_FOR_PROPOSAL: int = 3
    AGENT_MIN_RATIO_VS_AVERAGE: float = 2.0
    AGENT_COOLDOWN_DAYS: int = 3
    AGENT_DEFAULT_BUDGET_ARS: int = 10000

    ENV: Literal["development", "staging", "production"] = "development"

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
