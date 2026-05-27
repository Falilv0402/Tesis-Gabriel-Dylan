"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";

// ── Validaciones ──────────────────────────────────────────────────────────────

const BLOCKED_DOMAINS = [
  "gmail.com", "hotmail.com", "hotmail.es", "yahoo.com", "yahoo.es",
  "outlook.com", "outlook.es", "live.com", "icloud.com", "me.com",
  "aol.com", "protonmail.com",
];

function isInstitutionalEmail(email: string): boolean {
  if (!email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return !BLOCKED_DOMAINS.includes(domain);
}

interface PwdRules {
  length:    boolean;
  uppercase: boolean;
  lowercase: boolean;
  number:    boolean;
  special:   boolean;
}

function checkPassword(pwd: string): PwdRules {
  return {
    length:    pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number:    /[0-9]/.test(pwd),
    special:   /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
  };
}

function allPass(rules: PwdRules): boolean {
  return Object.values(rules).every(Boolean);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AuthViewProps {
  authMode: "login" | "registro" | "reset";
  setAuthMode: (mode: "login" | "registro" | "reset") => void;
  authEmail: string;
  setAuthEmail: (v: string) => void;
  authPassword: string;
  setAuthPassword: (v: string) => void;
  authNombre: string;
  setAuthNombre: (v: string) => void;
  authError: string;
  authMsg: string;
  authBusy: boolean;
  regDistrito: string;
  setRegDistrito: (v: string) => void;
  regColegioIe: string;
  setRegColegioIe: (v: string) => void;
  regColegiosList: { distrito: string; id_ie: string; total_estudiantes: number }[];
  distritosList: string[];
  ieHasDirector: boolean;
  handleLogin: () => void;
  handleRegister: () => void;
  handlePasswordReset: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function AuthView({
  authMode, setAuthMode,
  authEmail, setAuthEmail,
  authPassword, setAuthPassword,
  authNombre, setAuthNombre,
  authError, authMsg, authBusy,
  regDistrito, setRegDistrito,
  regColegioIe, setRegColegioIe,
  regColegiosList, distritosList, ieHasDirector,
  handleLogin, handleRegister, handlePasswordReset,
}: AuthViewProps) {
  const [showPwd, setShowPwd] = useState(false);
  const [pwdTouched, setPwdTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const pwdRules = checkPassword(authPassword);
  const pwdOk    = allPass(pwdRules);
  const emailOk  = authMode === "registro" ? isInstitutionalEmail(authEmail) : true;
  const canSubmit = authMode === "registro"
    ? !authBusy && pwdOk && emailOk && !!regDistrito && !!authNombre.trim()
    : !authBusy;

  const Rule = ({ ok, label }: { ok: boolean; label: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11,
      color: ok ? "#16a34a" : "#94a3b8", transition: "color 0.2s" }}>
      {ok
        ? <CheckCircle2 size={12} style={{ color: "#16a34a" }} />
        : <Circle      size={12} style={{ color: "#cbd5e1" }} />}
      {label}
    </div>
  );

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/Logo Icono SATRA_fondo_transparente.png" alt="SATRA"
          style={{ width: 80, margin: "0 auto", display: "block" }} />
        <h1 style={{ textAlign: "center" }}>Bienvenido a SATRA</h1>
        <p className="auth-subtitle">Sistema de Alerta Temprana de Riesgo Académico · UPC</p>

        {/* ── Tabs ── */}
        {authMode !== "reset" && (
          <div className="segmented">
            <button className={authMode === "login"    ? "active" : ""} onClick={() => setAuthMode("login")}>
              Iniciar sesion
            </button>
            <button className={authMode === "registro" ? "active" : ""} onClick={() => setAuthMode("registro")}>
              Registro
            </button>
          </div>
        )}

        {/* ── Aviso login ── */}
        {authMode === "login" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
            background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 12, color: "#0369a1" }}>
            <ShieldCheck size={13} />
            <span>Directores y Administradores inician sesión aquí. El sistema detecta el rol automáticamente.</span>
          </div>
        )}

        {/* ── Aviso registro ── */}
        {authMode === "registro" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
            background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: 12, color: "#15803d" }}>
            <ShieldCheck size={13} />
            <span>
              <strong>Registro para Directores / Coordinadores.</strong>{" "}
              Para crear una cuenta de Administrador, contacta al admin del sistema.
            </span>
          </div>
        )}

        {authMode === "reset" && (
          <p className="auth-subtitle">Ingresa tu correo para recibir el enlace de recuperacion.</p>
        )}

        {/* ── Campos solo registro ── */}
        {authMode === "registro" && (
          <>
            <label>Nombre completo
              <input
                value={authNombre}
                onChange={(e) => setAuthNombre(e.target.value)}
                placeholder="Tu nombre completo"
              />
            </label>

            <div style={{ display: "grid", gap: 6, background: "#f0f6ff",
              border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1d4ed8",
                textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Tu institución educativa
              </p>
              <label>Distrito <span style={{ color: "#ef4444" }}>*</span>
                <select value={regDistrito} onChange={(e) => setRegDistrito(e.target.value)}>
                  <option value="">Selecciona tu distrito...</option>
                  {distritosList.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label style={{ opacity: regDistrito ? 1 : 0.5 }}>
                Colegio
                <select value={regColegioIe} onChange={(e) => setRegColegioIe(e.target.value)} disabled={!regDistrito}>
                  <option value="">{regDistrito ? "Todos los colegios del distrito" : "Primero selecciona un distrito"}</option>
                  {regColegiosList.map((c) => (
                    <option key={c.id_ie} value={c.id_ie}>{c.id_ie} · {c.total_estudiantes} estudiantes</option>
                  ))}
                </select>
              </label>

              {/* Aviso si el colegio ya tiene director */}
              {regColegioIe && ieHasDirector && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 7,
                  padding: "8px 10px", borderRadius: 8, fontSize: 12,
                  background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
                }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
                  <div>
                    <strong>Este colegio ya tiene un Director registrado.</strong>
                    <p style={{ margin: "2px 0 0", fontSize: 11, lineHeight: 1.4 }}>
                      Tu cuenta se creará como <strong>Coordinador Académico</strong> — podrás registrar intervenciones, anotaciones y planes, pero el director tendrá autoridad sobre todos los registros del colegio.
                    </p>
                  </div>
                </div>
              )}

              {/* Confirmación si el colegio no tiene director aún */}
              {regColegioIe && !ieHasDirector && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "6px 10px", borderRadius: 8, fontSize: 12,
                  background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d",
                }}>
                  <span style={{ fontSize: 13 }}>✅</span>
                  <span>Serás el <strong>Director</strong> de este colegio en SATRA.</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Email ── */}
        <label>Correo {authMode === "registro" ? "institucional" : "electronico"}
          <input
            type="email"
            value={authEmail}
            onChange={(e) => { setAuthEmail(e.target.value); setEmailTouched(true); }}
            onBlur={() => setEmailTouched(true)}
            placeholder={authMode === "registro" ? "correo@colegio.edu.pe" : "correo@institucion.pe"}
            onKeyDown={(e) => e.key === "Enter" && authMode === "login" && void handleLogin()}
            style={authMode === "registro" && emailTouched && authEmail
              ? { borderColor: emailOk ? "#16a34a" : "#ef4444" }
              : {}}
          />
          {authMode === "registro" && emailTouched && authEmail && !emailOk && (
            <span style={{ fontSize: 11, color: "#ef4444", marginTop: 3, display: "block" }}>
              Usa un correo institucional (no Gmail, Hotmail, Yahoo, etc.)
            </span>
          )}
          {authMode === "registro" && emailTouched && authEmail && emailOk && (
            <span style={{ fontSize: 11, color: "#16a34a", marginTop: 3, display: "block" }}>
              ✓ Correo institucional válido
            </span>
          )}
        </label>

        {/* ── Contraseña ── */}
        {authMode !== "reset" && (
          <label>Contrasena
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={authPassword}
                onChange={(e) => { setAuthPassword(e.target.value); setPwdTouched(true); }}
                placeholder="••••••••"
                style={{ paddingRight: 38,
                  ...(authMode === "registro" && pwdTouched && authPassword
                    ? { borderColor: pwdOk ? "#16a34a" : "#f59e0b" }
                    : {}) }}
                onKeyDown={(e) => e.key === "Enter" && authMode === "login" && void handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Checklist de requisitos — solo en registro y si el usuario empezó a escribir */}
            {authMode === "registro" && pwdTouched && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px",
                marginTop: 8, padding: "8px 10px", background: "var(--surface)",
                border: "1px solid var(--border)", borderRadius: 8 }}>
                <Rule ok={pwdRules.length}    label="Mínimo 8 caracteres" />
                <Rule ok={pwdRules.uppercase} label="1 mayúscula (A–Z)" />
                <Rule ok={pwdRules.lowercase} label="1 minúscula (a–z)" />
                <Rule ok={pwdRules.number}    label="1 número (0–9)" />
                <Rule ok={pwdRules.special}   label="1 carácter especial (!@#...)" />
              </div>
            )}
          </label>
        )}

        {authError && <p className="auth-error">{authError}</p>}
        {authMsg   && <p className="auth-success">{authMsg}</p>}

        {/* ── Botones acción ── */}
        {authMode === "login" && (
          <button className="primary" disabled={canSubmit === false} onClick={() => void handleLogin()}>
            <KeyRound size={18} /> {authBusy ? "Ingresando..." : "Iniciar sesion"}
          </button>
        )}
        {authMode === "registro" && (
          <button className="primary" disabled={!canSubmit} onClick={() => void handleRegister()}
            title={!pwdOk ? "Completa los requisitos de contraseña" : !emailOk ? "Usa un correo institucional" : ""}>
            <KeyRound size={18} />
            {authBusy
              ? "Registrando..."
              : ieHasDirector
                ? "Crear cuenta como Coordinador"
                : "Crear cuenta como Director"}
          </button>
        )}
        {authMode === "reset" && (
          <>
            <button className="primary" disabled={authBusy} onClick={() => void handlePasswordReset()}>
              <Mail size={18} /> {authBusy ? "Enviando..." : "Enviar enlace"}
            </button>
            <button className="link-button" onClick={() => setAuthMode("login")}>
              Volver al inicio de sesion
            </button>
          </>
        )}
        {authMode === "login" && (
          <button className="link-button" onClick={() => setAuthMode("reset")}>
            Recuperar contrasena
          </button>
        )}

        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <ShieldCheck size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
          Datos protegidos · Ley 29733 · Uso educativo exclusivo
        </p>
      </section>
    </main>
  );
}
