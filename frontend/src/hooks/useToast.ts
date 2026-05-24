"use client";

import { useState } from "react";

export interface ToastEntry {
  id: number;
  msg: string;
  type: "success" | "error" | "info";
}

export interface NotifEntry {
  id: number;
  msg: string;
  type: string;
  ts: Date;
  read: boolean;
}

export function useToast() {
  const [toasts,          setToasts]          = useState<ToastEntry[]>([]);
  const [notifInbox,      setNotifInbox]      = useState<NotifEntry[]>([]);
  const [notifCount,      setNotifCount]      = useState(0);
  const [showNotifInbox,  setShowNotifInbox]  = useState(false);

  function toast(msg: string, type: ToastEntry["type"] = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    if (type !== "success") {
      setNotifInbox((prev) => [{ id, msg, type, ts: new Date(), read: false }, ...prev.slice(0, 49)]);
      setNotifCount((n) => n + 1);
    }
  }

  function clearNotifs() {
    setNotifInbox([]);
    setNotifCount(0);
  }

  return {
    toasts,
    notifInbox,
    notifCount, setNotifCount,
    showNotifInbox, setShowNotifInbox,
    toast, clearNotifs,
  };
}
