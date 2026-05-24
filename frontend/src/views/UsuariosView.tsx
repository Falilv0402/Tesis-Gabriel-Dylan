"use client";

import { useState } from "react";
import { RefreshCcw, UserCog, Activity } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Panel, EmptyState } from "@/components/ui/Primitives";

interface DbUser { id: string; email: string; nombre: string | null; rol: string; activo: boolean }
interface AuditEvent {
  id: string;
  accion: string;
  created_at: string;
  ip?: string | null;
  usuario_nombre?: string | null;
  usuario_email?: string | null;
}

interface UsuariosViewProps {
  session: User;
  dbUsers: DbUser[];
  dbAudit: AuditEvent[];
  showCreateUser: boolean;
  setShowCreateUser: (v: boolean | ((prev: boolean) => boolean)) => void;
  newUserEmail: string;
  setNewUserEmail: (v: string) => void;
  newUserNombre: string;
  setNewUserNombre: (v: string) => void;
  newUserPwd: string;
  setNewUserPwd: (v: string) => void;
  newUserRol: "admin" | "director";
  setNewUserRol: (v: "admin" | "director") => void;
  newUserDistrito: string;
  setNewUserDistrito: (v: string) => void;
  distritosList: string[];
  authBusy: boolean;
  onCreateUser: () => void;
  onDesactivar: (id: string) => void;
  onActivar: (id: string) => void;
  onRefreshUsers: () => void;
  onRefreshAudit: () => void;
}

export function UsuariosView({
  session, dbUsers, dbAudit,
  showCreateUser, setShowCreateUser,
  newUserEmail, setNewUserEmail,
  newUserNombre, setNewUserNombre,
  newUserPwd, setNewUserPwd,
  newUserRol, setNewUserRol,
  newUserDistrito, setNewUserDistrito,
  distritosList, authBusy,
  onCreateUser, onDesactivar, onActivar, onRefreshUsers, onRefreshAudit,
}: UsuariosViewProps) {
  return (
    <section className="two-col">
      <Panel title="Usuarios y roles">
        <table><tbody>
          <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr>
          {dbUsers.map((u) => (
            <tr key={u.id}>
              <td>{u.nombre ?? "—"}</td>
              <td>{u.email}</td>
              <td><span className={`role-tag ${u.rol}`}>{u.rol}</span></td>
              <td>{u.activo ? "Activo" : <span style={{ color: "#ef4444" }}>Inactivo</span>}</td>
              <td>
                {u.id !== session.id && (
                  u.activo ? (
                    <button
                      style={{ fontSize: "11px", padding: "2px 8px", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "6px", background: "#fef2f2", cursor: "pointer" }}
                      onClick={() => onDesactivar(u.id)}
                    >
                      Desactivar
                    </button>
                  ) : (
                    <button
                      style={{ fontSize: "11px", padding: "2px 8px", color: "#16a34a", border: "1px solid #86efac", borderRadius: "6px", background: "#f0fdf4", cursor: "pointer" }}
                      onClick={() => onActivar(u.id)}
                    >
                      Activar
                    </button>
                  )
                )}
              </td>
            </tr>
          ))}
          {dbUsers.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>Sin usuarios registrados aun.</td></tr>
          )}
        </tbody></table>

        <button className="primary" onClick={() => setShowCreateUser((v) => !v)}>
          <UserCog size={17} /> {showCreateUser ? "Cancelar" : "Crear usuario"}
        </button>

        {showCreateUser && (
          <div className="create-user-form">
            <label>Email institucional
              <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="correo@institucion.pe" />
            </label>
            <label>Nombre completo
              <input value={newUserNombre} onChange={(e) => setNewUserNombre(e.target.value)} placeholder="Nombre del usuario" />
            </label>
            <label>Contrasena temporal
              <input type="password" value={newUserPwd} onChange={(e) => setNewUserPwd(e.target.value)} placeholder="Min. 6 caracteres" />
            </label>
            <label>Rol asignado
              <select value={newUserRol} onChange={(e) => setNewUserRol(e.target.value as "admin" | "director")}>
                <option value="director">Director</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            {newUserRol === "director" && (
              <label>Distrito asignado
                <select value={newUserDistrito} onChange={(e) => setNewUserDistrito(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {distritosList.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            )}
            {newUserRol === "admin" && (
              <div style={{ padding: "8px 12px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                ⚠️ <strong>Rol Administrador</strong> — este usuario tendrá acceso total al sistema: gestión de usuarios, modelo ML y datos. Asegúrate de que sea de confianza.
              </div>
            )}
            <button className="primary" disabled={authBusy} onClick={onCreateUser}>
              <UserCog size={16} /> {authBusy ? "Creando..." : "Confirmar creacion"}
            </button>
          </div>
        )}
        <button style={{ marginTop: "8px" }} onClick={onRefreshUsers}><RefreshCcw size={16} /> Actualizar lista</button>
      </Panel>

      <AuditPanel dbAudit={dbAudit} onRefresh={onRefreshAudit} />
    </section>
  );
}

// ── Panel de auditoría con filtros ────────────────────────────────────────────

const AUDIT_FILTERS = [
  { id: "todos",        label: "Todos",         color: "var(--text-muted)" },
  { id: "sesion",       label: "Sesión",         color: "#64748b" },
  { id: "intervencion", label: "Intervenciones", color: "#7c3aed" },
  { id: "exportar",     label: "Exportaciones",  color: "#0369a1" },
  { id: "usuario",      label: "Usuarios",       color: "#16a34a" },
  { id: "anotacion",    label: "Anotaciones",    color: "#7c3aed" },
  { id: "modelo",       label: "Modelo ML",      color: "#d97706" },
] as const;

type FilterId = typeof AUDIT_FILTERS[number]["id"];

function getFilterId(accion: string): FilterId {
  const a = accion.toLowerCase();
  if (a.includes("sesion") || a.includes("login") || a.includes("logout") || a.includes("cierre") || a.includes("inicio")) return "sesion";
  if (a.includes("interven")) return "intervencion";
  if (a.includes("export") || a.includes("pdf") || a.includes("csv") || a.includes("xlsx")) return "exportar";
  if (a.includes("usuario") || a.includes("perfil") || a.includes("crear") || a.includes("desactivar")) return "usuario";
  if (a.includes("anota")) return "anotacion";
  if (a.includes("modelo") || a.includes("reentren") || a.includes("prediccion") || a.includes("actualizacion")) return "modelo";
  return "todos";
}

function getBadgeStyle(accion: string) {
  const a = accion.toLowerCase();
  if (a.includes("cierre") || a.includes("logout"))             return { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" };
  if (a.includes("crear") || a.includes("registrar"))           return { bg: "#f0fdf4", text: "#16a34a", border: "#86efac" };
  if (a.includes("desactivar"))                                 return { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" };
  if (a.includes("export") || a.includes("pdf") || a.includes("csv") || a.includes("xlsx")) return { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" };
  if (a.includes("interven") || a.includes("anota"))            return { bg: "#faf5ff", text: "#7c3aed", border: "#e9d5ff" };
  if (a.includes("modelo") || a.includes("reentren"))           return { bg: "#fffbeb", text: "#d97706", border: "#fde68a" };
  return { bg: "var(--surface)", text: "var(--text-muted)", border: "var(--border)" };
}

function AuditPanel({ dbAudit, onRefresh }: { dbAudit: AuditEvent[]; onRefresh: () => void }) {
  const [activeFilter, setActiveFilter] = useState<FilterId>("todos");

  const filtered = activeFilter === "todos"
    ? dbAudit
    : dbAudit.filter((e) => getFilterId(e.accion) === activeFilter);

  const counts = AUDIT_FILTERS.reduce((acc, f) => {
    acc[f.id] = f.id === "todos" ? dbAudit.length : dbAudit.filter((e) => getFilterId(e.accion) === f.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
      <Panel title="Auditoria reciente">
        {/* Contador + filtros */}
        {dbAudit.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
              padding: "6px 10px", background: "var(--surface)", borderRadius: 8,
              border: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)" }}>
              <Activity size={13} />
              <span><strong style={{ color: "var(--text)" }}>{filtered.length}</strong> de <strong style={{ color: "var(--text)" }}>{dbAudit.length}</strong> eventos</span>
            </div>

            {/* Chips de filtro */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {AUDIT_FILTERS.filter(f => f.id === "todos" || counts[f.id] > 0).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  style={{
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    padding: "3px 10px", borderRadius: 20, border: "1.5px solid",
                    transition: "all 0.15s",
                    borderColor: activeFilter === f.id ? f.color : "var(--border)",
                    background:  activeFilter === f.id ? f.color : "var(--surface)",
                    color:       activeFilter === f.id ? "#fff"   : f.color,
                  }}
                >
                  {f.label}
                  {counts[f.id] > 0 && (
                    <span style={{
                      marginLeft: 4, fontSize: 10,
                      background: activeFilter === f.id ? "rgba(255,255,255,0.25)" : `${f.color}22`,
                      borderRadius: 10, padding: "0 5px",
                      color: activeFilter === f.id ? "#fff" : f.color,
                    }}>
                      {counts[f.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((event) => {
            const quien = event.usuario_nombre ?? event.usuario_email?.split("@")[0] ?? "Sistema";
            const esAdmin = event.usuario_email?.includes("admin") ||
              (event.usuario_nombre?.toLowerCase().includes("admin"));
            const avatarColor = esAdmin ? "#7c3aed" : "#2563eb";
            const initial = quien.charAt(0).toUpperCase();
            const badgeColor = getBadgeStyle(event.accion);

            return (
              <div key={event.id} style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr auto",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                transition: "box-shadow 0.15s",
              }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: avatarColor, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {initial}
                </div>

                {/* Contenido */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      padding: "2px 8px", borderRadius: 20,
                      background: badgeColor.bg, color: badgeColor.text,
                      border: `1px solid ${badgeColor.border}`,
                    }}>
                      {event.accion}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: avatarColor }}>{quien}</span>
                    {event.usuario_email && (
                      <span style={{
                        fontSize: 11, color: "var(--text-muted)",
                        background: "#f8fafc", border: "1px solid var(--border)",
                        borderRadius: 4, padding: "0px 5px",
                      }}>
                        {event.usuario_email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fecha */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(event.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>
                    {new Date(event.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && dbAudit.length > 0 && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
            Sin eventos de este tipo
          </div>
        )}
        {dbAudit.length === 0 && <EmptyState message="No hay registros de auditoria aun." />}
        <button style={{ marginTop: 10 }} onClick={onRefresh}>
          <RefreshCcw size={14} /> Actualizar
        </button>
      </Panel>
  );
}
