FROM python:3.12-slim

# Dependencias del sistema necesarias para lightgbm/xgboost
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Python
COPY backend-ml/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY backend-ml/app ./app

# Copiar artefactos del modelo entrenado + scripts de entrenamiento
COPY modelo/model ./modelo/model
COPY modelo/data ./modelo/data
COPY modelo/train_em_model.py ./modelo/train_em_model.py
COPY modelo/pipeline ./modelo/pipeline

# Variables de entorno (rutas dentro del contenedor)
ENV MODEL_PATH=./modelo/model/modelo_em.pkl
ENV METRICS_PATH=./modelo/model/metricas_em.pkl
ENV DATASET_PATH=./modelo/data/em_2022_lima_privado.csv
ENV PYTHONUNBUFFERED=1

# Railway asigna PORT dinámicamente; en local cae a 8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
