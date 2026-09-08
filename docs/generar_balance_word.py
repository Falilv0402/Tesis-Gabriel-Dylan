# -*- coding: utf-8 -*-
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

NAVY = RGBColor(0x0F, 0x1F, 0x3D)
ACCENT = RGBColor(0x25, 0x63, 0xEB)
GREEN = RGBColor(0x16, 0xA3, 0x4A)
AMBER = RGBColor(0xD9, 0x77, 0x06)
RED = RGBColor(0xDC, 0x26, 0x26)
GRAY = RGBColor(0x5A, 0x6A, 0x85)

doc = Document()

# ── Estilos base ─────────────────────────────────────────────
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)
style.font.color.rgb = RGBColor(0x1A, 0x25, 0x40)

for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.3)
    section.right_margin = Cm(2.3)


def set_cell_shading(cell, color_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:fill'), color_hex)
    tcPr.append(shd)


def add_title(text, size=26, color=NAVY, space_after=4):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(size)
    run.font.color.rgb = color
    p.paragraph_format.space_after = Pt(space_after)
    return p


def add_heading2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(15)
    run.font.color.rgb = NAVY
    # Regla inferior sutil
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '4')
    bottom.set(qn('w:color'), '2563EB')
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p


def add_body(text, size=11, color=RGBColor(0x1A,0x25,0x40), bold=False, italic=False, space_after=8):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.bold = bold
    run.italic = italic
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.18
    return p


def add_bullet(text, bold_lead=None):
    p = doc.add_paragraph(style="List Bullet")
    if bold_lead:
        r1 = p.add_run(bold_lead)
        r1.bold = True
        r1.font.color.rgb = NAVY
        r2 = p.add_run(text)
    else:
        r2 = p.add_run(text)
    r2.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.15
    return p


def add_num(text, bold_lead=None):
    p = doc.add_paragraph(style="List Number")
    if bold_lead:
        r1 = p.add_run(bold_lead)
        r1.bold = True
        r1.font.color.rgb = NAVY
        r2 = p.add_run(text)
    else:
        r2 = p.add_run(text)
    r2.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.15
    return p


# ── Portada / encabezado ─────────────────────────────────────
add_title("Balance de SATRA", size=28)
sub = doc.add_paragraph()
run = sub.add_run("Para Gabriel y Dylan — cómo va todo y qué sigue")
run.font.size = Pt(13)
run.font.color.rgb = GRAY
run.italic = True
sub.paragraph_format.space_after = Pt(4)

fecha = doc.add_paragraph()
r = fecha.add_run("Septiembre 2026")
r.font.size = Pt(10)
r.font.color.rgb = GRAY
fecha.paragraph_format.space_after = Pt(16)

# ── Intro ─────────────────────────────────────────────────────
add_body(
    "Hola, chicos. Les dejo por escrito un resumen de cómo está quedando SATRA, para que lo tengan "
    "a mano sin depender del chat. Traté de ser bien directo: qué está listo, qué quedó a medias y por qué, "
    "y qué haría yo primero si estuviera en su lugar de acá a la sustentación."
)

# ── Balance numérico ──────────────────────────────────────────
add_heading2("El número en corto: 31 de 36")

add_body(
    "De las 36 historias de usuario originales, 31 están implementadas y funcionando en producción, "
    "4 están parciales (por una razón de fondo que les explico abajo, no por descuido), y 1 queda "
    "pendiente de que decidan algo ustedes."
)

table = doc.add_table(rows=1, cols=3)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.style = "Table Grid"
hdr = table.rows[0].cells
headers = ["Estado", "Cantidad", "¿Qué significa?"]
for i, h in enumerate(headers):
    hdr[i].text = ""
    p = hdr[i].paragraphs[0]
    r = p.add_run(h)
    r.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    r.font.size = Pt(10.5)
    set_cell_shading(hdr[i], "0F1F3D")

rows_data = [
    ("Implementadas", "31", "Funcionando en producción, probadas y desplegadas"),
    ("Parciales", "4", "Completas en el modelo EM2022, reducidas en el de colegio propio (a propósito)"),
    ("Pendiente", "1", "HU030 (actualización periódica) — les toca decidir a ustedes si se hace o se retira"),
]
for estado, cant, desc in rows_data:
    row = table.add_row().cells
    row[0].text = estado
    row[1].text = cant
    row[2].text = desc
    row[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    for c in row:
        for p in c.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10.5)

doc.add_paragraph().paragraph_format.space_after = Pt(4)

add_body(
    "Por épica, todo está parejo y sano, menos Gestión de Datos y Mantenimiento del Modelo ML, que es "
    "justo donde viven las 4 parciales y la 1 pendiente. Fuera de esas dos, no hay deuda pendiente real."
)

# ── Las 4 parciales ────────────────────────────────────────────
add_heading2("Las 4 que quedaron parciales — y por qué no las forzaría")

add_body(
    "Todas comparten la misma causa: el modelo nacional (EM2022) tiene un pipeline de interpretabilidad "
    "bien pesado — SHAP, análisis de equidad, pruebas estadísticas formales — pero el modelo de cada "
    "colegio no lo tiene al mismo nivel. Y no es que falte trabajarlo: es que con 30 a 300 alumnos por "
    "colegio, esas técnicas no producen resultados confiables. Es una limitación de tamaño de muestra, "
    "no de esfuerzo."
)

add_bullet(
    " Por qué está el alumno en riesgo (HU012) y qué variables pesan más en el modelo global (HU035): "
    "completo en EM2022 con SHAP; en colegio propio se explica con el desglose de notas por área, que "
    "funciona bien mostrado en el dashboard, pero no cuantifica la contribución de cada factor.",
    bold_lead="Explicación por factores. "
)
add_bullet(
    " el modelo de colegio propio hoy solo separa por ALTO/MEDIO/BAJO, no por un tipo específico "
    "de riesgo (lectura, matemática, contexto). Se podría agregar si les interesa.",
    bold_lead="Segmentar por tipo de riesgo (HU022): "
)
add_bullet(
    " se puede mover el umbral de corte ALTO/MEDIO, pero no los hiperparámetros del algoritmo "
    "(cuántos árboles, regularización, etc.). Fue decisión mía a propósito: exponer eso a alguien sin "
    "formación en ML es más riesgo que beneficio — un valor mal puesto puede arruinar el modelo sin que "
    "se note hasta después.",
    bold_lead="Ajustar parámetros del modelo (HU033): "
)

add_body(
    "Mi plan es no meterle más tiempo a estas 4 antes de la sustentación. El argumento metodológico ya "
    "quedó redactado y defendible en la documentación de tesis — insistir en sacar SHAP o fairness con "
    "muestras tan chicas produciría números que parecen rigurosos pero no lo son, y eso sí sería un "
    "problema si el jurado pregunta.",
    italic=True,
)

# ── Lo que avanzamos ────────────────────────────────────────────
add_heading2("Lo que se cerró en esta ronda de trabajo")

add_bullet(" backend en Hetzner con Docker, dominio propio, HTTPS automático, frontend en Vercel.", bold_lead="Despliegue completo en producción. ")
add_bullet(" Joseph & Mary más 3 colegios nuevos (La Perla, Trapiche, La Victoria), cada uno con su propio modelo entrenado y funcionando.", bold_lead="4 colegios reales. ")
add_bullet(" auto-logout, auditoría con filtros, cambio de rol, alertas automáticas por correo, historial de reentrenamientos con gráfico.", bold_lead="Historias de usuario cerradas. ")
add_bullet(" director y coordinador ahora también pueden cargar el Excel de su propio colegio (antes solo superadmin).", bold_lead="Carga de datos ampliada. ")
add_bullet(" banner de \"qué necesita tu atención hoy\" al inicio de los dashboards, con los casos más urgentes a un clic de distancia, más un sistema visual más moderno en toda la app.", bold_lead="Rediseño de UI. ")
add_bullet(" cuando alguien anota algo o agenda un hito de seguimiento, los demás directores/coordinadores del mismo colegio se enteran, en tiempo real, sin recargar.", bold_lead="Notificaciones entre compañeros de colegio. ")
add_bullet(" headers de protección contra clickjacking, límite de tamaño y tipo en los archivos que se suben, favicon con el logo real, y la documentación de tesis reescrita para defender el modelo correcto (el híbrido de colegio propio, no el nacional).", bold_lead="Seguridad y documentación. ")

# ── Qué sigue ──────────────────────────────────────────────────
add_heading2("Lo que sigue de mi lado")

add_body(
    "Todo esto lo voy manejando yo directamente, así que no es algo que les toque a ustedes — solo "
    "les cuento para que sepan por dónde viene el resto:"
)

add_bullet(
    " un par de ajustes que quedan pendientes en la base de datos (nada que se note desde "
    "la app, es configuración interna) para que el histórico de reentrenamientos y las notificaciones "
    "nuevas queden con datos.",
    bold_lead="Voy a terminar de aplicar. "
)
add_bullet(
    " el hosting de la base de datos corre en un plan gratuito que se pausa solo "
    "por inactividad — eso fue justo lo que rompió el login hace poco. Voy a revisar si conviene pasar "
    "a un plan pago antes de la sustentación, para que no vuelva a pasar justo ese día.",
    bold_lead="Voy a asegurarme de que no se vuelva a caer antes de la sustentación. "
)
add_bullet(
    " con cada tipo de cuenta (superadmin, admin, director, coordinador) antes de "
    "que la vean ustedes o el jurado, sobre todo lo que se agregó más reciente (notificaciones, carga "
    "de Excel para director/coordinador).",
    bold_lead="Voy a probar la app de punta a punta. "
)
add_bullet(
    " (una funcionalidad menor, actualización automática periódica) que todavía "
    "no decidí si vale la pena — se las cuento cuando lo tenga más claro, no bloquea nada más.",
    bold_lead="Me falta decidir qué hacer con un tema chico. "
)
add_bullet(
    " por buenas prácticas, nada urgente.",
    bold_lead="Y de seguridad, voy a rotar una credencial de correo por una más restringida. "
)

add_body(
    "En corto: lo que queda es asegurarme de que todo lo que ya construí funcione sin sorpresas el "
    "día de la sustentación, más que seguir metiéndole funcionalidad nueva. Para lo que la tesis "
    "necesita defender, el sistema ya está.",
    bold=True,
    space_after=4,
)

doc.add_paragraph().paragraph_format.space_after = Pt(2)
cierre = doc.add_paragraph()
r = cierre.add_run("Cualquier duda me dicen y las conversamos.")
r.italic = True
r.font.color.rgb = GRAY
r.font.size = Pt(10.5)

OUT = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\word\Balance_SATRA_Gabriel_Dylan.docx"
doc.save(OUT)
print("saved:", OUT)
