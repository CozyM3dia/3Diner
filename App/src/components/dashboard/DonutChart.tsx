"use client";

import { useEffect, useRef, useState } from "react";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: Segment[];
  size?: number;
  centerLabel?: string;
}

export default function DonutChart({ segments, size = 150, centerLabel = "Total" }: DonutChartProps) {
  const ref = useRef<SVGSVGElement>(null);
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

  const total = segments.reduce((s, x) => s + x.value, 0);
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const frac = total > 0 ? seg.value / total : 0;
    const len = frac * c;
    const arc = { ...seg, len, gap: c - len, rot: (offset / c) * 360 };
    offset += len;
    return arc;
  });

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${on ? a.len : 0} ${c}`}
              transform={`rotate(${a.rot - 90} ${cx} ${cx})`}
              style={{ transition: `stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1) ${i * 120}ms` }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color: "#E9EEF6" }}>
            {total.toLocaleString("id-ID")}
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "#5A7898" }}>
            {centerLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 min-w-0">
        {segments.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-xs flex-1 truncate" style={{ color: "#5A7898" }}>
                {s.label}
              </span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#E9EEF6" }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
