"""
borrar_usuarios_prueba.py — Borra todas las cuentas de prueba (Director /
Coordinador) registradas hasta ahora, dejando intactas las cuentas
admin/superadmin (para no perder el acceso al sistema).

Usa la Admin API de Supabase Auth (no un DELETE directo sobre auth.users) --
así se limpia correctamente todo lo interno de Auth (sesiones, tokens,
identities), y el borrado en cascada de "profiles" (ON DELETE CASCADE desde
auth.users) se encarga de lo demás automáticamente. Las tablas que referencian
profiles.id ya están definidas con ON DELETE SET NULL o CASCADE (ver
migraciones 0001-0013), así que no hace falta tocarlas a mano.

Solo usa la librería estándar de Python -- no necesita "pip install" nada.

Requiere las credenciales del proyecto como variables de entorno --
NUNCA las escribas en este archivo ni las pegues en el chat:
    SUPABASE_URL               (ej. https://xxxx.supabase.co)
    SUPABASE_SERVICE_ROLE_KEY  (Project Settings > API > service_role,
                                 NO la anon key -- esta sí puede todo)

Uso (PowerShell):
    # 1) Modo de prueba (no borra nada, solo muestra el plan):
    $env:SUPABASE_URL = "https://xxxx.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
    python scripts/borrar_usuarios_prueba.py

    # 2) Cuando el plan se vea correcto, borra de verdad:
    python scripts/borrar_usuarios_prueba.py --confirmar
"""
import json
import os
import sys
import urllib.error
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

ROLES_A_CONSERVAR = {"admin", "superadmin"}


def _request(method: str, url: str) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def main() -> None:
    if not SUPABASE_URL or not SERVICE_KEY:
        print("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.")
        print("Ver el docstring de este archivo para de dónde sacarlas.")
        sys.exit(1)

    confirmar = "--confirmar" in sys.argv

    # 1) Leer todos los perfiles (la service_role key bypasea RLS)
    status, body = _request("GET", f"{SUPABASE_URL}/rest/v1/profiles?select=id,email,nombre,rol")
    if status != 200:
        print(f"No se pudo leer 'profiles' (HTTP {status}): {body[:300]}")
        sys.exit(1)
    perfiles = json.loads(body)

    a_conservar = [p for p in perfiles if p.get("rol") in ROLES_A_CONSERVAR]
    a_borrar    = [p for p in perfiles if p.get("rol") not in ROLES_A_CONSERVAR]

    print(f"Total de cuentas encontradas: {len(perfiles)}")
    print(f"\nSe CONSERVAN ({len(a_conservar)}) -- admin/superadmin:")
    for p in a_conservar:
        print(f"   {p.get('email',''):40s} {p.get('rol',''):12s} {p.get('nombre') or ''}")

    print(f"\nSe {'BORRARÁN' if confirmar else 'BORRARÍAN'} ({len(a_borrar)}):")
    for p in a_borrar:
        print(f"   {p.get('email',''):40s} {p.get('rol',''):12s} {p.get('nombre') or ''}")

    if not a_borrar:
        print("\nNada que borrar.")
        return

    if not confirmar:
        print(f"\nEsto fue solo una simulación -- no se borró nada.")
        print(f"Si el plan de arriba se ve correcto, corre de nuevo con --confirmar.")
        return

    print(f"\nBorrando {len(a_borrar)} cuenta(s)...")
    ok, fallidos = 0, []
    for p in a_borrar:
        uid = p["id"]
        status, body = _request("DELETE", f"{SUPABASE_URL}/auth/v1/admin/users/{uid}")
        if 200 <= status < 300:
            ok += 1
            print(f"   OK  {p.get('email')}")
        else:
            fallidos.append(p)
            print(f"   ERROR ({status}) {p.get('email')}: {body[:200]}")

    print(f"\nListo: {ok} borrada(s), {len(fallidos)} con error.")
    if fallidos:
        print("Revisa manualmente en el Dashboard de Supabase (Authentication > Users) las que fallaron.")


if __name__ == "__main__":
    main()
