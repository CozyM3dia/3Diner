"use client";

import { useEffect, useRef, useState } from "react";

const LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function WeekdayBars({ data }: { data: number[] }) {
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

  const max = Math.max(1, ...data);
  const peak = data.indexOf(Math.max(...data));

  return (
    <div ref={ref} className="flex items-end justify-between gap-2" style={{ height: "140px" }}>
      {data.map((v, i) => {
        const h = on ? Math.max(3, (v / max) * 100) : 0;
        const isPeak = i === peak && v > 0;
        return (
          <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
            <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${h}%`,
                  background: isPeak ? "#FD5002" : "rgba(0,194,168,0.55)",
                  transition: `height 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms`,
                }}
                title={`${LABELS[i]}: ${v}`}
              />
            </div>
            <span className="text-[10px]" style={{ color: isPeak ? "#FD5002" : "#5A7898" }}>
              {LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
