"use client";

import { getAvatarColor, getInitials } from "@/lib/format";

export function Avatar({
  nombre,
  apellidos,
  email,
  color,
  avatarUrl,
  size = 36,
}: {
  nombre: string;
  apellidos: string;
  email: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa (Supabase Storage), no vale la pena el loader de next/image para un avatar chico
      <img
        src={avatarUrl}
        alt={nombre || email}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          userSelect: "none",
        }}
      />
    );
  }

  const initials = getInitials(nombre, apellidos, email);
  const bg = getAvatarColor(email, color);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 800,
        flexShrink: 0,
        letterSpacing: "0.03em",
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}
