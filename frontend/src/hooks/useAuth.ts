"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types";
import { apiUrl } from "@/lib/constants";
import { useProfile } from "@/hooks/useProfile";

export function useAuth(
  toast: (msg: string, type?: "success" | "error" | "info") => void
) {
  // ── Session state ─────────────────────────────────────────────────────────
  const [session,      setSession]      = useState<User | null>(null);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [authMode,     setAuthMode]     = useState<"login" | "registro" | "reset">("login");
  const [authEmail,    setAuthEmail]    = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authNombre,   setAuthNombre]   = useState("");
  const [authError,    setAuthError]    = useState("");
  const [authMsg,      setAuthMsg]      = useState("");
  const [authBusy,     setAuthBusy]     = useState(false);
  const [role,         setRole]         = useState<UserRole>("director");
  // roleLoaded: true solo después de que loadProfile leyó el rol real desde BD.
  // Mientras sea false, page.tsx muestra el spinner y nunca renderiza contenido
  // con el rol por-defecto ("director"), evitando flashes de vistas incorrectas.
  const [roleLoaded,   setRoleLoaded]   = useState(false);

  // ── Registration ──────────────────────────────────────────────────────────
  const [regDistrito,      setRegDistrito]      = useState("");
  const [regColegioIe,     setRegColegioIe]     = useState("");
  const [regColegiosList,  setRegColegiosList]  = useState<{ distrito: string; id_ie: string; total_estudiantes: number; nombre_ie?: string }[]>([]);
  const [ieHasDirector,    setIeHasDirector]    = useState(false);  // true si el IE ya tiene director

  // ── Profile state (shared with useProfile) ────────────────────────────────
  const [profileDistrito,     setProfileDistrito]     = useState<string | null>(null);
  const [profileCodigoIe,     setProfileCodigoIe]     = useState<string | null>(null);
  const [profileNombreIe,     setProfileNombreIe]     = useState<string | null>(null);
  const [profileNombre,       setProfileNombre]       = useState<string>("");
  const [profileApellidos,    setProfileApellidos]    = useState<string>("");
  const [profileAvatarColor,  setProfileAvatarColor]  = useState<string>("");


  // ── Lists ─────────────────────────────────────────────────────────────────
  const [distritosList, setDistritosList] = useState<string[]>([]);
  const [colegiosList,  setColegiosList]  = useState<{ distrito: string; id_ie: string; total_estudiantes: number; nombre_ie?: string }[]>([]);

  const skipOnboardingRef = useRef(false);
  const abortLoadProfile  = useRef(false);

  // ── Utilities ─────────────────────────────────────────────────────────────
  function translateAuthError(msg: string): string {
    if (msg.includes("Invalid login credentials"))    return "Correo o contrasena incorrectos.";
    if (msg.includes("Email not confirmed"))          return "Correo no confirmado. Revisa tu bandeja de entrada.";
    if (msg.includes("User already registered"))      return "Este correo ya tiene una cuenta registrada.";
    if (msg.includes("Password should be at least")) return "La contrasena debe tener al menos 6 caracteres.";
    if (msg.includes("email address is not valid"))  return "Correo electronico no valido.";
    if (msg.includes("signup is disabled"))          return "El registro esta deshabilitado. Contacta al administrador.";
    if (msg.includes("rate limit") || msg.includes("too many")) return "Demasiados intentos. Espera unos segundos.";
    if (msg.includes("network") || msg.includes("fetch"))       return "Error de conexion. Verifica tu internet.";
    return msg;
  }

  
  async function insertAudit(accion: string, tabla?: string, detalle?: object) {
    if (!session) return;
    await supabase.from("audit_log").insert({
      usuario_id: session.id,
      accion,
      tabla:  tabla  ?? null,
      detalle: detalle ?? null,
    });
  }

  // ── Profile panel (delegated) ─────────────────────────────────────────────
  const profile = useProfile(
    session,
    profileAvatarColor, setProfileAvatarColor,
    profileNombre, setProfileNombre,
    profileApellidos, setProfileApellidos,
    insertAudit, toast,
  );

  // ── Profile loading ───────────────────────────────────────────────────────
  async function loadProfile(userId: string, attempt = 0) {
    if (abortLoadProfile.current) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("rol, distrito, codigo_ie, nombre, apellidos, avatar_color")
      .eq("id", userId)
      .single();

    if (data?.rol) {
      setRole(data.rol as UserRole);
      setRoleLoaded(true);

      // Si el distrito viene de la BD lo usamos; si no, intentamos el caché local
      const cachedDistrito = localStorage.getItem(`satra_distrito_${userId}`);
      const distrito = data.distrito ?? cachedDistrito ?? null;

      setProfileDistrito(distrito);
      setProfileCodigoIe(data.codigo_ie ?? null);
      setProfileNombre(data.nombre ?? "");

      // Cargar nombre del colegio desde el backend si hay codigo_ie
      if (data.codigo_ie) {
        const ie = String(parseInt(data.codigo_ie, 10));
        fetch(`${apiUrl}/v1/colegios`)
          .then(r => r.ok ? r.json() : [])
          .then((colegios: { id_ie: string; nombre_ie?: string }[]) => {
            const match = colegios.find(c => String(parseInt(String(c.id_ie), 10)) === ie);
            if (match?.nombre_ie) setProfileNombreIe(match.nombre_ie);
          })
          .catch(() => {});
      }
      setProfileApellidos(data.apellidos ?? "");
      setProfileAvatarColor(data.avatar_color ?? "");

      // Guardar en caché si tenemos distrito
      if (data.distrito) {
        localStorage.setItem(`satra_distrito_${userId}`, data.distrito);
      }

    } else if (error?.code === "PGRST116" && attempt < 8) {
      setTimeout(() => void loadProfile(userId, attempt + 1), 600);
    }
  }

  function onSignIn(userId: string) {
    abortLoadProfile.current = false;
    void loadProfile(userId);
  }

  // ── District / school lists ───────────────────────────────────────────────
  async function loadDistritos() {
    try {
      const res = await fetch(`${apiUrl}/v1/colegios/distritos`);
      if (res.ok) {
        const data = await res.json();
        setDistritosList(data.distritos ?? []);
      }
    } catch { /* backend offline */ }
  }

  async function loadColegios(dist: string) {
    try {
      const res = await fetch(`${apiUrl}/v1/colegios`);
      if (res.ok) {
        const data: { distrito: string; id_ie: string; total_estudiantes: number; nombre_ie?: string }[] = await res.json();
        setColegiosList(data.filter((c) => c.distrito === dist));
      }
    } catch { /* backend offline */ }
  }


  // ── Auth actions ──────────────────────────────────────────────────────────
  async function handleLogin() {
    setAuthBusy(true); setAuthError(""); setAuthMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setAuthError(translateAuthError(error.message));
    setAuthBusy(false);
  }

  async function handleRegister() {
    if (!authNombre.trim()) { setAuthError("Ingresa tu nombre completo."); return; }
    if (!regDistrito)        { setAuthError("Selecciona tu distrito para continuar."); return; }

    // Validar correo institucional
    const blockedDomains = [
      "gmail.com","hotmail.com","hotmail.es","yahoo.com","yahoo.es",
      "outlook.com","outlook.es","live.com","icloud.com","me.com","aol.com","protonmail.com",
    ];
    const emailDomain = authEmail.split("@")[1]?.toLowerCase() ?? "";
    if (blockedDomains.includes(emailDomain)) {
      setAuthError("Usa un correo institucional (no Gmail, Hotmail, Yahoo, etc.).");
      return;
    }

    // Validar contraseña robusta
    const pwdChecks = [
      authPassword.length >= 8,
      /[A-Z]/.test(authPassword),
      /[a-z]/.test(authPassword),
      /[0-9]/.test(authPassword),
      /[!@#$%^&*()\-_=+\[\]{};':",.<>/?\\|]/.test(authPassword),
    ];
    if (!pwdChecks.every(Boolean)) {
      setAuthError("La contraseña no cumple los requisitos de seguridad.");
      return;
    }
    setAuthBusy(true); setAuthError(""); setAuthMsg("");
    skipOnboardingRef.current = true;
    // Si el colegio ya tiene director, se registra como coordinador
    const rolNuevoUsuario = ieHasDirector ? "coordinador" : "director";
    const { data: signUpData, error } = await supabase.auth.signUp({
      email:    authEmail,
      password: authPassword,
      options:  { data: { nombre: authNombre, rol: rolNuevoUsuario } },
    });
    if (error) {
      skipOnboardingRef.current = false;
      setAuthError(translateAuthError(error.message));
    } else {
      const savedDistrito = regDistrito;
      const savedIe       = regColegioIe;
      const savedEmail    = authEmail;
      const savedPassword = authPassword;

      if (signUpData.user) {
        const uid = signUpData.user.id;
        void (async () => {
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise((r) => setTimeout(r, 400));
            const { data: updatedRows, error: upErr } = await supabase
              .from("profiles")
              .update({ distrito: savedDistrito, codigo_ie: savedIe || null })
              .eq("id", uid)
              .select("id");
            if (!upErr && updatedRows && updatedRows.length > 0) {
              setProfileDistrito(savedDistrito);
              setProfileCodigoIe(savedIe || null);
              skipOnboardingRef.current = false;
              return;
            }
          }
          skipOnboardingRef.current = false;
        })();
      }

      setRegDistrito(""); setRegColegioIe(""); setRegColegiosList([]);
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: savedEmail, password: savedPassword,
      });
      if (loginError) {
        setAuthMsg("Cuenta creada. Ya puedes iniciar sesion.");
        setAuthMode("login");
        skipOnboardingRef.current = false;
      }
    }
    setAuthBusy(false);
  }

  async function handlePasswordReset() {
    setAuthBusy(true); setAuthError(""); setAuthMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: typeof window !== "undefined" ? window.location.origin : "",
    });
    if (error) setAuthError(error.message);
    else setAuthMsg("Enlace de recuperacion enviado. Revisa tu bandeja de entrada.");
    setAuthBusy(false);
  }

  async function handleLogout() {
    abortLoadProfile.current = true; 
    await insertAudit("Cierre de sesion");
    await supabase.auth.signOut();
    setSession(null);
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s?.user ?? null);
      if (s?.user) await loadProfile(s.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s?.user ?? null);
      if (s?.user) {
        abortLoadProfile.current = false;
        setRoleLoaded(false);   // bloquear render hasta que llegue el rol real
        void loadProfile(s.user.id);
        if (event === "SIGNED_IN") {
          void supabase.from("audit_log").insert({
            usuario_id: s.user.id,
            accion:  "Inicio de sesion",
            detalle: { email: s.user.email },
          });
        }
      } else {
        setRole("director");
        setRoleLoaded(false);   // reset al cerrar sesión
        setAuthLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void loadDistritos(); }, []);

  // Precargar TODOS los colegios al inicio (necesario para el dropdown en UsuariosView)
  useEffect(() => {
    fetch(`${apiUrl}/v1/colegios`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { distrito: string; id_ie: string; total_estudiantes: number; nombre_ie?: string }[]) => {
        setColegiosList(data);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!regDistrito) { setRegColegiosList([]); setRegColegioIe(""); return; }
    fetch(`${apiUrl}/v1/colegios`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: { distrito: string; id_ie: string; total_estudiantes: number; nombre_ie?: string }[]) => {
        setRegColegiosList(data.filter((c) => c.distrito === regDistrito));
        setRegColegioIe("");
      })
      .catch(() => {});
  }, [regDistrito]);

  // Verificar si el colegio seleccionado ya tiene un director
  // Usamos un RPC con SECURITY DEFINER porque al registrarse el usuario aún no está
  // autenticado, así que las políticas RLS le bloquearían el SELECT directo a profiles.
  useEffect(() => {
    if (!regColegioIe) { setIeHasDirector(false); return; }
    supabase
      .rpc("ie_has_director", { p_codigo_ie: regColegioIe })
      .then(({ data, error }) => {
        if (!error) setIeHasDirector(data === true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regColegioIe]);


  // ── Public API ────────────────────────────────────────────────────────────
  return {
    session, authLoading, roleLoaded,
    authMode, setAuthMode,
    authEmail, setAuthEmail,
    authPassword, setAuthPassword,
    authNombre, setAuthNombre,
    authError, authMsg, authBusy,
    role, setRole,
    regDistrito, setRegDistrito,
    regColegioIe, setRegColegioIe,
    regColegiosList, ieHasDirector,
    profileDistrito, setProfileDistrito,
    profileCodigoIe, setProfileCodigoIe,
    profileNombreIe,
    profileNombre, profileApellidos,
    profileAvatarColor, setProfileAvatarColor,
    distritosList, colegiosList,
    skipOnboardingRef,
    // profile panel
    ...profile,
    // actions
    loadProfile, loadDistritos, loadColegios,
    handleLogin, handleRegister, handlePasswordReset, handleLogout,
    translateAuthError, insertAudit,
  };
}
