// Observability helpers yang aman untuk bundle server maupun browser.
//
// Konsisten dengan pendekatan lain di repo: tanpa konfigurasi Datadog,
// modul ini tidak melakukan kerja tambahan apa pun selain console biasa.
// Dengan "Datadog Vercel integration", setiap baris yang dicetak ke stdout
// dari fungsi Vercel otomatis masuk ke Datadog sebagai log — lalu bisa
// dijadikan metrics/log-monitor tanpa setup tambahan di aplikasi.

export type LogLevel = "info" | "warn" | "error";

const SERVICE = process.env.NEXT_PUBLIC_DATADOG_SERVICE ?? "3diner";
const CONFIGURED = Boolean(
  process.env.DD_API_KEY || process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID
);

/**
 * Emit satu event bisnis sebagai JSON satu baris.
 *
 * Dipakai untuk peristiwa yang tidak tertangkap otomatis — misal hasil
 * interaksi kelompok misi (order.created, payment.charge_failed) — supaya
 * bisa ditapis/di-alert/menjadi custom metric di Datadog.
 *
 * @example
 * emitBusinessEvent("payment.charge_failed", { cafeId, amount, reason })
 */
export function emitBusinessEvent(
  name: string,
  attributes: Record<string, unknown> = {},
  level: LogLevel = "info"
): void {
  if (!CONFIGURED) return;

  const line = JSON.stringify({
    ddsource: "3diner-app",
    service: SERVICE,
    event: name,
    at: new Date().toISOString(),
    ...attributes,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Variasi singkat untuk error log yang disertai konteks bisnis. */
export function emitError(
  error: unknown,
  attributes: Record<string, unknown> = {}
): void {
  const message = error instanceof Error ? error.message : String(error);
  emitBusinessEvent("error.uncaught", { error: message, ...attributes }, "error");
}