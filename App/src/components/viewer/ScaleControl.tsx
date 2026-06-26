"use client";

import { Minus, Plus } from "lucide-react";

interface ScaleControlProps {
  /** Current scale as a percentage (50–200). */
  percent: number;
  /** Called with a target scale multiplier (0.5–2.0). Clamping is the caller's job. */
  onScale: (scale: number) => void;
  className?: string;
}

/** Floating glass panel to scale a 3D model. Shared by the 3D viewer and AR session. */
export default function ScaleControl({ percent, onScale, className = "" }: ScaleControlProps) {
  const scale = percent / 100;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl pointer-events-auto ${className}`}
      style={{
        background: "rgba(0,35,85,0.85)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <button
        type="button"
        onClick={() => onScale(scale - 0.1)}
        aria-label="Perkecil model"
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
        style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF" }}
      >
        <Minus size={15} />
      </button>

      <div className="flex-1 flex flex-col items-center gap-1.5 min-w-[120px]">
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={scale}
          onChange={(e) => onScale(parseFloat(e.target.value))}
          aria-label="Skala model"
          className="w-full cursor-pointer accent-[#FD5002]"
        />
        <span className="text-xs font-bold tabular-nums" style={{ color: "#FFFFFF" }}>
          {percent}%
        </span>
      </div>

      <button
        type="button"
        onClick={() => onScale(scale + 0.1)}
        aria-label="Perbesar model"
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
        style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF" }}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
