"use client";

import { useState } from "react";

export interface ToastEntry {
  id: number;
  msg: string;
  type: "success" | "error" | "info";
}

export function useToast() {
  const [toasts,          setToasts]          = useState<ToastEntry[]>([]);
  // Controla el panel del bell — el contenido real (notificaciones entre
  // compañeros del mismo colegio) vive en useNotificaciones, no aquí.
  const [showNotifInbox,  setShowNotifInbox]  = useState(false);

  function toast(msg: string, type: ToastEntry["type"] = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  return {
    toasts,
    showNotifInbox, setShowNotifInbox,
    toast,
  };
}
