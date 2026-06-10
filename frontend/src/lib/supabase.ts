import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
