"use client";

import { CheckCircle2 } from "lucide-react";

interface OnboardingViewProps {
  onboardingDistrito: string;
  setOnboardingDistrito: (v: string) => void;
  onboardingCodigoIe: string;
  setOnboardingCodigoIe: (v: string) => void;
  distritosList: string[];
  colegiosList: { distrito: string; id_ie: string; total_estudiantes: number }[];
  authBusy: boolean;
  saveOnboarding: () => void;
  setShowOnboarding: (v: boolean) => void;
}

export function OnboardingView({
  onboardingDistrito,
  setOnboardingDistrito,
  onboardingCodigoIe,
  setOnboardingCodigoIe,
  distritosList,
  colegiosList,
  authBusy,
  saveOnboarding,
  setShowOnboarding,
}: OnboardingViewProps) {
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/Logo Icono SATRA_fondo_transparente.png" alt="SATRA" style={{ width: 56, margin: "0 auto", display: "block" }} />
        <h1 style={{ textAlign: "center" }}>Bienvenido/a</h1>
        <p className="auth-subtitle">Selecciona tu distrito para ver los estudiantes de tu zona.</p>
        <label>Distrito
          <select value={onboardingDistrito} onChange={(e) => setOnboardingDistrito(e.target.value)}>
            <option value="">Selecciona un distrito...</option>
            {distritosList.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        {onboardingDistrito && (
          <label>Institución educativa (opcional)
            <select value={onboardingCodigoIe} onChange={(e) => setOnboardingCodigoIe(e.target.value)}>
              <option value="">Todas las IEs del distrito</option>
              {colegiosList.map((c) => (
                <option key={c.id_ie} value={c.id_ie}>{c.id_ie} ({c.total_estudiantes} estudiantes)</option>
              ))}
            </select>
          </label>
        )}
        <button
          className="primary"
          disabled={!onboardingDistrito || authBusy}
          onClick={() => void saveOnboarding()}
        >
          <CheckCircle2 size={18} /> {authBusy ? "Guardando..." : "Confirmar y continuar"}
        </button>
        <button className="link-button" onClick={() => setShowOnboarding(false)}>
          Omitir por ahora
        </button>
      </section>
    </main>
  );
}
