"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Tab } from "@/types";
import { supabase, createIsolatedClient } from "@/lib/supabase";
import { apiUrl, EM2022_HABILITADO } from "@/lib/constants";

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
    codigo_ie: string | null;
    distrito: string | null;
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
  // Colegio (IE) opcional para director/coordinador — separado de newUserDistrito
  // (que para esos roles guarda el DISTRITO, no el código de IE). Antes no existía
  // este campo y un coordinador no podía quedar asociado a ningún colegio propio.
  const [newUserColegioIe, setNewUserColegioIe] = useState("");

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
    nombre_colegio: string; salones: string[]; advertencias: string[];
  } | null>(null);

  // Estadísticas del modelo actual del colegio (se cargan al abrir Datos)
  const [colegioModelStats, setColegioModelStats] = useState<{
    nombre_colegio: string;
    n_alumnos: number;
    n_riesgo: number;
    pct_riesgo: number;
    auc_cv: number | null;
    auc_train: number | null;
    f1_train: number | null;
    precision_train: number | null;
    recall_train: number | null;
    accuracy_train: number | null;
    n_splits_cv: number | null;
    confusion_matrix: number[][] | null;
    roc_fpr: number[] | null;
    roc_tpr: number[] | null;
    modo_prediccion: string;
    salones: string[];
    trained_at: string | null;
    por_nivel: Record<string, number>;
    advertencias_carga: string[];
    importancia_variables: { variable: string; importancia: number }[] | null;
  } | null>(null);

  async function loadColegioModelStats(ieCode: string) {
    if (!ieCode) return;
    const ieNorm = String(parseInt(ieCode, 10)); // "0249" → "249"
    try {
      // 1️⃣ Intentar modelo CUBICOL propio del colegio
      const res = await fetch(`${apiUrl}/v1/colegio/${ieNorm}/resumen`);
      if (res.ok) {
        const data = await res.json();
        const m = data.metricas ?? {};
        setColegioModelStats({
          nombre_colegio:  data.nombre_colegio ?? ieCode,
          n_alumnos:       data.n_alumnos ?? 0,
          n_riesgo:        data.n_riesgo  ?? 0,
          pct_riesgo:      data.pct_riesgo ?? 0,
          auc_cv:          m.auc_cv ?? null,
          auc_train:       m.auc_train ?? null,
          f1_train:        m.f1_train ?? null,
          precision_train: m.precision_train ?? null,
          recall_train:    m.recall_train ?? null,
          accuracy_train:  m.accuracy_train ?? null,
          n_splits_cv:     m.n_splits_cv ?? null,
          confusion_matrix: m.confusion_matrix ?? null,
          roc_fpr:         m.roc_fpr ?? null,
          roc_tpr:         m.roc_tpr ?? null,
          modo_prediccion: m.modo_prediccion ?? "—",
          salones:         m.salones ?? [],
          trained_at:      data.trained_at ?? null,
          por_nivel:       data.por_nivel ?? {},
          advertencias_carga: m.advertencias_carga ?? [],
          importancia_variables: m.importancia_variables ?? null,
        });
        return;
      }

      // 2️⃣ Fallback: cargar stats del modelo nacional EM2022 para esta IE
      // (de momento apagado -- EM2022_HABILITADO en lib/constants.ts. Sin
      // modelo propio, colegioModelStats queda en null y DatosView ya
      // muestra el panel "Sin datos disponibles" para ese caso.)
      if (!EM2022_HABILITADO) { setColegioModelStats(null); return; }
      const emRes = await fetch(`${apiUrl}/v1/predicciones/resumen?id_ie=${ieNorm}`);
      if (emRes.ok) {
        const em = await emRes.json();
        const counts: Record<string, number> = em.risk_counts ?? {};
        const nAlto   = counts["ALTO"]  ?? 0;
        const nMedio  = counts["MEDIO"] ?? 0;
        const nBajo   = counts["BAJO"]  ?? 0;
        const nTotal  = em.total ?? (nAlto + nMedio + nBajo);
        const nRiesgo = nAlto + nMedio;
        const pct     = nTotal > 0 ? Math.round((nRiesgo / nTotal) * 100) : 0;

        // Obtener nombre del colegio desde el listado general
        let nombreColegio = `IE ${ieCode}`;
        try {
          const colegiosRes = await fetch(`${apiUrl}/v1/colegios`);
          if (colegiosRes.ok) {
            const colegios: { id_ie: string; nombre_ie?: string }[] = await colegiosRes.json();
            const match = colegios.find(c => String(parseInt(String(c.id_ie), 10)) === ieNorm);
            if (match?.nombre_ie) nombreColegio = match.nombre_ie;
          }
        } catch { /* nombre por defecto */ }

        setColegioModelStats({
          nombre_colegio:  nombreColegio,
          n_alumnos:       nTotal,
          n_riesgo:        nRiesgo,
          pct_riesgo:      pct,
          auc_cv:          null,
          auc_train:       null,
          f1_train:        null,
          precision_train: null,
          recall_train:    null,
          accuracy_train:  null,
          n_splits_cv:     null,
          confusion_matrix: null,
          roc_fpr:         null,
          roc_tpr:         null,
          modo_prediccion: "Modelo Nacional EM2022",
          salones:         [],
          trained_at:      null,
          por_nivel:       { ALTO: nAlto, MEDIO: nMedio, BAJO: nBajo },
          advertencias_carga: [],
          importancia_variables: null,
        });
      } else {
        setColegioModelStats(null);
      }
    } catch {
      setColegioModelStats(null);
    }
  }
  const colegioFileRef = useRef<HTMLInputElement>(null);

  // HU024/HU025/HU026: histórico de versiones del modelo por colegio — cada
  // reentrenamiento queda como una fila en modelos_versiones (backend), esto
  // solo la lee para graficar la evolución de riesgo en el tiempo.
  const [modelosVersiones, setModelosVersiones] = useState<{
    id: string; version: string; created_at: string;
    n_alumnos: number | null; n_alto: number | null; n_medio: number | null; n_bajo: number | null;
    accuracy: number | null; auc_roc: number | null;
  }[]>([]);
  async function loadModelosVersiones(codigoIe: string) {
    if (!codigoIe) { setModelosVersiones([]); return; }
    const ieNorm = String(parseInt(codigoIe, 10));
    const { data, error } = await supabase
      .from("modelos_versiones")
      .select("id, version, created_at, n_alumnos, n_alto, n_medio, n_bajo, accuracy, auc_roc")
      .eq("codigo_ie", ieNorm)
      .order("created_at", { ascending: true });
    // Si la migración 0012 todavía no se aplicó (columna codigo_ie no
    // existe), el error se ignora y el panel simplemente no muestra nada.
    setModelosVersiones(error ? [] : (data ?? []));
  }

  // HU039: respaldo y restauración del modelo — train_colegio_model.py ya
  // respalda el .pkl anterior antes de cada reentrenamiento; esto solo
  // consulta si hay uno disponible y permite restaurarlo desde la app.
  const [colegioRespaldo, setColegioRespaldo] = useState<{ disponible: boolean; fecha: string | null } | null>(null);
  const [restaurandoModelo, setRestaurandoModelo] = useState(false);

  async function loadColegioRespaldo(codigoIe: string) {
    if (!codigoIe) { setColegioRespaldo(null); return; }
    try {
      const res = await fetch(`${apiUrl}/v1/colegio/${codigoIe}/respaldo`);
      setColegioRespaldo(res.ok ? await res.json() : null);
    } catch {
      setColegioRespaldo(null);
    }
  }

  async function restaurarModeloColegio(codigoIe: string) {
    if (!codigoIe) return;
    setRestaurandoModelo(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/v1/colegio/${codigoIe}/restaurar`, {
        method: "POST",
        headers: currentSession?.access_token
          ? { Authorization: `Bearer ${currentSession.access_token}` }
          : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        toast(`Modelo de ${data.nombre_colegio ?? codigoIe} restaurado al respaldo anterior.`, "success");
        await insertAudit("Restaurar modelo anterior", "colegio", { ie: codigoIe });
        await Promise.all([
          loadColegioModelStats(codigoIe),
          loadModelosVersiones(codigoIe),
          loadColegioRespaldo(codigoIe),
        ]);
      } else {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        toast(err.detail ?? "No se pudo restaurar el modelo.", "error");
      }
    } catch {
      toast("Error de conexión con el backend.", "error");
    }
    setRestaurandoModelo(false);
  }

  const [scheduleFreq, setScheduleFreq] = useState("semanal");
  const [scheduleMsg, setScheduleMsg] = useState("");
  const [nextUpdate, setNextUpdate] = useState<string | null>(null);

  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [modelMessage, setModelMessage] = useState("Conectando con el servicio del modelo...");

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDbUsers() {
    let query = supabase
      .from("profiles")
      .select("id, email, nombre, rol, activo, codigo_ie, distrito")
      .order("created_at");

    // Admin o Director de colegio solo ve usuarios de su propia IE
    if ((role === "admin" || role === "director") && profileCodigoIe) {
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
    const rolEfectivo = newUserRol;
    if (!EM2022_HABILITADO && (rolEfectivo === "director" || rolEfectivo === "coordinador") && !newUserColegioIe) {
      toast("Selecciona un colegio para el nuevo usuario.", "error");
      return;
    }
    setAuthBusy(true);

    // Para "admin" newUserDistrito guarda el código de IE elegido (select
    // "Colegio asignado"); para "director"/"coordinador" guarda el DISTRITO,
    // y el colegio (opcional) viene del campo separado newUserColegioIe.
    const ieEfectiva = role === "admin"
      ? (profileCodigoIe ?? "")
      : rolEfectivo === "admin"
        ? newUserDistrito
        : newUserColegioIe;

    // codigo_ie y distrito se pasan como metadatos del usuario: el trigger
    // handle_new_user (SECURITY DEFINER, migración 0010) los lee desde
    // raw_user_meta_data y los inserta directamente en profiles al crear
    // la fila — sin necesidad de un UPDATE posterior ni restricciones RLS.
    const metaCodigoIe = ieEfectiva || null;
    const metaDistrito = (rolEfectivo === "director" || rolEfectivo === "coordinador")
      ? (newUserDistrito || null)
      : null;

    // IMPORTANTE: usamos un cliente AISLADO para el signUp. Supabase inicia
    // sesión automáticamente como el usuario recién creado; si usáramos el
    // cliente principal, el superadmin/admin quedaría logueado como el usuario
    // que acaba de crear. Con el cliente desechable, la sesión actual no se toca.
    const signupClient = createIsolatedClient();
    const { data: signUpData, error } = await signupClient.auth.signUp({
      email: newUserEmail,
      password: newUserPwd,
      options: {
        data: {
          nombre:    newUserNombre,
          rol:       rolEfectivo,
          codigo_ie: metaCodigoIe,
          distrito:  metaDistrito,
        },
      },
    });
    // Cerrar la sesión del cliente efímero (no persiste, pero por prolijidad).
    await signupClient.auth.signOut().catch(() => {});

    if (!error && signUpData.user) {
      await insertAudit("Crear usuario", "profiles", { email: newUserEmail, rol: newUserRol, asignacion: newUserDistrito });
      setShowCreateUser(false);
      setNewUserEmail(""); setNewUserNombre(""); setNewUserPwd(""); setNewUserRol("director");
      setNewUserDistrito(""); setNewUserColegioIe("");
      toast(`Usuario ${newUserEmail} creado correctamente como ${newUserRol}.`);
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
      // El backend valida el rol (admin/superadmin) contra este token de sesión
      // de Supabase — sin él, cualquiera que alcance la URL pública podría
      // reentrenar el modelo de cualquier colegio con datos arbitrarios.
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/v1/colegio/${ieCode}/procesar`, {
        method: "POST",
        headers: currentSession?.access_token
          ? { Authorization: `Bearer ${currentSession.access_token}` }
          : undefined,
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        const m = data.metricas ?? {};
        const advertencias: string[] = m.advertencias_carga ?? [];
        setColegioUploadResult({
          n_alumnos:      m.n_alumnos     ?? 0,
          n_riesgo:       m.n_riesgo      ?? 0,
          pct_riesgo:     m.pct_riesgo    ?? 0,
          nombre_colegio: m.nombre_colegio ?? ieCode,
          salones:        m.salones        ?? [],
          advertencias,
        });
        setColegioUploadStatus("success");
        setColegioUploadMsg(
          advertencias.length > 0
            ? `Modelo entrenado para ${m.nombre_colegio ?? ieCode}, con ${advertencias.length} advertencia(s) — revisa el detalle abajo.`
            : `Modelo entrenado correctamente para ${m.nombre_colegio ?? ieCode}.`
        );
        await insertAudit("Cargar Excel del colegio", "colegio", { ie: ieCode, n_alumnos: m.n_alumnos, advertencias: advertencias.length, nuevos_alto: data.nuevos_alto ?? 0 });
        toast(`Datos de ${m.nombre_colegio ?? ieCode} cargados. ${m.n_alumnos} alumnos procesados.`, "success");
        // El reentrenamiento que acaba de correr ya respaldó el modelo anterior
        // (train_colegio_model.py) — refrescamos para que "Restaurar" aparezca.
        void loadColegioRespaldo(ieCode);
        // HU019: si el reentrenamiento detectó alumnos NUEVOS en riesgo ALTO,
        // el backend ya envió el correo automático — se lo confirmamos aquí
        // a quien subió el Excel para que sepa que se avisó al equipo.
        if (data.nuevos_alto > 0) {
          toast(`⚠️ ${data.nuevos_alto} alumno(s) nuevo(s) en riesgo ALTO — se notificó por correo al equipo.`, "info");
        }
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
    const { error } = await supabase.from("profiles").update({ activo: false }).eq("id", id);
    if (error) { toast("No se pudo desactivar (sin permiso o usuario fuera de tu colegio).", "error"); return; }
    await insertAudit("Desactivar usuario", "profiles", { usuario_id: id });
    toast("Usuario desactivado correctamente.");
    void loadDbUsers();
  }

  async function activarUsuario(id: string) {
    const { error } = await supabase.from("profiles").update({ activo: true }).eq("id", id);
    if (error) { toast("No se pudo activar (sin permiso o usuario fuera de tu colegio).", "error"); return; }
    await insertAudit("Activar usuario", "profiles", { usuario_id: id });
    toast("Usuario activado correctamente.", "success");
    void loadDbUsers();
  }

  // HU005: cambiar el rol de un usuario ya existente (antes solo se podía
  // elegir el rol al crearlo). RLS ya restringe quién puede tocar a quién
  // (admin: solo su propia IE; superadmin: todos) — este handler solo
  // reporta si el update no tuvo efecto.
  async function cambiarRolUsuario(id: string, nuevoRol: string) {
    const { error } = await supabase.from("profiles").update({ rol: nuevoRol }).eq("id", id);
    if (error) { toast("No se pudo cambiar el rol (sin permiso).", "error"); return; }
    await insertAudit("Cambiar rol de usuario", "profiles", { usuario_id: id, nuevo_rol: nuevoRol });
    toast(`Rol actualizado a ${nuevoRol}.`, "success");
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

  const stableLoadUsers = useCallback(() => void loadDbUsers(), [role, profileCodigoIe]); // eslint-disable-line react-hooks/exhaustive-deps
  const stableLoadAudit = useCallback(() => void loadDbAudit(), [role, profileCodigoIe]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Load DB users when superadmin, admin o director (de su propio colegio)
  // abre la pestaña. La auditoría (audit_log) queda solo para admin/superadmin
  // -- RLS todavía no le da acceso a esa tabla a un director.
  useEffect(() => {
    const puedeVerUsuarios = role === "admin" || role === "superadmin" || role === "director";
    const puedeVerAuditoria = role === "admin" || role === "superadmin";
    if (tab === "usuarios" && session) {
      if (puedeVerUsuarios) stableLoadUsers();
      if (puedeVerAuditoria) stableLoadAudit();
    }
  }, [role, tab, session, stableLoadUsers, stableLoadAudit]);

  // Cargar estadísticas del modelo del colegio cuando el admin/director/coordinador abre la pestaña Datos
  useEffect(() => {
    const isColegioRole = role === "admin" || role === "superadmin" || role === "director" || role === "coordinador";
    if (isColegioRole && tab === "datos" && profileCodigoIe) {
      const ie = String(parseInt(profileCodigoIe, 10));
      void loadColegioModelStats(ie);
      void loadModelosVersiones(ie);
      void loadColegioRespaldo(ie);
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
    newUserColegioIe, setNewUserColegioIe,
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
    modelosVersiones, loadModelosVersiones,
    colegioRespaldo, restaurandoModelo, restaurarModeloColegio,
    loadDbUsers, loadDbAudit,
    handleCreateUser, validateCsv, saveSchedule,
    desactivarUsuario, activarUsuario, cambiarRolUsuario, updateEstadoIntervencion,
  };
}
