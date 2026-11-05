/**
 * CP053 (Mantis 28455/28456/28457): el Director pidió cambios, reenvió el plan a revisión y lo aprobó él mismo.
 * Se renderiza el aviso del plan de la ficha del alumno, tal como lo ve cada persona, en cada paso del flujo.
 */
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanEstadoBanner } from "@/views/ColegioEstudianteView";

(globalThis as unknown as { React: unknown }).React = React;

const DIRECTOR = "id-director";
const COORDINADOR = "id-coordinador";

function banner(rol: string, miId: string, estado: string, enviadoPor: string | null = null) {
  const props = {
    planEstado: { estudiante_id: "e1", codigo_ie: "9001", estado, enviado_por: enviadoPor, enviado_por_nombre: enviadoPor ? "Quien envió" : null, comentario: null, revisado_por_nombre: null },
    role: rol, miId, tieneHitos: true, isEnviandoRevision: false, isDecidiendoPlan: false,
    showRechazoForm: false, setShowRechazoForm: () => {}, comentarioRechazo: "", setComentarioRechazo: () => {},
    onEnviar: () => {}, onAprobar: () => {}, onRechazar: () => {},
  };
  return renderToStaticMarkup(createElement(PlanEstadoBanner, props as never));
}

describe("CP053 — el plan lo envía quien lo propone y lo decide otra persona", () => {
  test("paso 3 del tester: en un plan RECHAZADO el Director ya no ve «Enviar a revisión»", () => {
    const html = banner("director", DIRECTOR, "rechazado");
    expect(html).not.toContain("Enviar a revisión");
    expect(html).toContain("tú revisas los planes");
  });

  test("el Coordinador sí ve «Enviar a revisión» en borrador y en plan rechazado", () => {
    expect(banner("coordinador", COORDINADOR, "borrador")).toContain("Enviar a revisión");
    expect(banner("coordinador", COORDINADOR, "rechazado")).toContain("Enviar a revisión");
  });

  test("paso 4 del tester: el Director aprueba un plan en revisión que envió el Coordinador", () => {
    const html = banner("director", DIRECTOR, "en_revision", COORDINADOR);
    expect(html).toContain("Aprobar");
    expect(html).toContain("Pedir cambios");
  });

  test("quien envió el plan no puede aprobarlo ni pedir cambios (aunque sea Director)", () => {
    const html = banner("director", DIRECTOR, "en_revision", DIRECTOR);
    expect(html).not.toContain("Aprobar");
    expect(html).not.toContain("Pedir cambios");
    expect(html).toContain("lo debe revisar otro Director");
  });

  test("el Coordinador nunca ve «Aprobar»", () => {
    expect(banner("coordinador", COORDINADOR, "en_revision", COORDINADOR)).not.toContain("Aprobar");
  });
});
