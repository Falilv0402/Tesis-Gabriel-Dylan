"""
parse_excels.py — ETL para archivos de notas/conducta del sistema CUBICOL Académico.
Convierte los Excel del colegio en un DataFrame limpio con features por estudiante.

Uso:
    from modelo.colegio.parse_excels import procesar_colegio
    df = procesar_colegio(carpeta=".", codigo_ie="0249")
"""

from __future__ import annotations
import re
from pathlib import Path
import numpy as np
import pandas as pd

# ─── Conversión de notas literales a numéricas ────────────────────────────────
LITERAL_MAP = {"AD": 18.5, "A": 16.0, "B": 13.0, "C": 10.0}

def literal_a_num(val) -> float | None:
    if pd.isna(val):
        return None
    s = str(val).strip().upper()
    return LITERAL_MAP.get(s, None)


# ─── Asignaturas clave que necesita el modelo ─────────────────────────────────
# (col_start, nombre_clave) — col donde empieza la asignatura en el Excel
ASIGNATURAS_OBJETIVO = {
    "MATEMÁTICA":    "matematica",
    "COMUNICACIÓN":  "comunicacion",
    "CIENCIA, TECNOLOGÍA Y AMBIENTE": "cta",
    "LENGUAJE":      "lenguaje",       # primaria
    "LÓGICO MATEMÁTICA": "mat_prim",   # primaria alternativo
}


# ─── Parser principal de notas ────────────────────────────────────────────────

def _parse_notas_sheet(path: Path, sheet: str, salon: str) -> pd.DataFrame:
    """
    Lee una hoja de un Excel de notas CUBICOL y devuelve un DataFrame con
    una fila por alumno, con las columnas pp_{asignatura} y bim{1..4}_{asignatura}.
    """
    df_raw = pd.read_excel(path, sheet_name=sheet, header=None, dtype=str)

    # ── Detectar fila de nombres de asignaturas (row 5 usualmente) ────────────
    subject_row_idx = None
    for i in range(min(10, len(df_raw))):
        row = df_raw.iloc[i].fillna("").str.upper()
        if row.str.contains("MATEM").any() or row.str.contains("COMUNICACI").any():
            subject_row_idx = i
            break
    if subject_row_idx is None:
        raise ValueError(f"No encontré fila de asignaturas en {path.name}")

    subject_row = df_raw.iloc[subject_row_idx].fillna("")
    period_row  = df_raw.iloc[subject_row_idx + 2].fillna("")  # N°, APELLIDOS, C1, C2..., PP

    # ── Mapear columna → (asignatura_clave, es_pp) ───────────────────────────
    current_subject_key = None
    col_map: dict[int, tuple[str, bool]] = {}  # col → (key, is_pp)

    for col_i, subj_val in subject_row.items():
        subj_upper = str(subj_val).strip().upper()
        for pattern, key in ASIGNATURAS_OBJETIVO.items():
            if pattern in subj_upper:
                current_subject_key = key
                break

        if current_subject_key:
            period_val = str(period_row.get(col_i, "")).strip().upper()
            if period_val == "PP":
                col_map[col_i] = (current_subject_key, True)
            elif period_val.startswith("C"):
                col_map[col_i] = (current_subject_key, False)

    # ── Detectar fila de inicio de datos (después del header N°/APELLIDOS) ───
    data_start_idx = subject_row_idx + 3
    # Buscar primera fila con número de alumno en col 0
    for i in range(data_start_idx, min(data_start_idx + 10, len(df_raw))):
        val = str(df_raw.iloc[i, 0]).strip()
        if val.isdigit():
            data_start_idx = i
            break

    # ── Leer datos de alumnos ─────────────────────────────────────────────────
    # Cada alumno ocupa 5 filas: bim1, bim2, bim3, bim4, PP
    registros: list[dict] = []
    i = data_start_idx

    while i < len(df_raw):
        num_val = str(df_raw.iloc[i, 0]).strip()
        if not num_val.isdigit():
            i += 1
            continue

        n_alumno = int(num_val)
        nombre   = str(df_raw.iloc[i, 1]).strip() if pd.notna(df_raw.iloc[i, 1]) else f"Alumno {n_alumno}"

        # Leer las 5 filas del alumno (puede haber menos al final)
        block = df_raw.iloc[i : i + 5]

        record: dict = {
            "n_alumno":   n_alumno,
            "nombre":     nombre,
            "salon":      salon,
        }

        # Extraer valores por bimestre y PP para cada asignatura objetivo
        subj_bims: dict[str, list[float | None]] = {k: [] for k in ASIGNATURAS_OBJETIVO.values()}
        subj_pp:   dict[str, float | None]       = {k: None for k in ASIGNATURAS_OBJETIVO.values()}

        period_col = 3  # col que tiene "1°", "2°", "3°", "4°", "PP"
        for row_j in range(len(block)):
            period_label = str(block.iloc[row_j, period_col]).strip().upper()
            is_pp        = period_label == "PP"

            for col_i, (key, col_is_pp) in col_map.items():
                if col_i >= len(block.columns):
                    continue
                raw_val = block.iloc[row_j, col_i]
                num_val2 = literal_a_num(raw_val)
                if num_val2 is None:
                    continue
                if is_pp and col_is_pp:
                    subj_pp[key] = num_val2
                elif not is_pp and not col_is_pp:
                    subj_bims[key].append(num_val2)

        for key in ASIGNATURAS_OBJETIVO.values():
            record[f"pp_{key}"] = subj_pp.get(key)
            bims = subj_bims.get(key, [])
            for b_i, b_val in enumerate(bims[:4], start=1):
                record[f"b{b_i}_{key}"] = b_val
            # Tendencia: último bimestre - primero
            if len(bims) >= 2:
                record[f"tendencia_{key}"] = bims[-1] - bims[0]
            else:
                record[f"tendencia_{key}"] = None

        registros.append(record)
        i += 5  # saltar al siguiente alumno

    return pd.DataFrame(registros)


# ─── Parser de conducta ───────────────────────────────────────────────────────

def _detect_salon_from_content(df_raw: pd.DataFrame) -> str:
    """Detecta el salón buscando 'Salón:' en el contenido del Excel."""
    for i in range(min(10, len(df_raw))):
        for j in range(min(5, len(df_raw.columns))):
            val = str(df_raw.iloc[i, j]).strip().upper()
            if "SAL" in val and "N:" in val.replace("Ó", "O").replace("Ô", "O"):
                # Buscar el valor en la siguiente celda o misma fila
                for k in range(j+1, min(j+4, len(df_raw.columns))):
                    salon_val = str(df_raw.iloc[i, k]).strip()
                    if salon_val and salon_val != "nan":
                        return _inferir_salon(salon_val)
    return "?"


def _parse_conducta_sheet(path: Path, sheet: str = None) -> pd.DataFrame:
    """
    Lee un Excel de conducta CUBICOL y devuelve n_alumno + conducta por bimestre.
    Detecta el salón desde el CONTENIDO (no del nombre de hoja).
    """
    df_raw = pd.read_excel(path, sheet_name=sheet, header=None, dtype=str)

    # Detectar fila de datos (primera con número en col 0)
    data_start = None
    for i in range(len(df_raw)):
        val = str(df_raw.iloc[i, 0]).strip()
        if val.isdigit():
            data_start = i
            break
    if data_start is None:
        return pd.DataFrame()

    # Detectar columnas de bimestre (buscar "1ER BIMESTRE" etc.)
    header_row = df_raw.iloc[data_start - 1].fillna("").str.upper()
    bim_cols   = {}
    for col_i, val in header_row.items():
        if "1ER" in val or "1°" in val:   bim_cols["b1_conducta"] = col_i
        elif "2DO" in val or "2°" in val: bim_cols["b2_conducta"] = col_i
        elif "3ER" in val or "3°" in val: bim_cols["b3_conducta"] = col_i
        elif "4TO" in val or "4°" in val: bim_cols["b4_conducta"] = col_i

    if not bim_cols:
        # Fallback: columnas 5,6,8,9 (estructura típica CUBICOL)
        bim_cols = {"b1_conducta": 5, "b2_conducta": 6, "b3_conducta": 8, "b4_conducta": 9}

    registros = []
    for i in range(data_start, len(df_raw)):
        num_val = str(df_raw.iloc[i, 0]).strip()
        if not num_val.isdigit():
            continue
        record = {"n_alumno": int(num_val)}
        bims_num = []
        for key, col_i in bim_cols.items():
            v = literal_a_num(df_raw.iloc[i, col_i]) if col_i < len(df_raw.columns) else None
            record[key] = v
            if v is not None:
                bims_num.append(v)
        record["conducta_promedio"] = float(np.mean(bims_num)) if bims_num else None
        registros.append(record)

    return pd.DataFrame(registros)


# ─── Función pública principal ────────────────────────────────────────────────

def procesar_colegio(carpeta: str | Path, codigo_ie: str) -> pd.DataFrame:
    """
    Procesa todos los Excel de la carpeta y devuelve un DataFrame consolidado.
    Detecta automáticamente archivos con "Notas" y "Conducta" en el nombre.

    Returns:
        DataFrame con columnas: n_alumno, nombre, salon, codigo_ie,
        pp_matematica, pp_comunicacion, pp_cta, conducta_promedio,
        tendencia_*, n_materias_c, riesgo (target), riesgo_score
    """
    carpeta = Path(carpeta)

    # ── Detectar archivos ─────────────────────────────────────────────────────
    notas_files    = sorted(carpeta.glob("*Notas*.xlsx"))
    conducta_files = sorted(carpeta.glob("*Conducta*.xlsx"))

    if not notas_files:
        raise FileNotFoundError(f"No se encontraron archivos de notas en {carpeta}")

    # ── Extraer nombre del colegio de la primera fila del primer Excel ────────
    nombre_colegio = "Colegio"
    try:
        df_header = pd.read_excel(notas_files[0], header=None, nrows=2, dtype=str)
        val = str(df_header.iloc[0, 0]).strip()
        if val and val.lower() not in ["nan", "none", ""]:
            nombre_colegio = val.title()  # "JOSEPH AND MERY" → "Joseph And Mery"
    except Exception:
        pass

    # ── Parsear cada sección ──────────────────────────────────────────────────
    dfs_notas    = []
    dfs_conducta = []

    for nf in notas_files:
        try:
            xl = pd.ExcelFile(nf)
            # Leer TODAS las hojas con datos (ignorar hojas vacías o "Worksheet")
            hojas_validas = [
                s for s in xl.sheet_names
                if "worksheet" not in s.lower()
                and len(pd.read_excel(nf, sheet_name=s, header=None, nrows=3)) > 0
            ]
            for sheet in hojas_validas:
                # Normalizar: S5A→5A, S5B→5B, P6A→P6A, P6B→P6B
                salon = _normalizar_salon(sheet.strip().upper())
                df_n = _parse_notas_sheet(nf, sheet, salon)
                if len(df_n) < 5:
                    # Hoja con muy pocos alumnos — skip (datos incompletos)
                    print(f"  SKIP Notas {nf.name} [{sheet}]: solo {len(df_n)} alumnos (incompleto)")
                    continue
                df_n["sheet"] = sheet
                dfs_notas.append(df_n)
                print(f"  OK Notas {nf.name} [{sheet}]: {len(df_n)} alumnos, salon={salon}")
        except Exception as e:
            print(f"  ERROR en {nf.name}: {e}")

    for cf in conducta_files:
        try:
            xl = pd.ExcelFile(cf)
            hojas_validas = [
                s for s in xl.sheet_names
                if "worksheet" not in s.lower()
                and len(pd.read_excel(cf, sheet_name=s, header=None, nrows=3)) > 0
            ]
            for sheet in hojas_validas:
                df_c = _parse_conducta_sheet(cf, sheet)
                # Detectar el salón desde el contenido (más fiable que el nombre de hoja)
                df_raw_tmp = pd.read_excel(cf, sheet_name=sheet, header=None, dtype=str, nrows=10)
                salon = _detect_salon_from_content(df_raw_tmp)
                df_c["salon"] = salon
                dfs_conducta.append(df_c)
                print(f"  OK Conducta {cf.name} [{sheet}]: {len(df_c)} alumnos, salon={salon}")
        except Exception as e:
            print(f"  ERROR en {cf.name}: {e}")

    if not dfs_notas:
        raise RuntimeError("No se pudo parsear ningún archivo de notas.")

    # ── Unir notas + deduplicar por (salon, n_alumno) ────────────────────────
    df_notas = pd.concat(dfs_notas, ignore_index=True)
    before = len(df_notas)
    df_notas = df_notas.drop_duplicates(subset=["salon", "n_alumno"], keep="first")
    if len(df_notas) < before:
        print(f"  Deduplicados {before - len(df_notas)} registros duplicados")

    # ── Unir conducta ─────────────────────────────────────────────────────────
    if dfs_conducta:
        df_cond = pd.concat(dfs_conducta, ignore_index=True)
        df = df_notas.merge(df_cond[["n_alumno", "salon", "conducta_promedio"]],
                             on=["n_alumno", "salon"], how="left")
    else:
        df = df_notas.copy()
        df["conducta_promedio"] = None

    # ── Features derivadas ────────────────────────────────────────────────────
    # Número de materias clave con PP = C (≤13)
    materias_pp = [c for c in df.columns if c.startswith("pp_")]
    def n_materias_c(row):
        return sum(1 for c in materias_pp if pd.notna(row.get(c)) and row[c] <= 13.0)
    df["n_materias_c"] = df.apply(n_materias_c, axis=1)

    # Promedio de materias clave
    df["promedio_materias"] = df[materias_pp].mean(axis=1)

    # ── Target: riesgo académico ──────────────────────────────────────────────
    # En riesgo si tiene C (≤13) en Matemática O Comunicación
    mat_col  = next((c for c in ["pp_matematica", "pp_mat_prim"] if c in df.columns), None)
    com_col  = next((c for c in ["pp_comunicacion", "pp_lenguaje"] if c in df.columns), None)

    def calcular_riesgo(row):
        mat = row.get(mat_col) if mat_col else None
        com = row.get(com_col) if com_col else None
        if pd.notna(mat) and mat <= 13.0: return 1
        if pd.notna(com) and com <= 13.0: return 1
        return 0

    def calcular_score(row):
        # Score continuo 0-1 para ranking
        mat = row.get(mat_col) if mat_col else None
        com = row.get(com_col) if com_col else None
        cta = row.get("pp_cta")
        vals = [v for v in [mat, com, cta] if pd.notna(v)]
        if not vals:
            return 0.5
        promedio = np.mean(vals)
        # Invertir y normalizar: 10→1.0 (máximo riesgo), 18.5→0.0 (mínimo riesgo)
        score = max(0.0, min(1.0, (18.5 - promedio) / (18.5 - 10.0)))
        return round(float(score), 4)

    df["riesgo"]       = df.apply(calcular_riesgo, axis=1)
    df["riesgo_score"] = df.apply(calcular_score, axis=1)
    df["codigo_ie"]    = codigo_ie

    # ── Nivel de riesgo ───────────────────────────────────────────────────────
    def nivel_riesgo(score):
        if score >= 0.65: return "ALTO"
        if score >= 0.40: return "MEDIO"
        return "BAJO"
    df["nivel_riesgo"]    = df["riesgo_score"].apply(nivel_riesgo)
    df["nombre_colegio"]  = nombre_colegio

    df = df.sort_values("riesgo_score", ascending=False).reset_index(drop=True)

    print(f"\n  Total alumnos procesados: {len(df)}")
    print(f"  En riesgo (Matemática o Comunicación con C): {df['riesgo'].sum()}")
    print(f"  Distribución: ALTO={len(df[df.nivel_riesgo=='ALTO'])} "
          f"MEDIO={len(df[df.nivel_riesgo=='MEDIO'])} "
          f"BAJO={len(df[df.nivel_riesgo=='BAJO'])}")
    return df


# ─── Utilidades internas ──────────────────────────────────────────────────────

def _normalizar_salon(salon: str) -> str:
    """S5A→5A, S5B→5B, P6A→P6A (primaria mantiene P), 5A→5A."""
    s = salon.strip().upper()
    # Si empieza con S seguido de número → secundaria, quitar la S
    import re as _re
    if _re.match(r'^S\d', s):
        return s[1:]
    # Si empieza con P seguido de número → primaria, mantener
    return s


def _inferir_salon(nombre_base: str) -> str:
    """
    Convierte 'Quinto año A' → '5A', 'Sexto grado primaria B' → 'P6B', etc.
    """
    n = nombre_base.upper()
    if "PRIMERO"  in n or "1ER"  in n: grado = "1"
    elif "SEGUNDO" in n or "2DO"  in n: grado = "2"
    elif "TERCERO" in n or "3ER"  in n: grado = "3"
    elif "CUARTO"  in n or "4TO"  in n: grado = "4"
    elif "QUINTO"  in n or "5TO"  in n: grado = "5"
    elif "SEXTO"   in n or "6TO"  in n: grado = "6"
    elif "SÉTIMO"  in n or "7MO"  in n: grado = "7"
    else:
        m = re.search(r"\d+", nombre_base)
        grado = m.group() if m else "?"

    # Detectar sección: buscar la última letra suelta al final del nombre
    seccion = "A"
    # Limpiar el nombre base (quitar "PRIMARIA", "AÑO", "GRADO", etc.)
    clean = re.sub(r"(PRIMARIA|SECUNDARIA|GRADO|AÑO|ANO|QUINTO|SEXTO|CUARTO|TERCERO|SEGUNDO|PRIMERO)", "", n)
    m_sec = re.search(r"\b([A-E])\b\s*$", clean.strip())
    if m_sec:
        seccion = m_sec.group(1)

    prefijo = "P" if "PRIMARIA" in n or "GRADO" in n else ""
    return f"{prefijo}{grado}{seccion}"
