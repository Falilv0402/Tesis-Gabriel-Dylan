"use client";

import { CheckCircle2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_COLORS } from "@/lib/constants";

interface ProfilePanelProps {
  show: boolean;
  session: User;
  role: string;
  editNombre: string;
  setEditNombre: (v: string) => void;
  editApellidos: string;
  setEditApellidos: (v: string) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  editPwd: string;
  setEditPwd: (v: string) => void;
  editPwdConfirm: string;
  setEditPwdConfirm: (v: string) => void;
  profileAvatarColor: string;
  setProfileAvatarColor: (v: string) => void;
  profileBusy: boolean;
  profileMsg: { ok: boolean; text: string } | null;
  onClose: () => void;
  onSave: () => void;
}

export function ProfilePanel({
  show, session, role,
  editNombre, setEditNombre,
  editApellidos, setEditApellidos,
  editEmail, setEditEmail,
  editPwd, setEditPwd,
  editPwdConfirm, setEditPwdConfirm,
  profileAvatarColor, setProfileAvatarColor,
  profileBusy, profileMsg,
  onClose, onSave,
}: ProfilePanelProps) {
  if (!show) return null;

  return (
    <div className="profile-overlay" onClick={onClose}>
      <aside className="profile-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-panel-header">
          <h2>Mi perfil</h2>
          <button className="profile-close" onClick={onClose}>✕</button>
        </div>

        <div className="profile-avatar-area">
          <Avatar
            nombre={editNombre}
            apellidos={editApellidos}
            email={session.email ?? ""}
            color={profileAvatarColor}
            size={80}
          />
          <div className="profile-avatar-meta">
            <strong>
              {editNombre || editApellidos
                ? `${editNombre} ${editApellidos}`.trim()
                : session.email?.split("@")[0]}
            </strong>
            <span>{session.email}</span>
            <span className={`role-tag ${role}`}>{role}</span>
          </div>
        </div>

        <div className="profile-color-picker">
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Color del avatar
          </label>
          <div className="color-swatches">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch${profileAvatarColor === c ? " selected" : ""}`}
                style={{ background: c }}
                onClick={() => setProfileAvatarColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="profile-form">
          <div className="profile-section-title">Datos personales</div>
          <div className="profile-row">
            <label>Nombre
              <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} placeholder="Tu nombre" />
            </label>
            <label>Apellidos
              <input value={editApellidos} onChange={(e) => setEditApellidos(e.target.value)} placeholder="Tus apellidos" />
            </label>
          </div>

          <div className="profile-section-title">Cuenta</div>
          <label>Correo electrónico
            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="correo@institucion.pe" />
            <span className="profile-hint">Si cambias el correo recibirás un enlace de confirmación.</span>
          </label>

          <div className="profile-section-title">
            Cambiar contraseña <span className="profile-hint">(deja vacío para no cambiar)</span>
          </div>
          <div className="profile-row">
            <label>Nueva contraseña
              <input type="password" value={editPwd} onChange={(e) => setEditPwd(e.target.value)} placeholder="Mín. 6 caracteres" />
            </label>
            <label>Confirmar contraseña
              <input type="password" value={editPwdConfirm} onChange={(e) => setEditPwdConfirm(e.target.value)} placeholder="Repite la contraseña" />
            </label>
          </div>

          {profileMsg && (
            <p className={profileMsg.ok ? "auth-success" : "auth-error"}>{profileMsg.text}</p>
          )}

          <button className="primary" disabled={profileBusy} onClick={onSave} style={{ width: "100%" }}>
            <CheckCircle2 size={16} /> {profileBusy ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </aside>
    </div>
  );
}
