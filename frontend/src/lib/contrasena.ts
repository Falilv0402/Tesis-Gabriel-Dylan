/**
 * Reglas de contraseña de SATRA (las mismas del registro, HU0001): al menos 8 caracteres, una mayúscula,
 * una minúscula, un número y un carácter especial. Las usan el registro y la pantalla de nueva contraseña
 * que aparece al abrir un enlace de recuperación (HU0004).
 */
export interface ReglasContrasena {
  length:    boolean;
  uppercase: boolean;
  lowercase: boolean;
  number:    boolean;
  special:   boolean;
}

export function reglasContrasena(pwd: string): ReglasContrasena {
  return {
    length:    pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number:    /[0-9]/.test(pwd),
    special:   /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
  };
}

export function contrasenaValida(pwd: string): boolean {
  return Object.values(reglasContrasena(pwd)).every(Boolean);
}
