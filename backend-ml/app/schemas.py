from pydantic import BaseModel, Field


class StudentFeatures(BaseModel):
    sexo: str = Field(pattern="^(Hombre|Mujer)$")
    ise: float = Field(ge=0.0, le=5.0, description="Indice socioeconómico (0-5)")
    Distrito: str = Field(min_length=2, max_length=60, description="Distrito de Lima Metropolitana")
    M500_L: float = Field(ge=200.0, le=800.0, description="Puntaje Lectura escala 500")
    M500_CN: float = Field(ge=200.0, le=800.0, description="Puntaje Ciencia y Tecnología escala 500")


class PredictionRequest(BaseModel):
    estudiantes: list[StudentFeatures]


class PredictionResult(BaseModel):
    indice: int
    id_estudiante: str | None = None
    id_ie: str | None = None
    sexo: str | None = None
    ise: float | None = None
    distrito: str | None = None
    M500_L: float | None = None
    M500_CN: float | None = None
    M500_L_iemean: float | None = None
    M500_CN_iemean: float | None = None
    ise_iemean: float | None = None
    M500_M: float | None = None
    grupo_m_real: str | None = None
    prediccion_riesgo: int
    probabilidad_riesgo: float
    nivel_riesgo: str


class PredictionResponse(BaseModel):
    total: int
    resultados: list[PredictionResult]


class MetricResponse(BaseModel):
    accuracy: float | None = None
    precision: float | None = None
    recall: float | None = None
    f1_score: float | None = None
    auc_roc: float | None = None
    brier_score: float | None = None
    # Bootstrap IC 95%
    auc_ci_95: list[float] | None = None
    f1_ci_95: list[float] | None = None
    brier_ci_95: list[float] | None = None
    # PR-AUC
    pr_auc: float | None = None
    pr_baseline: float | None = None
    modelo_ganador: str | None = None
    trained_at: str | None = None
    train_rows: int | None = None
    test_rows: int | None = None
    scope: str | None = None


class FeatureImportance(BaseModel):
    feature: str
    importancia: float


class RetrainResponse(BaseModel):
    status: str
    detail: str


class CsvError(BaseModel):
    fila: int
    campo: str
    error: str


class CsvValidationResponse(BaseModel):
    total_filas: int
    filas_validas: int
    errores: list[CsvError]
    columnas_detectadas: list[str]
    columnas_faltantes: list[str]


class ShapContribution(BaseModel):
    feature: str
    value: float | str | None = None
    baseline: float | str | None = None
    contribution: float           # positivo = incrementa riesgo, negativo = protege
    abs_contribution: float


class ShapResponse(BaseModel):
    id_estudiante: str
    probabilidad_riesgo: float
    nivel_riesgo: str
    base_probabilidad: float
    contributions: list[ShapContribution]
