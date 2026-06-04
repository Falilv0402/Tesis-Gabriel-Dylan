# Roadmap — Carga de Excel del colegio desde la UI

## Estado actual (Opción A)

El modelo del colegio (IE 249 — Joseph And Mery) viene pre-entrenado en el repositorio
como `modelo/model/colegio_0249.pkl`. Los endpoints de lectura funcionan correctamente
en producción (Railway). La subida de Excel está desactivada en producción.

---

## Opciones futuras

### Opción B — Supabase Storage (recomendada para producción real)

**Cómo funciona:**
1. El admin sube los Excel desde la UI
2. FastAPI recibe los archivos y los sube a **Supabase Storage** (bucket privado)
3. Se entrena el modelo y el `.pkl` resultante también se guarda en Supabase Storage
4. Al arrancar el container de Railway, descarga el `.pkl` más reciente de Storage
5. El modelo persiste indefinidamente aunque Railway reinicie

**Lo que hay que hacer:**
- Crear un bucket en Supabase Storage: `satra-models`
- Añadir `SUPABASE_SERVICE_KEY` como variable de entorno en Railway
- Modificar `colegio_propio.py`:
  - `POST /procesar` → sube pkl a Storage tras entrenar
  - `GET /predicciones` → si no hay pkl local, lo descarga de Storage
- Añadir `supabase-py` a `requirements.txt`

**Tiempo estimado:** 4-6 horas

---

### Opción C — Subida solo en local (igual que el botón Reentrenar)

**Cómo funciona:**
- El botón de subir Excel solo aparece cuando `NEXT_PUBLIC_ML_API_URL` contiene `localhost`
- En producción se muestra el modelo actual del repo y nada más
- El admin actualiza los datos localmente y hace `git push` para desplegar el nuevo pkl

**Lo que hay que hacer:**
- En `DatosView.tsx`: envolver el panel de subida con `isLocalBackend()`
- Añadir `modelo/colegio/` al Dockerfile para que funcione en local con Railway

**Tiempo estimado:** 30 minutos

---

### Opción D — Subida funcional en Railway con aviso de volatilidad

**Cómo funciona:**
- Se añade `modelo/colegio/` al Dockerfile → los scripts llegan a Railway
- El admin puede subir Excel y el modelo se actualiza en esa sesión
- **AVISO:** el pkl se pierde cuando Railway reinicia el container (puede pasar cada 24h en plan free)
- Útil para demos en vivo

**Lo que hay que hacer:**
- Añadir al Dockerfile:
  ```dockerfile
  COPY modelo/colegio ./modelo/colegio
  ```
- Mostrar advertencia en la UI: "El modelo actualizado se perderá al reiniciar el servidor"

**Tiempo estimado:** 15 minutos

---

## Recomendación para producción real

**Opción B (Supabase Storage)** es la correcta para un sistema en producción.
El ciclo completo sería:

```
Admin sube Excel (UI)
  → FastAPI entrena modelo
  → pkl sube a Supabase Storage
  → Railway reinicia
  → Container descarga pkl de Storage al arrancar
  → Directores ven datos actualizados
```

Esto elimina la dependencia del sistema de archivos efímero de Railway.

---

*Documento generado: Junio 2026 · Proyecto P20261012 SATRA*
