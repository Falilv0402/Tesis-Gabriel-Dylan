"""
config.py — Centralised constants for the EM-2022 training pipeline.
Imported by every other pipeline module.
"""
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
SEED       = 42
DATASET    = Path("data/em_2022_lima_privado.csv")
MODEL_DIR  = Path("model")
MODEL_PATH = MODEL_DIR / "modelo_em.pkl"
PREP_PATH  = MODEL_DIR / "preprocessor_em.pkl"
METR_PATH  = MODEL_DIR / "metricas_em.pkl"

# ─── Feature sets ─────────────────────────────────────────────────────────────
TARGET    = "riesgo_matematica"
GROUP_COL = "ID_IE"

FEATURES_CAT     = ["sexo", "Distrito"]
FEATURES_NUM     = ["ise", "M500_L", "M500_CN"]
FEATURES_IE      = ["M500_L_iemean", "M500_CN_iemean", "ise_iemean", "tamanio_ie"]
FEATURES_DERIVED = ["M500_L_relativa", "M500_CN_relativa", "ise_relativo"]
ALL_FEATURES     = FEATURES_CAT + FEATURES_NUM + FEATURES_IE + FEATURES_DERIVED

# ─── Monotonic constraints ────────────────────────────────────────────────────
# Column order after ColumnTransformer matches ALL_FEATURES order.
# -1 = feature up → risk down  |  0 = unconstrained  |  +1 = feature up → risk up
#  idx  feature              constraint
#  0    sexo                  0
#  1    Distrito              0
#  2    ise                  -1
#  3    M500_L               -1
#  4    M500_CN              -1
#  5    M500_L_iemean        -1
#  6    M500_CN_iemean       -1
#  7    ise_iemean           -1
#  8    tamanio_ie            0
#  9    M500_L_relativa       0
# 10    M500_CN_relativa      0
# 11    ise_relativo          0
MONOTONIC_CONSTRAINTS = [0, 0, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0]
