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
    if (target === 0) {
      setN(0);
      return;
    }
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
    <div
      ref={ref}
      className="dash-card rounded-2xl p-5"
      style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "#E9EEF6" }}>
          {prefix && <span className="text-lg" style={{ color: "#5A7898" }}>{prefix}</span>}
          {n.toLocaleString("id-ID")}
          {suffix && <span className="text-lg" style={{ color: "#5A7898" }}>{suffix}</span>}
        </span>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: accentBg, color: accent }}>
          {icon}
        </span>
      </div>
      <p className="text-sm mt-2.5" style={{ color: "#5A7898" }}>
        {label}
      </p>
      {delta !== undefined ? (
        <div className="flex items-center gap-1 mt-2">
          {up ? (
            <ArrowUpRight size={13} style={{ color: "#22D3A6" }} />
          ) : (
            <ArrowDownRight size={13} style={{ color: "#EF4444" }} />
          )}
          <span className="text-xs font-semibold" style={{ color: up ? "#22D3A6" : "#EF4444" }}>
            {up ? "+" : ""}
            {delta}%
          </span>
          <span className="text-xs" style={{ color: "#5A7898" }}>
            vs minggu lalu
          </span>
        </div>
      ) : sub ? (
        <p className="text-xs mt-2" style={{ color: "#5A7898" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}
