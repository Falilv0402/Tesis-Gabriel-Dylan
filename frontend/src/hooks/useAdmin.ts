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

  // ── Carga de Excel del colegio ─────────────────────────────────────────────
  const [colegioUploadIe,     setColegioUploadIe]     = useState("");
  const [colegioUploadStatus, setColegioUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [colegioUploadMsg,    setColegioUploadMsg]    = useState("");
  const [colegioUploadResult, setColegioUploadResult] = useState<{
    n_alumnos: number; n_riesgo: number; pct_riesgo: number;
    nombre_colegio: string; salones: string[];
  } | null>(null);

  // Estadísticas del modelo actual del colegio (se cargan al abrir Datos)
  const [colegioModelStats, setColegioModelStats] = useState<{
    nombre_colegio: string;
    n_alumnos: number;
    n_riesgo: number;
    pct_riesgo: number;
    auc_cv: number | null;
    auc_train: number | null;
    modo_prediccion: string;
    salones: string[];
    trained_at: string | null;
    por_nivel: Record<string, number>;
  } | null>(null);

  async function loadColegioModelStats(ieCode: string) {
    if (!ieCode) return;
    try {
      const res = await fetch(`${apiUrl}/v1/colegio/${ieCode}/resumen`);
      if (res.ok) {
        const data = await res.json();
        const m = data.metricas ?? {};
        setColegioModelStats({
          nombre_colegio: data.nombre_colegio ?? ieCode,
          n_alumnos:      data.n_alumnos ?? 0,
          n_riesgo:       data.n_riesgo  ?? 0,
          pct_riesgo:     data.pct_riesgo ?? 0,
          auc_cv:         m.auc_cv ?? null,
          auc_train:      m.auc_train ?? null,
          modo_prediccion: m.modo_prediccion ?? "—",
          salones:        m.salones ?? [],
          trained_at:     data.trained_at ?? null,
          por_nivel:      data.por_nivel ?? {},
        });
      } else {
        setColegioModelStats(null);
      }
    } catch {
      setColegioModelStats(null);
    }
  }
  const colegioFileRef = useRef<HTMLInputElement>(null);

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

  async function uploadColegioExcels(files: FileList, ieCode: string) {
    if (!files.length || !ieCode) return;
    setColegioUploadStatus("uploading");
    setColegioUploadMsg(`Procesando ${files.length} archivo(s) para IE ${ieCode}...`);
    setColegioUploadResult(null);

    const form = new FormData();
    const notasFiles:    File[] = [];
    const conductaFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().includes("nota"))    notasFiles.push(f);
      else if (f.name.toLowerCase().includes("conducta")) conductaFiles.push(f);
      else notasFiles.push(f); // si no se puede determinar, lo trata como notas
    }

    if (!notasFiles.length) {
      setColegioUploadStatus("error");
      setColegioUploadMsg("Ningún archivo fue identificado como notas. Asegúrate de que los nombres incluyan 'Notas' o 'Conducta'.");
      return;
    }

    notasFiles.forEach(f    => form.append("notas_files",    f, f.name));
    conductaFiles.forEach(f => form.append("conducta_files", f, f.name));

    try {
      const res = await fetch(`${apiUrl}/v1/colegio/${ieCode}/procesar`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        const m = data.metricas ?? {};
        setColegioUploadResult({
          n_alumnos:      m.n_alumnos     ?? 0,
          n_riesgo:       m.n_riesgo      ?? 0,
          pct_riesgo:     m.pct_riesgo    ?? 0,
          nombre_colegio: m.nombre_colegio ?? ieCode,
          salones:        m.salones        ?? [],
        });
        setColegioUploadStatus("success");
        setColegioUploadMsg(`Modelo entrenado correctamente para ${m.nombre_colegio ?? ieCode}.`);
        await insertAudit("Cargar Excel del colegio", "colegio", { ie: ieCode, n_alumnos: m.n_alumnos });
        toast(`Datos de ${m.nombre_colegio ?? ieCode} cargados. ${m.n_alumnos} alumnos procesados.`, "success");
      } else {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        setColegioUploadStatus("error");
        setColegioUploadMsg(err.detail ?? "Error al procesar los archivos.");
        toast("Error al procesar los Excel del colegio.", "error");
      }
    } catch {
      setColegioUploadStatus("error");
      setColegioUploadMsg("No se pudo conectar con el backend. Verifica que esté activo.");
      toast("Error de conexión con el backend.", "error");
    }
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

  // Cargar estadísticas del modelo del colegio cuando el admin abre la pestaña Datos
  useEffect(() => {
    const isAdminRole = role === "admin" || role === "superadmin";
    if (isAdminRole && tab === "datos" && profileCodigoIe) {
      const ie = String(parseInt(profileCodigoIe, 10));
      void loadColegioModelStats(ie);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tab, profileCodigoIe]);

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
    // Carga de Excel del colegio
    colegioUploadIe, setColegioUploadIe,
    colegioUploadStatus, colegioUploadMsg, colegioUploadResult,
    colegioFileRef, uploadColegioExcels,
    colegioModelStats, loadColegioModelStats,
    loadDbUsers, loadDbAudit,
    handleCreateUser, validateCsv, saveSchedule,
    desactivarUsuario, activarUsuario, updateEstadoIntervencion,
  };
}
