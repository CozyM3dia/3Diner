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
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors duration-150"
      style={{
        background: active ? "rgba(34,211,166,0.1)" : "rgba(90,120,152,0.12)",
        color: active ? "#22D3A6" : "#5A7898",
        border: `1px solid ${active ? "rgba(34,211,166,0.2)" : "rgba(90,120,152,0.2)"}`,
        cursor: isPending ? "wait" : "pointer",
      }}
      title={active ? "Klik untuk nonaktifkan (Habis)" : "Klik untuk aktifkan"}
    >
      {isPending ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#22D3A6" : "#5A7898" }} />
      )}
      {active ? "Aktif" : "Habis"}
    </button>
  );
}
