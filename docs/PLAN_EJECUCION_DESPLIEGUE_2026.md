# Plan de Ejecución — Despliegue Final + Cierre de HUs — SATRA P20261012

**Creado:** 2026-08-31 · **Estado general:** 🟡 Esperando materiales de acceso (Fase 0)

Este documento se actualiza en vivo conforme se completan los pasos. Checklist:
`[ ]` pendiente · `[~]` en progreso · `[x]` hecho · `[!]` bloqueado (ver nota)

---

## Contexto y decisiones ya tomadas (2026-08-31)

- **Servidor Hetzner ya creado**: CX23 (2 vCPU, 4GB RAM, 40GB SSD), Nuremberg, Ubuntu 26.04, IP `2.28.71.5`. SSH con llave ed25519 funcionando desde esta máquina.
- **Dominio**: ya comprado en Cloudflare, falta apuntarlo al servidor y configurar HTTPS.
- **Base de datos**: Supabase ya configurado y en uso (proyecto `tesis-alerta-temprana`, ref `awudayejfwalvdfnqxlb`).
- **Frontend**: ya desplegado en Vercel (confirmado por el CORS regex en `backend-ml/app/main.py` que ya permite `*.vercel.app`).
- **Modelo ML — decisión de alcance**: se mantienen AMBOS modelos funcionando técnicamente (EM2022 nacional como fallback para directores sin colegio propio cargado, y el modelo híbrido de colegio propio). **Solo se actualiza la documentación de tesis** para defender el modelo híbrido de colegio propio como el aporte real — no se elimina código de EM2022.
- **Feature de carga de Excel por el profesor/director**: la funcionalidad YA EXISTE en el backend (`colegio_propio.py`, `parse_excels.py`, `train_colegio_model.py`) pero está apagada en producción porque el plan original era Railway (filesystem efímero — ver `docs/ROADMAP_CARGA_EXCEL_COLEGIO.md`). Con Hetzner (disco persistente) esto se resuelve solo con quitar el gate de `isLocalBackend()` y mapear un volumen Docker persistente.
- **Rediseño de frontend**: confirmado que es necesario (dashboards orientados a acción/insight en vez de solo tablas), pero el diseño concreto se define con mockups en la Fase 6, no a ciegas.

---

## FASE 0 — Materiales y accesos que necesito de ti

- [x] **Dominio confirmado**: `satraapp.com` (Cloudflare, plan Free). Frontend en la raíz + `www` (Vercel), API en `api.satraapp.com` (Hetzner `2.28.71.5`).
- [x] **DNS configurado en Cloudflare** (2026-08-31): CNAME `@`→Vercel, CNAME `www`→Vercel, A `api`→`2.28.71.5`, todos en modo "DNS only" (sin proxy naranja). Vercel ya emitiendo certificados SSL para ambos dominios.
- [x] **Resend**: dominio `satraapp.com` dado de alta (registros MX/TXT/DKIM ya en Cloudflare) — pendiente confirmar que Resend lo marque "Verified".
- [ ] **Cloudflare**: acceso a la cuenta o API Token — de momento resuelto porque Mathias ejecuta los cambios de DNS directamente y me pasa capturas; si se necesita automatizar algo (ej. rotar el proxy a "Proxied" después), pedir acceso puntual entonces.
- [ ] **Vercel**: confirmar si necesito acceso al proyecto (para actualizar la variable `NEXT_PUBLIC_ML_API_URL` apuntando al dominio nuevo de la API) o si tú lo actualizas cuando te lo indique.
- [ ] **GitHub**: acceso de push al repo (o confirmas que trabajamos sobre tu working copy local y tú haces los `git push` cuando te lo pida).
- [ ] **RESEND_API_KEY**: confirmar si la que ya está en Supabase Secrets sigue vigente, o si hay que regenerarla.
- [ ] **Los datasets/Excel adicionales** que mencionaste — con distintos formatos de colegio, para probar que `parse_excels.py` los soporte (o para mapear qué ajustes necesita el parser por cada formato nuevo).
- [x] ~~Confirmar `credenciales.md`~~ — verificado: nunca se subió a git (`git ls-files` no lo lista), está bien excluido desde siempre. Sin riesgo.

---

## FASE 1 — Preparar el servidor Hetzner ✅ (2026-09-08)

- [x] Usuario no-root con sudo: `deploy` (con NOPASSWD sudo + su propia llave SSH copiada de root)
- [x] Swapfile de 2GB configurado (`/swapfile`, swappiness=10)
- [x] `ufw` activo: solo 22 (SSH), 80 (HTTP), 443 (HTTPS) permitidos, default deny incoming
- [x] Docker 29.8.0 + Docker Compose v5.5.1 instalados, `deploy` en grupo `docker` (sin sudo)
- [x] Caddy (vía imagen oficial `caddy:2-alpine` en docker-compose) — HTTPS automático con Let's Encrypt, no se instaló a nivel de SO

## FASE 2 — Dockerizar y desplegar el backend ✅ (2026-09-08)

- [x] `backend-ml/Dockerfile` ya existía (armado para Railway) — se le agregó `COPY modelo/colegio ./modelo/colegio` (faltaba para que el entrenamiento del colegio funcione en el container)
- [x] `docker-compose.yml` creado en la raíz: servicio `backend` (build del Dockerfile, volúmenes persistentes en `./modelo/model` y `./modelo/data`) + servicio `caddy` (puertos 80/443, Caddyfile montado)
- [x] `Caddyfile` creado: reverse proxy de `api.satraapp.com` → `backend:8000`
- [x] `backend-ml/.env.production` con `SATRA_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- [x] Código + modelos `.pkl` + datasets + scripts de `modelo/colegio` y `modelo/em2022` transferidos al servidor vía `scp` a `~/satra/`
- [x] `docker compose up -d --build` — build exitoso, `satra-backend-1` y `satra-caddy-1` corriendo
- [x] Verificado en vivo: `https://api.satraapp.com/v1/health` → `{"status":"ok","model_loaded":true}`, `/v1/modelo/metricas` y `/v1/colegio/249/resumen` responden con datos reales

## FASE 3 — Dominio y HTTPS ✅ (2026-09-08)

- [x] Registros DNS en Cloudflare: `@`→Vercel, `www`→Vercel, `api`→`2.28.71.5` (todos DNS-only)
- [x] Certificado TLS emitido automáticamente por Caddy (Let's Encrypt) para `api.satraapp.com`, confirmado en logs (`certificate obtained successfully`)
- [x] CORS del backend actualizado (`backend-ml/app/main.py`) para aceptar `https://satraapp.com` y `https://www.satraapp.com`
- [x] Vercel: `NEXT_PUBLIC_ML_API_URL` actualizada a `https://api.satraapp.com` (hecho por Mathias)
- [x] Push a `origin/main` (commit `4eff165`, autenticado como la cuenta del cliente `Falilv0402`) → Vercel redeployó automáticamente
- [x] Verificado en vivo con el navegador: `satraapp.com` carga el login de SATRA correctamente, y el bundle JS de producción tiene `https://api.satraapp.com` compilado (no localhost) — el circuito dominio → Vercel → Hetzner → Supabase queda cerrado

## FASE 4 — Habilitar la carga de Excel del colegio en producción ✅ desplegado, 🟡 falta pulir

- [x] Encontrado y cerrado: `/v1/colegio/{ie}/procesar` no tenía ninguna autenticación — ahora exige sesión Supabase con rol admin/superadmin (y un admin de colegio solo puede subir para su propia IE), vía `require_admin_de_colegio` en `colegio_propio.py`
- [x] Quitado el gate `isLocalBackend()` en `DatosView.tsx` — ya no aplica con disco persistente en Hetzner
- [x] `useAdmin.ts` → `uploadColegioExcels` ahora envía el `Authorization: Bearer <token>` de la sesión activa
- [x] Verificado en vivo: `POST /v1/colegio/249/procesar` sin token → `401` (el guard funciona)
- [x] Pusheado a git y desplegado en Vercel — confirmado en el navegador
- [x] Confirmado: el volumen es un bind mount real al disco del host (`~/satra/modelo/model/`) — sobrevive rebuilds/restarts del contenedor
- [x] **HU029/HU032 (colegio) cerradas**: las hojas/archivos que se omiten o fallan al parsear (antes solo se imprimían en logs del servidor, invisibles) ahora se capturan en `parse_excels.py` → `df.attrs["advertencias"]` → `metricas["advertencias_carga"]` en el `.pkl` → expuesto en `/procesar` y `/resumen` → visible en `DatosView.tsx` tanto en el resultado inmediato de la carga como de forma persistente en el panel de estadísticas (sobrevive un refresh de página). Probado end-to-end: reentrenamiento real corrió limpio (AUC CV 0.9040, mismos números), campo confirmado en producción.
- [x] **Probado con 3 datasets reales nuevos** (Andrés Avelino Cáceres - Trapiche, Rafael Hoyos Rubio - La Victoria, Andrés Avelino Cáceres - La Perla) — formato "Reporte consolidado", completamente distinto de CUBICOL. Ver detalle completo abajo.
- [x] **Decidido y desplegado (2026-09-08)**: además de superadmin/admin, ahora **director y coordinador** también pueden cargar el Excel de su propio colegio — pedido explícito de Mathias. Backend (`require_admin_de_colegio`) y frontend (pestaña "Datos", `DatosView.tsx`, `directorTabs` en `page.tsx`) actualizados; la IE queda fija a su perfil (no editable, a diferencia de superadmin). El dashboard del colegio se refresca solo tras una carga exitosa.

### Soporte al formato "Reporte consolidado" (3 colegios nuevos) ✅ (2026-09-08)

- [x] Detecta el formato ("REPORTE CONSOLIDADO..." en la fila 0), mapea materias granulares (Álgebra/Aritmética/Geometría/Razonamiento Matemático → matematica; Plan Lector/Razonamiento Verbal → comunicacion; Danza/Música → arte; Comportamiento → conducta) a las 8 áreas ponderadas
- [x] **Extrae el bimestre real del título** ("... - II BIMESTRE") — cada salón trae 4 archivos (uno por bimestre, notas distintas confirmadas, no duplicados) → habilita el modo predictivo B1-B3→B4 genuino, igual que CUBICOL (no solo un promedio anual)
- [x] **3 bugs metodológicos reales corregidos** (afectaban a cualquier colegio sin bimestres completos, no solo a los nuevos): (1) modo predictivo se activaba sin datos reales de B4 → target degenerado (0% en riesgo); (2) modo descriptivo tenía fuga de datos (pp_matematica/pp_comunicacion como feature Y como definición del target, AUC≈1.0 sin valor real) — excluidas de `FEATURES_PP`; (3) glob de archivos sensible a mayúsculas, no matcheaba "notas" en minúscula en Linux
- [x] Deduplicación por (salón, n_alumno) cambiada de "quedarse con el primero" a "promediar" — ya no descarta datos silenciosamente
- [x] `_load_artefacto()` en `colegio_propio.py` solo soportaba códigos IE de hasta 4 dígitos (zfill(4)) — los códigos modulares reales de MINEDU tienen 7 (ej. `0831305`) y el frontend los normaliza quitando el cero inicial en varios lugares (`parseInt`) — corregido para soportar ambas convenciones
- [x] Códigos IE verificados en MINEDU (Identicole): Trapiche → **0831305**, La Victoria → **0864785**. La Perla usa código temporal **9001** — no se pudo verificar el real con una fuente oficial (el candidato de deperu.com resultó no existir en Identicole)
- [x] Los 4 colegios (0249, 0831305, 0864785, 9001) entrenados y verificados respondiendo correctamente en producción (`api.satraapp.com`)
- [x] **Selector de colegios corregido** (2026-09-08): `get_colegios()` ahora también escanea `modelo/model/colegio_*.pkl` y agrega los que no están en EM2022. Se agregó `--distrito` (opcional) a `train_colegio_model.py`; los 3 colegios nuevos se reentrenaron con su distrito real (Comas, La Victoria, La Perla). Los selectores de `UsuariosView.tsx` y `AuthView.tsx` muestran nombre real + IE + distrito. Verificado en producción: los 3 colegios aparecen en `/v1/colegios` con sus datos correctos.
- [x] Código real de La Perla: **no se busca más** (decisión del usuario) — se mantiene el temporal `9001` indefinidamente salvo que el colegio lo provea directamente.
- [x] Carpetas `modelo/data/Colegio 2/3/4 - .../` (Excel originales, nombres reales de alumnos) versionadas en git (decisión de Mathias: sí subirlas, igual que Joseph & Mary) — commit `e762946`

## FASE 5 — Cerrar historias de usuario pendientes ✅ código desplegado, 🟡 falta 1 migración manual

- [x] **HU003** — auto-logout por inactividad (30 min), `useAuth.ts` — detecta mousemove/keydown/scroll/touchstart y cierra sesión sola si no hay actividad
- [x] **HU005** — rol editable como `<select>` inline en `UsuariosView.tsx` (superadmin cambia cualquiera; admin cambia roles no-superadmin de su colegio), función `cambiarRolUsuario` en `useAdmin.ts`
- [x] **HU006** — `AuditPanel` en `UsuariosView.tsx` con filtros de usuario y rango de fechas (desde/hasta) + botón "Limpiar"
- [x] **HU019** — alerta proactiva: al reentrenar, `colegio_propio.py` compara nivel de riesgo antes/después por alumno y dispara la función edge `send-alert` para los que subieron a ALTO (best-effort, no bloquea el entrenamiento si falla)
- [x] **HU034** — cada reentrenamiento se registra en `modelos_versiones` (`_registrar_version_modelo` en `colegio_propio.py`)
- [x] **HU024/HU026** — panel "Histórico de reentrenamientos" en `DatosView.tsx`: gráfico de línea (ALTO/MEDIO/BAJO por versión) + tabla + export CSV (HU025), leyendo `modelos_versiones` vía `loadModelosVersiones` en `useAdmin.ts`
- [x] Seguridad reforzada de paso: `/v1/colegio/{ie}/procesar` y `/resumen` ahora exigen JWT válido + rol admin/superadmin de esa IE (antes de esto solo `/procesar` estaba protegido)
- [x] **Migración `0012_modelos_versiones_colegio.sql` aplicada** (2026-09-08, corrida manualmente por Mathias) — verificado vía REST que `modelos_versiones` ya tiene las columnas nuevas. Queda vacía hasta que alguien reentrene un colegio (recién ahí se escribe la primera fila).
- [x] Backend redesplegado en Hetzner (`docker compose up -d --build backend`), verificado `GET /docs` → 200 y logs limpios
- [x] Frontend: `npx tsc --noEmit` limpio + `npm run build` exitoso, commit `de5348a` pusheado a `main` → Vercel redeployando
- [ ] **HU030** — decidir si se implementa de verdad un cron de actualización periódica o se retira la funcionalidad cosmética actual (`scheduleFreq`/`saveSchedule`/`nextUpdate`/`scheduleMsg`, código muerto en 6 archivos — deprioritizado, no urgente)
- [x] **HU033** — evaluado: los sliders de umbral ALTO/MEDIO ya existentes satisfacen la intención de la HU sin exponer hiperparámetros riesgosos del modelo; no se necesita más UI

## FASE 6 — Rediseño de frontend orientado a acción/insight 🟡 primera pasada desplegada

- [x] **Banner "Resumen ejecutivo"** (`AttentionBanner.tsx`, nuevo componente): va como lo primero que se ve al entrar a `DashboardView` (EM2022) y `ColegioDashboardView` (colegio propio) — muestra "casos que necesitan tu atención hoy" priorizados por probabilidad de riesgo, con botón **Intervenir** a un clic, antes de cualquier tabla o filtro. Estado alterno "en calma" (verde) cuando no hay casos ALTO/MEDIO con el filtro actual.
- [x] **Sistema visual más expresivo** en `globals.css`: tokens nuevos (sombras escalonadas `--shadow-sm/md/lg`, radios `--radius-sm/md/lg`, gradientes de marca `--grad-navy`/`--grad-accent`, colores de riesgo semánticos) aplicados a `.panel`, `.kpi`, `.sidebar` (ahora con gradiente en vez de navy plano), botón primario (gradiente + glow al hover) y el nav activo (glow sutil)
- [x] Verificado con un harness de previsualización temporal (`/dev-preview`, borrado después) en desktop y mobile — glassmorphism en los chips del banner, scroll horizontal, estado "en calma" — y confirmado en vivo en `satraapp.com` (el chunk JS de producción contiene el nuevo componente)
- [ ] **Pendiente**: `EstudianteView` y `ColegioEstudianteView` (vista de detalle de un alumno) y `IntervencionesView`/`ColegioIntervencionesView` (checklist accionable) todavía no pasaron por esta pasada de rediseño — quedan con el look anterior (funcional, pero sin el banner/gradientes nuevos)
- [ ] Validar con Mathias si el tono/copy del banner ejecutivo funciona para los 4 roles (director/coordinador/admin/superadmin) o si necesita variarse

## FASE 7 — Documentación de tesis actualizada

- [ ] Actualizar `JUSTIFICACION_MODELO_PREDICTIVO.md`: corregir la sección 2.3 (dice que ganó "Logistic Regression" sola; el `.pkl` real usa Stacking/híbrido) y reencuadrar el documento para defender el modelo híbrido de colegio propio como el aporte de tesis, dejando EM2022 explícitamente como "modelo de referencia / fallback técnico, no el defendido"
- [ ] Actualizar `IMPLEMENTACION_HUS_CASOS.md` y el Product Backlog con el estado real (matriz de cobertura de las 36 HUs)

## FASE 8 — QA final end-to-end

- [ ] Probar cada rol (superadmin, admin, director, coordinador) en producción real
- [ ] Probar con los Excel/datasets adicionales que compartas
- [ ] Confirmar que alguien externo puede entrar al link, registrarse, y ver la app funcionando
