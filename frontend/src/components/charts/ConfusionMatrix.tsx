"use client";

import { EmptyState } from "@/components/ui/Primitives";

export function ConfusionMatrix({ matrix }: { matrix?: number[][] }) {
  if (!matrix || matrix.length !== 2) {
    return (
      <EmptyState message="No hay matriz de confusion disponible desde el modelo." />
    );
  }
  return (
    <div className="confusion">
      <div />
      <strong>Pred. sin riesgo</strong>
      <strong>Pred. riesgo</strong>
      <strong>Real sin riesgo</strong>
      <span>{matrix[0][0]} VN</span>
      <span>{matrix[0][1]} FP</span>
      <strong>Real riesgo</strong>
      <span>{matrix[1][0]} FN</span>
      <span>{matrix[1][1]} VP</span>
    </div>
  );
}
