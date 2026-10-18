"""
crear_cuentas_colegios.py — Genera las cuentas de los colegios con modelo propio
(administrador, director y profesores) para correrlas UNA vez en Supabase.

Por qué un SQL y no la API: el proyecto de Supabase tiene "Confirm email" activo
y el backend no guarda la service_role key, así que el registro público dejaría
cuentas sin confirmar (y mandaría correos de verificación a buzones que no
existen). Insertar directo en auth.users deja las cuentas confirmadas y listas
para iniciar sesión, y el trigger handle_new_user (migración 0010) crea el
perfil con rol, codigo_ie y distrito.

Qué hace:
  1. Genera una contraseña aleatoria y única por cuenta.
  2. Escribe scripts/_local/cuentas_colegios.sql  -> pegar en Supabase > SQL Editor.
     Lleva solo el HASH bcrypt de cada contraseña (nunca el texto plano), así el
     historial del SQL Editor no guarda contraseñas.
  3. Escribe scripts/_local/credenciales_cuentas.md -> las contraseñas en claro,
     para entregarlas a quien haga las pruebas.
Ambos archivos quedan en scripts/_local/, que está en .gitignore.

El SQL es idempotente: si un correo ya existe lo omite, y no crea un segundo
director en un colegio que ya tiene uno.

Requiere:  pip install bcrypt
Uso:       python scripts/crear_cuentas_colegios.py
           (no sobreescribe salidas existentes; usa --regenerar para rehacerlas,
            ojo: las contraseñas cambian y las cuentas ya creadas NO se actualizan)
"""
import secrets
import sys
from pathlib import Path

try:
    import bcrypt
except ImportError:  # pragma: no cover
    sys.exit("Falta bcrypt:  pip install bcrypt")

DOMINIO = "satraapp.com"
SALIDA = Path(__file__).resolve().parent / "_local"

# Misma convención que el registro real: el distrito es lo que devuelve
# GET /v1/colegios para cada colegio con modelo propio, y codigo_ie va sin ceros.
COLEGIOS = {
    "trapiche":   {"ie": "831305", "distrito": "Colegio propio IE 831305", "nombre": "Cole Andres Avelino Trapiche"},
    "lavictoria": {"ie": "864785", "distrito": "Colegio propio IE 864785", "nombre": "Cole Rafael Hoyos La Victoria"},
    "laperla":    {"ie": "9001",   "distrito": "Colegio propio IE 9001",   "nombre": "Cole Andres Avelino La Perla"},
    "josephmery": {"ie": "249",    "distrito": "SAN MIGUEL",               "nombre": "Joseph And Mery"},
}

# (colegio, rol, nombre, apellidos, materia, usuario_del_correo)
# 'coordinador' es el rol que la app asigna a los profesores (ver useAuth.ts).
# Trapiche ya tiene director (creado a mano por Mathias) y La Victoria también:
# el SQL igual no crearía un segundo, pero aquí no se piden para no listarlos.
CUENTAS = [
    # Trapiche (831305)
    ("trapiche", "admin",       "Rosa",     "Mendoza Quispe",     None,                  "admin.trapiche"),
    ("trapiche", "coordinador", "Carlos",   "Huamán Rojas",       "Matemática",          "profesor1.trapiche"),
    ("trapiche", "coordinador", "Lucía",    "Vargas Paredes",     "Comunicación",        "profesor2.trapiche"),
    ("trapiche", "coordinador", "Miguel",   "Salazar Cruz",       "Ciencia y Tecnología", "profesor3.trapiche"),
    # La Victoria (864785)
    ("lavictoria", "admin",       "Jorge",  "Paredes Llanos",     None,                  "admin.lavictoria"),
    ("lavictoria", "coordinador", "Elena",  "Castillo Ramos",     "Matemática",          "profesor1.lavictoria"),
    ("lavictoria", "coordinador", "Daniel", "Ríos Tello",         "Comunicación",        "profesor2.lavictoria"),
    ("lavictoria", "coordinador", "Sandra", "Ortiz Peña",         "Inglés",              "profesor3.lavictoria"),
    # La Perla (9001)
    ("laperla", "admin",       "Marta",     "Gutiérrez Silva",    None,                  "admin.laperla"),
    ("laperla", "director",    "Patricia",  "Núñez Alarcón",      None,                  "director.laperla"),
    ("laperla", "coordinador", "Luis",      "Campos Meza",        "Matemática",          "profesor1.laperla"),
    ("laperla", "coordinador", "Andrea",    "Flores Delgado",     "Comunicación",        "profesor2.laperla"),
    ("laperla", "coordinador", "Pedro",     "Aguilar Soto",       "Ciencias Sociales",   "profesor3.laperla"),
    # Joseph And Mery (249)
    ("josephmery", "admin",       "Fernando", "Torres Valdivia",  None,                  "admin.josephmery"),
    ("josephmery", "director",    "Ricardo",  "León Bustamante",  None,                  "director.josephmery"),
    ("josephmery", "coordinador", "Karina",   "Montes Rivas",     "Matemática",          "profesor1.josephmery"),
    ("josephmery", "coordinador", "Víctor",   "Chávez Lara",      "Comunicación",        "profesor2.josephmery"),
    ("josephmery", "coordinador", "Diana",    "Pacheco Neyra",    "Ciencia y Tecnología", "profesor3.josephmery"),
]

ROL_ETIQUETA = {"admin": "Administrador", "director": "Director", "coordinador": "Profesor (coordinador)"}

# Sin 0/O/1/l/I y sin comillas ni barras: la contraseña se pega en chats y formularios.
_ALFA = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_ESPECIALES = "!@#$%*-_=+?"


def generar_contrasena() -> str:
    """12 caracteres que cumplen la política del registro (mayúscula, minúscula, número, símbolo)."""
    while True:
        pwd = "".join(secrets.choice(_ALFA) for _ in range(10)) + "".join(secrets.choice(_ESPECIALES) for _ in range(2))
        pwd = "".join(secrets.SystemRandom().sample(pwd, len(pwd)))
        if (any(c.isupper() for c in pwd) and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd) and any(c in _ESPECIALES for c in pwd)):
            return pwd


def _sql(s: str | None) -> str:
    return "NULL" if s is None else "'" + s.replace("'", "''") + "'"


def construir() -> tuple[str, str]:
    filas_sql, filas_md = [], {}
    for col, rol, nombre, apellidos, materia, usuario in CUENTAS:
        c = COLEGIOS[col]
        email = f"{usuario}@{DOMINIO}"
        pwd = generar_contrasena()
        h = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt(rounds=10)).decode()
        distrito = None if rol == "admin" else c["distrito"]  # igual que useAdmin.ts: el admin solo lleva colegio
        filas_sql.append(
            f"    ({_sql(email)}, {_sql(h)}, {_sql(rol)}, {_sql(c['ie'])}, {_sql(distrito)}, "
            f"{_sql(nombre)}, {_sql(apellidos)}, {_sql(materia)})"
        )
        filas_md.setdefault(col, []).append((ROL_ETIQUETA[rol], f"{nombre} {apellidos}", materia or "—", email, pwd))

    ies = ", ".join(_sql(c["ie"]) for c in COLEGIOS.values())
    sql = f"""-- ============================================================
-- Cuentas de los colegios con modelo propio (admin / director / profesores)
-- Generado por scripts/crear_cuentas_colegios.py -- NO subir a git.
--
-- Cómo usar: Supabase > SQL Editor > pegar TODO > Run (una sola vez).
-- Es idempotente: omite correos que ya existen y no crea un segundo director
-- en un colegio que ya tiene uno. Solo lleva hashes bcrypt, no contraseñas.
-- El resultado final lista TODAS las cuentas de esos 4 colegios.
-- ============================================================

DO $$
DECLARE
  r        record;
  v_uid    uuid;
  v_nuevas int := 0;
  v_omit   int := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
{(","+chr(10)).join(filas_sql)}
    ) AS t(email, pwd_hash, rol, codigo_ie, distrito, nombre, apellidos, materia)
  LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(r.email)) THEN
      RAISE NOTICE 'OMITIDO (el correo ya existe): %', r.email;
      v_omit := v_omit + 1;
      CONTINUE;
    END IF;

    IF r.rol = 'director' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE ltrim(p.codigo_ie, '0') = ltrim(r.codigo_ie, '0') AND p.rol = 'director' AND p.activo
    ) THEN
      RAISE NOTICE 'OMITIDO (el colegio % ya tiene director): %', r.codigo_ie, r.email;
      v_omit := v_omit + 1;
      CONTINUE;
    END IF;

    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      lower(r.email), r.pwd_hash, now(),
      '{{"provider":"email","providers":["email"]}}'::jsonb,
      jsonb_build_object('nombre', r.nombre, 'rol', r.rol, 'codigo_ie', r.codigo_ie,
                         'distrito', r.distrito, 'email_verified', true),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', lower(r.email), 'email_verified', true),
      'email', now(), now(), now()
    );

    -- El trigger on_auth_user_created ya creó el perfil; se completan los campos
    -- que no viajan en los metadatos y se fija el rol explícitamente.
    UPDATE public.profiles
       SET nombre = r.nombre, apellidos = r.apellidos, rol = r.rol,
           codigo_ie = r.codigo_ie, distrito = r.distrito, materia = r.materia, activo = true
     WHERE id = v_uid;

    v_nuevas := v_nuevas + 1;
  END LOOP;

  RAISE NOTICE 'Cuentas creadas: %  |  omitidas: %', v_nuevas, v_omit;
END $$;

-- Resultado: todas las cuentas de los 4 colegios (las nuevas y las que ya existían)
SELECT p.codigo_ie,
       p.rol,
       p.email,
       trim(coalesce(p.nombre, '') || ' ' || coalesce(p.apellidos, '')) AS persona,
       p.materia,
       p.activo,
       p.created_at::date AS creada
FROM public.profiles p
WHERE ltrim(p.codigo_ie, '0') IN ({ies})
ORDER BY ltrim(p.codigo_ie, '0'),
         CASE p.rol WHEN 'director' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
         p.email;
"""

    md = ["# Cuentas de prueba por colegio — SATRA\n",
          "> Archivo local (está en `.gitignore`). No lo subas al repositorio ni lo pegues en canales abiertos.\n",
          "Inicia sesión en https://satraapp.com con el correo y la contraseña de la fila.\n",
          "**Qué ve cada rol:** el *administrador* gestiona usuarios y sube los Excel de su colegio; el *director* "
          "ve todo su colegio y gestiona su equipo; el *profesor (coordinador)* ve su colegio y edita solo lo que él registra.\n",
          "Las cuentas de director de **Trapiche (831305)** y **La Victoria (864785)** ya existían y no están en esta lista.\n"]
    for col, filas in filas_md.items():
        c = COLEGIOS[col]
        md.append(f"\n## {c['nombre']} — IE {c['ie']}\n")
        md.append("| Rol | Persona | Materia | Correo | Contraseña |")
        md.append("|---|---|---|---|---|")
        for rol_e, persona, materia, email, pwd in filas:
            md.append(f"| {rol_e} | {persona} | {materia} | `{email}` | `{pwd}` |")
    return sql, "\n".join(md) + "\n"


def main() -> None:
    regenerar = "--regenerar" in sys.argv
    SALIDA.mkdir(exist_ok=True)
    f_sql, f_md = SALIDA / "cuentas_colegios.sql", SALIDA / "credenciales_cuentas.md"
    if (f_sql.exists() or f_md.exists()) and not regenerar:
        sys.exit(f"Ya existen {f_sql.name} / {f_md.name} en {SALIDA}. Si los rehaces, las contraseñas cambian "
                 "y las cuentas ya creadas no se actualizan. Usa --regenerar solo si aún no corriste el SQL.")
    sql, md = construir()
    f_sql.write_text(sql, encoding="utf-8")
    f_md.write_text(md, encoding="utf-8")
    por_rol: dict[str, int] = {}
    for _, rol, *_ in CUENTAS:
        por_rol[rol] = por_rol.get(rol, 0) + 1
    print(f"{len(CUENTAS)} cuentas: {por_rol}")
    print(f"  SQL:          {f_sql}")
    print(f"  Credenciales: {f_md}")


if __name__ == "__main__":
    main()
