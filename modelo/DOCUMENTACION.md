# Documentación del proyecto
## Sistema de Alerta Temprana — Riesgo Académico
**Proyecto P20261012 · UPC · Taller de Proyectos I · Ingeniería de Sistemas de Información**

> **NOTA:** Este documento describe el prototipo Streamlit (`app.py` + `train_model.py`)
> que usaba un dataset sintético de 300 estudiantes y un modelo Random Forest.
> **El sistema activo es el stack FastAPI + Next.js** documentado en `README.md` (raiz del repo).
> El modelo vigente es Logistic Regression calibrada entrenada sobre datos reales MINEDU
> (EM 2022, 3 629 estudiantes, AUC test = 0.8431). Ver `train_em_model.py` y `modelo/README.md`.

---

## 1. ¿Qué es esta aplicación?

Es un dashboard web construido con **Streamlit** que predice el riesgo de bajo rendimiento académico de estudiantes de colegios privados de Lima Metropolitana. El dashboard carga un modelo de Machine Learning (Random Forest) previamente entrenado, aplica las predicciones sobre el dataset de estudiantes, y presenta los resultados de forma visual e interactiva.

El objetivo es que un usuario (coordinador académico, tutor, psicólogo) pueda:
- Ver cuántos estudiantes están en riesgo ALTO / MEDIO / BAJO.
- Ordenar la lista por urgencia para priorizar la atención.
- Entender **por qué** un estudiante está en riesgo (factores que más influyeron).
- Evaluar la calidad del modelo (accuracy, matriz de confusión, curva ROC).

---

## 2. Arquitectura general

No hay backend tradicional. Todo corre en un único proceso Python:

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│ dataset_estudiantes  │     │   train_model.py     │     │     modelo_rf.pkl    │
│       .csv           │───► │  (entrenamiento)     │────►│  label_encoder.pkl   │
│  (datos de entrada)  │     │                      │     │  metricas_modelo.pkl │
└──────────────────────┘     └──────────────────────┘     └──────────┬───────────┘
                                                                     │
                                                                     ▼
                              ┌──────────────────────────────────────────────────┐
                              │                    app.py                        │
                              │  (Streamlit · carga modelo · sirve dashboard)    │
                              └──────────────────────┬───────────────────────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │  Navegador web      │
                                          │  localhost:8501     │
                                          └─────────────────────┘
```

**Dos fases distintas:**

| Fase | Cuándo se ejecuta | Qué hace |
|---|---|---|
| **Offline (entrenamiento)** | Una sola vez (o cuando quieras reentrenar) | `train_model.py` lee el CSV, entrena el Random Forest, guarda los `.pkl`. |
| **Online (dashboard)** | Cada vez que arrancas la app | `app.py` carga los `.pkl`, calcula predicciones, muestra el dashboard. |

---

## 3. Archivos del proyecto

### 3.1 Archivos de datos

#### `dataset_estudiantes.csv`
Dataset original con 300 estudiantes y 10 columnas:

| Columna | Tipo | Rango | Qué mide |
|---|---|---|---|
| `promedio_notas` | float | 4 – 20 | Promedio general (escala vigesimal peruana) |
| `nota_matematica` | float | 4 – 20 | Nota del curso de matemática |
| `nota_comunicacion` | float | 4 – 20 | Nota del curso de comunicación |
| `porcentaje_asistencia` | float | 40 – 100 | % de clases a las que asistió |
| `nivel_conducta` | int | 1 – 5 | 1 = muy mala, 5 = excelente |
| `nivel_participacion` | int | 1 – 5 | 1 = nula, 5 = muy activa |
| `tendencia_notas` | int | -1, 0, 1 | -1 = empeora, 0 = estable, 1 = mejora |
| `grado` | int | 1 – 5 | Grado escolar |
| `seccion` | str | A, B, C | Sección del estudiante |
| `riesgo_academico` | int | 0, 1 | **Variable objetivo** — 0 = sin riesgo, 1 = en riesgo |

#### `listado_estudiantes_riesgo.csv`
Exportación generada por el notebook original. No se usa en la app (la app genera su propio CSV al hacer click en "Exportar ranking").

### 3.2 Archivos de código

#### `modelo_riesgo_academico.ipynb`
Notebook Jupyter con el análisis exploratorio (EDA), entrenamiento de 3 modelos (Random Forest, Logistic Regression, Decision Tree), evaluación y justificación académica. **No se usa en tiempo de ejecución**, pero es la referencia teórica del proyecto.

#### `train_model.py`
Script de entrenamiento. Hace lo mismo que el notebook, pero de forma automatizada y guarda artefactos reutilizables.

**Flujo interno:**
1. Lee `dataset_estudiantes.csv`.
2. Codifica la columna `seccion` (A, B, C) a números con `LabelEncoder`.
3. Divide los datos: 80% entrenamiento, 20% prueba (estratificado).
4. Aplica **SMOTE** al set de entrenamiento para balancear las clases (el dataset tiene más estudiantes sin riesgo que en riesgo; SMOTE genera ejemplos sintéticos de la clase minoritaria).
5. Entrena el Random Forest con estos hiperparámetros:
   - `n_estimators=200` (200 árboles en el bosque)
   - `max_depth=8` (profundidad máxima por árbol)
   - `min_samples_split=5` (mínimo de muestras para dividir un nodo)
   - `random_state=42` (para reproducibilidad)
6. Evalúa el modelo en el set de prueba.
7. Guarda tres archivos con `joblib.dump`:
   - `modelo_rf.pkl` — el modelo entrenado.
   - `label_encoder.pkl` — el encoder de secciones (para transformar A/B/C en runtime).
   - `metricas_modelo.pkl` — diccionario con accuracy, precision, recall, F1, AUC, matriz de confusión, puntos de la curva ROC, importancia de variables y timestamp.

#### `app.py`
La aplicación Streamlit. Es un único script que define el dashboard completo. Se divide en bloques lógicos:

| Sección del código | Responsabilidad |
|---|---|
| **Constantes** (líneas ~18-70) | Rutas de archivos, lista de features, colores, íconos, diccionarios de etiquetas. |
| **Configuración de página + CSS** (~72-160) | `st.set_page_config()` y CSS personalizado inyectado con `st.markdown(unsafe_allow_html=True)` para estilizar el sidebar oscuro, botones, tabs, etc. |
| **Funciones core** (~163-230) | Lógica de negocio: clasificar nivel según probabilidad, cargar modelo, cargar dataset, generar predicciones, aplicar filtros. Usan `@st.cache_resource` y `@st.cache_data` para no repetir trabajo caro. |
| **`render_sidebar`** (~235-295) | Dibuja la barra lateral: título, filtros de grado/sección/nivel, botón actualizar, mini-resumen. Devuelve un dict con los filtros seleccionados. |
| **`render_header`** (~301-340) | Franja superior con gradiente azul que muestra título y métricas clave del modelo. |
| **`seccion_kpis`** (~345-375) | Cuatro tarjetas blancas con borde superior coloreado: Total, Alto, Medio, Bajo. |
| **`seccion_ranking`** (~380-450) | Tabla ordenada por probabilidad descendente con `st.column_config.ProgressColumn` para visualizar la probabilidad como barra. Botón de exportar CSV. |
| **`seccion_visualizaciones`** (~455-610) | 4 tabs con gráficos Plotly: distribución (pie+bar), importancia de variables, matriz de confusión, curva ROC. |
| **`seccion_detalle_estudiante`** (~620-790) | Selector de estudiante, tarjeta cabecera, gauge de probabilidad, tabla de datos, 3 factores clave, explicación en texto. |
| **`main`** (~820-840) | Orquesta todo: verifica archivos, carga modelo, ejecuta secciones en orden. |

#### `requirements.txt`
Lista de dependencias Python:
- `streamlit` — framework del dashboard
- `pandas`, `numpy` — manipulación de datos
- `scikit-learn` — Random Forest, train/test split, métricas
- `imbalanced-learn` — proporciona SMOTE
- `plotly` — gráficos interactivos
- `joblib` — serialización del modelo
- `matplotlib`, `seaborn` — solo usados por el notebook original

#### `.streamlit/config.toml`
Configuración de Streamlit. Fuerza el tema claro (`base = "light"`) para evitar que, si el sistema operativo del usuario está en dark mode, Streamlit herede colores oscuros que arruinen los textos de los gráficos Plotly.

### 3.3 Archivos generados (no están en git; los crea `train_model.py`)

- `modelo_rf.pkl` (~1-3 MB) — objeto `RandomForestClassifier` serializado.
- `label_encoder.pkl` (~1 KB) — objeto `LabelEncoder` serializado.
- `metricas_modelo.pkl` (~10 KB) — diccionario con todas las métricas precomputadas.

---

## 4. ¿Cómo fluye la información?

### Al arrancar la app

```
1. app.py corre de arriba a abajo
2. Verifica que existan los .pkl  ──► si no, muestra error y detiene
3. cargar_modelo()          ──► lee los 3 .pkl  (cached con st.cache_resource)
4. cargar_dataset()         ──► lee el CSV y añade IDs "EST-0001"  (cached)
5. generar_predicciones()   ──► pasa features al modelo, calcula probabilidad
                                 y nivel (ALTO/MEDIO/BAJO) por estudiante  (cached)
6. render_sidebar()         ──► dibuja filtros, devuelve selección del usuario
7. aplicar_filtros()        ──► filtra el DataFrame según el sidebar
8. Se dibujan las 4 secciones usando el DataFrame filtrado
```

### Al mover un filtro (ej. desmarcar "ALTO")

```
1. Streamlit re-ejecuta app.py desde el inicio
2. cargar_modelo() / cargar_dataset() / generar_predicciones() NO se recalculan
   (el decorador @st.cache_* detecta que los argumentos no cambiaron)
3. Solo aplicar_filtros() y las secciones de UI vuelven a correr
4. El dashboard se actualiza en ~200 ms
```

### Al hacer click en "Actualizar predicciones" (sidebar)

```
1. Se llama a st.cache_data.clear() → limpia los caches
2. st.rerun() → fuerza re-ejecución completa
3. Todo se recalcula desde cero (útil si el CSV cambió)
```

---

## 5. ¿Cómo se calcula el nivel de riesgo?

El modelo Random Forest devuelve, para cada estudiante, una **probabilidad continua** entre 0 y 1 de pertenecer a la clase "en riesgo". Luego se discretiza en 3 niveles para facilitar la interpretación:

| Probabilidad | Nivel | Color | Semántica |
|---|---|---|---|
| ≥ 0.70 | **ALTO** | 🔴 Rojo `#A32D2D` | Requiere intervención inmediata |
| 0.45 – 0.69 | **MEDIO** | 🟡 Naranja `#BA7517` | Monitorear de cerca |
| < 0.45 | **BAJO** | 🟢 Verde `#3B6D11` | Sin alerta |

Estos umbrales están definidos en la función `clasificar_nivel()` dentro de `app.py` — se pueden ajustar si el colegio necesita ser más o menos estricto.

---

## 6. Cómo correr el proyecto

### Prerrequisitos
- Python 3.10 o superior instalado.
- Terminal (PowerShell, CMD, Git Bash).

### Paso 1 — Instalar dependencias
Desde la carpeta del proyecto, ejecuta:

```bash
pip install -r requirements.txt
```

Esto descarga streamlit, pandas, scikit-learn, imbalanced-learn, plotly y demás (~200 MB).

### Paso 2 — Entrenar el modelo
```bash
python train_model.py
```

Debe imprimir las métricas finales y generar los tres `.pkl`:
```
=======================================================
  REPORTE FINAL - RANDOM FOREST
=======================================================
  Accuracy : 0.8000
  Precision: 0.7143
  Recall   : 0.7143
  F1-score : 0.7143
  AUC-ROC  : 0.8657

Modelo guardado       -> modelo_rf.pkl
LabelEncoder guardado -> label_encoder.pkl
Métricas guardadas    -> metricas_modelo.pkl
```

**Solo necesitas hacer esto una vez**, o cada vez que cambies el dataset.

### Paso 3 — Correr el dashboard
```bash
python -m streamlit run app.py
```

Se abrirá automáticamente `http://localhost:8501` en tu navegador.

Para detener el servidor: `Ctrl+C` en la terminal.

### Paso 4 — (Opcional) Cambiar el puerto
Si el 8501 está ocupado:

```bash
python -m streamlit run app.py --server.port 8502
```

---

## 7. ¿Qué se ve en el dashboard?

### Header (franja azul)
Título del proyecto + 4 tarjetas con Accuracy, F1-Score, AUC-ROC y el nombre del modelo. Se lee de `metricas_modelo.pkl`.

### Sidebar (izquierda, fondo oscuro)
- **Filtros**: grado, sección, nivel de riesgo. Todos multiselect.
- **Botón "Actualizar predicciones"**: limpia caches y re-ejecuta.
- **Mini resumen global**: total estudiantes + % en riesgo alto con barra visual.

### KPIs (4 tarjetas blancas)
Total, Riesgo Alto, Riesgo Medio, Riesgo Bajo. Cada una muestra cantidad y porcentaje respecto al filtro aplicado.

### Ranking
Tabla ordenada descendentemente por probabilidad. Columnas: ID, Grado, Sección, Promedio, Asistencia, Conducta, Participación, Tendencia, **Barra de probabilidad visual**, Nivel (con emoji). Botón **"Exportar ranking a CSV"**.

### Visualizaciones (4 tabs)

1. **Distribución de riesgo**: pie chart (donut) + bar chart mostrando cuántos hay en cada nivel.
2. **Importancia de variables**: qué features influyen más en la predicción del Random Forest (ordenado de menor a mayor). Rojo = alta, amarillo = media, gris = baja.
3. **Matriz de confusión**: VN / FP / FN / VP del modelo en el conjunto de prueba (20% no visto en entrenamiento).
4. **Curva ROC**: tasa de verdaderos positivos vs. falsos positivos. El AUC (área bajo la curva) mide qué tan buen clasificador es.

### Detalle por estudiante
- **Selector**: elige un estudiante por ID (ordenados por mayor riesgo).
- **Tarjeta cabecera**: nombre, nivel con badge colorido, grado y sección.
- **Columna izquierda**: tabla con todos los datos del estudiante.
- **Columna derecha**: gauge visual con la probabilidad (verde/amarillo/rojo según zona).
- **Top 3 factores**: los features con mayor importancia general del modelo, con barras proporcionales.
- **Explicación en texto**: frase que menciona el nivel, la probabilidad y los factores clave.

### Footer
Métricas del modelo en test (Accuracy, Precision, Recall, F1, AUC-ROC).

---

## 8. Preguntas frecuentes (para la defensa)

**¿Por qué Random Forest y no otro modelo?**
Porque maneja bien variables categóricas y numéricas juntas, resiste al sobreajuste gracias al promedio de 200 árboles, y entrega de forma natural la importancia de cada variable. El notebook compara contra Logistic Regression y Decision Tree y RF gana en F1-Score.

**¿Por qué SMOTE?**
El dataset tiene ~35% de estudiantes en riesgo y ~65% sin riesgo. Sin balancear, el modelo tendería a predecir siempre "sin riesgo" (la clase mayoritaria) para maximizar accuracy, pero eso haría que fallara precisamente en los casos que más importan (los en riesgo). SMOTE genera ejemplos sintéticos de la clase minoritaria para igualar la proporción durante el entrenamiento.

**¿Por qué Recall es la métrica clave?**
Porque el costo de un **falso negativo** (no detectar a un estudiante en riesgo) es mucho mayor que el de un **falso positivo** (dar una alerta que luego resulta innecesaria). Recall mide qué porcentaje de los estudiantes realmente en riesgo el modelo detectó.

**¿Hay una base de datos?**
No. El dataset vive en un CSV plano. Para un despliegue real en un colegio, se podría conectar a una base de datos (PostgreSQL, MySQL) modificando `cargar_dataset()` en `app.py`.

**¿Se reentrena el modelo cada vez que abro la app?**
No. El entrenamiento es un paso aparte (`train_model.py`) que genera los `.pkl`. La app solo los carga. Esto permite que la app arranque en menos de 2 segundos.

**¿El CSS del sidebar oscuro funciona en todas las versiones de Streamlit?**
Fue probado en Streamlit 1.56. Usa selectores CSS estables (`[data-testid="stSidebar"]`). Si en el futuro Streamlit cambia esos selectores, habría que actualizar el CSS.

---

## 9. Cómo modificar la app

### Cambiar los umbrales de riesgo
Edita `clasificar_nivel()` en `app.py`:
```python
def clasificar_nivel(prob: float) -> str:
    if prob >= 0.70: return "ALTO"   # ← cambiar aquí
    if prob >= 0.45: return "MEDIO"  # ← cambiar aquí
    return "BAJO"
```

### Cambiar los colores
Edita las constantes al inicio de `app.py`:
```python
COLOR_ALTO  = "#A32D2D"
COLOR_MEDIO = "#BA7517"
COLOR_BAJO  = "#3B6D11"
```

### Cambiar hiperparámetros del modelo
Edita `train_model.py`:
```python
model = RandomForestClassifier(
    n_estimators=200,      # ← más árboles = más preciso pero más lento
    max_depth=8,           # ← más profundidad = más preciso pero puede sobreajustar
    min_samples_split=5,
    random_state=SEED,
)
```
Luego vuelve a correr `python train_model.py`.

### Agregar un filtro nuevo (ej. por promedio mínimo)
En `render_sidebar`, agrega:
```python
promedio_min = st.sidebar.slider("Promedio mínimo", 4.0, 20.0, 4.0)
```
Y en `aplicar_filtros`, agrega:
```python
filt = filt[filt["promedio_notas"] >= filtros["promedio_min"]]
```

---

## 10. Stack tecnológico — resumen

| Capa | Herramienta | Versión |
|---|---|---|
| Lenguaje | Python | 3.10+ |
| ML | scikit-learn | 1.4+ |
| Balanceo | imbalanced-learn (SMOTE) | 0.12+ |
| Datos | pandas, numpy | 2.1+, 1.26+ |
| Visualización | Plotly | 5.18+ |
| Dashboard | Streamlit | 1.32+ |
| Persistencia del modelo | joblib | 1.3+ |
| Estilo | CSS custom + Google Fonts (Inter) | — |

---

*Última actualización: abril 2026 · Proyecto P20261012 · UPC*
