/**
 * Environment variable validation.
 * Call validateEnv() at app startup to surface missing config early.
 *
 * Only NEXT_PUBLIC_* variables are accessible client-side.
 * Server-only vars (no NEXT_PUBLIC_ prefix) are available in server components / API routes only.
 */

const REQUIRED_PUBLIC: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL:      "Supabase project URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase anonymous/public key",
};

const OPTIONAL_PUBLIC: Record<string, string> = {
  NEXT_PUBLIC_ML_API_URL: "ML backend URL (defaults to http://127.0.0.1:8000)",
};

export function validateEnv(): void {
  const missing: string[] = [];
  for (const [key, label] of Object.entries(REQUIRED_PUBLIC)) {
    if (!process.env[key]) missing.push(`${key} (${label})`);
  }
  if (missing.length > 0) {
    const msg = `[SATRA] Missing required environment variables:\n${missing.map((m) => `  • ${m}`).join("\n")}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    } else {
      console.warn(msg);
    }
  }

  for (const [key, label] of Object.entries(OPTIONAL_PUBLIC)) {
    if (!process.env[key]) {
      console.info(`[SATRA] Optional env ${key} (${label}) not set — using default.`);
    }
  }
}

/** Typed access to env vars with defaults */
export const env = {
  supabaseUrl:    process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "",
  supabaseAnonKey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  mlApiUrl:       process.env.NEXT_PUBLIC_ML_API_URL        ?? "http://127.0.0.1:8000",
} as const;
