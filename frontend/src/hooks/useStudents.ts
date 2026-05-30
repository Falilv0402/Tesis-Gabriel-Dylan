"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { DatasetSummary, Diagnostico, RiskLevel, ShapData, Student } from "@/types";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/constants";
import type { DistrictRiskEntry } from "@/components/maps/LimaHeatmap";

export function useStudents(
  profileCodigoIe: string | null,
  profileDistrito: string | null,
  role: string,
  session: User | null,
  thresholdHigh: number,
  thresholdMedium: number,
  diagnostico: Diagnostico | null,
  apiConnected: boolean | null,
  setApiConnected: (v: boolean) => void,
  toast: (msg: string, type?: "success" | "error" | "info") => void,
  insertAudit: (accion: string, tabla?: string, detalle?: object) => Promise<void>,
) {
  const [students,          setStudents]          = useState<Student[]>([]);
  const [totalStudents,     setTotalStudents]      = useState(0);
  const [summary,           setSummary]            = useState<DatasetSummary>({
    total: 0, risk_counts: { ALTO: 0, MEDIO: 0, BAJO: 0 }, facets: {},
  });
  const [isLoadingMore,     setIsLoadingMore]      = useState(false);
  const [isSavingPredictions, setIsSavingPredictions] = useState(false);
  const [predictionsSaved,  setPredictionsSaved]   = useState(false);

  // Filters
  const [risk,      setRisk]      = useState("Todos");
  const [distrito,  setDistrito]  = useState("Todos");
  const [sexo,      setSexo]      = useState("Todos");
  const [segment,   setSegment]   = useState("Todos");
  const [selectedId,setSelectedId]= useState("");
  const [search,    setSearch]    = useState("");

  // SHAP
  const [shapData,    setShapData]    = useState<ShapData | null>(null);
  const [shapLoading, setShapLoading] = useState(false);

  // Comparator
  const [comparatorIds,  setComparatorIds]  = useState<string[]>([]);
  const [showComparator, setShowComparator] = useState(false);
  const [showIeProfile,  setShowIeProfile]  = useState(false);
  const [ieProfileId,    setIeProfileId]    = useState<string | null>(null);

  // Plan milestones
  const [planMilestones,    setPlanMilestones]    = useState<{
    id: string; texto: string; fecha: string; completado: boolean;
    autor_id?: string; autor_nombre?: string | null; autor_email?: string | null; es_propio?: boolean;
  }[]>([]);
  const [newMilestone,      setNewMilestone]      = useState("");
  const [newMilestoneDate,  setNewMilestoneDate]  = useState<string>(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [studentTab, setStudentTab] = useState<"resumen" | "anotaciones" | "plan">("resumen");
  const [isLoadingMilestones, setIsLoadingMilestones] = useState(false);

  function defaultMilestoneDate() {
    return new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  }

  function mapPrediction(item: Record<string, unknown>, index: number): Student {
    const m500L  = (item.M500_L  as number) ?? 0;
    const m500CN = (item.M500_CN as number) ?? 0;
    const ise    = (item.ise     as number) ?? 1.5;
    const tipo_riesgo =
      m500L < 450 && m500CN < 450 ? "Rendimiento multiple" :
      m500L < 450                  ? "Bajo en Lectura"      :
      m500CN < 450                 ? "Bajo en Ciencias"     :
      ise < 0.8                    ? "Contexto socioecon."  : "Sin alerta";
    return {
      id:        String(item.id_estudiante ?? `EST-${String(index + 1).padStart(4, "0")}`),
      id_ie:     (item.id_ie as string) ?? undefined,
      sexo:      (item.sexo  as string) ?? "Sin dato",
      ise, distrito: (item.distrito as string) ?? "Sin dato",
      M500_L: m500L, M500_CN: m500CN,
      M500_L_iemean:  typeof item.M500_L_iemean  === "number" ? item.M500_L_iemean  : undefined,
      M500_CN_iemean: typeof item.M500_CN_iemean === "number" ? item.M500_CN_iemean : undefined,
      ise_iemean:     typeof item.ise_iemean     === "number" ? item.ise_iemean     : undefined,
      M500_M:         item.M500_M      as number | undefined,
      grupo_m_real:   item.grupo_m_real as string | undefined,
      probabilidad_riesgo: item.probabilidad_riesgo as number,
      nivel_riesgo:   item.nivel_riesgo as RiskLevel,
      tipo_riesgo, periodo: "EM 2022",
    };
  }

  // El EM 2022 almacena IE como entero (249), pero el perfil lo guarda
  // con cero a la izquierda ("0249"). Normalizamos quitando ceros iniciales.
  const ieParaFiltro = profileCodigoIe
    ? String(parseInt(profileCodigoIe, 10))  // "0249" → "249"
    : null;

  // Tanto director como coordinador deben ver solo su IE
  const isDirectorRole = role === "director" || role === "coordinador";

  function buildDatasetQuery(offset = 0) {
    const params = new URLSearchParams({ limit: "1000", offset: String(offset) });
    if (risk     !== "Todos") params.set("nivel",    risk);
    if (distrito !== "Todos") params.set("distrito", distrito);
    if (sexo     !== "Todos") params.set("sexo",     sexo);
    if (isDirectorRole && ieParaFiltro) params.set("id_ie", ieParaFiltro);
    return params;
  }

  function buildSummaryQuery() {
    const params = new URLSearchParams();
    if (risk     !== "Todos") params.set("nivel",    risk);
    if (distrito !== "Todos") params.set("distrito", distrito);
    if (sexo     !== "Todos") params.set("sexo",     sexo);
    if (isDirectorRole && ieParaFiltro) params.set("id_ie", ieParaFiltro);
    return params;
  }

  async function loadStudents() {
    setPredictionsSaved(false);
    try {
      const summaryRes = await fetch(`${apiUrl}/v1/predicciones/resumen?${buildSummaryQuery()}`);
      if (summaryRes.ok) setSummary(await summaryRes.json());

      const res = await fetch(
        `${apiUrl}/v1/predicciones/dataset?${buildDatasetQuery(0)}`, { method: "POST" }
      );
      if (res.ok) {
        const payload = await res.json();
        const mapped  = (payload.resultados as Record<string, unknown>[]).map(mapPrediction);
        setStudents(mapped);
        setTotalStudents(payload.total ?? mapped.length);
        const mostUrgent = [...mapped].sort((a, b) => b.probabilidad_riesgo - a.probabilidad_riesgo)[0];
        setSelectedId(mostUrgent?.id ?? "");
        setApiConnected(true);
      }
    } catch {
      setStudents([]);
      setTotalStudents(0);
      setSummary({ total: 0, risk_counts: { ALTO: 0, MEDIO: 0, BAJO: 0 }, facets: {} });
      setApiConnected(false);
    }
  }

  async function loadMoreStudents() {
    if (isLoadingMore || students.length >= totalStudents) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `${apiUrl}/v1/predicciones/dataset?${buildDatasetQuery(students.length)}`, { method: "POST" }
      );
      if (res.ok) {
        const payload = await res.json();
        const mapped  = (payload.resultados as Record<string, unknown>[]).map(
          (item, i) => mapPrediction(item, students.length + i)
        );
        setStudents((prev) => [...prev, ...mapped]);
        setTotalStudents(payload.total ?? totalStudents);
      }
    } finally { setIsLoadingMore(false); }
  }

  async function fetchShap(studentId: string) {
    if (!studentId) return;
    setShapLoading(true);
    setShapData(null);
    try {
      const res = await fetch(`${apiUrl}/v1/predicciones/${encodeURIComponent(studentId)}/shap`);
      if (res.ok) setShapData(await res.json());
    } catch { /* backend offline */ }
    finally { setShapLoading(false); }
  }

  async function savePredictionsToSupabase(studentList: Student[], modelVersion: string) {
    if (!session || studentList.length === 0) return;
    setIsSavingPredictions(true);
    const periodo = "EM 2022";
    const batchSize = 300;
    let saved = 0;
    try {
      for (let i = 0; i < studentList.length; i += batchSize) {
        const batch = studentList.slice(i, i + batchSize).map((s) => ({
          estudiante_id: s.id, periodo,
          probabilidad_riesgo: s.probabilidad_riesgo,
          nivel_riesgo: s.nivel_riesgo,
          modelo_version: modelVersion || "desconocido",
        }));
        const { error } = await supabase
          .from("predicciones")
          .upsert(batch, { onConflict: "estudiante_id,periodo" });
        if (!error) saved += batch.length;
      }
      setPredictionsSaved(true);
      toast(`${saved.toLocaleString("es-PE")} predicciones guardadas en la base de datos.`, "success");
      await insertAudit("Guardar predicciones", "predicciones", { total: saved, periodo });
    } catch (err) {
      toast("Error al guardar predicciones: " + String(err), "error");
    } finally { setIsSavingPredictions(false); }
  }

  function toggleComparator(id: string) {
    setComparatorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
      : prev.length >= 3 ? [...prev.slice(1), id]
      : [...prev, id]
    );
  }

  async function loadMilestones(studentId: string) {
    if (!session) return;
    setIsLoadingMilestones(true);
    const { data, error } = await supabase
      .from("plan_hitos")
      .select("id, texto, fecha_objetivo, completado, autor_id, profiles(nombre, email)")
      .eq("estudiante_id", studentId)
      .order("created_at", { ascending: true });
    if (error) { toast("Error al cargar el plan de hitos.", "error"); setIsLoadingMilestones(false); return; }
    if (data) {
      setPlanMilestones(
        data.map((m) => {
          const p = m.profiles as { nombre?: string; email?: string } | null;
          return {
            id:           m.id as string,
            texto:        m.texto as string,
            fecha: m.fecha_objetivo
              ? new Date((m.fecha_objetivo as string) + "T00:00:00").toLocaleDateString("es-PE", {
                  day: "2-digit", month: "short", year: "numeric",
                })
              : "Sin fecha",
            completado:   m.completado as boolean,
            autor_id:     m.autor_id as string,
            autor_nombre: p?.nombre ?? null,
            autor_email:  p?.email  ?? null,
            es_propio:    m.autor_id === session.id,
          };
        })
      );
    }
    setIsLoadingMilestones(false);
  }

  async function addMilestone() {
    const texto = newMilestone.trim();
    if (!texto) return;
    const fechaIso = newMilestoneDate || defaultMilestoneDate();
    const fecha = new Date(fechaIso + "T00:00:00").toLocaleDateString("es-PE", {
      day: "2-digit", month: "short", year: "numeric",
    });

    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    setPlanMilestones((prev) => [...prev, { id: tempId, texto, fecha, completado: false }]);
    setNewMilestone("");
    setNewMilestoneDate(defaultMilestoneDate());

    if (session && selected) {
      const { data, error } = await supabase
        .from("plan_hitos")
        .insert({
          autor_id:      session.id,
          estudiante_id: selected.id,
          texto,
          fecha_objetivo: fechaIso,
          completado:    false,
        })
        .select("id")
        .single();
      if (!error && data) {
        // Replace temp id with the real uuid
        setPlanMilestones((prev) =>
          prev.map((m) => m.id === tempId ? { ...m, id: data.id as string } : m)
        );
      } else {
        // Roll back if insert failed
        setPlanMilestones((prev) => prev.filter((m) => m.id !== tempId));
        toast("Error al guardar el hito.", "error");
      }
    }
  }

  async function toggleMilestone(id: string) {
    const milestone = planMilestones.find((m) => m.id === id);
    if (!milestone) return;
    const nuevoEstado = !milestone.completado;

    // Optimistic update
    setPlanMilestones((prev) =>
      prev.map((m) => m.id === id ? { ...m, completado: nuevoEstado } : m)
    );

    if (session && !id.startsWith("temp-")) {
      const { error } = await supabase
        .from("plan_hitos")
        .update({ completado: nuevoEstado })
        .eq("id", id)
        .eq("autor_id", session.id);
      if (error) {
        // Roll back
        setPlanMilestones((prev) =>
          prev.map((m) => m.id === id ? { ...m, completado: !nuevoEstado } : m)
        );
        toast("Error al actualizar el hito.", "error");
      }
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const classifiedStudents = useMemo(() =>
    students.map((s) => ({
      ...s,
      nivel_riesgo: (
        s.probabilidad_riesgo * 100 >= thresholdHigh  ? "ALTO"  :
        s.probabilidad_riesgo * 100 >= thresholdMedium ? "MEDIO" : "BAJO"
      ) as RiskLevel,
    })),
    [students, thresholdHigh, thresholdMedium]
  );

  // Fix #8: `segment` y `search` se aplican en cliente sobre el dataset ya cargado.
  // Los filtros `risk`, `distrito`, `sexo` se envían al backend (loadStudents).
  // Esto es intencional: segment/search son exploración rápida sin re-fetch;
  // risk/distrito/sexo reducen el volumen descargado cuando el dataset es grande.
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return classifiedStudents
      .filter((s) => segment  === "Todos" || s.tipo_riesgo === segment)
      .filter((s) => !q || s.id.toLowerCase().includes(q) || s.distrito.toLowerCase().includes(q))
      .sort((a, b) => b.probabilidad_riesgo - a.probabilidad_riesgo);
  }, [classifiedStudents, segment, search]);

  const localCounts = useMemo(() => ({
    ALTO:  classifiedStudents.filter((s) => s.nivel_riesgo === "ALTO").length,
    MEDIO: classifiedStudents.filter((s) => s.nivel_riesgo === "MEDIO").length,
    BAJO:  classifiedStudents.filter((s) => s.nivel_riesgo === "BAJO").length,
  }), [classifiedStudents]);

  const districtRiskMap = useMemo<Record<string, DistrictRiskEntry>>(() => {
    const acc: Record<string, { total: number; alto: number; medio: number }> = {};
    for (const s of classifiedStudents) {
      const d = (s.distrito ?? "").toUpperCase().trim();
      if (!d) continue;
      acc[d] = acc[d] ?? { total: 0, alto: 0, medio: 0 };
      acc[d].total++;
      if (s.nivel_riesgo === "ALTO")  acc[d].alto++;
      else if (s.nivel_riesgo === "MEDIO") acc[d].medio++;
    }
    return Object.fromEntries(
      Object.entries(acc).map(([d, v]) => [d, { ...v, pct: v.alto / Math.max(v.total, 1) }])
    );
  }, [classifiedStudents]);

  const selected     = classifiedStudents.find((s) => s.id === selectedId) ?? filtered[0];
  const high         = localCounts.ALTO;
  const medium       = localCounts.MEDIO;
  const low          = localCounts.BAJO;
  const displayTotal = classifiedStudents.length || totalStudents;
  const avgIse       = students.length > 0
    ? (students.reduce((sum, s) => sum + s.ise, 0) / students.length).toFixed(2)
    : "—";

  const cohortStats = useMemo(() => {
    if (classifiedStudents.length === 0) return null;
    const bySex: Record<string, { n: number; alto: number; prob: number[] }> = {};
    for (const s of classifiedStudents) {
      const sx = s.sexo || "Sin dato";
      bySex[sx] = bySex[sx] ?? { n: 0, alto: 0, prob: [] };
      bySex[sx].n++;
      if (s.nivel_riesgo === "ALTO") bySex[sx].alto++;
      bySex[sx].prob.push(s.probabilidad_riesgo);
    }
    return { bySex };
  }, [classifiedStudents]);

  // Auto-filter by district for directors AND coordinators
  useEffect(() => {
    const isDir = role === "director" || role === "coordinador";
    if (isDir && profileDistrito) setDistrito(profileDistrito);
  }, [role, profileDistrito]);

  // Reload students when filters change
  useEffect(() => {
    void loadStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk, distrito, sexo, profileCodigoIe]);

  // Load SHAP when selection changes
  useEffect(() => {
    if (selectedId && apiConnected) void fetchShap(selectedId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, apiConnected]);

  return {
    students, totalStudents, summary, isLoadingMore,
    isSavingPredictions, predictionsSaved,
    risk, setRisk, distrito, setDistrito, sexo, setSexo,
    segment, setSegment, selectedId, setSelectedId, search, setSearch,
    shapData, shapLoading,
    comparatorIds, showComparator, setShowComparator,
    showIeProfile, setShowIeProfile, ieProfileId, setIeProfileId,
    planMilestones, newMilestone, setNewMilestone,
    newMilestoneDate, setNewMilestoneDate,
    studentTab, setStudentTab,
    // computed
    classifiedStudents, cohortStats, localCounts, filtered, selected,
    high, medium, low, displayTotal, avgIse, districtRiskMap,
    // functions
    loadStudents, loadMoreStudents, fetchShap,
    savePredictionsToSupabase, toggleComparator,
    addMilestone, toggleMilestone, loadMilestones,
    isLoadingMilestones, defaultMilestoneDate,
  };
}
