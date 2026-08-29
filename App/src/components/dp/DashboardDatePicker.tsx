"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import {
  PRESETS,
  presetRange,
  isoDay,
  addDays,
  type PresetKey,
} from "@/lib/date-range";

/** Pemilih rentang tanggal dashboard: preset cepat + kalender dual-month
 *  custom (tanpa lib) dengan pemilihan range (klik mulai → klik akhir).
 *  Nilai disimpan di URL (?from&to) supaya server re-render data sesuai. */

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = addDays(first, -(first.getDay() === 0 ? 6 : first.getDay() - 1)); // Senin awal
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export default function DashboardDatePicker({
  from,
  to,
  activePreset,
}: {
  from: string;
  to: string;
  activePreset: PresetKey;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selFrom, setSelFrom] = useState(from);
  const [selTo, setSelTo] = useState(to);
  const [pendingKey, setPendingKey] = useState<PresetKey>(activePreset);
  const [clicking, setClicking] = useState(false);
  const [busy, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  // Dua bulan tampil: bulan dari + bulan berikutnya (atau bulan sebelumnya saat membandingkan).
  const now = new Date();
  const base = new Date(selFrom);
  const [monthA, setMonthA] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const monthB = useMemo(() => {
    const d = new Date(monthA.y, monthA.m + 1, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [monthA]);

  function close() {
    setOpen(false);
    setSelFrom(from);
    setSelTo(to);
    setPendingKey(activePreset);
    setMonthA({ y: new Date(from).getFullYear(), m: new Date(from).getMonth() });
  }

  function apply(nextFrom: string, nextTo: string, key: PresetKey) {
    startTransition(() => {
      router.push(`/dashboard-v2?from=${nextFrom}&to=${nextTo}`, { scroll: false });
    });
    setOpen(false);
    void key;
  }

  function pickPreset(key: PresetKey) {
    if (key === "custom") {
      setPendingKey("custom");
      return;
    }
    const r = presetRange(key);
    setSelFrom(r.from);
    setSelTo(r.to);
    setPendingKey(key);
    apply(r.from, r.to, key);
  }

  function pickDay(d: Date) {
    const iso = isoDay(d);
    setPendingKey("custom");
    // Klik pertama = tetapkan mulai (rentang menyusut 1 hari), klik kedua =
    // perluas ke akhir (atau geser mulai bila lebih kecil). State klik
    // dilacak eksplisit supaya tidak bergantung pada heuristik from!==to.
    if (!clicking) {
      setClicking(true);
      setSelFrom(iso);
      setSelTo(iso);
      return;
    }
    setClicking(false);
    if (iso < selFrom) {
      setSelFrom(iso);
    } else {
      setSelTo(iso);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const todayIso = isoDay(now);
  const label =
    from === to
      ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(from))
      : `${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(from))} – ${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(to))}`;

  return (
    <div className="dp-dt" ref={boxRef}>
      <button
        type="button"
        className="dp-dt-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(o => !o)}
      >
        <CalendarDaysIcon className="h-4 w-4" />
        <span>{label}</span>
      </button>

      {open && (
        <div className="dp-dt-panel" role="dialog" aria-label="Pilih rentang tanggal">
          <div className="dp-dt-presets" role="tablist" aria-label="Preset rentang">
            {PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={pendingKey === p.key}
                className={`dp-dt-preset${pendingKey === p.key ? " dp-dt-preset-on" : ""}`}
                onClick={() => pickPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="dp-dt-calwrap">
            {([monthA, monthB] as const).map((m, idx) => {
              const cells = monthMatrix(m.y, m.m);
              return (
                <div key={idx} className="dp-dt-month">
                  <div className="dp-dt-mhead">
                    {idx === 0 ? (
                      <button type="button" className="dp-dt-nav" aria-label="Bulan sebelumnya"
                        onClick={() => setMonthA(({ y, m }) => ({ y: m === 0 ? y - 1 : y, m: m === 0 ? 11 : m - 1 }))}>
                        <ChevronLeftIcon className="h-4 w-4" />
                      </button>
                    ) : <span className="dp-dt-nav" aria-hidden />}
                    <b>{BULAN[m.m]} {m.y}</b>
                    {idx === 1 ? (
                      <button type="button" className="dp-dt-nav" aria-label="Bulan berikutnya"
                        onClick={() => setMonthA(({ y, m }) => ({ y: m === 11 ? y + 1 : y, m: m === 11 ? 0 : m + 1 }))}>
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    ) : <span className="dp-dt-nav" aria-hidden />}
                  </div>
                  <div className="dp-dt-grid">
                    {HARI.map(h => <span key={h} className="dp-dt-dow">{h}</span>)}
                    {cells.map(d => {
                      const iso = isoDay(d);
                      const out = d.getMonth() !== m.m;
                      const inRange = iso >= selFrom && iso <= selTo;
                      const isEdge = iso === selFrom || iso === selTo;
                      return (
                        <button
                          key={iso}
                          type="button"
                          className={[
                            "dp-dt-day",
                            out ? "dp-dt-out" : "",
                            inRange ? "dp-dt-in" : "",
                            isEdge ? "dp-dt-edge" : "",
                            iso === todayIso ? "dp-dt-today" : "",
                          ].join(" ")}
                          onClick={() => pickDay(d)}
                        >
                          {d.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dp-dt-foot">
            <span className="dp-dt-sel">
              {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(selFrom))}
              {" – "}
              {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(selTo))}
            </span>
            <span className="dp-dt-actions">
              <button type="button" className="dp-dt-clear" onClick={close}>
                <XIcon className="h-3.5 w-3.5" /> Batal
              </button>
              <button
                type="button"
                className="dp-dt-apply"
                disabled={busy}
                onClick={() => apply(selFrom, selTo, "custom")}
              >
                {busy ? "Memuat…" : "Terapkan"}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
