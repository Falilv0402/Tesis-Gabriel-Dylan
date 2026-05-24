"""
Inspecciona los artefactos .pkl del modelo P20261012.
Ejecutar desde la carpeta modelo/:
    python ver_pkl.py
"""
import joblib
import json
from pathlib import Path

MODEL_DIR = Path("model")

# ── Métricas ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  METRICAS DEL MODELO")
print("=" * 60)
metricas = joblib.load(MODEL_DIR / "metricas_em.pkl")

campos = [
    "modelo_ganador", "trained_at", "scope",
    "accuracy", "precision", "recall", "f1_score", "auc_roc",
    "train_rows", "test_rows", "train_ies", "test_ies",
]
for k in campos:
    v = metricas.get(k, "—")
    if isinstance(v, float):
        print(f"  {k:<18}: {v:.4f}")
    else:
        print(f"  {k:<18}: {v}")

# ── Importancia de variables (SHAP) ───────────────────────────────────────────
print("\n" + "=" * 60)
print("  IMPORTANCIA DE VARIABLES (SHAP)")
print("=" * 60)
shap_imp = metricas.get("shap_importance", [])
for item in shap_imp:
    bar = "█" * int(item["shap_mean"] * 300)
    print(f"  {item['feature']:<22} {item['shap_mean']:.4f}  {bar}")

# ── Comparativa de modelos (CV) ────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  COMPARATIVA DE MODELOS — GroupKFold(5)")
print(f"  {'Modelo':<22} {'AUC':>8} {'±':>6}  {'F1':>8} {'±':>6}")
print("  " + "-" * 55)
cv = metricas.get("cv_comparativa", {})
for nombre, res in cv.items():
    print(f"  {nombre:<22} {res['auc_mean']:.4f}  ±{res['auc_std']:.4f}  "
          f"{res['f1_mean']:.4f}  ±{res['f1_std']:.4f}")

# ── Modelo cargado ─────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  MODELO CARGADO (objeto)")
print("=" * 60)
modelo = joblib.load(MODEL_DIR / "modelo_em.pkl")
print(f"  Tipo      : {type(modelo).__name__}")
print(f"  Estimador : {type(modelo.estimator).__name__}")

# ── Preprocesador ──────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  PREPROCESADOR")
print("=" * 60)
prep = joblib.load(MODEL_DIR / "preprocessor_em.pkl")
print(f"  Tipo      : {type(prep).__name__}")
for name, transformer, cols in prep.transformers_:
    print(f"  {name:<6} → {type(transformer).__name__:<20} columnas: {cols}")

print("\n")
