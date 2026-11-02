import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Marca de sesión de navegador: este ingreso viene de un enlace de recuperación de contraseña (ver useAuth). */
export const RECOVERY_KEY = "satra_recovery";

// Al abrir el enlace del correo, Supabase procesa la URL (#...&type=recovery) en cuanto se crea el cliente, borra esa
// señal de la barra de direcciones y emite PASSWORD_RECOVERY casi enseguida, antes de que React llegue a suscribirse.
// Por eso se anota aquí, de forma síncrona y antes de crear el cliente.
if (typeof window !== "undefined" && /[#&?]type=recovery(&|$)/.test(window.location.hash + window.location.search)) {
  try { sessionStorage.setItem(RECOVERY_KEY, "1"); } catch { /* sin sessionStorage: queda el evento de Supabase */ }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Crea un cliente Supabase EFÍMERO y aislado (no persiste sesión ni refresca
 * tokens). Sirve para registrar usuarios desde un admin sin que `signUp`
 * reemplace la sesión del usuario actual: Supabase inicia sesión como el
 * usuario recién creado, así que lo hacemos en un cliente desechable y la
 * sesión del superadmin/admin queda intacta.
 */
export function createIsolatedClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: "satra-signup-temp",
    },
  });
}
