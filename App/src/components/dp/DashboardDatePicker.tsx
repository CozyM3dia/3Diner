"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDaysIcon, XIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { id as localeID } from "react-day-picker/locale";
import {
  PRESETS,
  presetRange,
  isoDay,
  parseDay,
  type PresetKey,
} from "@/lib/date-range";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Pemilih rentang tanggal dashboard — preset cepat + Calendar shadcn
 *  (react-day-picker v10, mode "range", locale Indonesia).
 *  Nilai disimpan di URL (?from&to) supaya server re-render data sesuai. */

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
  // Rentang ditulis ke rute yang SEDANG dibuka (Ringkasan, Penjualan, atau
  // harness) — bukan ke satu rute tetap, supaya berpindah lembar tidak
  // sekaligus melempar pengguna kembali ke Ringkasan.
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [selFrom, setSelFrom] = React.useState(from);
  const [selTo, setSelTo] = React.useState(to);
  const [pendingKey, setPendingKey] = React.useState<PresetKey>(activePreset);
  const [busy, startTransition] = React.useTransition();

  // Bulan tampilan mengikuti rentang terpilih saat popover dibuka.
  const [month, setMonth] = React.useState<Date>(() => parseDay(from));
  // True saat pengguna sedang memilih (klik pertama dilakukan, menunggu klik akhir).
  const [clicking, setClicking] = React.useState(false);

  function syncFromProps() {
    setSelFrom(from);
    setSelTo(to);
    setClicking(false);
    setPendingKey(activePreset);
    setMonth(parseDay(from));
  }

  function apply(nextFrom: string, nextTo: string, key: PresetKey) {
    startTransition(() => {
      router.push(`${pathname}?from=${nextFrom}&to=${nextTo}` as never, { scroll: false });
    });
    setOpen(false);
    setClicking(false);
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
    setClicking(false);
    setPendingKey(key);
    apply(r.from, r.to, key);
  }

  // react-day-picker memakai Date lokal — konversi lewat parseDay supaya
  // bebas offset zona (new Date("YYYY-MM-DD") diurai sebagai UTC).
  // Matematika range RDP (resetOnSelect=false secara default) TIDAK dipakai:
  // hari yang diklik diambil dari triggerDate, state dikelola sendiri seperti
  // pola komponen lama (klik 1 = mulai, klik 2 = selesaikan). Saat menunggu
  // klik akhir, rentang sengaja dirender {X, X} supaya hari awal tetap
  // ter-highlight di kalender.
  const selected: DateRange = React.useMemo(
    () => ({ from: parseDay(selFrom), to: parseDay(selTo) }),
    [selFrom, selTo]
  );

  function pickRange(_range: DateRange | undefined, triggerDate: Date | undefined) {
    if (!triggerDate) return;
    const iso = isoDay(triggerDate);
    setPendingKey("custom");
    if (!clicking) {
      // Klik pertama: mulai rentang baru, ciutkan dulu ke 1 hari.
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

  const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("id-ID", opts).format(parseDay(iso));

  const label =
    from === to
      ? fmtDay(from, { day: "numeric", month: "long", year: "numeric" })
      : `${fmtDay(from, { day: "numeric", month: "short" })} – ${fmtDay(to, { day: "numeric", month: "short", year: "numeric" })}`;

  const selLabel = clicking
    ? `${fmtDay(selFrom, { day: "numeric", month: "short" })} – pilih tanggal akhir…`
    : `${fmtDay(selFrom, { day: "numeric", month: "short" })} – ${fmtDay(selTo, { day: "numeric", month: "short" })}`;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) syncFromProps();
      }}
    >
      <PopoverTrigger
        className="dp-dt-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarDaysIcon className="h-4 w-4" />
        <span>{label}</span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={10}
        className="dp-cal-pop w-auto p-3.5"
        aria-label="Pilih rentang tanggal"
      >
        <div
          className="dp-dt-presets"
          role="tablist"
          aria-label="Preset rentang"
        >
          {PRESETS.map((p) => (
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

        <Calendar
          mode="range"
          selected={selected}
          onSelect={pickRange}
          month={month}
          onMonthChange={setMonth}
          numberOfMonths={2}
          locale={localeID}
          captionLayout="dropdown"
          disabled={{ after: new Date() }}
        />

        <div className="dp-dt-foot">
          <span className="dp-dt-sel">{selLabel}</span>
          <span className="dp-dt-actions">
            <button
              type="button"
              className="dp-dt-clear"
              onClick={() => setOpen(false)}
            >
              <XIcon className="h-3.5 w-3.5" /> Batal
            </button>
            <button
              type="button"
              className="dp-dt-apply"
              disabled={busy || clicking}
              onClick={() => apply(selFrom, selTo, "custom")}
            >
              {busy ? "Memuat…" : "Terapkan"}
            </button>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
