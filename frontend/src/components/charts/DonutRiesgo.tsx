"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";

export type PorcionDonut = { name: string; value: number; color: string };

const RAD = Math.PI / 180;
const RADIO_MAXIMO = 76;
const RADIO_MINIMO = 36;
const DISTANCIA_ETIQUETA = 10;   // entre el borde del aro y la etiqueta
const ANCHO_ETIQUETA = 56;       // lo que ocupa «Medio 45%» a 12 px

/**
 * Radio del aro según el ancho de la tarjeta: tiene que dejar sitio, a cada lado, para la distancia a la etiqueta y
 * para su texto. En una tarjeta ancha es el máximo; en una angosta (Reportes fuerza 3 columnas aunque la pantalla
 * sea chica) el aro se achica en vez de mandar las etiquetas fuera del gráfico.
 */
export function radioParaAncho(ancho: number | null): number {
  if (ancho == null) return RADIO_MAXIMO;
  return Math.max(RADIO_MINIMO, Math.min(RADIO_MAXIMO, Math.floor(ancho / 2 - DISTANCIA_ETIQUETA - ANCHO_ETIQUETA)));
}

/**
 * Dónde va la etiqueta de una porción: pegada al aro, en el sentido en que apunta la porción, y alineada hacia
 * afuera (a la derecha del aro: el texto crece hacia la derecha; a la izquierda: hacia la izquierda; arriba y
 * abajo: centrada). Antes salían 20 px más lejos y el borde del gráfico las cortaba («Alto 52 %» arriba,
 * «Medio 6 %» a la izquierda). `midAngle` en grados, contra el reloj desde las 3 en punto (como lo entrega recharts).
 */
export function posicionEtiqueta(cx: number, cy: number, midAngle: number, radioExterior: number = RADIO_MAXIMO) {
  const cos = Math.cos(-midAngle * RAD);
  const sin = Math.sin(-midAngle * RAD);
  const r = radioExterior + DISTANCIA_ETIQUETA;
  return {
    x: cx + r * cos,
    y: cy + r * sin,
    anchor: (cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle") as "start" | "end" | "middle",
  };
}

function etiqueta(p: PieLabelRenderProps) {
  const porcentaje = p.percent ?? 0;
  // Una sola porción (100 %): la etiqueta va arriba, no a un costado donde el texto no cabe.
  const angulo = porcentaje >= 0.98 ? 90 : Number(p.midAngle ?? 0);
  const { x, y, anchor } = posicionEtiqueta(Number(p.cx), Number(p.cy), angulo, Number(p.outerRadius ?? RADIO_MAXIMO));
  return (
    <text x={x} y={y} fill={p.fill} fontSize={12} textAnchor={anchor} dominantBaseline="central">
      {`${p.name} ${Math.round(porcentaje * 100)}%`}
    </text>
  );
}

/** Donut de alumnos por nivel de riesgo. `datos` ya debe venir sin las porciones en 0. */
export function DonutRiesgo({ datos, unidad = "alumnos" }: { datos: PorcionDonut[]; unidad?: string }) {
  const [ancho, setAncho] = useState<number | null>(null);
  const exterior = radioParaAncho(ancho);
  return (
    // La clase deja que, si aun así una etiqueta sobrepasa el gráfico, se vea completa en vez de cortada.
    <ResponsiveContainer width="100%" height={230} className="donut-riesgo" onResize={(w) => setAncho(w)}>
      <PieChart margin={{ top: 30, right: 10, bottom: 30, left: 10 }}>
        <Pie
          data={datos}
          cx="50%" cy="50%" innerRadius={Math.round(exterior * 0.62)} outerRadius={exterior} paddingAngle={3}
          dataKey="value" nameKey="name" label={etiqueta} labelLine={false}
        >
          {datos.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v) => [`${v} ${unidad}`]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
