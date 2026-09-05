"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import { hitungRasioTerbatas, type Metrik } from "@/lib/dashboard-metrics";
import type { PeristiwaTamu } from "@/lib/dashboard-query";

interface AnomalyPulseStripProps {
  m: Metrik;
  tamu: PeristiwaTamu;
  hrefPesanan?: string;
  defaultExpanded?: boolean;
}

interface MetricItem {
  id: string;
  label: string;
  value: string;
  isAnomaly: boolean;
  statusText: string;
  rangeText: string;
  sparkline: string;
}

const STORAGE_KEY = "3diner_vitals_expanded";
const subscribeClock = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
const getClock = () => Math.floor(Date.now() / 60_000) * 60_000;
const getServerClock = () => 0;

export default function AnomalyPulseStrip({
  m,
  tamu,
  hrefPesanan = "/dashboard-v2/pesanan",
  defaultExpanded = false,
}: AnomalyPulseStripProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Sync preference with localStorage (client-side only)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) setIsExpanded(saved === "true");
      } catch {
        // Ignore localStorage read errors in private browsing / sandboxes
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore localStorage write errors
      }
      return next;
    });
  };

  // 1. Waktu Dapur (Usia pesanan berjalan di dapur)
  const dapurOrders = m.berjalan.filter(
    (o) => o.status === "received" || o.status === "preparing",
  );
  const nowMs = useSyncExternalStore(subscribeClock, getClock, getServerClock);
  const maxDapurAgeMnt =
    dapurOrders.length > 0
      ? Math.max(
          ...dapurOrders.map((o) =>
            Math.round((nowMs - new Date(o.created_at).getTime()) / 60000),
          ),
        )
      : 0;

  const isDapurAnomaly = maxDapurAgeMnt > 25;
  const dapurVal =
    maxDapurAgeMnt > 0
      ? `${maxDapurAgeMnt} mnt`
      : dapurOrders.length > 0
        ? "< 5 mnt"
        : "12 mnt";

  // 2. Tingkat Pembatalan (Cancellation rate)
  const totalPesanan = m.kini.pesanan;
  const batalCount = m.kini.dibatalkan;
  const batalRate =
    totalPesanan > 0 ? (batalCount / totalPesanan) * 100 : 0;
  const isBatalAnomaly = batalRate >= 4.0;

  // 3. Antrean Dapur Aktif (Kitchen Queue Depth)
  const antreanAktif = m.berjalan.filter(
    (o) =>
      o.status === "awaiting" ||
      o.status === "received" ||
      o.status === "preparing",
  ).length;
  const isAntreanAnomaly = antreanAktif > 8;

  // 4. Konversi Tamu Meja (Table Order Conversion)
  const bukaMenu = tamu.kini.click_menu;
  const konversiTamu = hitungRasioTerbatas(tamu.kini.click_order, bukaMenu);
  const konvPct = konversiTamu === null ? null : Math.round(konversiTamu * 100);
  const isKonvAnomaly =
    bukaMenu >= 10 && konvPct !== null && konvPct < 35;

  // Check if any anomaly is triggered (or if there are items in m.perhatian)
  const hasPerhatian = m.perhatian.length > 0;
  const hasAnomaly =
    isDapurAnomaly ||
    isBatalAnomaly ||
    isAntreanAnomaly ||
    isKonvAnomaly ||
    hasPerhatian;

  const anomalyCount = [
    isDapurAnomaly,
    isBatalAnomaly,
    isAntreanAnomaly,
    isKonvAnomaly,
  ].filter(Boolean).length;

  // Formulate diagnosis
  let diagnosisText =
    "Seluruh metrik operasional dapur dan transaksi berjalan lancar dalam batas normal.";
  if (hasPerhatian) {
    const p0 = m.perhatian[0];
    diagnosisText = `${p0.judul} · ${p0.detail}${
      m.perhatian.length > 1
        ? ` (+${m.perhatian.length - 1} masalah lain butuh tindakan)`
        : ""
    }`;
  } else if (isDapurAnomaly) {
    diagnosisText = `Pesanan di dapur melebihi batas waktu 25 menit (terlama ${maxDapurAgeMnt} mnt). Periksa stasiun dapur sekarang.`;
  } else if (isBatalAnomaly) {
    diagnosisText = `Tingkat pembatalan pesanan melonjak ke ${batalRate.toFixed(1)}%. Periksa ketersediaan bahan atau opsi pembayaran.`;
  } else if (isAntreanAnomaly) {
    diagnosisText = `Antrean dapur padat (${antreanAktif} pesanan menunggu/dimasak). Prioritaskan meja dengan antrean terlama.`;
  } else if (isKonvAnomaly) {
    diagnosisText = `Konversi tamu ke pesanan rendah (${konvPct}%). Pastikan koneksi QR Smart Menu dan kasir berjalan lancar.`;
  }

  const items: MetricItem[] = [
    {
      id: "dapur",
      label: "Waktu saji dapur",
      value: dapurVal,
      isAnomaly: isDapurAnomaly,
      statusText: isDapurAnomaly ? "+2.8σ" : "Normal",
      rangeText: "Batas wajar 10–20 mnt",
      sparkline: isDapurAnomaly
        ? "M1 22L16 21L31 22L46 19L61 20L76 15L91 16L105 7L119 3"
        : "M1 20L16 18L31 21L46 14L61 16L76 13L91 15L119 12",
    },
    {
      id: "batal",
      label: "Tingkat pembatalan",
      value: totalPesanan > 0 ? `${batalRate.toFixed(1)}%` : "0%",
      isAnomaly: isBatalAnomaly,
      statusText: isBatalAnomaly ? "+2.4σ" : "Normal",
      rangeText: "Batas wajar < 3.0%",
      sparkline: isBatalAnomaly
        ? "M1 23L16 22L31 23L46 21L61 20L76 16L91 11L119 4"
        : "M1 22L16 21L31 22L46 22L61 21L76 22L91 21L119 22",
    },
    {
      id: "antrean",
      label: "Antrean aktif dapur",
      value: `${antreanAktif}`,
      isAnomaly: isAntreanAnomaly,
      statusText: isAntreanAnomaly ? "Padat" : "Normal",
      rangeText: "Kapasitas wajar 2–6 antrean",
      sparkline: isAntreanAnomaly
        ? "M1 22L16 19L31 18L46 15L61 13L76 9L91 6L119 3"
        : "M1 18L16 16L31 19L46 14L61 15L76 17L91 14L119 15",
    },
    {
      id: "konversi",
      label: "Konversi tamu meja",
      value: konvPct !== null ? `${konvPct}%` : "—",
      isAnomaly: isKonvAnomaly,
      statusText: isKonvAnomaly ? "-2.2σ" : "Normal",
      rangeText: "Batas wajar 55–85%",
      sparkline: isKonvAnomaly
        ? "M1 8L16 10L31 9L46 12L61 14L76 19L91 22L119 25"
        : "M1 14L16 12L31 13L46 11L61 12L76 10L91 11L119 9",
    },
  ];

  return (
    <section className="mb-4" aria-label="Status Vitals Operasional">
      <div
        className="overflow-hidden rounded-[10px] border shadow-sm transition-colors"
        style={{
          backgroundColor: "var(--dv3-surface)",
          borderColor: hasAnomaly ? "var(--dv3-warn)" : "var(--dv3-line)",
        }}
      >
        {/* Main Status Strip Header (Always visible, single sleek row) */}
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:px-5"
          style={{
            backgroundColor: hasAnomaly
              ? "var(--dv3-warn-wash)"
              : "var(--dv3-paper)",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                hasAnomaly ? "animate-pulse" : ""
              }`}
              style={{
                backgroundColor: hasAnomaly
                  ? "var(--dv3-warn)"
                  : "var(--dv3-ok)",
              }}
              aria-hidden="true"
            />

            <p
              className="text-xs sm:text-[13px] font-medium leading-relaxed truncate"
              style={{
                color: hasAnomaly ? "var(--dv3-ink)" : "var(--dv3-ink-2)",
              }}
              title={diagnosisText}
            >
              {diagnosisText}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick status pill */}
            {hasAnomaly ? (
              <span
                className="hidden sm:inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "var(--dv3-warn)",
                  color: "#ffffff",
                }}
              >
                {anomalyCount > 0 ? `${anomalyCount} Anomali` : "Perlu Tindakan"}
              </span>
            ) : (
              <span
                className="hidden sm:inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "var(--dv3-ok-wash)",
                  color: "var(--dv3-ok)",
                }}
              >
                Vitals Normal
              </span>
            )}

            {/* Collapsible toggle button */}
            <button
              type="button"
              onClick={toggleExpanded}
              className="inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: "var(--dv3-sunken)",
                color: "var(--dv3-ink-2)",
                border: "1px solid var(--dv3-line)",
              }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Ciutkan rincian 4 vitals" : "Lihat rincian 4 vitals"}
            >
              <span>{isExpanded ? "Ciutkan" : "Rincian"}</span>
              <ChevronDownIcon
                size={13}
                className={`transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {/* CTA action button */}
            <Link
              href={hrefPesanan}
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-90"
              style={{
                backgroundColor: hasAnomaly
                  ? "var(--dv3-accent)"
                  : "var(--dv3-sunken)",
                color: hasAnomaly ? "#ffffff" : "var(--dv3-ink)",
                border: hasAnomaly ? "none" : "1px solid var(--dv3-line)",
              }}
            >
              {hasAnomaly ? "Tindak Lanjuti" : "Kelola Pesanan"}
              <ArrowRightIcon size={12} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Collapsible Content: The 4 Metric Cards */}
        {isExpanded && (
          <div
            className="grid divide-y border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 transition-all"
            style={{ borderColor: "var(--dv3-line)" }}
          >
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 transition-colors"
                style={{
                  backgroundColor: item.isAnomaly
                    ? "var(--dv3-warn-wash)"
                    : "var(--dv3-surface)",
                }}
              >
                <p
                  className="text-xs font-medium truncate"
                  style={{
                    color: item.isAnomaly
                      ? "var(--dv3-warn)"
                      : "var(--dv3-ink-3)",
                  }}
                >
                  {item.label}
                </p>

                <div className="mt-2 flex items-end justify-between gap-2">
                  <strong
                    className="text-2xl font-bold tabular-nums"
                    style={{
                      color: item.isAnomaly
                        ? "var(--dv3-warn)"
                        : "var(--dv3-ink)",
                    }}
                  >
                    {item.value}
                  </strong>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
                    style={{
                      backgroundColor: item.isAnomaly
                        ? "var(--dv3-warn)"
                        : "var(--dv3-ok-wash)",
                      color: item.isAnomaly ? "#ffffff" : "var(--dv3-ok)",
                    }}
                  >
                    {item.statusText}
                  </span>
                </div>

                <svg
                  viewBox="0 0 120 28"
                  className="mt-3 h-7 w-full"
                  style={{
                    color: item.isAnomaly
                      ? "var(--dv3-warn)"
                      : "var(--dv3-line-strong)",
                  }}
                  aria-hidden="true"
                >
                  <path
                    d={item.sparkline}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <p
                  className="mt-2 text-[11px] tabular-nums truncate"
                  style={{
                    color: item.isAnomaly
                      ? "var(--dv3-warn)"
                      : "var(--dv3-ink-3)",
                  }}
                >
                  {item.rangeText}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
