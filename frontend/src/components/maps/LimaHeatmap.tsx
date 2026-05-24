"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";

export type DistrictRiskEntry = {
  total: number;
  alto: number;
  medio: number;
  pct: number; // fracción 0-1 de ALTO
};

type Props = {
  districtRisk: Record<string, DistrictRiskEntry>;
};

/* Centroides aproximados de los distritos de Lima Metropolitana */
const LIMA_CENTROIDS: Record<string, [number, number]> = {
  "MIRAFLORES":              [-12.1191, -77.0282],
  "SAN ISIDRO":              [-12.1009, -77.0369],
  "SANTIAGO DE SURCO":       [-12.1440, -76.9984],
  "LA MOLINA":               [-12.0831, -76.9478],
  "SAN BORJA":               [-12.0964, -76.9956],
  "BARRANCO":                [-12.1464, -77.0227],
  "CHORRILLOS":              [-12.1695, -77.0188],
  "JESUS MARIA":             [-12.0695, -77.0472],
  "LINCE":                   [-12.0847, -77.0354],
  "SAN MIGUEL":              [-12.0773, -77.0901],
  "PUEBLO LIBRE":            [-12.0806, -77.0693],
  "MAGDALENA DEL MAR":       [-12.0934, -77.0695],
  "SURQUILLO":               [-12.1118, -77.0095],
  "SAN LUIS":                [-12.0773, -76.9934],
  "ATE":                     [-12.0311, -76.9201],
  "SANTA ANITA":             [-12.0462, -76.9669],
  "EL AGUSTINO":             [-12.0354, -77.0000],
  "LIMA":                    [-12.0453, -77.0311],
  "RIMAC":                   [-12.0264, -77.0275],
  "SAN MARTIN DE PORRES":    [-11.9978, -77.0782],
  "LOS OLIVOS":              [-11.9722, -77.0803],
  "INDEPENDENCIA":           [-11.9925, -77.0542],
  "COMAS":                   [-11.9383, -77.0451],
  "CARABAYLLO":              [-11.8530, -77.0279],
  "PUENTE PIEDRA":           [-11.8600, -77.0757],
  "SAN JUAN DE LURIGANCHO":  [-11.9897, -76.9890],
  "LURIGANCHO":              [-11.9166, -76.8989],
  "CHACLACAYO":              [-11.9790, -76.7688],
  "CIENEGUILLA":             [-12.0613, -76.8729],
  "PACHACAMAC":              [-12.1678, -76.8616],
  "VILLA MARIA DEL TRIUNFO": [-12.1629, -76.9360],
  "SAN JUAN DE MIRAFLORES":  [-12.1555, -76.9691],
  "VILLA EL SALVADOR":       [-12.2095, -76.9375],
  "LURIN":                   [-12.2716, -76.8717],
  "PUNTA NEGRA":             [-12.3783, -76.7891],
  "PUNTA HERMOSA":           [-12.3440, -76.8065],
  "SAN BARTOLO":             [-12.3831, -76.7659],
  "SANTA MARIA DEL MAR":     [-12.4107, -76.7481],
  "PUCUSANA":                [-12.4793, -76.7854],
  "SANTA ROSA":              [-11.7904, -77.1523],
  "ANCON":                   [-11.7697, -77.1677],
  "BREÑA":                   [-12.0614, -77.0500],
  "LA VICTORIA":             [-12.0697, -77.0138],
  "SAN CARLOS":              [-12.0613, -76.9560],
};

function riskColor(pct: number): string {
  if (pct < 0.20) return "#22c55e";
  if (pct < 0.35) return "#84cc16";
  if (pct < 0.50) return "#eab308";
  if (pct < 0.65) return "#f97316";
  return "#ef4444";
}

function riskLabel(pct: number): string {
  if (pct < 0.20) return "Bajo";
  if (pct < 0.35) return "Moderado";
  if (pct < 0.50) return "Medio";
  if (pct < 0.65) return "Alto";
  return "Crítico";
}

/** Workaround para garantizar que el mapa se recalcule cuando el contenedor cambia de tamaño */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);
  return null;
}

export default function LimaHeatmap({ districtRisk }: Props) {
  return (
    <div className="lima-heatmap-wrapper">
      <div className="lima-heatmap-legend">
        {[
          { label: "Bajo < 20%",   color: "#22c55e" },
          { label: "Moderado < 35%", color: "#84cc16" },
          { label: "Medio < 50%",  color: "#eab308" },
          { label: "Alto < 65%",   color: "#f97316" },
          { label: "Crítico ≥ 65%", color: "#ef4444" },
        ].map((item) => (
          <span key={item.label} className="lima-legend-item">
            <span className="lima-legend-dot" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="lima-legend-note">Tamaño = nº estudiantes</span>
      </div>

      <div className="lima-map-container">
        <MapContainer
          center={[-12.05, -77.00]}
          zoom={11}
          minZoom={9}
          maxZoom={17}
          scrollWheelZoom={true}
          dragging={true}
          doubleClickZoom={true}
          touchZoom={true}
          boxZoom={true}
          keyboard={true}
          zoomControl={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />
          <MapResizer />

          {Object.entries(LIMA_CENTROIDS).map(([rawDistrict, coords]) => {
            const entry =
              districtRisk[rawDistrict] ??
              districtRisk[rawDistrict.toUpperCase()] ??
              districtRisk[rawDistrict.toLowerCase()];

            const pct = entry ? entry.pct : 0;
            const total = entry ? entry.total : 0;
            const alto = entry ? entry.alto : 0;
            const color = riskColor(pct);
            const radius = total > 0 ? Math.max(10, Math.min(35, 8 + total * 0.8)) : 8;

            const districtName = rawDistrict
              .split(" ")
              .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
              .join(" ");

            return (
              <CircleMarker
                key={rawDistrict}
                center={coords}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  color: "white",
                  weight: 1.5,
                  opacity: 0.9,
                  fillOpacity: total > 0 ? 0.82 : 0.25,
                }}
              >
                <Tooltip direction="top" className="lima-tooltip">
                  {total > 0 ? (
                    <>
                      <strong>{districtName}</strong><br />
                      Estudiantes: <b>{total}</b><br />
                      Riesgo ALTO: <b>{alto}</b> ({(pct * 100).toFixed(1)}%)<br />
                      Nivel: <span style={{ color, fontWeight: 600 }}>{riskLabel(pct)}</span>
                    </>
                  ) : (
                    <>
                      <strong>{districtName}</strong><br />
                      <em>Sin datos</em>
                    </>
                  )}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
