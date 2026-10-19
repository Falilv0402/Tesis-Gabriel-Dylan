"""
seudonimos.py — Seudonimización de alumnos: el sistema NO guarda ni muestra nombres reales.

Cada alumno recibe un código estable por colegio ("Estudiante 000123"). El mismo alumno recibe siempre el mismo
código aunque suba otro Excel, cambie su número de lista o aparezca en archivos de distintos bimestres.

Qué se guarda y qué no:
  * El mapa (`colegio_{ie}_seudonimos.json`) solo contiene HMAC-SHA256 de (salón + nombre normalizado) → código.
    Nunca el nombre. La clave del HMAC sale de la variable de entorno SATRA_PSEUDONYM_KEY o, si no existe, de un
    archivo `.seudonimos.key` (modo 600) junto al mapa: sin ella, el mapa no permite adivinar nombres.
  * Los nombres reales solo existen en memoria durante la carga y en el "libro de claves" que se le entrega al
    colegio (código ↔ nombre); el servidor no lo conserva. Si se pierde, subir de nuevo el mismo Excel lo regenera
    con los mismos códigos.

Alumnos sin nombre en el Excel (algunos CUBICOL traen la columna vacía) se identifican por (salón, N.° de lista).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import unicodedata
from contextlib import contextmanager
from pathlib import Path

try:  # solo Linux/macOS (producción corre en Docker/Linux); en Windows el bloqueo es solo entre hilos
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None

PREFIJO = "Estudiante"
_PATRON_SEUDONIMO = re.compile(rf"^{PREFIJO} (\d{{6,}})$")
_PATRON_RESERVA = re.compile(r"^Alumno \d+$", re.IGNORECASE)   # el nombre de reserva del parser cuando la celda viene vacía
_hilos = threading.RLock()


def etiqueta(codigo: int) -> str:
    """12 → 'Estudiante 000012'."""
    return f"{PREFIJO} {int(codigo):06d}"


def codigo_de_etiqueta(texto) -> int | None:
    """'Estudiante 000012' → 12 (None si no es un seudónimo)."""
    m = _PATRON_SEUDONIMO.match(str(texto).strip()) if texto is not None else None
    return int(m.group(1)) if m else None


def es_seudonimo(texto) -> bool:
    return codigo_de_etiqueta(texto) is not None


def normalizar_nombre(texto) -> str:
    """'Bernal Montero, Fátima' y 'BERNAL MONTERO FATIMA' son la misma persona."""
    s = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


def _sin_nombre(nombre) -> bool:
    if nombre is None:
        return True
    n = str(nombre).strip()
    return n == "" or n.lower() in ("nan", "none") or bool(_PATRON_RESERVA.match(n))


def _clave_del_servidor(ruta_mapa: Path | None) -> bytes:
    env = os.environ.get("SATRA_PSEUDONYM_KEY", "").strip()
    if env:
        return env.encode("utf-8")
    if ruta_mapa is None:                       # sin disco (pruebas): clave solo para esta instancia
        return secrets.token_bytes(32)
    archivo = ruta_mapa.parent / ".seudonimos.key"
    if archivo.exists():
        return archivo.read_bytes().strip()
    clave = secrets.token_hex(32).encode()
    ruta_mapa.parent.mkdir(parents=True, exist_ok=True)
    archivo.write_bytes(clave)
    try:
        os.chmod(archivo, 0o600)
    except OSError:  # pragma: no cover (Windows)
        pass
    return clave


class Seudonimizador:
    """Mapa persistente (salón, alumno) → código. Úsalo siempre dentro de `with s.sesion():` cuando haya disco."""

    def __init__(self, ruta_mapa: str | Path | None = None, clave: bytes | None = None):
        self.ruta = Path(ruta_mapa) if ruta_mapa else None
        self._clave = clave or _clave_del_servidor(self.ruta)
        self._mapa: dict[str, int] = {}
        self._siguiente = 1
        self._sucio = False
        self._cargar()

    # ── persistencia ──────────────────────────────────────────────────────────
    def _cargar(self) -> None:
        if self.ruta and self.ruta.exists():
            datos = json.loads(self.ruta.read_text(encoding="utf-8"))
            self._mapa = {str(k): int(v) for k, v in datos.get("mapa", {}).items()}
            self._siguiente = max(int(datos.get("siguiente", 1)), 1 + max(self._mapa.values(), default=0))
        else:
            self._mapa, self._siguiente = {}, 1
        self._sucio = False

    def guardar(self) -> None:
        if not self.ruta or not self._sucio:
            return
        self.ruta.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.ruta.with_suffix(".json.tmp")
        tmp.write_text(json.dumps({"version": 1, "siguiente": self._siguiente, "mapa": self._mapa}, indent=0), encoding="utf-8")
        os.replace(tmp, self.ruta)
        self._sucio = False

    @contextmanager
    def sesion(self):
        """Bloquea el mapa (entre hilos y entre procesos), lo relee del disco y lo guarda al terminar. Así dos cargas
        simultáneas del mismo colegio no se pisan ni reparten el mismo código a dos alumnos."""
        with _hilos:
            lock = None
            if self.ruta and fcntl is not None:
                self.ruta.parent.mkdir(parents=True, exist_ok=True)
                lock = open(self.ruta.with_suffix(".lock"), "a+")
                fcntl.flock(lock, fcntl.LOCK_EX)
            try:
                self._cargar()
                yield self
                self.guardar()
            finally:
                if lock is not None:
                    fcntl.flock(lock, fcntl.LOCK_UN)
                    lock.close()

    # ── código por alumno ─────────────────────────────────────────────────────
    def _hash(self, salon, material: str) -> str:
        return hmac.new(self._clave, f"{salon}|{material}".encode("utf-8"), hashlib.sha256).hexdigest()[:32]

    def codigo(self, nombre, salon, n_lista) -> int:
        existente = codigo_de_etiqueta(nombre)
        if existente is not None:                       # ya viene seudonimizado (archivo anonimizado antes)
            if existente >= self._siguiente:
                self._siguiente, self._sucio = existente + 1, True
            return existente
        material = f"#{int(n_lista)}" if _sin_nombre(nombre) else normalizar_nombre(nombre)
        h = self._hash(salon, material)
        if h not in self._mapa:
            self._mapa[h] = self._siguiente
            self._siguiente += 1
            self._sucio = True
        return self._mapa[h]

    def seudonimo(self, nombre, salon, n_lista) -> str:
        return etiqueta(self.codigo(nombre, salon, n_lista))

    def aplicar(self, salones, numeros, nombres) -> list[str]:
        """Versión por columnas (listas o Series) para el DataFrame del colegio."""
        return [self.seudonimo(nom, sal, n) for sal, n, nom in zip(salones, numeros, nombres)]

    @property
    def total(self) -> int:
        return len(self._mapa)
