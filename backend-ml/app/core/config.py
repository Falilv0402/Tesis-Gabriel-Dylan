from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_title: str = "P20261012 Backend ML"
    api_version: str = "0.1.0"
    model_path: Path = Path("../modelo/model/modelo_em.pkl")
    preprocessor_path: Path = Path("../modelo/model/preprocessor_em.pkl")
    metrics_path: Path = Path("../modelo/model/metricas_em.pkl")
    dataset_path: Path = Path("../modelo/data/em_2022_lima_privado.csv")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
