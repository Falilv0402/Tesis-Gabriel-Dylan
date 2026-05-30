"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Tab } from "@/types";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/constants";

export function useAdmin(
  session: User | null,
  role: string,
  tab: Tab,
  toast: (msg: string, type?: "success" | "error" | "info") => void,
  insertAudit: (accion: string, tabla?: string, detalle?: object) => Promise<void>,
  profileCodigoIe: string | null = null,
) {
  const [dbUsers, setDbUsers] = useState<{
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
    activo: boolean;
  }[]>([]);
  const [dbAudit, setDbAudit] = useState<{
    id: string;
    accion: string;
    created_at: string;
    ip?: string | null;
    usuario_nombre?: string | null;
    usuario_email?: string | null;
  }[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserNombre, setNewUserNombre] = useState("");
  const [newUserPwd, setNewUserPwd] = useState("");
  const [newUserRol, setNewUserRol] = useState<"admin" | "director" | "coordinador">("director");
  const [newUserDistrito, setNewUserDistrito] = useState("");

  const [uploadResult, setUploadResult] = useState("Sin archivo cargado.");
  const [csvValidation, setCsvValidation] = useState<{
    total_filas: number;
    filas_validas: number;
    errores: { fila: number; campo: string; error: string }[];
    columnas_faltantes: string[];
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [scheduleFreq, setScheduleFreq] = useState("semanal");
  const [scheduleMsg, setScheduleMsg] = useState("");
  const [nextUpdate, setNextUpdate] = useState<string | null>(null);

  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [modelMessage, setModelMessage] = useState("Conectando con el servicio del modelo...");

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDbUsers() {
    let query = supabase
      .from("profiles")
      .select("id, email, nombre, rol, activo, codigo_ie")
      .order("created_at");

    // Admin de colegio solo ve usuarios de su IE
    if (role === "admin" && profileCodigoIe) {
      query = query.eq("codigo_ie", profileCodigoIe);
    }

    const { data } = await query;
    if (data) setDbUsers(data);
  }

  async function loadDbAudit() {
    let query = supabase
      .from("audit_log")
      .select("id, accion, created_at, ip, profiles(nombre, email, codigo_ie)")
      .order("created_at", { ascending: false })
      .limit(50);

    // Admin de colegio: solo ve auditoría de usuarios de su IE
    if (role === "admin" && profileCodigoIe) {
      // Filtrar vía relación: solo eventos de usuarios que pertenecen a su IE
      query = supabase
        .from("audit_log")
        .select("id, accion, created_at, ip, profiles!inner(nombre, email, codigo_ie)")
        .eq("profiles.codigo_ie", profileCodigoIe)
        .order("created_at", { ascending: false })
        .limit(50);
    }

    const { data } = await query;
    if (data) {
      setDbAudit(data.map((e: Record<string, unknown>) => {
        const p = e.profiles as { nombre?: string; email?: string } | null;
        return {
          id:              e.id as string,
          accion:          e.accion as string,
          created_at:      e.created_at as string,
          ip:              e.ip as string | null,
          usuario_nombre:  p?.nombre ?? null,
          usuario_email:   p?.email  ?? null,
        };
      }));
    }
  }

  async function handleCreateUser(
    translateAuthError: (msg: string) => string,
    authBusy: boolean,
    setAuthBusy: (v: boolean) => void
  ) {
    setAuthBusy(true);

    const rolEfectivo  = newUserRol; // admin de IE y superadmin ambos usan el rol elegido
    const ieEfectiva   = role === "admin" ? (profileCodigoIe ?? "") : newUserDistrito;

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: newUserEmail,
      password: newUserPwd,
      options: { data: { nombre: newUserNombre, rol: rolEfectivo } },
    });
    if (!error && signUpData.user) {
      const uid = signUpData.user.id;

      if (ieEfectiva) {
        // Fix #4a: campo correcto por rol (director necesita codigo_ie Y distrito)
        const updateField = rolEfectivo === "director" || rolEfectivo === "coordinador"
          ? { codigo_ie: ieEfectiva, distrito: newUserDistrito || null }
          : { codigo_ie: ieEfectiva };

        // Fix #4b: polling hasta que el trigger cree el perfil (máx ~5s)
        let actualizado = false;
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 400));
          const { data: rows, error: upErr } = await supabase
            .from("profiles")
            .update(updateField)
            .eq("id", uid)
            .select("id");
          if (!upErr && rows && rows.length > 0) { actualizado = true; break; }
        }
        if (!actualizado) toast("El perfil se creó pero no se pudo asignar el colegio.", "error");
      }

      await insertAudit("Crear usuario", "profiles", { email: newUserEmail, rol: newUserRol, asignacion: newUserDistrito });
      setShowCreateUser(false);
      setNewUserEmail(""); setNewUserNombre(""); setNewUserPwd(""); setNewUserRol("director"); setNewUserDistrito("");
      toast(`Usuario ${newUserEmail} creado como ${newUserRol}.`);
      void loadDbUsers();
    } else if (error) {
      toast(translateAuthError(error.message), "error");
    }
    setAuthBusy(false);
  }

  async function validateCsv(file: File) {
    setIsValidating(true);
    setCsvValidation(null);
    setUploadResult(`Validando "${file.name}"...`);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${apiUrl}/v1/datos/validar-csv`, { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setCsvValidation(data);
        setUploadResult(
          data.columnas_faltantes.length > 0
            ? `Columnas faltantes: ${data.columnas_faltantes.join(", ")}`
            : `${data.total_filas} filas — ${data.filas_validas} validas — ${data.errores.length} errores`
        );
      } else {
        setUploadResult("Error del servidor al validar el archivo.");
      }
    } catch {
      setUploadResult("No se pudo conectar con el backend para validar. Revisa que FastAPI este activo.");
    } finally {
      setIsValidating(false);
    }
  }

  async function saveSchedule() {
    if (!session) return;
    const days = scheduleFreq === "semanal" ? 7 : scheduleFreq === "mensual" ? 30 : 180;
    const proxima = new Date(Date.now() + days * 86_400_000).toLocaleDateString("es-PE");
    await supabase.from("audit_log").insert({
      usuario_id: session.id,
      accion: "Configurar actualizacion periodica",
      tabla: "configuracion",
      detalle: { frecuencia: scheduleFreq, proxima_actualizacion: proxima },
    });
    setNextUpdate(proxima);
    setScheduleMsg(`Proxima actualizacion: ${proxima}`);
    toast(`Programacion ${scheduleFreq} guardada. Proxima: ${proxima}`);
  }

  async function desactivarUsuario(id: string) {
    await supabase.from("profiles").update({ activo: false }).eq("id", id);
    await insertAudit("Desactivar usuario", "profiles", { usuario_id: id });
    toast("Usuario desactivado correctamente.");
    void loadDbUsers();
  }

  async function activarUsuario(id: string) {
    await supabase.from("profiles").update({ activo: true }).eq("id", id);
    await insertAudit("Activar usuario", "profiles", { usuario_id: id });
    toast("Usuario activado correctamente.", "success");
    void loadDbUsers();
  }

  async function updateEstadoIntervencion(
    id: string,
    nuevoEstado: string,
    setInterventions: (fn: (prev: { id: string; codigo_estudiante: string | null; tipo: string; descripcion: string; estado: string; fecha: string }[]) => { id: string; codigo_estudiante: string | null; tipo: string; descripcion: string; estado: string; fecha: string }[]) => void
  ) {
    const { error } = await supabase.from("intervenciones").update({ estado: nuevoEstado }).eq("id", id);
    if (!error) {
      setInterventions((prev) => prev.map((i) => i.id === id ? { ...i, estado: nuevoEstado } : i));
      await insertAudit("Actualizar estado intervencion", "intervenciones", { id, estado: nuevoEstado });
      toast(`Estado actualizado: ${nuevoEstado}`);
    }
  }

  // Fix #15: useCallback estabiliza referencias para evitar stale closures
  const stableLoadUsers = useCallback(() => void loadDbUsers(), [role, profileCodigoIe]); // eslint-disable-line react-hooks/exhaustive-deps
  const stableLoadAudit = useCallback(() => void loadDbAudit(), [role, profileCodigoIe]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Load DB users/audit when superadmin or admin opens the tab
  useEffect(() => {
    const isAdminRole = role === "admin" || role === "superadmin";
    if (isAdminRole && tab === "usuarios" && session) {
      stableLoadUsers();
      stableLoadAudit();
    }
  }, [role, tab, session, stableLoadUsers, stableLoadAudit]);

  return {
    dbUsers, dbAudit,
    showCreateUser, setShowCreateUser,
    newUserEmail, setNewUserEmail,
    newUserNombre, setNewUserNombre,
    newUserPwd, setNewUserPwd,
    newUserRol, setNewUserRol,
    newUserDistrito, setNewUserDistrito,
    uploadResult, setUploadResult,
    csvValidation, isValidating,
    scheduleFreq, setScheduleFreq,
    scheduleMsg, nextUpdate,
    apiConnected, setApiConnected,
    modelMessage, setModelMessage,
    fileInputRef,
    loadDbUsers, loadDbAudit,
    handleCreateUser, validateCsv, saveSchedule,
    desactivarUsuario, activarUsuario, updateEstadoIntervencion,
  };
}
