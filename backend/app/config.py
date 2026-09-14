"""配置从环境读取，数据库和对象存储密码不写入代码。"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str
    s3_endpoint: str
    s3_access_key: str
    s3_secret_key: str
    s3_bucket: str = "map-army"
    s3_region: str = "us-east-1"
    cookie_secure: bool = False
    max_file_bytes: int = 64 * 1024 * 1024
    max_document_bytes: int = 32 * 1024 * 1024
    converter_timeout: int = 45
    tool_path: Path = Path("backend/tool/exchange.cjs")
    seed_path: Path = Path("backend/tool/catalog.json")
    public_path: Path = Path("public")
    legacy_share_directory: Path = Path("/legacy-shares")


@lru_cache
def settings() -> Settings:
    return Settings()
