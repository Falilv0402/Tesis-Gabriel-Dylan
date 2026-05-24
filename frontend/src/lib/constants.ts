import type { Tab, UserRole } from "@/types";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  FileText,
  UserCog,
  Users,
} from "lucide-react";

export const apiUrl = process.env.NEXT_PUBLIC_ML_API_URL ?? "http://127.0.0.1:8000";

export const navItems: { id: Tab; label: string; icon: typeof Activity; roles: UserRole[] }[] = [
  { id: "dashboard",      label: "Dashboard",     icon: BarChart3,     roles: ["director"] },
  { id: "estudiante",     label: "Estudiante",    icon: UserCog,       roles: ["director"] },
  { id: "intervenciones", label: "Intervenciones",icon: AlertTriangle,  roles: ["director"] },
  { id: "reportes",       label: "Reportes",      icon: FileText,      roles: ["director"] },
  { id: "usuarios",       label: "Usuarios",      icon: Users,         roles: ["admin"] },
  { id: "datos",          label: "Datos",          icon: Database,      roles: ["admin"] },
  { id: "modelo",         label: "Modelo ML",     icon: Activity,      roles: ["admin"] },
];

export const featureLabels: Record<string, string> = {
  M500_L:         "Puntaje Lectura",
  M500_CN:        "Puntaje Ciencias",
  M500_L_iemean:  "Lectura prom. IE",
  sexo:           "Sexo",
  ise_iemean:     "ISE prom. IE",
  M500_CN_iemean: "Ciencias prom. IE",
  Distrito:       "Distrito",
  ise:            "ISE estudiante",
  tamanio_ie:     "Tamanio IE",
};

export const AVATAR_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
];
