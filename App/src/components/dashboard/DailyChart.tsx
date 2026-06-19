"use client";

import { useEffect, useRef, useState } from "react";

interface DailyChartProps {
  data: { label: string; count: number }[];
}

/** 14-day vertical bar chart. Bars grow from baseline on mount. */
export default function DailyChart({ data }: DailyChartProps) {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...data.map((d) => d.count));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setOn(true)),
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex items-end justify-between gap-1 h-40">
      {data.map((d, i) => {
        const h = on ? Math.max(4, (d.count / max) * 100) : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
            <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
              <div
                className="w-full max-w-[14px] rounded-t-md relative"
                style={{
                  height: `${h}%`,
                  background:
                    i === data.length - 1
                      ? "linear-gradient(180deg, #FD5002, #FC6A41)"
                      : "linear-gradient(180deg, #254473, #022C60)",
                  transition: `height 0.8s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms`,
                }}
                title={`${d.label}: ${d.count}`}
              />
            </div>
            <span
              className="text-[8px] leading-none text-center"
              style={{ color: "#51698F" }}
            >
              {i % 2 === 0 ? d.label.split(" ")[0] : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
