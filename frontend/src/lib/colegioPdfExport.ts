"use client";

/**
 * colegioPdfExport.ts
 * Genera el reporte PDF del colegio propio (ColegioReportesView).
 * Orientación landscape A4 para que quepan las 7 materias + conducta.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AlumnoColegio } from "@/types";
import { MATERIAS_COLEGIO, notaInfo, notaBimestre, type Bimestre } from "@/lib/colegio";
import { pct } from "@/lib/format";

const NAVY: [number, number, number] = [15, 31, 61];
const GRAY: [number, number, number] = [90, 106, 133];

export function exportColegioPdf(
  nombreColegio: string,
  filtrados:     AlumnoColegio[],   // alumnos ya filtrados (los que van a la tabla)
  allAlumnos:    AlumnoColegio[],   // todos los alumnos (para totales del colegio)
  bimestre:      Bimestre,
  userEmail:     string,
): void {
  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 297 mm
  const pageH = doc.internal.pageSize.getHeight();  // 210 mm

  // ── Conteos ──────────────────────────────────────────────────────────────
  const tot     = filtrados.length;
  const alto    = filtrados.filter((a) => a.nivel_riesgo === "ALTO").length;
  const medio   = filtrados.filter((a) => a.nivel_riesgo === "MEDIO").length;
  const bajo    = filtrados.filter((a) => a.nivel_riesgo === "BAJO").length;
  const enRiesgo = alto + medio;

  const allTot    = allAlumnos.length;
  const allAlto   = allAlumnos.filter((a) => a.nivel_riesgo === "ALTO").length;
  const allMedio  = allAlumnos.filter((a) => a.nivel_riesgo === "MEDIO").length;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SATRA — Reporte de Riesgo Académico", 12, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${nombreColegio} · Bimestre ${bimestre} · ${new Date().toLocaleDateString("es-PE", { dateStyle: "long" })}`,
    12, 17,
  );

  // ── Resumen ejecutivo (dos columnas) ─────────────────────────────────────
  let y = 30;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Resumen del colegio (total)", 12, y);
  doc.text("Mostrando en este reporte", pageW / 2 + 4, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const col1: string[] = [
    `Total alumnos:   ${allTot}`,
    `Riesgo ALTO:     ${allAlto}  (${pct(allAlto  / Math.max(allTot, 1))})`,
    `Riesgo MEDIO:    ${allMedio} (${pct(allMedio / Math.max(allTot, 1))})`,
    `En riesgo (A+M): ${allAlto + allMedio} (${pct((allAlto + allMedio) / Math.max(allTot, 1))})`,
  ];
  const col2: string[] = [
    `Alumnos filtrados:  ${tot}`,
    `Riesgo ALTO:        ${alto}`,
    `Riesgo MEDIO:       ${medio}  ·  BAJO: ${bajo}`,
    `En riesgo (A+M):    ${enRiesgo} (${pct(enRiesgo / Math.max(tot, 1))})`,
  ];
  col1.forEach((line) => { doc.text(line, 12, y); y += 4.5; });
  y = 35;
  col2.forEach((line) => { doc.text(line, pageW / 2 + 4, y); y += 4.5; });
  y = Math.max(y, 35 + col1.length * 4.5) + 4;

  // ── Tabla de alumnos ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Detalle por alumno — notas del Bimestre ${bimestre}`, 12, y);
  y += 4;

  const headers: string[] = [
    "N°", "Nombre", "Salón", "Nivel", "Prob.",
    ...MATERIAS_COLEGIO.map((m) => m.label.replace(" y ", "/").replace("Educación ", "Ed. ")),
    "Conducta",
  ];

  const body: (string | number)[][] = filtrados.slice(0, 120).map((a, i) => [
    i + 1,
    a.nombre,
    a.salon,
    a.nivel_riesgo,
    pct(a.prob_riesgo),
    ...MATERIAS_COLEGIO.map((m) => notaInfo(notaBimestre(a, m.key, bimestre)).letra),
    a.conducta_promedio != null ? notaInfo(a.conducta_promedio).letra : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [headers],
    body,
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { fontSize: 7, halign: "center" },
    columnStyles: {
      0: { cellWidth: 7  },   // N°
      1: { cellWidth: 42, halign: "left" }, // Nombre (más ancho)
      2: { cellWidth: 12 },   // Salón
      3: { cellWidth: 13, fontStyle: "bold" }, // Nivel
      4: { cellWidth: 12 },   // Prob.
      // materias: auto
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const val = String(data.cell.raw ?? "");

      // Nivel → color por riesgo
      if (data.column.index === 3) {
        if      (val === "ALTO")  data.cell.styles.textColor = [220, 38,  38];
        else if (val === "MEDIO") data.cell.styles.textColor = [217, 119, 6];
        else                       data.cell.styles.textColor = [22,  163, 74];
      }

      // Columnas de materias y conducta (índice >= 5) → color por nota
      if (data.column.index >= 5) {
        if      (val === "C")  data.cell.styles.textColor = [220, 38,  38];
        else if (val === "B")  data.cell.styles.textColor = [217, 119, 6];
        else if (val === "A")  data.cell.styles.textColor = [37,  99,  235];
        else if (val === "AD") data.cell.styles.textColor = [22,  163, 74];
      }
    },
    margin: { left: 10, right: 10 },
    tableWidth: "auto",
  });

  // ── Nota de truncado si hay más de 120 alumnos ────────────────────────────
  if (filtrados.length > 120) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterTable = ((doc as any).lastAutoTable?.finalY ?? pageH - 18) + 3;
    if (afterTable < pageH - 15) {
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(
        `Mostrando los primeros 120 de ${filtrados.length} alumnos. Exporta en CSV para el listado completo.`,
        pageW / 2, afterTable, { align: "center" },
      );
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(
    "Documento confidencial. Datos protegidos por Ley 29733 (Perú). Uso exclusivo educativo. SATRA – UPC P20261012.",
    pageW / 2, pageH - 8, { align: "center" },
  );
  doc.text(
    `Generado por ${userEmail} — ${new Date().toLocaleString("es-PE")}`,
    pageW / 2, pageH - 4, { align: "center" },
  );

  const safe = nombreColegio.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30);
  doc.save(`SATRA_${safe}_B${bimestre}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
