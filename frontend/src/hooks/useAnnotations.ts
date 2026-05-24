"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Student } from "@/types";
import { supabase } from "@/lib/supabase";

export type Annotation = {
  id: string;
  estudiante_id: string;
  contenido: string;
  created_at: string;
  autor_id?: string;
  autor_nombre?: string | null;
  autor_email?: string | null;
  es_propia?: boolean;
};

export function useAnnotations(
  session:     User | null,
  selected:    Student | undefined,
  insertAudit: (accion: string, tabla?: string, detalle?: object) => Promise<void>,
  toast:       (msg: string, type?: "success" | "error" | "info") => void,
) {
  const [annotations,       setAnnotations]       = useState<Annotation[]>([]);
  const [annotationText,    setAnnotationText]    = useState("");
  const [isSavingAnnotation,setIsSavingAnnotation]= useState(false);

  async function loadAnnotations(studentId: string) {
    if (!session) return;
    const { data } = await supabase
      .from("anotaciones")
      .select("id, estudiante_id, contenido, created_at, autor_id, profiles(nombre, email)")
      .eq("estudiante_id", studentId)
      .order("created_at", { ascending: false });
    if (data) {
      setAnnotations(
        data.map((a: Record<string, unknown>) => {
          const p = a.profiles as { nombre?: string; email?: string } | null;
          return {
            id:           a.id as string,
            estudiante_id:a.estudiante_id as string,
            contenido:    a.contenido as string,
            created_at:   a.created_at as string,
            autor_id:     a.autor_id as string,
            autor_nombre: p?.nombre ?? null,
            autor_email:  p?.email  ?? null,
            es_propia:    a.autor_id === session.id,
          };
        })
      );
    }
  }

  async function saveAnnotation() {
    if (!session || !selected || !annotationText.trim()) return;
    setIsSavingAnnotation(true);
    const { error } = await supabase.from("anotaciones").insert({
      estudiante_id: selected.id,
      autor_id:      session.id,
      contenido:     annotationText.trim(),
    });
    if (!error) {
      setAnnotationText("");
      await loadAnnotations(selected.id);
      toast("Anotación guardada.");
      await insertAudit("Guardar anotacion", "anotaciones", { estudiante_id: selected.id });
    } else {
      toast("Error al guardar la anotación.", "error");
    }
    setIsSavingAnnotation(false);
  }

  return {
    annotations, setAnnotations,
    annotationText, setAnnotationText,
    isSavingAnnotation,
    loadAnnotations, saveAnnotation,
  };
}
