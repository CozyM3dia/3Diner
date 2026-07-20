"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Loader2,
  Check,
  AlertCircle,
  Percent,
  CalendarDays,
  Zap,
  Plus,
} from "lucide-react";
import { setMenuAvailability } from "@/lib/dashboard-actions";
import { isMenuAvailableNow } from "@/lib/menu-availability";
import {
  DashboardEmptyState,
  DashboardPanel,
  Field,
  StatusBadge,
  dashInputClass,
  dashInputStyle,
} from "@/components/dashboard/system";
import type { Menu } from "@/types";

const WEEKDAYS = [
  { v: "1", l: "Sn", full: "Senin" },
  { v: "2", l: "Sl", full: "Selasa" },
  { v: "3", l: "Rb", full: "Rabu" },
  { v: "4", l: "Km", full: "Kamis" },
  { v: "5", l: "Jm", full: "Jumat" },
  { v: "6", l: "St", full: "Sabtu" },
  { v: "7", l: "Mg", full: "Minggu" },
];

type ScheduleMode = "always" | "scheduled";

interface RowState {
  is_active: boolean;
  discount_pct: number;
  mode: ScheduleMode;
  days: Set<string>;
  start: string;
  end: string;
}

function MenuRow({ menu, index }: { menu: Menu; index: number }) {
  const hasDays =
    (menu.schedule_days ?? "").split(",").filter(Boolean).length > 0;
  const hasTime = Boolean(menu.schedule_start) || Boolean(menu.schedule_end);

  const [st, setSt] = useState<RowState>({
    is_active: menu.is_active !== false,
    discount_pct: menu.discount_pct ?? 0,
    mode: hasDays || hasTime ? "scheduled" : "always",
    days: new Set(
      (menu.schedule_days ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
    start: menu.schedule_start ?? "",
    end: menu.schedule_end ?? "",
  });

  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function mark(p: Partial<RowState>) {
    setSt((prev) => ({ ...prev, ...p }));
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  function toggleDay(v: string) {
    setSt((prev) => {
      const days = new Set(prev.days);
      days.has(v) ? days.delete(v) : days.add(v);
      return { ...prev, days };
    });
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  function toggleAllDays() {
    const allOn = WEEKDAYS.every((d) => st.days.has(d.v));
    mark({ days: allOn ? new Set<string>() : new Set(WEEKDAYS.map((d) => d.v)) });
  }

  function save() {
    startTransition(async () => {
      const res = await setMenuAvailability(menu.id_menu, {
        is_active: st.is_active,
        discount_pct: st.discount_pct,
        schedule_days:
          st.mode === "scheduled" ? ([...st.days].join(",") || null) : null,
        schedule_start:
          st.mode === "scheduled" ? (st.start || null) : null,
        schedule_end:
          st.mode === "scheduled" ? (st.end || null) : null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  // Live preview: compute visibility from current (unsaved) state
  const previewMenu: Menu = {
    ...menu,
    is_active: st.is_active,
    schedule_days:
      st.mode === "scheduled" ? ([...st.days].join(",") || null) : null,
    schedule_start:
      st.mode === "scheduled" ? (st.start || null) : null,
    schedule_end:
      st.mode === "scheduled" ? (st.end || null) : null,
  };
  const visibleNow = isMenuAvailableNow(previewMenu);
  const allDaysOn = WEEKDAYS.every((d) => st.days.has(d.v));

  return (
    <div
      className="dash-reveal"
      style={{ animationDelay: `${Math.min(index, 7) * 0.055}s` }}
    >
    <DashboardPanel
      className="dash-card"
      icon={
        <button
          onClick={() => mark({ is_active: !st.is_active })}
          aria-label={
            st.is_active ? "Nonaktifkan menu ini" : "Aktifkan menu ini"
          }
          aria-pressed={st.is_active}
          className="shrink-0 relative inline-flex items-center rounded-full"
          style={{
            width: "36px",
            height: "20px",
            background: st.is_active
              ? "rgba(34,211,166,0.22)"
              : "rgba(255,255,255,0.08)",
            border: `1.5px solid ${
              st.is_active
                ? "rgba(34,211,166,0.4)"
                : "rgba(255,255,255,0.09)"
            }`,
            transition:
              "background 150ms ease-out, border-color 150ms ease-out",
          }}
        >
          <span
            className="absolute rounded-full"
            style={{
              width: "14px",
              height: "14px",
              background: st.is_active
                ? "#22D3A6"
                : "rgba(255,255,255,0.32)",
              left: st.is_active ? "17px" : "1px",
              transition:
                "left 180ms cubic-bezier(0.22,1,0.36,1), background 150ms ease-out",
            }}
          />
        </button>
      }
      title={
        <span
          className="normal-case tracking-normal text-[13px] font-semibold"
          style={{
            color: st.is_active ? "var(--dash-text)" : "var(--dash-muted)",
            transition: "color 150ms ease-out",
          }}
        >
          {menu.nama_menu}
        </span>
      }
      actions={
        <StatusBadge
          kind={visibleNow ? "active" : "inactive"}
          label={visibleNow ? "Tampil" : "Tersembunyi"}
        />
      }
    >
      {/* ── Body ── */}
      <div
        style={{
          opacity: st.is_active ? 1 : 0.38,
          pointerEvents: st.is_active ? "auto" : "none",
          transition: "opacity 200ms ease-out",
        }}
      >
        {/* Mode segmented control */}
        <div className="flex items-center gap-2.5 mb-4">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider shrink-0"
            style={{ color: "#5A7898" }}
          >
            Tampil
          </span>
          <div
            className="flex rounded-xl p-0.5 gap-0.5"
            style={{
              background: "#0A1525",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <button
              onClick={() => mark({ mode: "always" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold"
              style={{
                background:
                  st.mode === "always"
                    ? "rgba(253,80,2,0.16)"
                    : "transparent",
                color: st.mode === "always" ? "#FD5002" : "#5A7898",
                transition:
                  "background 150ms ease-out, color 150ms ease-out",
              }}
            >
              <Zap size={11} />
              Selalu
            </button>
            <button
              onClick={() => mark({ mode: "scheduled" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold"
              style={{
                background:
                  st.mode === "scheduled"
                    ? "rgba(253,80,2,0.16)"
                    : "transparent",
                color: st.mode === "scheduled" ? "#FD5002" : "#5A7898",
                transition:
                  "background 150ms ease-out, color 150ms ease-out",
              }}
            >
              <CalendarDays size={11} />
              Jadwal
            </button>
          </div>
        </div>

        {/* Schedule controls */}
        {st.mode === "scheduled" && (
          <div className="space-y-3 mb-4">
            {/* Day chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--dash-muted)" }}
                >
                  Hari aktif
                </label>
                <button
                  onClick={toggleAllDays}
                  className="text-[10px] font-semibold"
                  style={{ color: allDaysOn ? "#FD5002" : "#5A7898" }}
                >
                  {allDaysOn ? "Hapus semua" : "Pilih semua"}
                </button>
              </div>
              <div className="flex gap-1">
                {WEEKDAYS.map((d) => {
                  const on = st.days.has(d.v);
                  return (
                    <button
                      key={d.v}
                      onClick={() => toggleDay(d.v)}
                      aria-label={d.full}
                      aria-pressed={on}
                      className="dash-chip flex-1 rounded-xl text-[11px] font-bold"
                      style={{
                        height: "36px",
                        background: on ? "rgba(253,80,2,0.13)" : "#0A1525",
                        color: on ? "#FD5002" : "#5A7898",
                        border: `1.5px solid ${
                          on
                            ? "rgba(253,80,2,0.36)"
                            : "rgba(255,255,255,0.07)"
                        }`,
                      }}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mulai" htmlFor={`sched-start-${menu.id_menu}`}>
                <input
                  id={`sched-start-${menu.id_menu}`}
                  type="time"
                  value={st.start}
                  onChange={(e) => mark({ start: e.target.value })}
                  className={dashInputClass}
                  style={dashInputStyle}
                />
              </Field>
              <Field label="Selesai" htmlFor={`sched-end-${menu.id_menu}`}>
                <input
                  id={`sched-end-${menu.id_menu}`}
                  type="time"
                  value={st.end}
                  onChange={(e) => mark({ end: e.target.value })}
                  className={dashInputClass}
                  style={dashInputStyle}
                />
              </Field>
            </div>

            {st.days.size === 0 && !st.start && !st.end && (
              <p className="text-[11px]" style={{ color: "#3E566E" }}>
                Belum ada jadwal dipilih. Menu tetap tampil kapan saja.
              </p>
            )}
          </div>
        )}

        {/* Discount */}
        <Field label="Diskon" htmlFor={`sched-disc-${menu.id_menu}`}>
          <div className="relative" style={{ width: "116px" }}>
            <input
              id={`sched-disc-${menu.id_menu}`}
              type="number"
              min="0"
              max="100"
              value={st.discount_pct}
              onChange={(e) =>
                mark({
                  discount_pct: Math.min(
                    100,
                    Math.max(0, Number(e.target.value))
                  ),
                })
              }
              className={`${dashInputClass} tabular-nums`}
              style={{
                ...dashInputStyle,
                paddingRight: "32px",
              }}
            />
            <Percent
              size={12}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "#5A7898" }}
            />
          </div>
          {st.discount_pct > 0 && (
            <p className="text-[11px] mt-1" style={{ color: "#FD5002" }}>
              Harga otomatis turun {st.discount_pct}%
            </p>
          )}
        </Field>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-xl"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.16)",
            }}
          >
            <AlertCircle
              size={13}
              style={{ color: "#F87171" }}
              className="shrink-0"
            />
            <p className="text-xs" style={{ color: "#F87171" }}>
              {error}
            </p>
          </div>
        )}

        {/* Save footer */}
        {(dirty || saved) && (
          <div
            className="flex justify-end mt-4 pt-3.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <button
              onClick={save}
              disabled={pending || !dirty}
              className="dash-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
              style={{
                background: saved ? "#1DBF94" : "#FD5002",
                opacity: pending || !dirty ? 0.65 : 1,
                transition:
                  "background 220ms ease-out, filter 0.15s, transform 0.12s, opacity 0.15s",
              }}
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : saved ? (
                <Check size={13} />
              ) : null}
              {pending ? "Menyimpan…" : saved ? "Tersimpan" : "Simpan perubahan"}
            </button>
          </div>
        )}
      </div>
    </DashboardPanel>
    </div>
  );
}

export default function SchedulerClient({ menus }: { menus: Menu[] }) {
  if (menus.length === 0) {
    return (
      <DashboardPanel>
        <DashboardEmptyState
          icon={<CalendarDays size={36} strokeWidth={1.4} />}
          title="Belum ada menu"
          hint="Tambah menu dulu untuk mengatur jadwal & diskon"
          action={
            <Link
              href="/dashboard/menu/new"
              className="dash-btn inline-flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white"
              style={{ background: "var(--orange)" }}
            >
              <Plus size={15} /> Tambah Menu
            </Link>
          }
        />
      </DashboardPanel>
    );
  }

  return (
    <div className="space-y-3">
      {menus.map((m, i) => (
        <MenuRow key={m.id_menu} menu={m} index={i} />
      ))}
    </div>
  );
}
