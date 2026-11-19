"use client";

import { EmptyState } from "@/components/ui/Primitives";

export function ConfusionMatrix({ matrix, showPercentages = false }: { matrix?: number[][]; showPercentages?: boolean }) {
  if (!matrix || matrix.length !== 2) {
    return (
      <EmptyState message="No hay matriz de confusion disponible desde el modelo." />
    );
  }
  const cell = (row: number, column: number, label: string) => {
    const count = matrix[row][column];
    const total = matrix[row][0] + matrix[row][1];
    const proportion = total > 0 ? count / total : 0;
    return (
      <span style={showPercentages ? {
        display: "flex", flexDirection: "column", gap: 4,
        background: `rgba(${row === column ? "22, 163, 74" : "220, 38, 38"}, ${0.04 + proportion * 0.16})`,
      } : undefined}>
        {count} {label}
        {showPercentages && <small style={{ fontSize: 11, fontWeight: 500 }}>{total > 0 ? `${(proportion * 100).toFixed(2)}%` : "Sin alumnos"}</small>}
      </span>
    );
  };
  return (
    <div className="confusion">
      <div />
      <strong>Pred. sin riesgo</strong>
      <strong>Pred. riesgo</strong>
      <strong>Real sin riesgo</strong>
      {cell(0, 0, "VN")}
      {cell(0, 1, "FP")}
      <strong>Real riesgo</strong>
      {cell(1, 0, "FN")}
      {cell(1, 1, "VP")}
    </div>
  );
}
