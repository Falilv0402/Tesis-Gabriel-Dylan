"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { reglasContrasena } from "@/lib/contrasena";

interface NuevaContrasenaViewProps {
  /** Correo de la cuenta que se está recuperando (solo para mostrarlo). */
  email: string;
  busy: boolean;
  /** Guarda la contraseña. Devuelve null si salió bien o el mensaje de error. */
  onSubmit: (nueva: string) => Promise<string | null>;
  /** Abandona la recuperación: cierra la sesión que abrió el enlace. */
  onCancel: () => void;
}

/**
 * Pantalla que se muestra al entrar con el enlace de "Recuperar contraseña" (HU0004). Sin ella, el enlace dejaba
 * a la persona dentro de su cuenta sin pedirle la contraseña nueva.
 */
export function NuevaContrasenaView({ email, busy, onSubmit, onCancel }: NuevaContrasenaViewProps) {
  const [pwd, setPwd] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");

  const reglas = reglasContrasena(pwd);
  const cumple = Object.values(reglas).every(Boolean);
  const coincide = pwd.length > 0 && pwd === confirmar;
  const puedeGuardar = cumple && coincide && !busy;

  const Regla = ({ ok, texto }: { ok: boolean; texto: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: ok ? "#16a34a" : "#94a3b8", transition: "color 0.2s" }}>
      {ok ? <CheckCircle2 size={12} style={{ color: "#16a34a" }} /> : <Circle size={12} style={{ color: "#cbd5e1" }} />}
      {texto}
    </div>
  );

  async function guardar() {
    if (!puedeGuardar) return;
    setError("");
    const fallo = await onSubmit(pwd);
    if (fallo) setError(fallo);
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/Logo Icono SATRA_fondo_transparente.png" alt="SATRA" style={{ width: 80, margin: "0 auto", display: "block" }} />
        <h1 style={{ textAlign: "center" }}>Elige tu nueva contraseña</h1>
        <p className="auth-subtitle">
          Cuenta: <strong>{email}</strong>
        </p>

        <label>Nueva contraseña
          <div style={{ position: "relative" }}>
            <input
              type={ver ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              style={{ paddingRight: 38 }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setVer((v) => !v)}
              aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
            >
              {ver ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </label>

        {pwd.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
            <Regla ok={reglas.length}    texto="Mínimo 8 caracteres" />
            <Regla ok={reglas.uppercase} texto="1 mayúscula (A–Z)" />
            <Regla ok={reglas.lowercase} texto="1 minúscula (a–z)" />
            <Regla ok={reglas.number}    texto="1 número (0–9)" />
            <Regla ok={reglas.special}   texto="1 carácter especial (!@#...)" />
          </div>
        )}

        <label>Confirmar contraseña
          <input
            type={ver ? "text" : "password"}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void guardar()}
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            style={confirmar.length > 0 ? { borderColor: coincide ? "#16a34a" : "#ef4444" } : {}}
          />
          {confirmar.length > 0 && !coincide && (
            <span style={{ fontSize: 11, color: "#ef4444", marginTop: 3, display: "block" }}>Las contraseñas no coinciden.</span>
          )}
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="primary" disabled={!puedeGuardar} onClick={() => void guardar()}>
          <KeyRound size={18} /> {busy ? "Guardando..." : "Guardar contraseña"}
        </button>
        <button className="link-button" onClick={onCancel}>Cancelar y volver al inicio de sesion</button>

        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <ShieldCheck size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
          Datos protegidos · Ley 29733 · Uso educativo exclusivo
        </p>
      </section>
    </main>
  );
}
