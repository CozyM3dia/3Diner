import { describe, it, expect } from "vitest";
import {
  buildScheduleDays,
  validateSchedulePair,
  buildScheduleFields,
} from "@/lib/schedule-days";

/** Kontrak jadwal tayang: format kolom harus persis yang dibaca
 *  `menu-availability.ts` di sisi pelanggan ("1,2,3" ISO weekday, HH:MM). */

describe("buildScheduleDays", () => {
  it("mengurutkan, unik, dan membuang angka di luar 1..7", () => {
    expect(buildScheduleDays("3,1,2")).toBe("1,2,3");
    expect(buildScheduleDays("7, 7, 2")).toBe("2,7");
    expect(buildScheduleDays("1,0,9,abc")).toBe("1");
  });

  it("kosong atau lengkap 7 hari = null (tiap hari)", () => {
    expect(buildScheduleDays("")).toBeNull();
    expect(buildScheduleDays(null)).toBeNull();
    expect(buildScheduleDays("1,2,3,4,5,6,7")).toBeNull();
  });
});

describe("validateSchedulePair", () => {
  it("salah satu terisi saja = error", () => {
    expect(validateSchedulePair("08:00", null)).toMatch(/dua-duanya/);
    expect(validateSchedulePair(null, "22:00")).toMatch(/dua-duanya/);
  });

  it("format HH:MM ditolak kalau rusak", () => {
    expect(validateSchedulePair("8:00", "22:00")).toMatch(/HH:MM/);
    expect(validateSchedulePair("08:00", "24:99")).toMatch(/HH:MM/);
  });

  it("dua-duanya kosong atau valid = null", () => {
    expect(validateSchedulePair(null, null)).toBeNull();
    expect(validateSchedulePair("08:00", "22:00")).toBeNull();
  });
});

describe("buildScheduleFields", () => {
  it("menyusun kolom lengkap dari input mentah", () => {
    const out = buildScheduleFields("5,6,7", " 08:00 ", "22:00");
    expect(out).toEqual({
      schedule_days: "5,6,7",
      schedule_start: "08:00",
      schedule_end: "22:00",
    });
  });

  it("meneruskan error jam tanpa mengarang kolom", () => {
    const out = buildScheduleFields("1", "08:00", null);
    expect(out.error).toMatch(/dua-duanya/);
    expect(out.schedule_days).toBeNull();
  });
});
