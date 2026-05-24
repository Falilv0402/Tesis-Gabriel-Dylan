"use client";

import { getAvatarColor, getInitials } from "@/lib/format";

export function Avatar({
  nombre,
  apellidos,
  email,
  color,
  size = 36,
}: {
  nombre: string;
  apellidos: string;
  email: string;
  color: string;
  size?: number;
}) {
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
