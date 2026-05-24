FROM python:3.12-slim

WORKDIR /app

COPY backend-ml/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend-ml/app ./app
COPY legacy-streamlit ./legacy-streamlit

ENV MODEL_PATH=./legacy-streamlit/model/modelo_rf.pkl
ENV ENCODER_PATH=./legacy-streamlit/model/label_encoder.pkl
ENV METRICS_PATH=./legacy-streamlit/model/metricas_modelo.pkl
ENV DATASET_PATH=./legacy-streamlit/data/dataset_estudiantes.csv

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

