"use client";

import { RefreshCw, Wifi, BatteryFull, SignalHigh } from "lucide-react";

interface PhoneMockupProps {
  children: React.ReactNode;
  /** Status-bar / chrome foreground color. Defaults to white. */
  statusColor?: string;
  onRefresh?: () => void;
  label?: string;
}

/** Premium smartphone frame for dashboard live previews: bezel, dynamic island,
 *  status bar, scrollable screen, home indicator. Sticky on large screens. */
export default function PhoneMockup({ children, statusColor = "#FFFFFF", onRefresh, label = "Pratinjau Langsung" }: PhoneMockupProps) {
  return (
    <div className="lg:sticky lg:top-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 text-center lg:text-left" style={{ color: "var(--dash-muted)" }}>
        {label}
      </p>

      <div
        className="mx-auto w-full max-w-[320px] rounded-[36px] p-2.5 border"
        style={{
          background: "#090D16",
          borderColor: "rgba(255,255,255,0.1)",
          boxShadow: "0 25px 60px -15px rgba(0,0,0,0.7)",
        }}
      >
        <div className="relative rounded-[26px] overflow-hidden" style={{ background: "#001737" }}>
          {/* Dynamic island */}
          <div
            className="absolute top-[9px] left-1/2 -translate-x-1/2 z-30 rounded-full"
            style={{ width: 80, height: 20, background: "#000000" }}
          />

          {/* Status bar */}
          <div
            className="relative z-20 flex items-center justify-between px-5 pt-2.5 pb-1.5 text-[11px] font-semibold"
            style={{ color: statusColor }}
          >
            <span className="tabular-nums">19:30</span>
            <div className="flex items-center gap-1.5">
              <SignalHigh size={13} />
              <Wifi size={13} />
              <BatteryFull size={15} />
            </div>
          </div>

          {/* Scrollable screen */}
          <div className="overflow-y-auto max-h-[560px] phone-scroll">{children}</div>

          {/* Home indicator */}
          <div className="relative z-20 flex justify-center py-2.5" style={{ background: "#001737" }}>
            <div className="rounded-full" style={{ width: 110, height: 4, background: "rgba(255,255,255,0.32)" }} />
          </div>
        </div>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="dash-press mx-auto mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
          style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.08)", color: "#9FB6D1" }}
        >
          <RefreshCw size={12} /> Segarkan Pratinjau
        </button>
      )}

      <style>{`.phone-scroll::-webkit-scrollbar{width:0;height:0}.phone-scroll{scrollbar-width:none}`}</style>
    </div>
  );
}
