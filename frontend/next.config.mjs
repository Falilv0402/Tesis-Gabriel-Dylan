/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Evita que SATRA se embeba en un <iframe> de otro sitio (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // El navegador no debe "adivinar" el tipo de un archivo distinto al declarado.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No filtra la URL completa (con IDs/tokens en query) al navegar a otro dominio.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La app no usa camara/microfono/geolocalizacion — se desactivan explicitamente.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

