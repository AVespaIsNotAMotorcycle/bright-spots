from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="BRIGHT_SPOTS_")

    # Front-end origin allowed by CORS (spec: allow the front-end origin only).
    frontend_origin: str = "http://localhost:5173"

    # Per-request timeout for outbound HTTP (spec 6.7: HTTP_TIMEOUT_S).
    http_timeout_s: float = 20


settings = Settings()
