"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, Percent } from "lucide-react";
import { setMenuAvailability } from "@/lib/dashboard-actions";
import type { Menu } from "@/types";

const WEEKDAYS = [
  { v: "1", l: "S" },
  { v: "2", l: "S" },
  { v: "3", l: "R" },
  { v: "4", l: "K" },
  { v: "5", l: "J" },
  { v: "6", l: "S" },
  { v: "7", l: "M" },
];

interface RowState {
  is_active: boolean;
  discount_pct: number;
  days: Set<string>;
  start: string;
  end: string;
}

function MenuRow({ menu }: { menu: Menu }) {
  const [st, setSt] = useState<RowState>({
    is_active: menu.is_active !== false,
    discount_pct: menu.discount_pct ?? 0,
    days: new Set((menu.schedule_days ?? "").split(",").map((s) => s.trim()).filter(Boolean)),
    start: menu.schedule_start ?? "",
    end: menu.schedule_end ?? "",
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  function mark(patch: Partial<RowState>) {
    setSt((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaved(false);
  }
  function toggleDay(v: string) {
    setSt((prev) => {
      const days = new Set(prev.days);
      days.has(v) ? days.delete(v) : days.add(v);
      return { ...prev, days };
    });
    setDirty(true);
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await setMenuAvailability(menu.id_menu, {
        is_active: st.is_active,
        discount_pct: st.discount_pct,
        schedule_days: [...st.days].join(",") || null,
        schedule_start: st.start || null,
        schedule_end: st.end || null,
      });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const inputStyle: React.CSSProperties = { background: "#132136", border: "1px solid rgba(255,255,255,0.1)", color: "#E9EEF6" };

  return (
    <div className="dash-card rounded-2xl p-4 lg:p-5" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm font-semibold truncate" style={{ color: "#E9EEF6" }}>{menu.nama_menu}</p>
        <button onClick={() => mark({ is_active: !st.is_active })} className="shrink-0">
          <span className="relative inline-block w-11 h-6 rounded-full" style={{ background: st.is_active ? "#22D3A6" : "rgba(255,255,255,0.12)", transition: "background 150ms ease-out" }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ left: st.is_active ? "22px" : "2px", transition: "left 180ms cubic-bezier(0.22,1,0.36,1)" }} />
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>Hari aktif</label>
          <div className="flex gap-1">
            {WEEKDAYS.map((d, i) => {
              const on = st.days.has(d.v);
              return (
                <button
                  key={i}
                  onClick={() => toggleDay(d.v)}
                  className="dash-chip w-8 h-8 rounded-lg text-xs font-semibold"
                  style={{
                    background: on ? "rgba(253,80,2,0.14)" : "#132136",
                    color: on ? "#FD5002" : "#5A7898",
                    border: `1px solid ${on ? "rgba(253,80,2,0.4)" : "rgba(255,255,255,0.08)"}`,
                    transition: "all 150ms ease-out",
                  }}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>Mulai</label>
            <input type="time" value={st.start} onChange={(e) => mark({ start: e.target.value })} className="dash-input px-2.5 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>Selesai</label>
            <input type="time" value={st.end} onChange={(e) => mark({ end: e.target.value })} className="dash-input px-2.5 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>Diskon</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={st.discount_pct}
                onChange={(e) => mark({ discount_pct: Number(e.target.value) })}
                className="dash-input w-20 pl-2.5 pr-7 py-2 rounded-lg text-sm outline-none tabular-nums"
                style={inputStyle}
              />
              <Percent size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#5A7898" }} />
            </div>
          </div>
        </div>
      </div>

      {(dirty || saved) && (
        <div className="flex justify-end mt-4">
          <button
            onClick={save}
            disabled={pending || !dirty}
            className="dash-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ background: saved ? "#22D3A6" : "#FD5002", opacity: pending ? 0.7 : 1, transition: "background 200ms ease-out, filter 0.15s, transform 0.12s" }}
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
            {saved ? "Tersimpan" : "Simpan"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SchedulerClient({ menus }: { menus: Menu[] }) {
  if (menus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="font-semibold" style={{ color: "#E9EEF6" }}>Belum ada menu</p>
        <p className="text-sm mt-1" style={{ color: "#5A7898" }}>Tambah menu dulu untuk mengatur jadwal & diskon</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {menus.map((m) => (
        <MenuRow key={m.id_menu} menu={m} />
      ))}
    </div>
  );
}
