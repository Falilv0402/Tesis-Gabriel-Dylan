# Guía de instalación — SATRA

> Sistema de Alerta Temprana de Riesgo Académico · UPC · P20261012

Esta guía te lleva desde **cero** hasta tener la aplicación corriendo en tu computadora.
Tiempo estimado: **15–25 minutos** la primera vez.

---

## 1. Requisitos previos

Antes de empezar, instala estos programas en tu computadora:

### 1.1 Python 3.11 o superior

- **Descargar**: <https://www.python.org/downloads/>
- **IMPORTANTE** durante la instalación, marca la casilla **"Add Python to PATH"**
- Verificar instalación abriendo CMD/PowerShell:
  ```bash
  python --version
  ```
  Debería mostrar `Python 3.11.x` o superior.

### 1.2 Node.js 18 o superior

- **Descargar**: <https://nodejs.org/en/download> (versión LTS)
- Verificar:
  ```bash
  node --version
  npm --version
  ```
  Debería mostrar `v18.x.x` o superior.

### 1.3 Git (opcional pero recomendado)

- **Descargar**: <https://git-scm.com/downloads>
- Solo necesario si quieres clonar el código desde GitHub. Si te lo pasaron en ZIP, puedes saltar este paso.

---

## 2. Obtener el código

### Opción A — desde un archivo ZIP
1. Descomprime el ZIP en una carpeta sin espacios ni acentos, por ejemplo: `C:\proyectos\SATRA`

### Opción B — desde GitHub
```bash
git clone <URL_DEL_REPO> SATRA
cd SATRA
```

Al final deberías tener esta estructura:
```
SATRA/
├── backend-ml/      ← API Python (FastAPI + modelo ML)
├── frontend/        ← Aplicación web (Next.js)
├── modelo/          ← Modelo entrenado (.pkl)
├── supabase/        ← Migraciones de base de datos
└── docs/            ← Documentación
```

---

## 3. Configurar el backend ML (Python)

Abre una terminal **PowerShell** y entra a la carpeta del backend:

```bash
cd "C:\proyectos\SATRA\backend-ml"
```

Instala todas las dependencias (toma 3–5 minutos):

```bash
pip install -r requirements.txt
```

Si ves errores con `xgboost` o `lightgbm`, instala manualmente:
```bash
pip install xgboost lightgbm shap
```

---

## 4. Configurar el frontend (Next.js)

Abre una **segunda terminal** PowerShell y entra a la carpeta del frontend:

```bash
cd "C:\proyectos\SATRA\frontend"
```

Instala las dependencias (toma 2–4 minutos):

```bash
npm install
```

### 4.1 Crear archivo de configuración `.env.local`

Dentro de la carpeta `frontend/`, crea un archivo llamado **`.env.local`** con este contenido exacto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://awudayejfwalvdfnqxlb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dWRheWVqZndhbHZkZm5xeGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MDQwODcsImV4cCI6MjA5NDM4MDA4N30.68oB6gItKkPPyy-zSXLVQsV5WllNfxu6F7WsZmaztsY
NEXT_PUBLIC_ML_API_URL=http://localhost:8000
```

> Estas credenciales conectan a la base de datos Supabase del proyecto. Ya están configuradas y listas para usar.

---

## 5. Levantar la aplicación

Necesitas **2 terminales abiertas al mismo tiempo**, una para cada servicio.

### Terminal 1 — Backend ML

```bash
cd "C:\proyectos\SATRA\backend-ml"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Cuando veas estas líneas, está listo:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**No cierres esta terminal mientras uses la app.**

### Terminal 2 — Frontend

```bash
cd "C:\proyectos\SATRA\frontend"
npm run dev
```

Cuando veas:
```
✓ Ready in X.Xs
- Local: http://localhost:3000
```

Abre tu navegador (Chrome o Edge) en: **<http://localhost:3000>**

---

## 6. Credenciales de prueba

| Email | Contraseña | Rol | Qué ve |
|---|---|---|---|
| `admin@tesis.pe` | `Tesis2026!` | Administrador | Gestión de usuarios, modelo ML, datos |
| `director@tesis.pe` | `Tesis2026!` | Director | Dashboard, estudiantes, intervenciones, reportes |

También puedes **registrarte como director** desde la misma pantalla de login.
Requisitos del registro:
- Correo institucional (no Gmail, Hotmail, Yahoo)
- Contraseña con: mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 carácter especial

---

## 7. Problemas comunes y soluciones

### ❌ "Puerto 8000 ya está en uso"
Otro proceso está ocupando el puerto. Ciérralo:
```powershell
Get-Process -Name "python","uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force
```
Luego vuelve a levantar el backend.

### ❌ "Puerto 3000 ya está en uso"
```powershell
$pids = netstat -ano | Select-String ":3000 " | ForEach-Object { ($_ -split '\s+')[-1] } | Where-Object { $_ -match '^\d+$' } | Sort-Object -Unique
foreach ($p in $pids) { Stop-Process -Id $p -Force }
```

### ❌ Frontend muestra "Failed to load resource: 404"
Borra el caché de Next.js y reinicia:
```powershell
Remove-Item -Recurse -Force "C:\proyectos\SATRA\frontend\.next"
npm run dev
```

### ❌ "Backend desconectado" en la app
Asegúrate de que la Terminal 1 (uvicorn) siga corriendo y muestre `Application startup complete.`
Si está caída, vuelve a ejecutar:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### ❌ Errores de permisos al instalar `npm install`
Ejecuta PowerShell **como administrador** y vuelve a intentar.

### ❌ `pip` no se reconoce
Python no se agregó al PATH. Reinstala Python marcando "Add Python to PATH" o usa:
```bash
python -m pip install -r requirements.txt
```

---

## 8. Detener la aplicación

En cada terminal, presiona **`Ctrl + C`** para detener el servicio.

---

## 9. Resumen rápido para arrancar la app después de la instalación

Una vez instalado todo, solo necesitas estas 2 terminales:

**Terminal 1:**
```bash
cd "C:\proyectos\SATRA\backend-ml"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2:**
```bash
cd "C:\proyectos\SATRA\frontend"
npm run dev
```

Abre <http://localhost:3000> y entra con las credenciales de prueba.

---

## 10. Contacto

Si algo no funciona después de seguir estos pasos, contacta al equipo de desarrollo:
- Mathias · Frontend
- Dylan · Backend ML
- Gabriel · Datos y documentación

---

*Documento generado para el proyecto **P20261012 — SATRA** · UPC · Taller de Proyectos I*
