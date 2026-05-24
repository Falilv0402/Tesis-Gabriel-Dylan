"use client";

/**
 * useProfile — manages the profile edit panel UI state and save logic.
 * Depends on the current session (User object) and the auth audit function.
 */

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AVATAR_COLORS } from "@/lib/constants";

export function useProfile(
  session:          User | null,
  profileAvatarColor: string,
  setProfileAvatarColor: (c: string) => void,
  profileNombre:    string,
  setProfileNombre: (v: string) => void,
  profileApellidos: string,
  setProfileApellidos: (v: string) => void,
  insertAudit:      (accion: string, tabla?: string, detalle?: object) => Promise<void>,
  toast:            (msg: string, type?: "success" | "error" | "info") => void,
) {
  const [showProfile,      setShowProfile]      = useState(false);
  const [editNombre,       setEditNombre]       = useState("");
  const [editApellidos,    setEditApellidos]    = useState("");
  const [editEmail,        setEditEmail]        = useState("");
  const [editPwd,          setEditPwd]          = useState("");
  const [editPwdConfirm,   setEditPwdConfirm]   = useState("");
  const [profileBusy,      setProfileBusy]      = useState(false);
  const [profileMsg,       setProfileMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  function openProfilePanel() {
    setEditNombre(profileNombre);
    setEditApellidos(profileApellidos);
    setEditEmail(session?.email ?? "");
    setEditPwd("");
    setEditPwdConfirm("");
    setProfileMsg(null);
    setShowProfile(true);
  }

  async function saveProfile() {
    if (!session) return;
    setProfileBusy(true);
    setProfileMsg(null);

    const color = profileAvatarColor || AVATAR_COLORS[session.email!.charCodeAt(0) % AVATAR_COLORS.length];

    const { error: profileError } = await supabase.from("profiles").update({
      nombre:       editNombre.trim() || null,
      apellidos:    editApellidos.trim() || null,
      avatar_color: color,
    }).eq("id", session.id);

    if (profileError) {
      setProfileMsg({ text: "Error al guardar el perfil: " + profileError.message, ok: false });
      setProfileBusy(false);
      return;
    }

    setProfileNombre(editNombre.trim());
    setProfileApellidos(editApellidos.trim());
    setProfileAvatarColor(color);

    if (editEmail.trim() && editEmail.trim() !== session.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: editEmail.trim() });
      if (emailError) {
        setProfileMsg({ text: "Perfil guardado, pero hubo un error al cambiar el correo: " + emailError.message, ok: false });
        setProfileBusy(false);
        return;
      }
      setProfileMsg({ text: "Perfil actualizado. Revisa tu correo para confirmar el nuevo email.", ok: true });
    }

    if (editPwd) {
      if (editPwd !== editPwdConfirm) {
        setProfileMsg({ text: "Las contraseñas no coinciden.", ok: false });
        setProfileBusy(false);
        return;
      }
      if (editPwd.length < 6) {
        setProfileMsg({ text: "La contraseña debe tener al menos 6 caracteres.", ok: false });
        setProfileBusy(false);
        return;
      }
      const { error: pwdError } = await supabase.auth.updateUser({ password: editPwd });
      if (pwdError) {
        setProfileMsg({ text: "Perfil guardado, pero error al cambiar contraseña: " + pwdError.message, ok: false });
        setProfileBusy(false);
        return;
      }
    }

    await insertAudit("Actualizar perfil", "profiles", { nombre: editNombre, apellidos: editApellidos });
    if (!profileMsg) setProfileMsg({ text: "Perfil actualizado correctamente.", ok: true });
    toast("Perfil actualizado.", "success");
    setProfileBusy(false);
  }

  return {
    showProfile, setShowProfile,
    editNombre, setEditNombre,
    editApellidos, setEditApellidos,
    editEmail, setEditEmail,
    editPwd, setEditPwd,
    editPwdConfirm, setEditPwdConfirm,
    profileBusy, profileMsg,
    openProfilePanel, saveProfile,
  };
}
