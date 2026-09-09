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
  profileAvatarUrl:  string | null,
  setProfileAvatarUrl: (v: string | null) => void,
  profileNombre:    string,
  setProfileNombre: (v: string) => void,
  profileApellidos: string,
  setProfileApellidos: (v: string) => void,
  profileMateria:   string | null,
  setProfileMateria: (v: string | null) => void,
  insertAudit:      (accion: string, tabla?: string, detalle?: object) => Promise<void>,
  toast:            (msg: string, type?: "success" | "error" | "info") => void,
) {
  const [showProfile,      setShowProfile]      = useState(false);
  const [editNombre,       setEditNombre]       = useState("");
  const [editApellidos,    setEditApellidos]    = useState("");
  const [editEmail,        setEditEmail]        = useState("");
  const [editPwd,          setEditPwd]          = useState("");
  const [editPwdConfirm,   setEditPwdConfirm]   = useState("");
  const [editMateria,      setEditMateria]      = useState("");
  const [profileBusy,      setProfileBusy]      = useState(false);
  const [profileMsg,       setProfileMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [avatarUploading,  setAvatarUploading]  = useState(false);

  function openProfilePanel() {
    setEditNombre(profileNombre);
    setEditApellidos(profileApellidos);
    setEditEmail(session?.email ?? "");
    setEditPwd("");
    setEditPwdConfirm("");
    setEditMateria(profileMateria ?? "");
    setProfileMsg(null);
    setShowProfile(true);
  }

  /** Sube la foto de inmediato (no espera a "Guardar cambios") — misma
   * lógica que cualquier avatar de app: se ve el resultado al toque. */
  async function uploadAvatar(file: File) {
    if (!session) return;
    if (!file.type.startsWith("image/")) {
      setProfileMsg({ text: "El archivo debe ser una imagen.", ok: false });
      return;
    }
    const MAX_BYTES = 3 * 1024 * 1024; // 3MB, de sobra para una foto de perfil
    if (file.size > MAX_BYTES) {
      setProfileMsg({ text: "La imagen no puede pesar más de 3MB.", ok: false });
      return;
    }
    setAvatarUploading(true);
    setProfileMsg(null);
    // Path fijo (no el nombre original) para que cada nueva foto reemplace la
    // anterior en vez de acumular archivos sueltos en el bucket.
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${session.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) {
      setProfileMsg({ text: "Error al subir la foto: " + upErr.message, ok: false });
      setAvatarUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-bust: la URL pública es siempre la misma para este usuario, así
    // que sin esto el navegador podría seguir mostrando la foto vieja cacheada.
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", session.id);
    if (dbErr) {
      setProfileMsg({ text: "Foto subida, pero no se pudo guardar en el perfil: " + dbErr.message, ok: false });
      setAvatarUploading(false);
      return;
    }
    setProfileAvatarUrl(url);
    await insertAudit("Actualizar foto de perfil", "profiles");
    toast("Foto de perfil actualizada.", "success");
    setAvatarUploading(false);
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
      materia:      editMateria || null,
    }).eq("id", session.id);

    if (profileError) {
      setProfileMsg({ text: "Error al guardar el perfil: " + profileError.message, ok: false });
      setProfileBusy(false);
      return;
    }

    setProfileNombre(editNombre.trim());
    setProfileApellidos(editApellidos.trim());
    setProfileAvatarColor(color);
    setProfileMateria(editMateria || null);

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
    editMateria, setEditMateria,
    profileBusy, profileMsg,
    avatarUploading, uploadAvatar,
    openProfilePanel, saveProfile,
  };
}
