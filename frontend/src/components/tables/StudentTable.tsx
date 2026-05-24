"use client";

import { useState } from "react";
import type { Student } from "@/types";
import { shortId, pct, riskClass } from "@/lib/format";

export function StudentTable({
  students,
  total,
  isLoadingMore,
  onLoadMore,
  selectedId,
  onSelect,
}: {
  students: Student[];
  total: number;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const rowHeight = 58;
  const viewportHeight = 620;
  const overscan = 8;
  const [scrollTop, setScrollTop] = useState(0);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(students.length, startIndex + visibleCount);
  const visibleStudents = students.slice(startIndex, endIndex);
  const topSpacer = startIndex * rowHeight;
  const bottomSpacer = Math.max(0, (students.length - endIndex) * rowHeight);

  return (
    <>
      <div className="table-count">
        {students.length.toLocaleString("es-PE")} de{" "}
        {total.toLocaleString("es-PE")} estudiantes cargados
      </div>
      <div
        className="table-scroll"
        onScroll={(event) => {
          const target = event.currentTarget;
          setScrollTop(target.scrollTop);
          if (
            target.scrollTop + target.clientHeight >=
            target.scrollHeight - 240
          )
            onLoadMore();
        }}
      >
        <table>
          <tbody>
            <tr>
              <th>Estudiante</th>
              <th>Distrito</th>
              <th>Riesgo</th>
              <th>Prob.</th>
              <th>ISE</th>
            </tr>
            {topSpacer > 0 && (
              <tr aria-hidden="true">
                <td colSpan={5} style={{ height: topSpacer, padding: 0 }} />
              </tr>
            )}
            {visibleStudents.map((student) => (
              <tr
                key={student.id}
                className={
                  selectedId === student.id ? "selected-row" : ""
                }
                onClick={() => onSelect(student.id)}
              >
                <td>
                  <strong>Est. {shortId(student.id)}</strong>
                  <small>{student.sexo}</small>
                </td>
                <td>{student.distrito}</td>
                <td>
                  <span className={riskClass(student.nivel_riesgo)}>
                    {student.nivel_riesgo}
                  </span>
                </td>
                <td>{pct(student.probabilidad_riesgo)}</td>
                <td>{student.ise.toFixed(2)}</td>
              </tr>
            ))}
            {bottomSpacer > 0 && (
              <tr aria-hidden="true">
                <td colSpan={5} style={{ height: bottomSpacer, padding: 0 }} />
              </tr>
            )}
            {students.length === 0 && (
              <tr>
                <td colSpan={5}>
                  No hay predicciones disponibles desde el modelo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isLoadingMore && (
        <div className="table-count">Cargando mas estudiantes...</div>
      )}
    </>
  );
}
