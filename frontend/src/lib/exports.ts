"use client";

/**
 * Client-side export utilities (CSV, XLSX, PDF) for the student risk dataset.
 * All functions are pure (no React state) and accept the data they need.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { Metrics, Student } from "@/types";
import { shortId, pct, toCsv } from "@/lib/format";

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportCsv(filtered: Student[]) {
  const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "estudiantes_riesgo.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// ── XLSX ──────────────────────────────────────────────────────────────────────

export function exportXlsx(
  filtered:  Student[],
  metrics:   Metrics,
  high:      number,
  medium:    number,
  low:       number,
) {
  const headers = [
    "ID", "Sexo", "ISE", "Distrito", "M500_L", "M500_CN",
    "Probabilidad", "Nivel Riesgo", "Tipo Riesgo", "Nivel Real Mat.",
  ];
  const rows = filtered.map((s) => [
    shortId(s.id), s.sexo, s.ise.toFixed(2), s.distrito,
    s.M500_L.toFixed(0), s.M500_CN.toFixed(0),
    (s.probabilidad_riesgo * 100).toFixed(1) + "%",
    s.nivel_riesgo, s.tipo_riesgo, s.grupo_m_real ?? "",
  ]);
  const total   = high + medium + low;
  const resumen = [
    ["SATRA — Reporte de Riesgo Académico"],
    ["Fecha", new Date().toLocaleDateString("es-PE")],
    ["Modelo", metrics.modelo_ganador ?? "—"],
    ["AUC-ROC", metrics.auc_roc ? (metrics.auc_roc * 100).toFixed(1) + "%" : "—"],
    [],
    ["Nivel", "N°"],
    ["ALTO",  high],
    ["MEDIO", medium],
    ["BAJO",  low],
    [],
    ["Total", total],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Estudiantes Riesgo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");
  XLSX.writeFile(wb, `SATRA_estudiantes_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export function exportPdf(
  filtered:     Student[],
  metrics:      Metrics,
  displayTotal: number,
  high:         number,
  medium:       number,
  low:          number,
  userEmail:    string,
) {
  const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(15, 31, 61);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("SATRA — Sistema de Alerta Temprana de Riesgo Academico", 12, 11);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Universidad Peruana de Ciencias Aplicadas — Proyecto P20261012", 12, 17);

  // Summary
  doc.setTextColor(26, 37, 64); doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(`Reporte ejecutivo — ${new Date().toLocaleDateString("es-PE", { dateStyle: "long" })}`, 12, 32);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  let y = 40;
  [
    `Total estudiantes: ${displayTotal.toLocaleString("es-PE")}`,
    `Riesgo ALTO: ${high} (${((high / Math.max(displayTotal, 1)) * 100).toFixed(1)}%)`,
    `Riesgo MEDIO: ${medium} · Riesgo BAJO: ${low}`,
    `Modelo: ${metrics.modelo_ganador ?? "—"} | AUC: ${pct(metrics.auc_roc)} | F1: ${pct(metrics.f1_score)}`,
  ].forEach((line) => { doc.text(line, 12, y); y += 5.5; });

  // Table
  autoTable(doc, {
    startY: y + 4,
    head: [["Est.", "Distrito", "Sexo", "ISE", "Lectura", "Ciencias", "Prob.", "Nivel"]],
    body: filtered.slice(0, 50).map((s) => [
      shortId(s.id), s.distrito, s.sexo, s.ise.toFixed(2),
      s.M500_L.toFixed(0), s.M500_CN.toFixed(0), pct(s.probabilidad_riesgo), s.nivel_riesgo,
    ]),
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 12, right: 12 },
  });

  // Footer
  doc.setFontSize(7); doc.setTextColor(90, 106, 133);
  doc.text(
    "Documento confidencial. Datos protegidos por Ley 29733 (Peru). Uso exclusivo educativo. SATRA - UPC.",
    pageW / 2, pageH - 8, { align: "center" }
  );
  doc.text(
    `Generado por ${userEmail} — ${new Date().toLocaleString("es-PE")}`,
    pageW / 2, pageH - 4, { align: "center" }
  );

  doc.save(`SATRA_reporte_${new Date().toISOString().slice(0, 10)}.pdf`);
}
