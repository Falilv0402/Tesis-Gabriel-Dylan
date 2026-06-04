"""
preprocessing.py — Feature engineering and sklearn pipeline construction.
"""
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sklearn.model_selection import cross_validate

from .config import GROUP_COL, FEATURES_CAT, FEATURES_NUM, FEATURES_IE, FEATURES_DERIVED


# ─── Feature engineering ──────────────────────────────────────────────────────

def add_ie_features(train_df: pd.DataFrame, apply_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute IE-level aggregates from *train_df* only and merge them into *apply_df*.
    Unseen IEs fall back to global training means (no leakage).
    Also appends the three derived relative-performance features.
    """
    agg = (
        train_df.groupby(GROUP_COL)
        .agg(
            M500_L_iemean  = ("M500_L",   "mean"),
            M500_CN_iemean = ("M500_CN",  "mean"),
            ise_iemean     = ("ise",      "mean"),
            tamanio_ie     = (GROUP_COL,  "count"),
        )
        .reset_index()
    )
    global_means = {
        "M500_L_iemean":  train_df["M500_L"].mean(),
        "M500_CN_iemean": train_df["M500_CN"].mean(),
        "ise_iemean":     train_df["ise"].mean(),
        "tamanio_ie":     train_df.groupby(GROUP_COL).size().mean(),
    }
    out = apply_df.merge(agg, on=GROUP_COL, how="left")
    for col, val in global_means.items():
        out[col] = out[col].fillna(val)
    # Relative performance features
    out["M500_L_relativa"]  = out["M500_L"]  - out["M500_L_iemean"]
    out["M500_CN_relativa"] = out["M500_CN"] - out["M500_CN_iemean"]
    out["ise_relativo"]     = out["ise"]     - out["ise_iemean"]
    return out


# ─── Preprocessor & pipeline builders ────────────────────────────────────────

def build_preprocessor() -> ColumnTransformer:
    cat_features = FEATURES_CAT
    num_features = FEATURES_NUM + FEATURES_IE + FEATURES_DERIVED
    return ColumnTransformer(
        transformers=[
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_features),
            ("num", StandardScaler(), num_features),
        ],
        remainder="drop",
    )


def make_pipeline(clf) -> Pipeline:
    return Pipeline([
        ("prep", build_preprocessor()),
        ("clf",  clf),
    ])


def evaluate_cv(pipe, X, y, groups, cv_split) -> dict:
    """GroupKFold cross-validation returning mean/std for AUC and F1."""
    scores = cross_validate(
        pipe, X, y,
        cv=cv_split,
        groups=groups,
        scoring={"auc": "roc_auc", "f1": "f1"},
        n_jobs=-1,
    )
    return {
        "auc_mean": scores["test_auc"].mean(),
        "auc_std":  scores["test_auc"].std(),
        "f1_mean":  scores["test_f1"].mean(),
        "f1_std":   scores["test_f1"].std(),
    }
