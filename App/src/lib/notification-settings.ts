/** Pengaturan notifikasi (modul "Notifications" ala Dream POS).
 *
 *  Satu objek disimpan ke `Cafes.notification_settings` (jsonb). Matriks
 *  event × channel + perangkat + jam tenang. Gaya sama dengan
 *  `receipt-settings.ts`: kunci yang tidak dikenal dibuang, tipe dipaksa,
 *  NULL / rusak = default bawaan — tidak ada perilaku lama yang berubah.
 *
 *  Channel nyata hari ini hanya `in_app` (bell di Shell). `desktop` =
 *  Notification API + bunyi + toast di perangkat yang membuka halaman
 *  Pesanan (OrdersClient). `push` / `sms` / `email` sengaja DISIMPAN tapi
 *  belum dieksekusi — supaya menyalakannya di sini bukan kontrol palsu,
 *  halaman menandainya "menyusul". */

export type NotifEventType = "order_new" | "payment_paid" | "kitchen_ready" | "order_cancelled";

export type NotifChannel = "in_app" | "desktop" | "push" | "sms" | "email";

/** Channel yang sudah dieksekusi sistem. Sisanya tampil di UI sebagai
 *  "menyusul" (disabled, badge). */
export const LIVE_CHANNELS: NotifChannel[] = ["in_app", "desktop"];

export const ALL_CHANNELS: NotifChannel[] = ["in_app", "desktop", "push", "sms", "email"];

export const EVENT_LABELS: Record<NotifEventType, { label: string; desc: string }> = {
  order_new: {
    label: "Pesanan Baru",
    desc: "Pelanggan menyelesaikan pesanan dari halaman menu / QR",
  },
  payment_paid: {
    label: "Pembayaran Lunas",
    desc: "Pembayaran QRIS terkonfirmasi Midtrans atau tunai ditandai lunas kasir",
  },
  kitchen_ready: {
    label: "Pesanan Siap",
    desc: "Dapur menandai pesanan siap diantar",
  },
  order_cancelled: {
    label: "Pesanan Dibatalkan",
    desc: "Pesanan dibatalkan kasir atau melewati batas waktu",
  },
};

export const CHANNEL_LABELS: Record<NotifChannel, string> = {
  in_app: "In-App",
  desktop: "Desktop",
  push: "Push",
  sms: "SMS",
  email: "Email",
};

export interface NotifSettings {
  events: Record<NotifEventType, Record<NotifChannel, boolean>>;
  desktop_enabled: boolean;
  sound_enabled: boolean;
  quiet_enabled: boolean;
  /** "21:00" — pukul mulai jam tenang (WIB, jam lokal browser). */
  quiet_start: string;
  /** "07:00" — pukul selesai jam tenang; sebelum start di hari yang sama. */
  quiet_end: string;
}

/** Default mengikuti perilaku sistem yang berjalan hari ini: in_app menyala
 *  untuk semua event, desktop menyala untuk pesanan baru (alert di halaman
 *  Pesanan), sisanya mati. Jam tenang nonaktif. */
export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  events: {
    order_new: { in_app: true, desktop: true, push: false, sms: false, email: false },
    payment_paid: { in_app: true, desktop: false, push: false, sms: false, email: false },
    kitchen_ready: { in_app: true, desktop: false, push: false, sms: false, email: false },
    order_cancelled: { in_app: true, desktop: false, push: false, sms: false, email: false },
  },
  desktop_enabled: true,
  sound_enabled: true,
  quiet_enabled: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
};

const EVENTS: NotifEventType[] = ["order_new", "payment_paid", "kitchen_ready", "order_cancelled"];
const CHANNELS: NotifChannel[] = ["in_app", "desktop", "push", "sms", "email"];

/** "HH:MM" valid 00:00–23:59 — string rusak digantikan default. */
function normClock(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw.trim());
  return m ? raw.trim() : fallback;
}

/** Ambil hanya kunci yang dikenal, paksa boolean/string — sisanya dibuang.
 *  Aman dipanggil dengan `Cafes.notification_settings` apa pun. */
export function normalizeNotifSettings(raw: unknown): NotifSettings {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Mulai dari default lalu TIMPA PER-KUNCI dari merge localStorage
  // ({...default, ...parsial}) maupun dari jsonb — shallow spread di atas
  // `events` akan menimpa seluruh matriks dengan parsial dan mematikan
  // event yang tidak disebut, sedangkan spread mentah per-baris membawa
  // kunci asing. Satu-satunya jalur yang benar: deep-copy default, lalu
  // salin channel Dikenal yang bertipe boolean.
  const merged: NotifSettings["events"] = JSON.parse(
    JSON.stringify(DEFAULT_NOTIF_SETTINGS.events),
  ) as NotifSettings["events"];
  const srcEvents =
    src.events && typeof src.events === "object"
      ? (src.events as Record<string, Record<string, unknown>>)
      : {};
  for (const ev of EVENTS) {
    const row = srcEvents[ev];
    if (!row || typeof row !== "object") continue;
    for (const ch of CHANNELS) {
      if (typeof row[ch] === "boolean") merged[ev][ch] = row[ch] as boolean;
    }
  }
  const out: NotifSettings = {
    events: merged,
    desktop_enabled: DEFAULT_NOTIF_SETTINGS.desktop_enabled,
    sound_enabled: DEFAULT_NOTIF_SETTINGS.sound_enabled,
    quiet_enabled: DEFAULT_NOTIF_SETTINGS.quiet_enabled,
    quiet_start: DEFAULT_NOTIF_SETTINGS.quiet_start,
    quiet_end: DEFAULT_NOTIF_SETTINGS.quiet_end,
  };
  for (const k of ["desktop_enabled", "sound_enabled", "quiet_enabled"] as const) {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  out.quiet_start = normClock(src.quiet_start, out.quiet_start);
  out.quiet_end = normClock(src.quiet_end, out.quiet_end);
  return out;
}

/** Cek "ada perubahan belum disimpan" — urutan kunci dibakukan. */
export function sameNotifSettings(a: NotifSettings, b: NotifSettings): boolean {
  return JSON.stringify(normalizeNotifSettings(a)) === JSON.stringify(normalizeNotifSettings(b));
}

/** Apakah event ini layak menghasilkan notifikasi di channel ini?
 *  Satu gerbang kebenaran yang dipakai writer (in_app) dan reader perangkat
 *  (desktop) — tidak ada logika toggle kedua. */
export function isChannelOn(
  s: NotifSettings,
  event: NotifEventType,
  channel: NotifChannel,
): boolean {
  if (channel === "desktop" && !s.desktop_enabled) return false;
  return Boolean(s.events[event]?.[channel]);
}

/** Jam tenang: rentang boleh melewati tengah malam (22:00–07:00).
 *  `nowMinutes` disuntikkan agar bisa diuji; default = jam lokal browser. */
export function isQuietTime(s: NotifSettings, nowMinutes?: number): boolean {
  if (!s.quiet_enabled) return false;
  const [sh, sm] = s.quiet_start.split(":").map(Number);
  const [eh, em] = s.quiet_end.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const now = nowMinutes ?? new Date().getHours() * 60 + new Date().getMinutes();
  if (start === end) return true; // rentang nol = tenang sepanjang hari
  if (start < end) return now >= start && now < end;
  return now >= start || now < end; // melewati tengah malam
}
