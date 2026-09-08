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
- [ ] Probar con los datasets/formatos adicionales que compartas (la validación de arriba reportará qué hojas no reconoce en formatos nuevos, en vez de fallar en silencio)
- [ ] Decidir: ¿quién puede subir Excel? Hoy es exclusivo de `superadmin` en el frontend — el backend ya soporta que un `admin` de colegio también pueda (solo para su propia IE), falta decidir si se le muestra el panel en `DatosView.tsx`

## FASE 5 — Cerrar historias de usuario pendientes

- [ ] **HU003** — auto-logout por inactividad (30 min)
- [ ] **HU005** — UI para cambiar el rol de un usuario existente
- [ ] **HU006** — filtro de auditoría por usuario específico y rango de fechas
- [ ] **HU019** — alerta proactiva/automática cuando se detecta un nuevo caso ALTO (no solo manual)
- [ ] **HU024/025/026** — seguimiento histórico multi-periodo y comparación entre periodos (requiere decidir cómo versionar "periodos" en el modelo de colegio propio, que hoy es solo bimestral de un año)
- [ ] **HU030** — decidir si se implementa de verdad un cron de actualización periódica o se retira la funcionalidad cosmética actual
- [ ] **HU033** — evaluar si aplica exponer más "ajuste de parámetros" o si los umbrales ALTO/MEDIO ya satisfacen la intención de la HU
- [ ] **HU034** — versionado real de modelos: usar la tabla `modelos_versiones` (ya existe en Supabase, nunca se escribe) para guardar historial cada vez que se reentrena

## FASE 6 — Rediseño de frontend orientado a acción/insight

- [ ] Sesión de mockups: traducir "no quiero solo una tabla" en pantallas concretas (candidatas: tarjetas de alumno con semáforo + acción recomendada como elemento principal, resumen ejecutivo tipo "esto necesita tu atención hoy" arriba del dashboard, vista de intervención con checklist accionable)
- [ ] Validar con Mathias antes de tocar código de vistas
- [ ] Implementar sobre `DashboardView`, `ColegioDashboardView`, `EstudianteView`, `ColegioEstudianteView`

## FASE 7 — Documentación de tesis actualizada

- [ ] Actualizar `JUSTIFICACION_MODELO_PREDICTIVO.md`: corregir la sección 2.3 (dice que ganó "Logistic Regression" sola; el `.pkl` real usa Stacking/híbrido) y reencuadrar el documento para defender el modelo híbrido de colegio propio como el aporte de tesis, dejando EM2022 explícitamente como "modelo de referencia / fallback técnico, no el defendido"
- [ ] Actualizar `IMPLEMENTACION_HUS_CASOS.md` y el Product Backlog con el estado real (matriz de cobertura de las 36 HUs)

## FASE 8 — QA final end-to-end

- [ ] Probar cada rol (superadmin, admin, director, coordinador) en producción real
- [ ] Probar con los Excel/datasets adicionales que compartas
- [ ] Confirmar que alguien externo puede entrar al link, registrarse, y ver la app funcionando
