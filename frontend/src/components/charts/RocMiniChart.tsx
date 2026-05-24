"use client";

import { EmptyState } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";

export function RocMiniChart({
  fpr,
  tpr,
  auc,
}: {
  fpr?: number[];
  tpr?: number[];
  auc?: number;
}) {
  if (!fpr || !tpr || fpr.length !== tpr.length || fpr.length <= 1) {
    return (
      <EmptyState message="No hay curva ROC disponible desde el modelo." />
    );
  }
  const points = fpr
    .map((x, i) => `${x * 100},${100 - tpr[i] * 100}`)
    .join(" ");
  return (
    <div className="roc-card">
      <svg viewBox="0 0 100 100" role="img" aria-label="Curva ROC del modelo">
        <line x1="0" y1="100" x2="100" y2="0" />
        <polyline points={points} />
      </svg>
      <strong>AUC {pct(auc)}</strong>
    </div>
  );
}
