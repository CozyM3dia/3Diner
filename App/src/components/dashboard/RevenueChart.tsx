"use client";

import { useEffect, useRef, useState } from "react";

interface RevenueChartProps {
  data: { label: string; value: number }[];
  color?: string;
}

function shortRp(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "jt";
  if (n >= 1_000) return Math.round(n / 1_000) + "rb";
  return String(n);
}

export default function RevenueChart({ data, color = "#FD5002" }: RevenueChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setOn(true)),
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div ref={ref}>
      <div className="flex items-end justify-between gap-1" style={{ height: "168px" }}>
        {data.map((d, i) => {
          const h = on ? Math.max(2, (d.value / max) * 100) : 0;
          const isLast = i === data.length - 1;
          return (
            <div
              key={i}
              className="flex-1 h-full flex flex-col justify-end items-center relative"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div
                  className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[10px] font-semibold tabular-nums whitespace-nowrap z-10 pointer-events-none"
                  style={{ background: "#132136", color: "#E9EEF6", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Rp {d.value.toLocaleString("id-ID")}
                </div>
              )}
              <div
                className="w-full max-w-[18px] rounded-t-md"
                style={{
                  height: `${h}%`,
                  background: isLast ? color : "rgba(253,80,2,0.45)",
                  transition: `height 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 35}ms`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        {data.map((d, i) =>
          i % 2 === 0 ? (
            <span key={i} className="text-[9px] flex-1 text-center" style={{ color: "var(--dash-muted)" }}>
              {d.label.split(" ")[0]}
            </span>
          ) : (
            <span key={i} className="flex-1" />
          )
        )}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px]" style={{ color: "var(--dash-muted)" }}>
        <span>Maks: Rp {shortRp(max)}</span>
      </div>
    </div>
  );
}
