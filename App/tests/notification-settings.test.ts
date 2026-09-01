import { describe, it, expect } from "vitest";
import {
  DEFAULT_NOTIF_SETTINGS,
  normalizeNotifSettings,
  sameNotifSettings,
  isChannelOn,
  isQuietTime,
} from "@/lib/notification-settings";

/** Kontrak Pengaturan Notifikasi: matriks event × channel + perangkat +
 *  jam tenang HARUS konsisten antara yang dilihat pemilik di halaman
 *  Pengaturan dan yang dievaluasi gerbang penulisan (in_app) / alert
 *  perangkat (desktop). Yang tidak diuji di sini dianggap tidak dijamin. */

describe("normalizeNotifSettings", () => {
  it("NULL / rusak = default bawaan (perilaku lama tetap hidup)", () => {
    expect(normalizeNotifSettings(null)).toEqual(DEFAULT_NOTIF_SETTINGS);
    expect(normalizeNotifSettings(undefined)).toEqual(DEFAULT_NOTIF_SETTINGS);
    expect(normalizeNotifSettings("rusak")).toEqual(DEFAULT_NOTIF_SETTINGS);
  });

  it("membuang kunci asing dan memaksa tipe boolean", () => {
    const out = normalizeNotifSettings({
      injected_key: "hack",
      events: {
        order_new: { in_app: false, push: "yes", evil: true },
        event_palsu: { in_app: false },
      },
      desktop_enabled: 0,
      sound_enabled: 1,
      quiet_enabled: "true",
    });
    expect(out).toEqual({
      ...DEFAULT_NOTIF_SETTINGS,
      events: { ...DEFAULT_NOTIF_SETTINGS.events, order_new: { ...DEFAULT_NOTIF_SETTINGS.events.order_new, in_app: false } },
      desktop_enabled: DEFAULT_NOTIF_SETTINGS.desktop_enabled,
      sound_enabled: DEFAULT_NOTIF_SETTINGS.sound_enabled,
      quiet_enabled: DEFAULT_NOTIF_SETTINGS.quiet_enabled,
    });
  });

  it("memperbaiki jam rusak ke default, menerima jam valid", () => {
    const ok = normalizeNotifSettings({ quiet_start: "23:30", quiet_end: "06:00" });
    expect(ok.quiet_start).toBe("23:30");
    expect(ok.quiet_end).toBe("06:00");

    const rusak = normalizeNotifSettings({ quiet_start: "25:99", quiet_end: "7am" });
    expect(rusak.quiet_start).toBe(DEFAULT_NOTIF_SETTINGS.quiet_start);
    expect(rusak.quiet_end).toBe(DEFAULT_NOTIF_SETTINGS.quiet_end);
  });
});

describe("isChannelOn — gerbang yang sama dipakai penulis & perangkat", () => {
  const base = normalizeNotifSettings(null);

  it("mengikuti matriks per-event", () => {
    expect(isChannelOn(base, "order_new", "in_app")).toBe(true);
    expect(isChannelOn(base, "order_new", "desktop")).toBe(true);
    expect(isChannelOn(base, "payment_paid", "desktop")).toBe(false);

    const off = normalizeNotifSettings({
      events: { order_new: { in_app: false } },
    });
    expect(isChannelOn(off, "order_new", "in_app")).toBe(false);
  });

  it("desktop induk mematikan semua desktop, in_app tak terpengaruh", () => {
    const masterOff = normalizeNotifSettings({ desktop_enabled: false });
    expect(isChannelOn(masterOff, "order_new", "desktop")).toBe(false);
    expect(isChannelOn(masterOff, "order_new", "in_app")).toBe(true);
  });
});

describe("isQuietTime", () => {
  const s = (over: Record<string, unknown>) =>
    normalizeNotifSettings({ quiet_enabled: true, quiet_start: "22:00", quiet_end: "07:00", ...over });

  it("nonaktif = tidak pernah tenang", () => {
    expect(isQuietTime(normalizeNotifSettings({ quiet_enabled: false }), 23 * 60)).toBe(false);
  });

  it("rentang melewati tengah malam: 22:00 → 07:00", () => {
    expect(isQuietTime(s({}), 23 * 60 + 30)).toBe(true); // 23:30
    expect(isQuietTime(s({}), 6 * 60 + 59)).toBe(true); // 06:59
    expect(isQuietTime(s({}), 12 * 60)).toBe(false); // 12:00
  });

  it("rentang biasa: 13:00 → 15:00", () => {
    const siang = normalizeNotifSettings({ quiet_enabled: true, quiet_start: "13:00", quiet_end: "15:00" });
    expect(isQuietTime(siang, 13 * 60)).toBe(true);
    expect(isQuietTime(siang, 14 * 60 + 59)).toBe(true);
    expect(isQuietTime(siang, 15 * 60)).toBe(false);
  });

  it("start == end = tenang sepanjang hari", () => {
    expect(isQuietTime(normalizeNotifSettings({ quiet_enabled: true, quiet_start: "00:00", quiet_end: "00:00" }), 9 * 60)).toBe(true);
  });
});

describe("sameNotifSettings — badge 'belum disimpan'", () => {
  it("stabil terhadap urutan kunci & kunci asing", () => {
    const a = normalizeNotifSettings(null);
    const b = normalizeNotifSettings({ events: { order_new: { in_app: true } }, zzz: 1 });
    expect(sameNotifSettings(a, b)).toBe(true);
  });

  it("mendeteksi perubahan nyata", () => {
    const a = normalizeNotifSettings(null);
    const b = normalizeNotifSettings({ events: { order_new: { in_app: false } } });
    expect(sameNotifSettings(a, b)).toBe(false);
  });
});
