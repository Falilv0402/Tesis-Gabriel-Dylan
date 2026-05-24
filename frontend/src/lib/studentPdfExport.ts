"use client";

/**
 * Student individual PDF export.
 * Pure utility — no React state. Called from useInterventions.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ShapData, Student } from "@/types";
import { shortId, pct } from "@/lib/format";
import { featureLabels } from "@/lib/constants";

export async function generateStudentPdf(
  selected:         Student,
  shapData:         ShapData | null,
  annotations:      { id: string; estudiante_id: string; contenido: string; created_at: string }[],
  sessionEmail:     string,
): Promise<void> {
  const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const headerColor: [number, number, number] =
    selected.nivel_riesgo === "ALTO"  ? [220, 38, 38] :
    selected.nivel_riesgo === "MEDIO" ? [217, 119, 6] : [22, 163, 74];

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SATRA — Reporte Individual de Estudiante", 12, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Riesgo ${selected.nivel_riesgo} · Est. ${shortId(selected.id)} · ${new Date().toLocaleDateString("es-PE")}`, 12, 17);

  // ── Perfil académico ──────────────────────────────────────────────────────
  doc.setTextColor(26, 37, 64);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Perfil académico", 12, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const datos: [string, string][] = [
    ["ID (anonimizado)",          `···${shortId(selected.id)}`],
    ["Distrito",                  selected.distrito],
    ["Sexo",                      selected.sexo],
    ["ISE individual",            selected.ise.toFixed(2)],
    ["ISE promedio IE",           selected.ise_iemean?.toFixed(2) ?? "—"],
    ["Puntaje Lectura (M500_L)",  selected.M500_L.toFixed(0)],
    ["Puntaje Ciencias (M500_CN)",selected.M500_CN.toFixed(0)],
    ["Nivel real en Matemática",  selected.grupo_m_real ?? "Sin dato"],
    ["Probabilidad de riesgo",    pct(selected.probabilidad_riesgo)],
    ["Nivel de riesgo",           selected.nivel_riesgo],
    ["Tipo de riesgo",            selected.tipo_riesgo],
  ];
  let y = 38;
  datos.forEach(([label, val]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 12, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(val), 75, y);
    y += 5.5;
  });

  // ── SHAP ──────────────────────────────────────────────────────────────────
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Factores que explican el riesgo (SHAP)", 12, y);
  y += 5;

  if (shapData && shapData.id_estudiante === selected.id && shapData.contributions.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Probabilidad base del modelo: ${pct(shapData.base_probabilidad)}`, 12, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [["Factor", "Valor del estudiante", "Contribución al riesgo"]],
      body: shapData.contributions.slice(0, 8).map((c) => [
        featureLabels[c.feature] ?? c.feature,
        typeof c.value === "number" ? c.value.toFixed(2) : String(c.value ?? "—"),
        `${c.contribution > 0 ? "+" : ""}${(c.contribution * 100).toFixed(1)}%`,
      ]),
      headStyles: { fillColor: headerColor, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const val = String(data.cell.raw);
          if (val.startsWith("+"))       data.cell.styles.textColor = [220, 38, 38];
          else if (val.startsWith("-"))  data.cell.styles.textColor = [22, 163, 74];
        }
      },
      margin: { left: 12, right: 12 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? (y + 42)) + 8;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text("Datos SHAP no disponibles — ejecutar con backend activo.", 12, y);
    y += 10;
    doc.setTextColor(26, 37, 64);
  }

  // ── Anotaciones ───────────────────────────────────────────────────────────
  const studentAnnotations = annotations.filter((a) => a.estudiante_id === selected.id);
  if (studentAnnotations.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Anotaciones del director:", 12, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    studentAnnotations.forEach((a) => {
      const dateStr = new Date(a.created_at).toLocaleDateString("es-PE");
      const lines   = doc.splitTextToSize(`[${dateStr}] ${a.contenido}`, pageW - 24);
      doc.text(lines, 12, y);
      y += lines.length * 5 + 2;
    });
  }

  // ── Firma + footer ────────────────────────────────────────────────────────
  y = Math.max(y + 10, pageH - 50);
  doc.setDrawColor(180, 180, 180);
  doc.line(12, y, 90, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text("Firma del director / coordinador académico", 12, y + 4);
  doc.setFontSize(7);
  doc.text(
    "Documento confidencial. Datos protegidos — Ley 29733 (Perú). Uso exclusivo educativo. SATRA — UPC P20261012.",
    pageW / 2, pageH - 6, { align: "center" }
  );
  doc.text(
    `Generado por ${sessionEmail} — ${new Date().toLocaleString("es-PE")}`,
    pageW / 2, pageH - 2, { align: "center" }
  );

  doc.save(`SARA_est_${shortId(selected.id)}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
