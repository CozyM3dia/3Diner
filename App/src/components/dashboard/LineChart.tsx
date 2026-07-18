"use client";

import { useEffect, useId, useRef, useState } from "react";

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}

// Catmull-Rom → cubic bezier for a smooth curve through all points.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const W = 600;
const PAD_L = 38;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 26;

export default function LineChart({ data, color = "#FD5002", height = 180 }: LineChartProps) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
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

  const H = height;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(max / 4) * 4 || 4;

  const pts = data.map((d, i) => ({
    x: PAD_L + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
    y: PAD_T + plotH - (d.value / niceMax) * plotH,
  }));

  const line = smoothPath(pts);
  const area =
    line && `${line} L ${pts[pts.length - 1].x} ${PAD_T + plotH} L ${pts[0].x} ${PAD_T + plotH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: PAD_T + plotH - t * plotH,
    label: Math.round(niceMax * t).toString(),
  }));

  const last = pts[pts.length - 1];

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ overflow: "visible" }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid + Y labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            y1={t.y}
            x2={W - PAD_R}
            y2={t.y}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
            strokeDasharray="2 5"
          />
          <text x={PAD_L - 8} y={t.y + 3} textAnchor="end" fontSize="10" fill="#5A7898">
            {t.label}
          </text>
        </g>
      ))}

      {/* area */}
      {area && (
        <path
          d={area}
          fill={`url(#area-${uid})`}
          style={{ opacity: on ? 1 : 0, transition: "opacity 600ms ease-out 250ms" }}
        />
      )}

      {/* line, drawn left→right */}
      {line && (
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: on ? 0 : 1,
            transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      )}

      {/* hover hit-areas + dots */}
      {pts.map((p, i) => (
        <g key={i}>
          <rect
            x={p.x - plotW / Math.max(1, data.length - 1) / 2}
            y={PAD_T}
            width={plotW / Math.max(1, data.length - 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
          {hover === i && (
            <>
              <line x1={p.x} y1={PAD_T} x2={p.x} y2={PAD_T + plotH} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
              <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="#0D1829" strokeWidth="2" />
              <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#E9EEF6">
                {data[i].value}
              </text>
            </>
          )}
        </g>
      ))}

      {/* end dot */}
      {last && (
        <circle
          cx={last.x}
          cy={last.y}
          r="3.5"
          fill={color}
          style={{ opacity: on ? 1 : 0, transition: "opacity 300ms ease-out 1000ms" }}
        />
      )}

      {/* X labels (every other) */}
      {data.map((d, i) =>
        i % 2 === 0 ? (
          <text
            key={i}
            x={pts[i].x}
            y={H - 8}
            textAnchor="middle"
            fontSize="9.5"
            fill="#5A7898"
          >
            {d.label.split(" ")[0]}
          </text>
        ) : null
      )}
    </svg>
  );
}
