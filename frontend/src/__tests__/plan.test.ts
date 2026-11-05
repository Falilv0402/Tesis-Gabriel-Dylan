import { reglasPlan } from "../lib/plan";

const base = { tieneHitos: true, enviadoPor: "coord-1", miId: "dir-1" } as const;

describe("reglas del plan de seguimiento (CP053)", () => {
  test("el Coordinador envía a revisión un borrador con hitos", () => {
    const r = reglasPlan({ ...base, estado: "borrador", rol: "coordinador", miId: "coord-1" });
    expect(r.puedeEnviar).toBe(true);
    expect(r.puedeDecidir).toBe(false);
  });

  test("sin hitos no se puede enviar", () => {
    expect(reglasPlan({ ...base, estado: "borrador", rol: "coordinador", tieneHitos: false }).puedeEnviar).toBe(false);
  });

  test("tras pedir cambios, el Coordinador puede volver a enviarlo", () => {
    expect(reglasPlan({ ...base, estado: "rechazado", rol: "coordinador", miId: "coord-1" }).puedeEnviar).toBe(true);
  });

  test("el Director NO envía planes a revisión: él es quien revisa", () => {
    const r = reglasPlan({ ...base, estado: "borrador", rol: "director" });
    expect(r.puedeEnviar).toBe(false);
    expect(r.directorNoEnvia).toBe(true);
    expect(reglasPlan({ ...base, estado: "rechazado", rol: "director" }).puedeEnviar).toBe(false);
  });

  test("el Director aprueba o pide cambios un plan enviado por otra persona", () => {
    const r = reglasPlan({ ...base, estado: "en_revision", rol: "director" });
    expect(r.puedeDecidir).toBe(true);
    expect(r.esMiEnvio).toBe(false);
  });

  test("quien envió el plan no puede decidir sobre él, ni siquiera siendo Director", () => {
    const r = reglasPlan({ ...base, estado: "en_revision", rol: "director", enviadoPor: "dir-1" });
    expect(r.puedeDecidir).toBe(false);
    expect(r.esMiEnvio).toBe(true);
  });

  test("un Coordinador nunca decide", () => {
    expect(reglasPlan({ ...base, estado: "en_revision", rol: "coordinador" }).puedeDecidir).toBe(false);
  });

  test("un plan ya aprobado no se vuelve a enviar ni a decidir", () => {
    const r = reglasPlan({ ...base, estado: "aprobado", rol: "director" });
    expect(r.puedeEnviar).toBe(false);
    expect(r.puedeDecidir).toBe(false);
  });
});
