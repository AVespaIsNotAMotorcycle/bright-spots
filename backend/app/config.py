from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="BRIGHT_SPOTS_")

    # Front-end origin allowed by CORS (spec: allow the front-end origin only).
    frontend_origin: str = "http://localhost:5173"

    # Per-request timeout for outbound HTTP (spec 6.7: HTTP_TIMEOUT_S).
    http_timeout_s: float = 20

    # Parallel ORNL requests (spec 6.7: ORNL_CONCURRENCY).
    ornl_concurrency: int = 8

    # Contact appended to the Nominatim User-Agent, e.g. an email or URL
    # (Nominatim usage policy asks apps to identify themselves).
    nominatim_contact: str = ""

    # Optional: lets "Explain it to me" rewrite chart explanations with a small model.
    # Without a key, the app uses its built-in data-only sentences.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-5-5"  # cheapest current Claude model

    # SQLite file for the researcher community board (the Campfire).
    community_db: str = "community.db"


settings = Settings()
