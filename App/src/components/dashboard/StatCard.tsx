"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatCardProps {
  value: number;
  label: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  delta?: number; // % change vs last week
  sub?: string; // alternative caption when no delta
  suffix?: string; // e.g. "%" appended to the value
  prefix?: string; // e.g. "Rp " before the value
}

function useCountUp(target: number, run: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 4); // ease-out quart
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

export default function StatCard({ value, label, icon, accent, accentBg, delta, sub, suffix, prefix }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const n = useCountUp(value, on);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setOn(true)),
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const up = (delta ?? 0) >= 0;

  return (
    <div ref={ref} className="dash-card dash-panel">
      {/* Header band — icon + label (dash-8 KPI rhythm) */}
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: accentBg, color: accent }}>
          <span className="scale-[0.8] flex items-center justify-center">{icon}</span>
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.06em] truncate"
          style={{ color: "var(--dash-muted)" }}
        >
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="px-4 pt-2.5 pb-4">
        <span className="text-[26px] font-bold leading-none tabular-nums" style={{ color: "var(--dash-text)" }}>
          {prefix && <span className="text-base font-semibold" style={{ color: "var(--dash-muted)" }}>{prefix}</span>}
          {n.toLocaleString("id-ID")}
          {suffix && <span className="text-base font-semibold" style={{ color: "var(--dash-muted)" }}>{suffix}</span>}
        </span>

        {delta !== undefined ? (
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className={`delta-chip ${up ? "up" : "down"}`}>
              {up ? <ArrowUpRight size={11} strokeWidth={2.4} /> : <ArrowDownRight size={11} strokeWidth={2.4} />}
              {up ? "+" : ""}
              {delta}%
            </span>
            <span className="text-[11px]" style={{ color: "var(--dash-muted)" }}>
              vs minggu lalu
            </span>
          </div>
        ) : sub ? (
          <p className="text-[11px] mt-2.5" style={{ color: "var(--dash-muted)" }}>
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}
