"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setMenuAvailability } from "@/lib/dashboard-actions";

interface Props {
  menuId: string;
  initialActive: boolean;
}

export default function MenuActiveToggle({ menuId, initialActive }: Props) {
  const [active, setActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      await setMenuAvailability(menuId, { is_active: next });
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      role="switch"
      aria-checked={active}
      className="inline-flex items-center gap-2.5"
      style={{ cursor: isPending ? "wait" : "pointer" }}
      title={active ? "Klik untuk nonaktifkan" : "Klik untuk aktifkan"}
    >
      {/* Track */}
      <span
        style={{
          width: 36,
          height: 20,
          borderRadius: 9999,
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          background: active ? "rgba(34,211,166,0.15)" : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${active ? "rgba(34,211,166,0.45)" : "rgba(90,120,152,0.28)"}`,
          transition: "background 0.2s ease, border-color 0.2s ease",
        }}
      >
        {/* Thumb */}
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 9999,
            background: active ? "#22D3A6" : "#374F6B",
            position: "absolute",
            left: active ? 18 : 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "left 0.2s cubic-bezier(0.25, 0, 0, 1), background 0.2s ease, box-shadow 0.2s ease",
            boxShadow: active ? "0 0 0 3px rgba(34,211,166,0.18)" : "none",
          }}
        >
          {isPending && (
            <Loader2
              size={8}
              strokeWidth={2.5}
              style={{ color: "rgba(255,255,255,0.9)" }}
              className="animate-spin"
            />
          )}
        </span>
      </span>

      {/* Label */}
      <span
        className="text-xs font-semibold"
        style={{
          minWidth: "2.5rem",
          color: isPending ? "#5A7898" : active ? "#22D3A6" : "#5A7898",
          transition: "color 0.2s ease",
        }}
      >
        {isPending ? "..." : active ? "Aktif" : "Habis"}
      </span>
    </button>
  );
}
