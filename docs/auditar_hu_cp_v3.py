# -*- coding: utf-8 -*-
"""
auditar_hu_cp_v3.py -- Auditoría completa de las 35 HU/CP contra el código
real (frontend + backend + migraciones), a pedido explícito del cliente:
"quiero una redacción impecable reflejando todo lo que tenemos ahora mismo".

Resultado de la auditoría (evidencia completa en la conversación, no repetida
aquí por brevedad):

1) 3 HU MÁS se eliminan (además de las 5 ya quitadas antes) porque describen
   funcionalidad hoy inalcanzable o inexistente:
   - HU011 "ejecutar el modelo con un solo botón" -- describe el botón
     "Reentrenar" de ModeloView (EM2022), pestaña hoy ausente del menú.
   - HU017 "explicación simple del riesgo en lenguaje natural" -- no existe
     ninguna frase generada para colegio propio; es la MISMA función que
     HU012 (factoresRiesgoColegio), sin ninguna capacidad adicional real.
   - HU031 "ajustar los parámetros del modelo predictivo" (sliders de
     umbral) -- mismo ModeloView muerto; colegio propio usa umbrales fijos
     definidos en el entrenamiento (70%/45%), no hay pantalla para tocarlos.

2) 19 HU se reescriben porque su redacción no refleja el comportamiento real
   verificado en el código (mensajes exactos, roles reales, mecánicas mal
   descritas, o características inventadas). El detalle de cada corrección
   queda en los comentarios junto a su definición abajo.

3) 13 HU quedan intactas (ya verificadas como precisas: HU003, HU007, HU008,
   HU010, HU022, HU023, HU024, HU025, HU026, HU027, HU033, HU034, HU035).

Parte de v1.6 (HU) / v1.5 (CP) y guarda como v1.7 / v1.6.
"""
import json
import re
import openpyxl

HU_SRC = r"C:\Users\Usuario\Downloads\P20261012_Historias de Usuario y Criterios de Validacion v1.6.xlsx"
HU_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Historias de Usuario y Criterios de Validacion v1.7.xlsx"
HU_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Historias de Usuario y Criterios de Validacion v1.7.xlsx"

CP_SRC = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.5.xlsx"
CP_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.6.xlsx"
CP_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Casos de Prueba v1.6.xlsx"

REMOVE_HU = {"HU011", "HU017", "HU031"}

# ═══════════════════════════════════════════════════════════════════════════
# Contenido nuevo de cada HU reescrita: (rol, quiere, para, [escenarios]).
# Cada escenario trae también su CP correspondiente (mismo orden 1 a 1).
# ═══════════════════════════════════════════════════════════════════════════

def esc(num, nombre, dado, cuando, entonces, autor, precond, pasos, tipo, prioridad, requer, postcond):
    return {
        "num": num, "nombre": nombre, "dado": dado, "cuando": cuando, "entonces": entonces,
        "cp": {
            "autor": autor, "precondiciones": precond, "pasos": pasos,
            "tipo": tipo, "prioridad": prioridad, "requerimientos": requer, "postcondiciones": postcond,
        },
    }


REWRITE_HU = {}

# HU001 -- Registro. El rol real es Director/Coordinador (NO Administrador:
# el propio formulario dice "para crear una cuenta de Administrador, contacta
# al admin"); ya no hay campo "distrito" (EM2022 apagado); las 5 reglas de
# contraseña son concretas, no "un formato exigido"; el mensaje de correo
# duplicado es literal; y en el caso más común el registro deja al usuario
# autenticado de inmediato (auto-login), no "redirige al login".
REWRITE_HU["HU001"] = {
    "rol": "Director / Coordinador Académico",
    "quiere": "registrarme con los datos de mi colegio para obtener una cuenta operativa",
    "para": "no depender de que un administrador la cree manualmente",
    "esc": [
        esc(1, "Registro exitoso",
            "Nombre, colegio, correo de un proveedor no bloqueado y contraseña con mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial",
            "Completa el formulario y presiona \"Crear cuenta\"",
            "Sistema crea la cuenta (Director si el colegio no tiene uno todavía, o Coordinador si ya lo tiene) y, si el proyecto no exige confirmar el correo, entra directo al dashboard; si lo exige, muestra el aviso de confirmación",
            "Director / Coordinador Académico",
            "La aplicacion esta instalada y operativa. El colegio elegido no tiene todavia un Director (para que la cuenta se cree como Director)",
            [("Usuario completa nombre, colegio, correo y contraseña válidos", "Aplicación habilita el botón \"Crear cuenta como Director\""),
             ("Usuario presiona \"Crear cuenta\"", "Aplicación crea la cuenta y, si no se exige confirmar correo, entra directo al dashboard")],
            "Manual", "Alta", "Ninguno",
            "Sistema registra la cuenta como Director de ese colegio y, cuando corresponde, deja al usuario autenticado sin pasar por login"),
        esc(2, "Correo duplicado",
            "El correo ingresado ya tiene una cuenta registrada",
            "Intenta registrarse con ese correo",
            "Sistema muestra 'Este correo ya tiene una cuenta registrada. Si es tuya, usa \"Recuperar contraseña\".'",
            "Director / Coordinador Académico",
            "La aplicacion esta instalada y operativa. Ya existe una cuenta con el correo que se va a usar",
            [("Usuario completa el formulario con un correo ya registrado", "Aplicación habilita el botón de registro"),
             ("Usuario presiona \"Crear cuenta\"", "Aplicación muestra el aviso de correo ya registrado, sin crear una cuenta nueva")],
            "Manual", "Alta", "Una cuenta ya registrada con ese correo",
            "Sistema no crea una cuenta duplicada"),
        esc(3, "Datos inválidos",
            "Campo requerido vacío, colegio no seleccionado, contraseña sin alguna de las 5 reglas, o correo de un proveedor gratuito bloqueado (gmail, hotmail, yahoo, outlook, live, icloud, me, aol, protonmail)",
            "Completa el formulario",
            "El botón \"Crear cuenta\" permanece deshabilitado hasta corregir todo (el checklist de contraseña se actualiza en tiempo real)",
            "Director / Coordinador Académico",
            "La aplicacion esta instalada y operativa",
            [("Usuario deja un campo vacío, o usa un correo de proveedor gratuito, o una contraseña que no cumple alguna regla", "Aplicación muestra en rojo la regla que falta y mantiene el botón deshabilitado"),
             ("Usuario corrige el dato señalado", "Aplicación habilita el botón en cuanto todo cumple")],
            "Manual", "Media", "Ninguno",
            "Sistema no permite enviar el formulario hasta que todos los campos sean válidos"),
        esc(4, "Administrador sin autorregistro",
            "Cualquier visitante",
            "Abre el formulario de registro",
            "Sistema solo permite crear cuentas de Director/Coordinador; para una cuenta de Administrador, indica que hay que contactar al admin del sistema",
            "Visitante",
            "La aplicacion esta instalada y operativa",
            [("Usuario abre la pestaña \"Registro\"", "Aplicación muestra el aviso \"Para crear una cuenta de Administrador, contacta al admin del sistema\" junto al formulario de Director/Coordinador")],
            "Manual", "Baja", "Ninguno",
            "Sistema no ofrece ninguna forma de autorregistrarse como Administrador"),
    ],
}

# HU002 -- Login. El mensaje de cuenta inactiva es literal; la verificación
# de `activo` es real (posterior a la autenticación de Supabase, por eso el
# intento igual queda en auditoría); no hay redirección de URL (SPA de una
# sola ruta), es un cambio de pestaña según el rol.
REWRITE_HU["HU002"] = {
    "rol": "Cualquier usuario registrado",
    "quiere": "iniciar sesión con mis credenciales",
    "para": "acceder a las funcionalidades correspondientes a mi rol",
    "esc": [
        esc(1, "Login exitoso",
            "Credenciales válidas y cuenta activa",
            "Ingresa correo y contraseña",
            "Sistema autentica y muestra la primera pestaña permitida para su rol (Dashboard para Director/Coordinador, Usuarios para Admin/Superadmin)",
            "Cualquier usuario registrado",
            "La aplicacion esta instalada y operativa. Cuenta activa con credenciales válidas",
            [("Usuario ingresa correo y contraseña correctos", "Aplicación autentica"),
             ("Sistema calcula la primera pestaña permitida para su rol", "Aplicación la muestra")],
            "Manual", "Alta", "Cuenta activa",
            "Sistema deja al usuario autenticado en la pestaña correspondiente a su rol"),
        esc(2, "Credenciales inválidas",
            "Correo o contraseña incorrectos",
            "Ingresa credenciales",
            "Sistema muestra 'Correo o contrasena incorrectos.'",
            "Cualquier usuario registrado",
            "La aplicacion esta instalada y operativa",
            [("Usuario ingresa un correo o contraseña incorrectos", "Aplicación muestra 'Correo o contrasena incorrectos.'")],
            "Manual", "Alta", "Ninguno",
            "Sistema no autentica al usuario"),
        esc(3, "Cuenta desactivada",
            "Cuenta con activo=false",
            "Ingresa credenciales correctas",
            "Supabase autentica momentáneamente, pero el sistema detecta la inactividad, cierra la sesión y muestra 'Cuenta inactiva. Contacta a tu administrador.' (el intento igual queda registrado como 'Inicio de sesion' en auditoría antes de cerrarse)",
            "Cualquier usuario registrado",
            "La aplicacion esta instalada y operativa. Cuenta con activo=false",
            [("Usuario ingresa credenciales correctas de una cuenta desactivada", "Aplicación autentica momentáneamente"),
             ("Sistema verifica el campo activo del perfil", "Aplicación cierra la sesión y muestra 'Cuenta inactiva. Contacta a tu administrador.'")],
            "Manual", "Alta", "Cuenta con activo=false",
            "Sistema no deja una sesión activa para una cuenta desactivada"),
    ],
}

# HU004 -- Recuperar contraseña. El "no expone cuentas" es el comportamiento
# por diseño de Supabase (no una lógica propia de SATRA): el mensaje de
# éxito es siempre el mismo exista o no la cuenta. Si Supabase sí devuelve
# un error real, se muestra sin traducir (a diferencia de login/registro).
REWRITE_HU["HU004"] = {
    "rol": "Cualquier usuario registrado",
    "quiere": "recuperar mi contraseña en caso de olvido",
    "para": "recobrar el acceso al sistema sin asistencia técnica",
    "esc": [
        esc(1, "Enlace enviado",
            "Un correo ingresado (exista o no una cuenta con ese correo -- Supabase no distingue, por diseño anti-enumeración)",
            "Presiona \"Enviar enlace\"",
            "Sistema muestra 'Enlace de recuperacion enviado. Revisa tu bandeja de entrada.'",
            "Cualquier usuario registrado",
            "La aplicacion esta instalada y operativa",
            [("Usuario ingresa un correo (registrado o no) y presiona \"Enviar enlace\"", "Aplicación muestra 'Enlace de recuperacion enviado. Revisa tu bandeja de entrada.', exista o no la cuenta")],
            "Manual", "Media", "Ninguno",
            "Sistema nunca revela si un correo tiene o no una cuenta asociada"),
        esc(2, "Error real de Supabase",
            "Un error real de Supabase (ej. de red o límite de envíos)",
            "Solicita el enlace",
            "Sistema muestra el mensaje de error tal como lo devuelve Supabase, sin traducir al español",
            "Cualquier usuario registrado",
            "La aplicacion esta instalada y operativa. Supabase devuelve un error real (no de \"correo no encontrado\")",
            [("Usuario solicita el enlace y Supabase devuelve un error de servicio", "Aplicación muestra ese error tal cual, en el idioma que lo devuelva Supabase")],
            "Manual", "Baja", "Ninguno",
            "Sistema no oculta un error real de servicio, pero tampoco lo traduce"),
    ],
}

# HU005 -- Gestión de usuarios. No hay dos formularios distintos ("crear
# usuario" y "crear Coordinador"): es el MISMO formulario con un selector de
# rol; la contraseña que define el admin no exige la complejidad del
# autorregistro; y Director NO puede crear usuarios (solo cambia rol y
# activa/desactiva dentro de su propio colegio, ver HU007) -- esto reemplaza
# el esc4 anterior, que solo repetía esc1 con otras palabras.
REWRITE_HU["HU005"] = {
    "rol": "Administrador del Sistema",
    "quiere": "gestionar los usuarios del sistema (alta, baja, roles) y asignar colegios a coordinadores y directores",
    "para": "controlar quién accede y con qué nivel de permisos",
    "esc": [
        esc(1, "Crear usuario nuevo",
            "Email, nombre, contraseña temporal (sin exigencia de complejidad, solo el mínimo de Supabase) y rol elegidos por el Admin",
            "Completa el formulario y guarda (mismo formulario para cualquier rol; el Admin de colegio no ve el selector de rol/colegio, quedan fijos a los suyos)",
            "Sistema crea la cuenta con esa contraseña y Supabase envía el correo de confirmación si el proyecto lo tiene habilitado",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador",
            [("Admin completa email, nombre, contraseña temporal y rol", "Aplicación habilita \"Crear usuario\""),
             ("Admin guarda", "Aplicación crea la cuenta y Supabase envía el correo de confirmación si corresponde")],
            "Manual", "Alta", "Cuenta Administrador",
            "Sistema registra al nuevo usuario con la contraseña definida por el Admin"),
        esc(2, "Desactivar o activar usuario",
            "Usuario existente dentro de su alcance (RLS)",
            "Confirma desactivar o activar",
            "Sistema actualiza el acceso; si está fuera de su alcance, RLS lo rechaza y muestra 'No se pudo desactivar (sin permiso o usuario fuera de tu colegio).'",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Usuario activo seleccionado, dentro del alcance del Admin",
            [("Admin selecciona \"Desactivar\" o \"Activar\" sobre un usuario de su alcance", "Aplicación actualiza el acceso de ese usuario"),
             ("Admin intenta la misma acción sobre un usuario fuera de su alcance", "Aplicación la rechaza (RLS) y muestra el aviso de sin permiso")],
            "Manual", "Alta", "Cuenta Administrador",
            "Sistema bloquea o restaura el acceso solo dentro del alcance permitido"),
        esc(3, "Cambiar rol de usuario",
            "Usuario existente dentro de su alcance",
            "Modifica el rol asignado",
            "Sistema actualiza permisos y registra el cambio en auditoría",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Usuario existente seleccionado",
            [("Admin selecciona un nuevo rol para un usuario de su alcance", "Aplicación actualiza el rol y lo registra en auditoría")],
            "Manual", "Media", "Cuenta Administrador",
            "Sistema actualiza permisos y deja constancia del cambio"),
        esc(4, "Director sin acceso a crear usuarios",
            "Rol Director",
            "Abre \"Usuarios\"",
            "No ve el botón \"Crear usuario\" -- solo puede cambiar el rol y activar/desactivar cuentas ya existentes de su propio colegio",
            "Director",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Director",
            [("Director abre la pestaña \"Usuarios\"", "Aplicación muestra \"Mi equipo\" sin el botón \"Crear usuario\", solo el selector de rol y activar/desactivar de su colegio")],
            "Manual", "Media", "Cuenta Director",
            "Sistema no ofrece a un Director ninguna forma de crear cuentas nuevas"),
    ],
}

# HU006 -- Auditoría. El audit_log registra 19 tipos de acción reales (no
# solo accesos): sesión, usuarios, modelo/respaldo, intervenciones,
# anotaciones, exportaciones, perfil y configuración. Hay un panel real con
# búsqueda por texto y rango de fechas, visible solo para admin/superadmin
# (Director no tiene acceso, ni siquiera a nivel de base de datos).
REWRITE_HU["HU006"] = {
    "rol": "Administrador del Sistema",
    "quiere": "consultar el registro de auditoría de acciones del sistema (no solo accesos) y filtrarlo por usuario o fecha",
    "para": "supervisar el uso del sistema y detectar acciones indebidas",
    "esc": [
        esc(1, "Consultar y filtrar auditoría",
            "Admin o Superadmin con acciones registradas (sesión, usuarios, modelo, intervenciones, anotaciones, exportaciones, configuración, entre otras)",
            "Abre \"Usuarios\" y busca por texto o aplica un rango de fechas",
            "Sistema muestra, de las 50 acciones más recientes, las que coincidan con la búsqueda o el rango",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Datos de auditoría disponibles",
            [("Admin abre \"Usuarios\" y revisa \"Auditoria reciente\"", "Aplicación muestra hasta las 50 acciones más recientes de cualquier tipo, con quién y cuándo"),
             ("Admin escribe un nombre/correo o elige un rango de fechas", "Aplicación filtra la lista ya cargada")],
            "Manual", "Media", "Cuenta Administrador",
            "Sistema muestra el histórico de acciones filtrado según lo buscado"),
        esc(2, "Director sin acceso",
            "Rol Director",
            "Abre \"Usuarios\"",
            "No ve el panel de auditoría en absoluto (bloqueado también a nivel de base de datos, no solo en la interfaz)",
            "Director",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Director",
            [("Director abre la pestaña \"Usuarios\"", "Aplicación no muestra ningún panel de auditoría")],
            "Manual", "Media", "Cuenta Director",
            "Sistema no expone auditoría a un Director, ni por la interfaz ni por la base de datos"),
    ],
}

# HU009 -- Identificar riesgo. Único ajuste: el análisis no es un paso
# manual ("ejecuta análisis de predicción"), corre automáticamente al abrir
# el dashboard -- ya lo aclaraba HU012-esc2, ahora también aquí.
REWRITE_HU["HU009"] = {
    "rol": "Coordinador Académico",
    "quiere": "identificar estudiantes con riesgo de bajo rendimiento",
    "para": "Con la finalidad de intervenir oportunamente",
    "esc": [
        esc(1, "Predicción exitosa",
            "Sistema con datos académicos cargados",
            "Abre el dashboard del colegio (el análisis se ejecuta automáticamente, sin un paso manual)",
            "Sistema muestra lista de estudiantes en riesgo",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Colegio con modelo propio entrenado",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra el dashboard"),
             ("Usuario abre el dashboard de su colegio", "Aplicación ya muestra la lista de estudiantes en riesgo, sin ningún paso manual de \"ejecutar\"")],
            "Automática", "Alta", "Cuenta Coordinador, colegio con modelo propio",
            "Sistema muestra la lista de estudiantes en riesgo apenas se abre el dashboard"),
        esc(2, "Sin datos suficientes",
            "Colegio sin los 4 bimestres cargados todavía",
            "Accede al dashboard del colegio",
            "Sistema muestra el aviso 'Este colegio todavía no tiene los 4 bimestres cargados — el modelo está operando con datos limitados' y opera en modo descriptivo (no predictivo) en vez de bloquear el análisis",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Colegio sin los 4 bimestres cargados",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra el dashboard"),
             ("Usuario accede al dashboard de un colegio con datos incompletos", "Aplicación muestra el aviso de datos limitados y opera en modo descriptivo")],
            "Automática", "Media", "Cuenta Coordinador, colegio con menos de 4 bimestres cargados",
            "Sistema no bloquea el análisis; opera en modo descriptivo con aviso"),
        esc(3, "Error de procesamiento",
            "Servidor de análisis (FastAPI) no responde o falla la conexión",
            "Ejecuta análisis de predicción",
            "Sistema muestra un aviso de error de conexión indicando que no se pudo procesar la solicitud",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Backend desconectado",
            [("Usuario esta loggeado como Coordinador", "Aplicación intenta cargar el dashboard"),
             ("Backend no responde", "Aplicación muestra el aviso de error de conexión")],
            "Automática", "Alta", "Cuenta Coordinador",
            "Sistema informa el error de conexión en vez de fallar en silencio"),
    ],
}

# HU012 -- Factores de riesgo. Son 3 áreas de un total de 7 materias +
# Conducta (no solo "áreas académicas"); el promedio es B1-B3 con fallback
# al promedio anual si el alumno no tiene bimestres cargados; y no existe
# ningún estado de "cargando" (el cálculo es síncrono).
REWRITE_HU["HU012"] = {
    "rol": "Coordinador Académico",
    "quiere": "conocer los factores específicos que elevan el riesgo de un estudiante",
    "para": "Para diseñar estrategias de intervención personalizadas",
    "esc": [
        esc(1, "Factores visibles por estudiante",
            "Alumno con nota registrada en al menos una de 7 materias + Conducta (bimestre 1-3, o promedio anual si el salón no tiene desglose por bimestre)",
            "Selecciona un estudiante",
            "Sistema muestra las 3 áreas con el promedio más bajo, ordenadas de menor a mayor, con barra visual y valor numérico",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno con al menos una nota registrada",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra la lista de alumnos"),
             ("Usuario selecciona un alumno", "Aplicación muestra sus 3 áreas de menor promedio, con barra y valor numérico")],
            "Automática", "Alta", "Cuenta Coordinador, alumno con notas registradas",
            "Sistema muestra los 3 factores que más elevan el riesgo de ese alumno"),
        esc(2, "Alumno sin ninguna nota registrada",
            "Alumno sin ninguna nota en ninguna área",
            "Selecciona un estudiante",
            "Sistema muestra 'Aún no hay notas de los bimestres 1-3 para estimar los factores de riesgo de este alumno.' (el cálculo es inmediato; no existe un estado de carga)",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno sin ninguna nota cargada",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra la lista de alumnos"),
             ("Usuario selecciona un alumno sin notas", "Aplicación muestra el aviso de que aún no hay notas para estimar factores")],
            "Automática", "Media", "Cuenta Coordinador, alumno sin notas",
            "Sistema no bloquea la vista del alumno; solo indica que faltan notas"),
    ],
}

# HU013 -- KPIs del colegio. Son 5 KPIs exactos (no un número genérico), y
# el estado "vacío" real de este panel es simplemente mostrar todo en cero
# cuando el filtro no tiene coincidencias (los estados de "sin modelo" y
# "modo descriptivo" ya están documentados en HU010 y HU009 respectivamente
# -- repetirlos aquí sería crear un duplicado nuevo).
REWRITE_HU["HU013"] = {
    "rol": "Coordinador Académico",
    "quiere": "visualizar indicadores globales del colegio",
    "para": "Para evaluar el desempeño institucional",
    "esc": [
        esc(1, "Visualización correcta",
            "Colegio con modelo propio entrenado",
            "Accede al dashboard",
            "Sistema muestra 5 KPIs (Alumnos, En riesgo, Riesgo alto, Riesgo medio, Riesgo bajo), recalculados según los filtros de nivel/grado/sección activos",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Colegio con modelo propio",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra el dashboard"),
             ("Usuario accede al dashboard", "Aplicación muestra los 5 KPIs")],
            "Automática", "Alta", "Cuenta Coordinador, colegio con modelo propio",
            "Sistema muestra los 5 KPIs del colegio, recalculados según los filtros activos"),
        esc(2, "Filtro sin coincidencias",
            "Ningún alumno cumple el filtro activo",
            "Accede al dashboard",
            "Sistema muestra los 5 KPIs en cero, sin ningún mensaje de advertencia adicional",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Filtro aplicado sin coincidencias",
            [("Usuario aplica un filtro sin alumnos que lo cumplan", "Aplicación muestra los 5 KPIs en cero, sin mensaje adicional")],
            "Automática", "Baja", "Cuenta Coordinador",
            "Sistema muestra ceros en los KPIs cuando el filtro no tiene coincidencias"),
    ],
}

# HU014 -- Ranking. Límite real de 25 alumnos en el panel "Estudiantes más
# críticos", con acceso a la lista completa desde "Ver notas por materia";
# mensajes exactos de carga y de ausencia de datos.
REWRITE_HU["HU014"] = {
    "rol": "Coordinador Académico",
    "quiere": "ver un ranking de estudiantes según nivel de riesgo",
    "para": "Para identificar rápidamente los casos más críticos",
    "esc": [
        esc(1, "Ranking descendente correcto",
            "Alumnos que cumplen el filtro activo",
            "Accede al panel \"Estudiantes más críticos\"",
            "Sistema lista hasta 25 alumnos ordenados de mayor a menor probabilidad de riesgo, con acceso a la lista completa desde \"Ver notas por materia\"",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumnos que cumplen el filtro",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra el dashboard"),
             ("Usuario revisa \"Estudiantes más críticos\"", "Aplicación lista hasta 25 alumnos ordenados por probabilidad de riesgo descendente")],
            "Automática", "Alta", "Cuenta Coordinador, alumnos con predicción",
            "Sistema muestra el ranking de los alumnos más críticos"),
        esc(2, "Sin datos disponibles",
            "Ningún alumno cumple el filtro, o los datos aún están cargando",
            "Accede al panel",
            "Sistema muestra 'No hay alumnos con el filtro seleccionado.' o 'Cargando alumnos del colegio...' según corresponda",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador",
            [("Usuario accede al panel mientras los datos cargan, o con un filtro sin coincidencias", "Aplicación muestra 'Cargando alumnos del colegio...' o 'No hay alumnos con el filtro seleccionado.' según el caso")],
            "Automática", "Baja", "Cuenta Coordinador",
            "Sistema informa la ausencia de datos en vez de mostrar una tabla vacía sin explicación"),
    ],
}

# HU015 -- Filtrar por grado/sección. El mensaje de "sin coincidencias" es
# el mismo que el de HU014 (comparten los mismos datos filtrados).
REWRITE_HU["HU015"] = {
    "rol": "Coordinador Académico",
    "quiere": "filtrar estudiantes por grado o sección",
    "para": "Para analizar grupos específicos",
    "esc": [
        esc(1, "Filtro por grado o sección correcto",
            "Alumnos con salón/grado/sección definidos",
            "Aplica un filtro de grado o sección",
            "Sistema recalcula KPIs, ranking y gráfico de distribución mostrando solo los alumnos que cumplen el filtro",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra los filtros de Grado y Sección"),
             ("Usuario elige un grado o sección", "Aplicación recalcula KPIs, ranking y gráfico con solo esos alumnos")],
            "Automática", "Media", "Cuenta Coordinador",
            "Sistema muestra solo los alumnos que cumplen el filtro elegido"),
        esc(2, "Filtro sin coincidencias",
            "Filtro aplicado sin alumnos que lo cumplan",
            "Aplica el filtro",
            "Sistema muestra 'No hay alumnos con el filtro seleccionado.' (mismo mensaje del panel de ranking, porque comparten los mismos datos filtrados)",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador",
            [("Usuario aplica un filtro de grado/sección sin alumnos que lo cumplan", "Aplicación muestra 'No hay alumnos con el filtro seleccionado.'")],
            "Automática", "Baja", "Cuenta Coordinador",
            "Sistema informa que el filtro no tiene coincidencias"),
    ],
}

# HU016 -- Distribución (donut). Mensaje exacto de ausencia de datos.
REWRITE_HU["HU016"] = {
    "rol": "Coordinador Académico",
    "quiere": "visualizar la distribución de estudiantes por nivel de riesgo",
    "para": "Para tener una visión general rápida",
    "esc": [
        esc(1, "Gráfico correcto",
            "Alumnos que cumplen el filtro activo",
            "Accede al dashboard",
            "Sistema muestra un donut con la distribución ALTO/MEDIO/BAJO, con colores fijos por nivel (un nivel en 0 no hereda el color de otro)",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumnos que cumplen el filtro",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra el dashboard"),
             ("Usuario revisa \"Distribución de riesgo\"", "Aplicación muestra el donut ALTO/MEDIO/BAJO")],
            "Automática", "Media", "Cuenta Coordinador",
            "Sistema muestra el gráfico de distribución de riesgo"),
        esc(2, "Sin datos para el filtro",
            "Ningún alumno cumple el filtro activo",
            "Accede al dashboard",
            "Sistema muestra 'Sin datos para el filtro seleccionado.' en vez del gráfico",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Filtro sin coincidencias",
            [("Usuario aplica un filtro sin alumnos que lo cumplan", "Aplicación muestra 'Sin datos para el filtro seleccionado.' en vez del gráfico")],
            "Automática", "Baja", "Cuenta Coordinador",
            "Sistema informa la ausencia de datos en vez de mostrar un gráfico vacío"),
    ],
}

# HU018 -- Historial académico. Estructura real: pestaña "Trayectoria" con
# tabla de notas por bimestre (7 materias + Conducta anual) y gráfico de
# evolución B1-B4; sin notas, se muestran celdas vacías y el gráfico sin
# puntos -- no hay un mensaje de advertencia dedicado para esta ausencia.
REWRITE_HU["HU018"] = {
    "rol": "Coordinador Académico",
    "quiere": "ver el historial académico de un estudiante en un solo lugar",
    "para": "Para analizar su evolución completa",
    "esc": [
        esc(1, "Historial completo",
            "Alumno con notas cargadas",
            "Abre su detalle, pestaña \"Trayectoria\"",
            "Sistema muestra la tabla de notas del bimestre seleccionado (7 materias + Conducta anual) y el gráfico de evolución B1-B4 con línea de referencia de aprobación",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno con notas cargadas",
            [("Usuario esta loggeado como Coordinador", "Aplicación muestra el detalle del alumno"),
             ("Usuario abre la pestaña \"Trayectoria\"", "Aplicación muestra la tabla de notas por bimestre y el gráfico de evolución B1-B4")],
            "Automática", "Media", "Cuenta Coordinador, alumno con notas",
            "Sistema muestra el historial académico integrado del alumno"),
        esc(2, "Historial incompleto",
            "Alumno sin ninguna nota cargada",
            "Abre su detalle",
            "Sistema muestra la tabla y el gráfico igual, con celdas vacías ('—') y sin puntos en el gráfico — no hay un mensaje de advertencia dedicado para esta ausencia",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno sin notas cargadas",
            [("Usuario abre el detalle de un alumno sin notas", "Aplicación muestra la tabla con celdas '—' y el gráfico sin puntos, sin ningún aviso adicional")],
            "Automática", "Baja", "Cuenta Coordinador",
            "Sistema no bloquea ni advierte especialmente sobre un historial vacío"),
    ],
}

# HU019 -- Alertas. La mecánica real es muy distinta de "alerta por canal
# configurado": es un correo automático, disparado SOLO al terminar un
# reentrenamiento, y SOLO por alumnos que pasan a ALTO por primera vez
# (comparando contra el estado anterior a ese mismo reentrenamiento).
REWRITE_HU["HU019"] = {
    "rol": "Coordinador Académico",
    "quiere": "recibir un aviso automático cuando el reentrenamiento del modelo detecte alumnos nuevos en riesgo ALTO",
    "para": "no tener que revisar el dashboard manualmente después de cada carga de datos",
    "esc": [
        esc(1, "Alerta por correo tras reentrenar",
            "El reentrenamiento hace que uno o más alumnos pasen a nivel ALTO por primera vez (no lo estaban antes de esa carga)",
            "Termina de procesarse el nuevo Excel",
            "Sistema envía un correo a los perfiles activos admin/director/coordinador de ese colegio, indicando cuántos alumnos nuevos entraron en ALTO",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Colegio con modelo previo, se sube un Excel que produce nuevos alumnos en ALTO",
            [("Se sube un Excel que reentrena el modelo del colegio", "Aplicación detecta alumnos que pasan a ALTO por primera vez"),
             ("Sistema termina de procesar la carga", "Aplicación envía un correo a admin/director/coordinador del colegio con la cantidad de alumnos nuevos en ALTO")],
            "Automática", "Alta", "Colegio con modelo previo entrenado",
            "Sistema notifica por correo al equipo del colegio sobre los alumnos nuevos en riesgo ALTO"),
        esc(2, "Sin alumnos nuevos en ALTO",
            "Ningún alumno pasa a ALTO por primera vez, o es la primera carga del colegio (sin estado previo)",
            "Termina de procesarse el Excel",
            "Sistema no envía ninguna alerta",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Reentrenamiento sin alumnos nuevos en ALTO",
            [("Se sube un Excel que reentrena el modelo sin generar alumnos nuevos en ALTO", "Aplicación no envía ningún correo")],
            "Automática", "Baja", "Ninguno",
            "Sistema no genera alertas innecesarias"),
    ],
}

# HU020 -- Recomendaciones. No se "muestran" al consultar un alumno: son un
# texto de regla fija que (1) se guarda como descripción por defecto si la
# intervención se registra sin descripción, y (2) aparece como "Acción
# recomendada" dentro del correo de alerta al equipo. Para colegio propio
# casi siempre es el mensaje genérico, porque las reglas específicas están
# escritas para categorías de riesgo de EM2022.
REWRITE_HU["HU020"] = {
    "rol": "Coordinador Académico",
    "quiere": "que el sistema sugiera automáticamente una acción de intervención cuando no escribo una descripción",
    "para": "no dejar una intervención sin ningún detalle registrado",
    "esc": [
        esc(1, "Descripción de respaldo al guardar",
            "Registra una intervención sin escribir descripción",
            "Guarda la intervención",
            "Sistema guarda como descripción un texto de regla fija según el riesgo del alumno (en colegio propio, casi siempre el mensaje genérico \"Monitoreo academico continuo y revision periodica\", porque las reglas específicas están escritas para categorías de EM2022)",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno seleccionado, descripción vacía",
            [("Usuario selecciona un alumno y un tipo de intervención, sin escribir descripción", "Aplicación habilita \"Registrar\""),
             ("Usuario guarda la intervención", "Aplicación guarda como descripción el texto de regla fija correspondiente")],
            "Automática", "Baja", "Cuenta Coordinador, alumno seleccionado",
            "Sistema no deja una intervención sin ningún detalle registrado"),
        esc(2, "Mismo texto en el correo de alerta",
            "Envía la alerta del alumno al equipo por correo",
            "Selecciona \"Enviar alerta al equipo\"",
            "El correo incluye una \"Acción recomendada\" con ese mismo texto de regla fija",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno en riesgo seleccionado",
            [("Usuario selecciona \"Enviar alerta al equipo\" para un alumno en riesgo", "Aplicación envía el correo con una sección \"Acción recomendada\" con el texto de regla fija")],
            "Automática", "Baja", "Cuenta Coordinador, alumno en riesgo",
            "Sistema incluye la misma sugerencia de acción en el correo de alerta"),
    ],
}

# HU021 -- Registrar intervenciones. Campos reales: alumno, tipo (4 valores
# fijos) y descripción opcional -- no hay campo de fecha ni de estado en el
# formulario (se asignan por defecto). El botón también se deshabilita
# mientras se está guardando, no solo por falta de alumno.
REWRITE_HU["HU021"] = {
    "rol": "Coordinador Académico",
    "quiere": "registrar las intervenciones realizadas a estudiantes",
    "para": "Para hacer seguimiento a las acciones tomadas",
    "esc": [
        esc(1, "Registro exitoso",
            "Alumno seleccionado, tipo de intervención elegido (tutoría/reunión/derivación/seguimiento) y descripción opcional",
            "Hace clic en \"Registrar\"",
            "Sistema guarda la intervención con estado inicial \"pendiente\" y fecha actual (si la descripción quedó vacía, usa el texto de regla fija de HU020)",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno seleccionado",
            [("Usuario selecciona alumno y tipo de intervención", "Aplicación habilita \"Registrar\""),
             ("Usuario hace clic en \"Registrar\"", "Aplicación guarda la intervención con estado \"pendiente\" y fecha actual")],
            "Manual", "Alta", "Cuenta Coordinador, alumno seleccionado",
            "Sistema almacena la intervención correctamente"),
        esc(2, "Registro bloqueado",
            "Ningún alumno seleccionado, o el guardado ya está en curso",
            "Intenta hacer clic en \"Registrar\"",
            "Sistema mantiene el botón deshabilitado (muestra \"Guardando...\" mientras se procesa)",
            "Coordinador Académico",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Ningún alumno seleccionado",
            [("Usuario no ha seleccionado un alumno", "Aplicación mantiene \"Registrar\" deshabilitado"),
             ("Usuario ya hizo clic y el guardado está en curso", "Aplicación deshabilita el botón y muestra \"Guardando...\"")],
            "Manual", "Media", "Cuenta Coordinador",
            "Sistema no permite un registro incompleto ni un doble envío"),
    ],
}

# HU028 -- El pipeline no "corrige" datos: omite hojas/archivos puntuales
# con error o muy pocos alumnos, y sigue procesando el resto sin bloquear
# la carga completa.
REWRITE_HU["HU028"] = {
    "rol": "Administrador del Sistema",
    "quiere": "que el sistema descarte automáticamente las hojas o archivos con datos insuficientes o corruptos al procesar el Excel del colegio, sin bloquear el resto de la carga",
    "para": "asegurar que un archivo problemático no impida entrenar el modelo con el resto de los datos válidos",
    "esc": [
        esc(1, "Omisión exitosa",
            "Un archivo/hoja con muy pocos alumnos (menos de 5) o con un error de formato",
            "Se procesa la carga completa",
            "Sistema omite esa hoja/archivo puntual y continúa procesando el resto sin bloquear la carga",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador. Uno de los archivos subidos tiene un problema puntual",
            [("Admin sube varios archivos de notas/conducta, uno de ellos con muy pocos alumnos o un error de formato", "Aplicación procesa la carga"),
             ("Sistema detecta el archivo/hoja problemático", "Aplicación lo omite y sigue procesando el resto sin bloquear la carga")],
            "Automática", "Alta", "Cuenta Administrador",
            "Sistema entrena el modelo con el resto de los datos válidos, sin bloquear toda la carga por un archivo puntual"),
        esc(2, "Motivo reportado",
            "Una o más hojas/archivos omitidos",
            "Termina de procesar",
            "Sistema reporta cada omisión con su motivo (ej. \"solo 3 alumno(s) detectado(s), mínimo 5\")",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador. Al menos una hoja/archivo fue omitido",
            [("Sistema terminó de procesar una carga con omisiones", "Aplicación registra el motivo exacto de cada una")],
            "Automática", "Media", "Cuenta Administrador",
            "Sistema deja registrado por qué se omitió cada hoja/archivo"),
    ],
}

# HU029 -- Solo se aceptan .xlsx/.xls (no CSV) con "Notas" o "Conducta" en
# el nombre; un archivo rechazado no bloquea el resto de la carga.
REWRITE_HU["HU029"] = {
    "rol": "Administrador del Sistema",
    "quiere": "cargar los Excel de notas y conducta de mi colegio para actualizar el modelo",
    "para": "mantener las predicciones de riesgo al día con la información real del colegio",
    "esc": [
        esc(1, "Carga exitosa",
            "Uno o más archivos .xlsx/.xls con \"Notas\" o \"Conducta\" en el nombre",
            "Los selecciona y sube",
            "Sistema los procesa, reentrena el modelo y muestra alumnos procesados, en riesgo y % de riesgo",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador. Archivos .xlsx/.xls válidos",
            [("Admin selecciona uno o más archivos .xlsx/.xls con \"Notas\" o \"Conducta\" en el nombre", "Aplicación los sube"),
             ("Sistema termina de procesarlos", "Aplicación muestra alumnos procesados, en riesgo y % de riesgo")],
            "Manual", "Alta", "Cuenta Administrador",
            "Sistema procesa los archivos y reentrena el modelo del colegio"),
        esc(2, "Archivo inválido",
            "Un archivo que no es .xlsx/.xls, o que supera 20MB",
            "Intenta subirlo",
            "Sistema rechaza ese archivo puntual con el detalle del error, sin bloquear el resto",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador",
            [("Admin intenta subir un archivo que no es .xlsx/.xls, o que supera 20MB", "Aplicación rechaza ese archivo puntual con el detalle del error")],
            "Manual", "Media", "Cuenta Administrador",
            "Sistema no acepta un archivo fuera del formato o tamaño permitido"),
    ],
}

# HU030 -- Las "advertencias" son por hoja/archivo omitido, no por fila; ya
# se ve en el panel de Datos del colegio, no en una pantalla de "Detalle"
# separada.
REWRITE_HU["HU030"] = {
    "rol": "Administrador del Sistema",
    "quiere": "ver qué hojas o archivos se excluyeron al cargar los datos de mi colegio, y por qué",
    "para": "detectar y corregir el archivo problemático sin tener que adivinar qué falló",
    "esc": [
        esc(1, "Advertencias visibles",
            "La última carga omitió una o más hojas/archivos",
            "Revisa el panel de datos del colegio",
            "Sistema muestra la lista de hojas/archivos omitidos, con el motivo de cada uno",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador. La última carga omitió algo",
            [("Admin abre \"Datos\" tras una carga con omisiones", "Aplicación muestra la lista de hojas/archivos omitidos con su motivo")],
            "Automática", "Media", "Cuenta Administrador",
            "Sistema muestra qué se excluyó de la última carga y por qué"),
        esc(2, "Sin advertencias",
            "La carga se procesó sin omitir nada",
            "Revisa el panel de datos del colegio",
            "Sistema no muestra ningún bloque de advertencias (la ausencia de avisos es la confirmación implícita de que todo se procesó sin errores)",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador. La última carga no tuvo omisiones",
            [("Admin abre \"Datos\" tras una carga sin omisiones", "Aplicación no muestra ningún bloque de advertencias")],
            "Automática", "Baja", "Cuenta Administrador",
            "Sistema confirma implícitamente que todo se procesó sin errores"),
    ],
}

# HU032 -- No hay una pantalla de "Re-entrenar Modelo" separada de la carga
# de Excel: para colegio propio, subir el Excel ES entrenar (una sola
# acción atómica), automáticamente, sin un botón de "entrenar" aparte.
REWRITE_HU["HU032"] = {
    "rol": "Administrador del Sistema",
    "quiere": "que subir el Excel del colegio reentrene el modelo automáticamente, sin un paso manual aparte",
    "para": "no depender de un botón de \"entrenar\" separado que alguien pueda olvidar presionar",
    "esc": [
        esc(1, "Entrenamiento automático al cargar datos",
            "Archivos de notas/conducta válidos",
            "Sube el Excel (no hay una pantalla de \"Re-entrenar\" separada: el reentrenamiento es automático al cargar los datos)",
            "Sistema reentrena y registra la nueva versión en el histórico de reentrenamientos",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador. Archivos válidos",
            [("Admin sube el Excel de notas/conducta", "Aplicación reentrena el modelo en el mismo paso, sin un botón de \"entrenar\" separado"),
             ("Sistema termina de reentrenar", "Aplicación registra la nueva versión en el histórico de reentrenamientos")],
            "Automática", "Alta", "Cuenta Administrador, datos de entrenamiento válidos",
            "Sistema reentrena y deja constancia de la nueva versión del modelo"),
        esc(2, "Datos insuficientes",
            "Pocos registros para entrenar",
            "Sube el Excel igual",
            "Sistema reentrena igual, pero cae a modo descriptivo (menos preciso) y lo advierte en el dashboard, en vez de bloquear el reentrenamiento",
            "Administrador del Sistema",
            "La aplicacion esta instalada y operativa. Se esta loggeado como Administrador. Pocos alumnos en el Excel subido",
            [("Admin sube un Excel con pocos registros", "Aplicación reentrena igual, cae a modo descriptivo y lo advierte en el dashboard")],
            "Automática", "Media", "Cuenta Administrador",
            "Sistema no bloquea el reentrenamiento; lo degrada a modo descriptivo con aviso"),
    ],
}

print(f"HU a eliminar: {sorted(REMOVE_HU)}")
print(f"HU a reescribir: {len(REWRITE_HU)} -> {sorted(REWRITE_HU)}")

# ═══════════════════════════════════════════════════════════════════════════
# PARTE 1: HU + EPICAS
# ═══════════════════════════════════════════════════════════════════════════
wb_hu = openpyxl.load_workbook(HU_SRC)
ws_hu = wb_hu["HU"]


def leer_hus(ws):
    records = []
    row, cur = 3, None
    while row <= ws.max_row:
        id_val = ws.cell(row=row, column=2).value
        if id_val:
            cur = {"id": id_val, "rol": ws.cell(row=row, column=3).value,
                   "quiere": ws.cell(row=row, column=4).value,
                   "para": ws.cell(row=row, column=5).value, "esc": []}
            records.append(cur)
        esc_num = ws.cell(row=row, column=6).value
        if esc_num:
            cur["esc"].append({
                "num": esc_num, "nombre": ws.cell(row=row, column=7).value,
                "dado": ws.cell(row=row, column=8).value,
                "cuando": ws.cell(row=row, column=9).value,
                "entonces": ws.cell(row=row, column=10).value,
            })
        row += 1
    return records


hu_records_old = leer_hus(ws_hu)
assert len(hu_records_old) == 35, f"esperaba 35 HU en v1.6, hay {len(hu_records_old)}"
by_id_old = {r["id"]: r for r in hu_records_old}

epi_old = wb_hu["EPICAS"]
EPICA_ROWS = [(3, 10), (11, 13), (14, 20), (21, 24), (25, 28), (29, 32), (33, 37)]
epicas_old = []
for start, end in EPICA_ROWS:
    label = epi_old.cell(row=start, column=2).value
    obj = epi_old.cell(row=start, column=3).value
    hu_ids = [epi_old.cell(row=r, column=4).value for r in range(start, end + 1)]
    epicas_old.append({"label": label, "obj": obj, "hu_ids": hu_ids})

# Sanity check contra lo verificado antes de tocar nada.
assert epicas_old[0]["hu_ids"] == [f"HU{i:03d}" for i in range(1, 9)]
assert epicas_old[6]["hu_ids"] == [f"HU{i:03d}" for i in range(31, 36)]

final_epicas = []
for ep in epicas_old:
    kept = [h for h in ep["hu_ids"] if h not in REMOVE_HU]
    final_epicas.append({"label": ep["label"], "obj": ep["obj"], "hu_ids": kept})

old_to_new_hu = {}
final_hu_order = []  # [(new_id, record)]
counter = 1
for ep in final_epicas:
    for hid in ep["hu_ids"]:
        new_id = f"HU{counter:03d}"
        base = by_id_old[hid]
        if hid in REWRITE_HU:
            override = REWRITE_HU[hid]
            rec = {"id": hid, "rol": override["rol"], "quiere": override["quiere"],
                   "para": override["para"], "esc": override["esc"]}
        else:
            rec = base
        old_to_new_hu[hid] = new_id
        final_hu_order.append((new_id, rec))
        counter += 1

TOTAL_HU = counter - 1
print(f"HU finales: {TOTAL_HU}")
assert TOTAL_HU == 32, f"esperaba 32 HU finales (35 - 3), salieron {TOTAL_HU}"

# Reescribir hoja "HU"
for m in list(ws_hu.merged_cells.ranges):
    if m.min_row >= 3:
        ws_hu.unmerge_cells(str(m))
for row in ws_hu.iter_rows(min_row=3, max_row=ws_hu.max_row):
    for cell in row:
        cell.value = None

row = 3
for new_id, rec in final_hu_order:
    n_esc = len(rec["esc"])
    start_row = row
    ws_hu.cell(row=start_row, column=2).value = new_id
    ws_hu.cell(row=start_row, column=3).value = rec["rol"]
    ws_hu.cell(row=start_row, column=4).value = rec["quiere"]
    ws_hu.cell(row=start_row, column=5).value = rec["para"]
    if n_esc > 1:
        end_row = start_row + n_esc - 1
        for col in (2, 3, 4, 5):
            ws_hu.merge_cells(start_row=start_row, start_column=col, end_row=end_row, end_column=col)
    for i, e in enumerate(rec["esc"]):
        r = start_row + i
        ws_hu.cell(row=r, column=6).value = e["num"]
        ws_hu.cell(row=r, column=7).value = e["nombre"]
        ws_hu.cell(row=r, column=8).value = e["dado"]
        ws_hu.cell(row=r, column=9).value = e["cuando"]
        ws_hu.cell(row=r, column=10).value = e["entonces"]
    row = start_row + n_esc

print(f"HU sheet: filas 3..{row - 1}")

# Reescribir hoja "EPICAS"
for m in list(epi_old.merged_cells.ranges):
    epi_old.unmerge_cells(str(m))
for row_ in epi_old.iter_rows(min_row=3, max_row=epi_old.max_row):
    for cell in row_:
        cell.value = None

row = 3
for ep in final_epicas:
    n = len(ep["hu_ids"])
    start_row = row
    end_row = start_row + n - 1
    epi_old.cell(row=start_row, column=2).value = ep["label"]
    epi_old.cell(row=start_row, column=3).value = ep["obj"]
    if n > 1:
        epi_old.merge_cells(start_row=start_row, start_column=2, end_row=end_row, end_column=2)
        epi_old.merge_cells(start_row=start_row, start_column=3, end_row=end_row, end_column=3)
    for i, hid in enumerate(ep["hu_ids"]):
        epi_old.cell(row=start_row + i, column=4).value = old_to_new_hu[hid]
    row = end_row + 1

print(f"EPICAS: filas 3..{row - 1}")

wb_hu.save(HU_OUT_DL)
wb_hu.save(HU_OUT_REPO)
print("guardado:", HU_OUT_DL)

# Volcar el mapeo para que la parte de CP lo reutilice.
mapping_out = {"old_to_new_hu": old_to_new_hu, "remove_hu": sorted(REMOVE_HU)}
with open(r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\_hu_mapping_v3.json", "w", encoding="utf-8") as f:
    json.dump(mapping_out, f, ensure_ascii=False, indent=2)
print("mapeo guardado en docs/_hu_mapping_v3.json")

# ═══════════════════════════════════════════════════════════════════════════
# PARTE 2: LISTA CP + pestañas individuales
# ═══════════════════════════════════════════════════════════════════════════
wb_cp = openpyxl.load_workbook(CP_SRC)
lst = wb_cp["LISTA CP"]

cps_by_old_hu = {}
row = 3
while row <= lst.max_row:
    cp_id = lst.cell(row=row, column=2).value
    if cp_id:
        hu_id = lst.cell(row=row, column=4).value
        cps_by_old_hu.setdefault(hu_id, []).append({
            "old_id": cp_id, "descripcion": lst.cell(row=row, column=3).value,
            "numero": lst.cell(row=row, column=5).value, "nombre": lst.cell(row=row, column=6).value,
        })
    row += 1

total_old_cp = sum(len(v) for v in cps_by_old_hu.values())
assert total_old_cp == 76, f"esperaba 76 CP en v1.5, hay {total_old_cp}"

_CONJ = {
    "muestra": "muestre", "guarda": "guarde", "envía": "envíe", "envia": "envie",
    "actualiza": "actualice", "crea": "cree", "permanece": "permanezca",
    "mantiene": "mantenga", "reentrena": "reentrene", "omite": "omita",
    "reporta": "reporte", "rechaza": "rechace", "revierte": "revierta",
    "incluye": "incluya", "aplica": "aplique", "confirma": "confirme",
    "procesa": "procese", "genera": "genere", "deja": "deje", "impide": "impida",
    "recalcula": "recalcule", "lista": "liste", "informa": "informe",
    "entra": "entre", "no": "no",
}


def to_descripcion(entonces: str) -> str:
    m = re.match(r"^Sistema (\S+)(.*)$", entonces)
    if m:
        verb, rest = m.group(1), m.group(2)
        text = f"el sistema {_CONJ.get(verb, verb)}{rest}"
    else:
        text = entonces[0].lower() + entonces[1:]
    return "Validar que " + text


actions = []
counter = 1
for hu_num in range(1, TOTAL_HU + 1):
    new_hu_id = f"HU{hu_num:03d}"
    old_hid = next(h for h, n in old_to_new_hu.items() if n == new_hu_id)
    if old_hid in REWRITE_HU:
        rec = REWRITE_HU[old_hid]
        for e in rec["esc"]:
            new_cp_id = f"CP{counter:03d}"
            actions.append({
                "new_cp_id": new_cp_id, "new_hu_id": new_hu_id, "kind": "NEW",
                "numero": e["num"], "nombre": e["nombre"],
                "descripcion": to_descripcion(e["entonces"]),
                "content": e["cp"] | {"nombre": e["nombre"]},
            })
            counter += 1
    else:
        for cp in cps_by_old_hu[old_hid]:
            new_cp_id = f"CP{counter:03d}"
            actions.append({
                "new_cp_id": new_cp_id, "new_hu_id": new_hu_id, "kind": "COPY",
                "old_id": cp["old_id"], "descripcion": cp["descripcion"],
                "numero": cp["numero"], "nombre": cp["nombre"],
            })
            counter += 1

TOTAL_CP = counter - 1
print(f"CP finales: {TOTAL_CP}")

# Reescribir "LISTA CP"
for m in list(lst.merged_cells.ranges):
    if m.min_row >= 3:
        lst.unmerge_cells(str(m))
for row_ in lst.iter_rows(min_row=3, max_row=lst.max_row):
    for cell in row_:
        cell.value = None

for i, a in enumerate(actions):
    r = 3 + i
    lst.cell(row=r, column=2).value = a["new_cp_id"]
    lst.cell(row=r, column=3).value = a["descripcion"]
    lst.cell(row=r, column=4).value = a["new_hu_id"]
    lst.cell(row=r, column=5).value = a["numero"]
    lst.cell(row=r, column=6).value = a["nombre"]

# Reconstruir pestañas individuales
copy_actions = [a for a in actions if a["kind"] == "COPY"]
new_actions = [a for a in actions if a["kind"] == "NEW"]

for a in copy_actions:
    tmp_ws = wb_cp.copy_worksheet(wb_cp[a["old_id"]])
    tmp_ws.title = f"TMP_{a['old_id']}"

for name in list(wb_cp.sheetnames):
    if re.fullmatch(r"CP\d{3}", name):
        del wb_cp[name]

for a in copy_actions:
    ws = wb_cp[f"TMP_{a['old_id']}"]
    ws.title = a["new_cp_id"]
    old_prefix = f"Caso de Prueba: {a['old_id']}:"
    new_prefix = f"Caso de Prueba: {a['new_cp_id']}:"
    a1 = ws["A1"].value or ""
    assert a1.startswith(old_prefix), f"{a['old_id']}: encabezado inesperado: {a1!r}"
    ws["A1"].value = new_prefix + a1[len(old_prefix):]


def crear_pestana_cp(wb, nombre, contenido):
    ws_cp = wb.create_sheet(nombre)
    ws_cp["A1"] = f"Caso de Prueba: {nombre}: {contenido['nombre']}"
    ws_cp["A2"] = "Autor:"; ws_cp["B2"] = contenido["autor"]
    ws_cp["A3"] = f"Precondiciones: {contenido['precondiciones']}"
    ws_cp["A6"] = "#:"; ws_cp["B6"] = "Pasos:"; ws_cp["C6"] = "Resultados Esperados:"
    r = 7
    for i, (paso, resultado) in enumerate(contenido["pasos"], 1):
        ws_cp.cell(row=r, column=1).value = i
        ws_cp.cell(row=r, column=2).value = paso
        ws_cp.cell(row=r, column=3).value = resultado
        r += 1
    ws_cp.cell(row=r, column=1).value = "Tipo de ejecución:"; ws_cp.cell(row=r, column=2).value = contenido["tipo"]; r += 1
    ws_cp.cell(row=r, column=1).value = "Prioridad:"; ws_cp.cell(row=r, column=2).value = contenido["prioridad"]; r += 1
    ws_cp.cell(row=r, column=1).value = "Requerimientos"; ws_cp.cell(row=r, column=2).value = contenido["requerimientos"]; r += 1
    ws_cp.cell(row=r, column=1).value = f"Postcondiciones:\n{contenido['postcondiciones']}"
    return ws_cp


for a in new_actions:
    crear_pestana_cp(wb_cp, a["new_cp_id"], a["content"])

# Verificaciones finales
cp_sheet_names = sorted(n for n in wb_cp.sheetnames if re.fullmatch(r"CP\d{3}", n))
expected_names = sorted(a["new_cp_id"] for a in actions)
assert cp_sheet_names == expected_names, "las pestañas CP no cuadran con LISTA CP"
assert not any(n.startswith("TMP_") for n in wb_cp.sheetnames), "quedaron pestañas temporales sin renombrar"

# Cada HU final tiene tantos CP como escenarios.
hu_esc_count = {new_id: len(rec["esc"]) for new_id, rec in final_hu_order}
cp_count_by_hu = {}
for a in actions:
    cp_count_by_hu[a["new_hu_id"]] = cp_count_by_hu.get(a["new_hu_id"], 0) + 1
mismatches = [(hu, hu_esc_count[hu], cp_count_by_hu.get(hu, 0)) for hu in hu_esc_count if hu_esc_count[hu] != cp_count_by_hu.get(hu, 0)]
assert not mismatches, f"desbalance HU/CP: {mismatches}"

wb_cp.save(CP_OUT_DL)
wb_cp.save(CP_OUT_REPO)
print("guardado:", CP_OUT_DL)
print(f"Pestañas CP finales: {len(cp_sheet_names)}")
