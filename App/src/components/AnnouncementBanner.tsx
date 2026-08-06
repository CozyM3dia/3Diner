"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { typeMeta } from "@/lib/announcement-types";
import { readableOn, readableSoftOn } from "@/lib/contrast";

interface AnnouncementBannerProps {
  id: string;
  message: string;
  bgColor: string;
  type?: string;
}

export default function AnnouncementBanner({ id, message, bgColor, type }: AnnouncementBannerProps) {
  const storageKey = `3diner.ann-dismissed.${id}`;
  const [show, setShow] = useState(true);

  // Ditutup sekali = tetap tertutup selama sesi ini. Dibaca setelah mount
  // supaya tidak ada hydration mismatch dengan render server.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(storageKey) === "1";
    } catch { /* storage tidak tersedia */ }
    if (!dismissed) return;
    const t = setTimeout(() => setShow(false), 0);
    return () => clearTimeout(t);
  }, [storageKey]);

  if (!show) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch { /* abaikan */ }
    setShow(false);
  }

  const meta = typeMeta(type);
  const Icon = meta.icon;
  const fg = readableOn(bgColor);
  const soft = readableSoftOn(bgColor);

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium"
      style={{
        background: bgColor,
        color: fg,
        animation: "ann-slide 360ms cubic-bezier(0.22,1,0.36,1)",
      }}
      role="status"
    >
      <Icon size={15} className="shrink-0" style={{ color: fg }} />
      <span className="flex-1 leading-snug">{message}</span>
      <button
        onClick={dismiss}
        aria-label="Tutup"
        className="shrink-0 -my-1.5 -mr-2 inline-flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-100"
        style={{ color: soft }}
      >
        <X size={16} />
      </button>
      <style>{`@keyframes ann-slide { from { transform: translateY(-100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
}
