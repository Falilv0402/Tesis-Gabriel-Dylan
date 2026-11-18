"use client";

import { Panel, Kpi, Bar } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";
import type { UsoReal } from "@/hooks/useColegioModels";

/**
 * Cómo le fue al sistema en la práctica, contado en alumnos y no en un solo número (F1): de los que marcó ALTO,
 * cuántos estaban de verdad en riesgo; cuántos de los primeros de la lista (tantos como terminaron en riesgo) lo estaban;
 * y cuánto mejor es eso que elegir al azar. Son los mismos alumnos y las mismas
 * predicciones (de validación cruzada: el modelo no vio a esos alumnos), solo medidas de otra forma.
 */
export function UsoRealPanel({ u }: { u: UsoReal }) {
  const p = u.priorizado;
  const aciertoAlto = u.alto.pct_en_riesgo;

  return (
    <Panel title="Cómo funciona en la práctica">
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <Kpi
          label="Acierto en riesgo ALTO"
          value={aciertoAlto != null ? pct(aciertoAlto) : "—"}
          detail={u.alto.n
            ? `${u.alto.en_riesgo} de ${u.alto.n} alumnos marcados ALTO sí estaban en riesgo`
            : "ningún alumno quedó en ALTO"}
          tone={aciertoAlto != null && aciertoAlto >= 0.7 ? "low" : "medium"}
        />
        <Kpi
          label={`Acierto en los primeros ${p.n} de la lista`}
          value={pct(p.precision)}
          detail={`${p.en_riesgo} de los ${p.n} alumnos que el sistema pone primero sí estaban en riesgo (tantos como terminaron en riesgo)`}
          tone={p.precision >= 0.7 ? "low" : "medium"}
        />
        <Kpi
          label="Frente a elegir al azar"
          value={`×${p.veces_mejor_que_azar.toLocaleString("es-PE", { maximumFractionDigits: 1 })}`}
          detail={`al azar se acertaría solo el ${pct(u.tasa_base)} de los ${p.n} elegidos`}
          tone={p.veces_mejor_que_azar >= 1.5 ? "low" : "medium"}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <Bar label={`De los marcados ALTO, en riesgo de verdad · ${u.alto.n}`} value={u.alto.pct_en_riesgo ?? 0} tone="high" />
        <Bar label={`De los marcados MEDIO, en riesgo de verdad · ${u.medio.n}`} value={u.medio.pct_en_riesgo ?? 0} tone="medium" />
        <Bar label={`De los marcados BAJO, en riesgo de verdad · ${u.bajo.n}`} value={u.bajo.pct_en_riesgo ?? 0} tone="low" />
      </div>

      <div className="model-note" style={{ fontSize: 11 }}>
        Contando los {u.n_evaluados} alumnos con notas de B4: {pct(u.tasa_base)} terminó en riesgo (nota 13 o menos en
        Matemática o Comunicación). Elegir alumnos al azar acertaría ese {pct(u.tasa_base)}; el sistema acierta mucho más
        en ALTO y MEDIO y deja en BAJO a quienes casi nunca lo estuvieron. Son las predicciones de validación cruzada
        (el modelo no vio a esos alumnos al calcularlas).
      </div>
    </Panel>
  );
}
