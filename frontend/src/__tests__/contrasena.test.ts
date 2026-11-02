import { contrasenaValida, reglasContrasena } from "../lib/contrasena";

describe("reglas de contraseña (registro y recuperación)", () => {
  test("acepta una contraseña con las 5 reglas", () => {
    expect(contrasenaValida("Satra#2026")).toBe(true);
    expect(reglasContrasena("Satra#2026")).toEqual({ length: true, uppercase: true, lowercase: true, number: true, special: true });
  });

  test("marca qué regla falla", () => {
    expect(reglasContrasena("satra#2026").uppercase).toBe(false);
    expect(reglasContrasena("SATRA#2026").lowercase).toBe(false);
    expect(reglasContrasena("Satra#Segura").number).toBe(false);
    expect(reglasContrasena("Satra2026a").special).toBe(false);
    expect(reglasContrasena("Sa#1").length).toBe(false);
  });

  test("rechaza la contraseña inicial simple de las cuentas de prueba (sin mayúscula ni símbolo)", () => {
    expect(contrasenaValida("contraseña123")).toBe(false);
  });

  test("una contraseña vacía no cumple nada", () => {
    expect(Object.values(reglasContrasena("")).some(Boolean)).toBe(false);
    expect(contrasenaValida("")).toBe(false);
  });
});
