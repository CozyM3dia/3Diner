import { Sparkles, TriangleAlert } from "lucide-react";
import type { CreditStatus } from "@/lib/ai-credits";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function periodLabel(periodStart: string): string {
  const date = new Date(periodStart);
  if (Number.isNaN(date.getTime())) return "bulan ini";
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Meteran jatah AI: satu baris, bukan kartu metrik.
 *
 *  Kafe perlu tahu sisa jatah sebelum menekan "Generate", bukan sesudah ditolak.
 *  Warna hanya berubah saat ada sesuatu yang harus dilakukan — jatah menipis
 *  atau langganan mati — supaya keadaan normal tidak berteriak. */
export default function AiCreditMeter({ status }: { status: CreditStatus | null }) {
  if (!status) return null;

  const { quota, used, remaining, subscriptionActive } = status;
  const ratio = quota > 0 ? Math.min(used / quota, 1) : 1;
  const exhausted = remaining <= 0;
  const low = !exhausted && remaining <= Math.max(1, Math.ceil(quota * 0.2));
  const blocked = !subscriptionActive || exhausted;

  const accent = blocked ? "var(--semantic-danger)" : low ? "var(--semantic-warning)" : "var(--orange)";

  return (
    <div
      className="rounded-2xl px-4 py-3.5"
      style={{
        background: "var(--dash-panel)",
        border: `1px solid ${blocked ? "rgba(239,68,68,0.28)" : "var(--dash-border)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 min-w-0">
          {blocked ? (
            <TriangleAlert size={15} strokeWidth={1.8} style={{ color: accent }} />
          ) : (
            <Sparkles size={15} strokeWidth={1.8} style={{ color: accent }} />
          )}
          <span className="text-sm font-semibold" style={{ color: "var(--dash-text)" }}>
            Jatah AI
          </span>
          <span className="text-[11px]" style={{ color: "var(--dash-muted)" }}>
            {periodLabel(status.periodStart)}
          </span>
        </span>

        <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: accent }}>
          {remaining}
          <span className="font-medium text-xs" style={{ color: "var(--dash-muted)" }}>
            {" "}/ {quota}
          </span>
        </span>
      </div>

      <div
        className="h-1.5 rounded-full mt-3 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={quota}
        aria-label={`Jatah AI terpakai ${used} dari ${quota}`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${ratio * 100}%`,
            background: accent,
            transition: "width 240ms var(--ease-out)",
          }}
        />
      </div>

      <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: "var(--dash-muted)" }}>
        {!subscriptionActive
          ? "Langganan belum aktif. Generate 3D dan ekstraksi menu dimatikan sampai pembayaran masuk."
          : exhausted
          ? "Jatah bulan ini habis. Kuota diperbarui otomatis awal bulan depan."
          : "Dipakai oleh generate model 3D, ekstraksi menu dari foto, dan penulisan deskripsi."}
      </p>
    </div>
  );
}
