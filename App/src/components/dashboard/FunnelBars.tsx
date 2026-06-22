"use client";

import { useEffect, useRef, useState } from "react";

interface Stage {
  label: string;
  value: number;
  pct: number; // 0..100 relative to top of funnel
  color: string;
}

export default function FunnelBars({ stages }: { stages: Stage[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

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

  return (
    <div ref={ref} className="space-y-4">
      {stages.map((s, i) => {
        const dropFromPrev =
          i > 0 && stages[i - 1].value > 0
            ? Math.round((s.value / stages[i - 1].value) * 100)
            : null;
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color: "#E9EEF6" }}>
                {s.label}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold tabular-nums" style={{ color: "#E9EEF6" }}>
                  {s.value.toLocaleString("id-ID")}
                </span>
                {dropFromPrev !== null && (
                  <span className="text-[10px] tabular-nums" style={{ color: "#5A7898" }}>
                    {dropFromPrev}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: on ? `${Math.max(2, s.pct)}%` : "0%",
                  background: s.color,
                  transition: `width 800ms cubic-bezier(0.22,1,0.36,1) ${i * 120}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
