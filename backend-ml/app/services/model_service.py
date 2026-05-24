"""
Orquestador principal — compone ModelLoader + PredictionService + DiagnosticoService + ShapService.
Expone el singleton `model_service` que usan los routers.
"""
from app.services.model_loader      import ModelLoader
from app.services.prediction_service import PredictionService
from app.services.diagnostico_service import DiagnosticoService
from app.services.shap_service       import ShapService


class ModelService(ModelLoader):
    """
    Hereda de ModelLoader (state del modelo) y delega en los servicios especializados.
    Se mantiene como única clase para compatibilidad con los routers existentes.
    """
    def __init__(self) -> None:
        super().__init__()
        self._pred  = PredictionService(self)
        self._diag  = DiagnosticoService(self)
        self._shap  = ShapService(self, self._pred)

    # ── Predicciones ──────────────────────────────────────────────────────────
    def predict(self, request):             return self._pred.predict(request)
    def query_dataset(self, **kw):          return self._pred.query_dataset(**kw)
    def get_dataset_summary(self, **kw):    return self._pred.get_dataset_summary(**kw)
    def get_colegios(self):                 return self._pred.get_colegios()
    def get_distritos(self):                return self._pred.get_distritos()

    # ── Diagnóstico ───────────────────────────────────────────────────────────
    def get_metrics(self):                  return self._diag.get_metrics()
    def get_importance(self):               return self._diag.get_importance()
    def get_evaluation(self):               return self._diag.get_evaluation()
    def get_diagnostico(self):              return self._diag.get_diagnostico()

    # ── SHAP ──────────────────────────────────────────────────────────────────
    def get_student_shap(self, id_est):     return self._shap.get_student_shap(id_est)

    # ── Reentrenamiento (override para invalidar cache) ───────────────────────
    def retrain(self) -> str:
        self._pred.invalidate_cache()
        return super().retrain()


model_service = ModelService()
