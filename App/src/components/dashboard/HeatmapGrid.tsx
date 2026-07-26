"use client";

import { useEffect, useRef, useState } from "react";

interface HeatmapGridProps {
  /** 24 values, index = hour of day. */
  hourly: number[];
  color?: string;
}

export default function HeatmapGrid({ hourly, color = "#FD5002" }: HeatmapGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setOn(true)),
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const max = Math.max(1, ...hourly);
  const peak = hourly.indexOf(max);

  return (
    <div ref={ref}>
      <div className="flex gap-1">
        {hourly.map((v, h) => {
          const intensity = v / max; // 0..1
          const isPeak = h === peak && v > 0;
          return (
            <div
              key={h}
              className="flex-1 relative"
              onMouseEnter={() => setHover(h)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className="w-full rounded-md"
                style={{
                  height: "44px",
                  background:
                    v === 0
                      ? "rgba(255,255,255,0.04)"
                      : `rgba(253,80,2,${0.14 + intensity * 0.86})`,
                  outline: isPeak ? `1.5px solid ${color}` : "none",
                  outlineOffset: "1px",
                  opacity: on ? 1 : 0,
                  transform: on ? "scaleY(1)" : "scaleY(0.4)",
                  transformOrigin: "bottom",
                  transition: `opacity 400ms ease-out ${h * 18}ms, transform 400ms cubic-bezier(0.22,1,0.36,1) ${h * 18}ms`,
                }}
              />
              {hover === h && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 -top-9 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap z-10 pointer-events-none"
                  style={{ background: "#132136", color: "#E9EEF6", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {String(h).padStart(2, "0")}:00 · {v}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
          <span key={h} className="text-[9px]" style={{ color: "var(--dash-muted)" }}>
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}
