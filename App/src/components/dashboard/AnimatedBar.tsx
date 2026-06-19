"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedBarProps {
  /** 0–100 target width percentage */
  pct: number;
  delayMs?: number;
  gradient?: boolean;
  track?: string;
  fill?: string;
}

/** Horizontal bar that grows from 0 → pct on mount. */
export default function AnimatedBar({
  pct,
  delayMs = 0,
  gradient = false,
  track = "#E0E7EE",
  fill = "#022C60",
}: AnimatedBarProps) {
  const [w, setW] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const id = setTimeout(() => setW(pct), delayMs);
            return () => clearTimeout(id);
          }
        }),
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pct, delayMs]);

  return (
    <div
      ref={ref}
      className="w-full h-2.5 rounded-full overflow-hidden"
      style={{ background: track }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${w}%`,
          background: gradient ? "linear-gradient(90deg, #022C60, #FD5002)" : fill,
          transition: "width 1s cubic-bezier(0.22,1,0.36,1)",
        }}
      />
    </div>
  );
}
