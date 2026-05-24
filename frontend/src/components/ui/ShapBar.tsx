"use client";

import type { ShapContribution } from "@/types";
import { featureLabels } from "@/lib/constants";

export function ShapBar({ contrib }: { contrib: ShapContribution }) {
  const MAX_DELTA = 0.25; // 25 pp como referencia del ancho máximo de barra
  const width = Math.min((contrib.abs_contribution / MAX_DELTA) * 100, 100);
  const isRisk = contrib.contribution > 0;
  const label = featureLabels[contrib.feature] ?? contrib.feature;
  const valStr =
    typeof contrib.value === "number"
      ? contrib.value.toFixed(2)
      : String(contrib.value ?? "—");
  const sign = isRisk ? "+" : "";
  const pctStr = `${sign}${(contrib.contribution * 100).toFixed(1)}%`;

  return (
    <div className="shap-bar-row">
      <div className="shap-bar-meta">
        <span className="shap-feature-label">{label}</span>
        <span className="shap-feature-val">{valStr}</span>
      </div>
      <div className="shap-bar-track">
        <div
          className={`shap-bar-fill ${isRisk ? "shap-risk" : "shap-protect"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span
        className={`shap-delta ${isRisk ? "shap-risk-text" : "shap-protect-text"}`}
      >
        {pctStr}
      </span>
    </div>
  );
}
