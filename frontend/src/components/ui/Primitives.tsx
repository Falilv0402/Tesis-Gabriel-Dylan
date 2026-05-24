"use client";

import React from "react";
import { pct } from "@/lib/format";

export function Kpi({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString("es-PE") : value;
  return (
    <article className={`kpi ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{displayValue}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Bar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="bar-row">
      <div>
        <span>{label}</span>
        <strong>{pct(value)}</strong>
      </div>
      <div className="bar-track">
        <span
          className={tone ?? ""}
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}
