import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const SITE_URL = "https://satraapp.com";
const TITLE = "SATRA — Sistema de Alerta Temprana de Riesgo Académico";
const DESCRIPTION =
  "Plataforma de alerta temprana de riesgo académico para colegios: predicción de riesgo con machine learning, seguimiento de intervenciones y reportes para directores y coordinadores. Proyecto de tesis UPC.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "alerta temprana",
    "riesgo académico",
    "deserción escolar",
    "machine learning educación",
    "SATRA",
    "gestión educativa",
    "predicción de riesgo académico",
  ],
  authors: [{ name: "UPC" }],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "SATRA",
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

