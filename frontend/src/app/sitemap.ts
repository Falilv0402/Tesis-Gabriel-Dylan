import type { MetadataRoute } from "next";

// SATRA es una SPA de una sola ruta pública (todo lo demás vive detrás de
// login, dentro de "/"): el sitemap solo necesita listar la raíz.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://satraapp.com",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
