"use client";

import { useState } from "react";
import { Megaphone, X } from "lucide-react";

interface AnnouncementBannerProps {
  message: string;
  bgColor: string;
}

export default function AnnouncementBanner({ message, bgColor }: AnnouncementBannerProps) {
  const [show, setShow] = useState(true);
  if (!show) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium"
      style={{
        background: bgColor,
        color: "#FFFFFF",
        animation: "ann-slide 360ms cubic-bezier(0.22,1,0.36,1)",
      }}
      role="status"
    >
      <Megaphone size={15} className="shrink-0" />
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={() => setShow(false)} aria-label="Tutup" className="shrink-0 opacity-80 hover:opacity-100">
        <X size={15} />
      </button>
      <style>{`@keyframes ann-slide { from { transform: translateY(-100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
}
