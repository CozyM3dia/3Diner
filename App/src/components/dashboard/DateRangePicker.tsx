"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface DateRangePickerProps {
  initialStart?: string;
  initialEnd?: string;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const WEEK_DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function DateRangePicker({ initialStart, initialEnd }: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Fixed-position coords so the dropdown escapes overflow:auto scroll containers
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);

  function openWithPos() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setIsOpen((v) => !v);
  }

  // Temporary selection state for custom calendar selection
  const [tempStart, setTempStart] = useState<Date | null>(
    initialStart ? new Date(initialStart) : null
  );
  const [tempEnd, setTempEnd] = useState<Date | null>(
    initialEnd ? new Date(initialEnd) : null
  );
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Active month in the calendar view
  const [currentMonth, setCurrentMonth] = useState<Date>(
    initialStart ? new Date(initialStart) : new Date()
  );

  // Sync state if initial props change
  useEffect(() => {
    setTempStart(initialStart ? new Date(initialStart) : null);
    setTempEnd(initialEnd ? new Date(initialEnd) : null);
  }, [initialStart, initialEnd]);

  // Handle outside click to close dropdown
  // The dropdown is fixed-positioned (outside containerRef), so we track it separately.
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const t = event.target as Node;
      const insideTrigger = containerRef.current?.contains(t);
      const insideDropdown = dropdownRef.current?.contains(t);
      if (!insideTrigger && !insideDropdown) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle escape key to close dropdown
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Formatting dates for display
  const formatDateISO = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (d: Date) => {
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const activeRangeLabel = (() => {
    if (initialStart && initialEnd) {
      const start = new Date(initialStart);
      const end = new Date(initialEnd);
      if (formatDateISO(start) === formatDateISO(end)) {
        return formatDateDisplay(start);
      }
      return `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`;
    }
    if (initialStart) {
      return `Mulai dari ${formatDateDisplay(new Date(initialStart))}`;
    }
    if (initialEnd) {
      return `Hingga ${formatDateDisplay(new Date(initialEnd))}`;
    }
    return "14 Hari Terakhir"; // default fallback in dashboard
  })();

  // Apply selected dates to URL params
  const applyDates = (start?: Date, end?: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    if (start) {
      params.set("start", formatDateISO(start));
    } else {
      params.delete("start");
    }

    if (end) {
      params.set("end", formatDateISO(end));
    } else {
      params.delete("end");
    }

    setIsOpen(false);
    router.push(`${pathname}?${params.toString()}`);
  };

  const applyPreset = (preset: "today" | "7days" | "14days" | "30days" | "thisMonth" | "allTime") => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start: Date | undefined;
    let end: Date | undefined = new Date(today);

    if (preset === "today") {
      start = new Date(today);
    } else if (preset === "7days") {
      start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    } else if (preset === "14days") {
      start = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
    } else if (preset === "30days") {
      start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    } else if (preset === "thisMonth") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === "allTime") {
      start = undefined;
      end = undefined;
    }

    setTempStart(start || null);
    setTempEnd(end || null);
    applyDates(start, end);
  };

  // Generate calendar days
  const calendarCells = (() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
    const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const nextPadding = 42 - cells.length;
    for (let i = 1; i <= nextPadding; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return cells;
  })();

  const handleDayClick = (date: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(date);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      if (date < tempStart) {
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
    }
  };

  const isSelected = (date: Date) => {
    if (tempStart && formatDateISO(date) === formatDateISO(tempStart)) return "start";
    if (tempEnd && formatDateISO(date) === formatDateISO(tempEnd)) return "end";
    return null;
  };

  const isInRange = (date: Date) => {
    if (tempStart && tempEnd) {
      return date > tempStart && date < tempEnd;
    }
    if (tempStart && !tempEnd && hoveredDate) {
      return date > tempStart && date < hoveredDate;
    }
    return false;
  };

  const changeMonth = (direction: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1));
  };

  return (
    <div ref={containerRef} className="relative z-30">
      {/* Date trigger button */}
      <button
        ref={triggerRef}
        onClick={openWithPos}
        className="press flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
        style={{
          background: "#0D1829",
          color: "#E9EEF6",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
        }}
      >
        <CalendarIcon size={16} className="opacity-70 text-orange-500" style={{ color: "#FD5002" }} />
        <span>{activeRangeLabel}</span>
      </button>

      {/* Dropdown panel — portalled to body to escape all ancestor stacking contexts */}
      {isOpen && dropPos && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          className="rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-2xl dash-reveal"
          style={{
            position: "fixed",
            top: dropPos.top,
            right: dropPos.right,
            zIndex: 9999,
            background: "rgba(13, 24, 41, 0.98)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            width: "max-content",
            maxWidth: "calc(100vw - 16px)",
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Left panel: Presets */}
          <div
            className="w-full md:w-[170px] shrink-0 p-3 space-y-1 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible no-scrollbar"
            style={{
              borderRight: "1px solid rgba(255, 255, 255, 0.06)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            {[
              { id: "today", label: "Hari Ini" },
              { id: "7days", label: "7 Hari Terakhir" },
              { id: "14days", label: "14 Hari Terakhir" },
              { id: "30days", label: "30 Hari Terakhir" },
              { id: "thisMonth", label: "Bulan Ini" },
              { id: "allTime", label: "Semua Waktu" }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id as any)}
                className="w-max md:w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                style={{ color: "#9FB6D1" }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Right panel: Calendar picker */}
          <div className="p-4 w-[290px] md:w-[310px] shrink-0">
            {/* Calendar header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold" style={{ color: "#E9EEF6" }}>
                {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => changeMonth(-1)}
                  className="press p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ color: "var(--dash-muted)" }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => changeMonth(1)}
                  className="press p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ color: "var(--dash-muted)" }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEK_DAYS.map((d) => (
                <span key={d} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--dash-muted)" }}>
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, idx) => {
                const sel = isSelected(cell.date);
                const range = isInRange(cell.date);
                const isToday = formatDateISO(cell.date) === formatDateISO(new Date());

                return (
                  <button
                    key={idx}
                    onClick={() => handleDayClick(cell.date)}
                    onMouseEnter={() => tempStart && !tempEnd && setHoveredDate(cell.date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className="h-8 rounded-lg flex items-center justify-center text-xs font-semibold relative transition-colors cursor-pointer"
                    style={{
                      color: sel ? "#FFF" : !cell.isCurrentMonth ? "#374F6B" : "#9FB6D1",
                      background: sel
                        ? "#FD5002"
                        : range
                        ? "rgba(253, 80, 2, 0.12)"
                        : isToday
                        ? "rgba(255, 255, 255, 0.04)"
                        : "transparent",
                      border: isToday && !sel ? "1px solid rgba(255, 255, 255, 0.15)" : "none"
                    }}
                  >
                    <span className="relative z-10">{cell.date.getDate()}</span>
                    {/* Visual dot background connection */}
                    {sel && tempStart && tempEnd && (
                      <span
                        className="absolute inset-y-0 w-4 pointer-events-none"
                        style={{
                          background: "rgba(253, 80, 2, 0.12)",
                          left: sel === "end" ? 0 : "auto",
                          right: sel === "start" ? 0 : "auto",
                          zIndex: 0
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors cursor-pointer"
                style={{ color: "var(--dash-muted)" }}
              >
                Batal
              </button>
              <button
                onClick={() => applyDates(tempStart || undefined, tempEnd || undefined)}
                disabled={!tempStart}
                className="flex-1 py-2 rounded-xl text-xs font-bold dash-on-accent transition-all disabled:opacity-50 cursor-pointer"
                style={{
                  background: "#FD5002",
                  boxShadow: "0 4px 12px rgba(253, 80, 2, 0.25)"
                }}
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
