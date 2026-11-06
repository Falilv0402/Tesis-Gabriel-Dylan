import { avisoEquipo } from "@/lib/avisos";

// CP050: al agendar un hito el autor no recibe el aviso del equipo, así que la pantalla debe confirmarle
// que el hito quedó guardado y a cuántos compañeros se avisó.
describe("avisoEquipo (confirmación al agendar o completar un hito)", () => {
  it("indica a cuántos compañeros se avisó", () => {
    expect(avisoEquipo("Hito guardado", 6)).toEqual({
      text: "Hito guardado. Se avisó a 6 compañeros del equipo.", type: "success",
    });
  });

  it("usa el singular con un solo compañero", () => {
    expect(avisoEquipo("Hito guardado", 1).text).toBe("Hito guardado. Se avisó a 1 compañero del equipo.");
  });

  it("explica que no había a quién avisar cuando el colegio no tiene más miembros activos", () => {
    const r = avisoEquipo("Hito guardado", 0);
    expect(r.type).toBe("success");
    expect(r.text).toContain("No hay otros Directores/Coordinadores activos");
  });

  it("no afirma que se avisó si el aviso no se pudo guardar", () => {
    const r = avisoEquipo("Hito completado", null);
    expect(r.type).toBe("info");
    expect(r.text).toBe("Hito completado, pero no se pudo avisar al equipo.");
    expect(r.text).not.toContain("Se avisó");
  });

  it("solo confirma el guardado si no hay función de aviso", () => {
    expect(avisoEquipo("Hito guardado", undefined)).toEqual({ text: "Hito guardado.", type: "success" });
  });
});
