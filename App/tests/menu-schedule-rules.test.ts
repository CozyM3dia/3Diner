import { describe, expect, it } from "vitest";

import {
  describeSchedule,
  parseDays,
  pricePreview,
  serializeDays,
  WEEKDAYS,
} from "@/lib/menu-schedule-rules";

const days = (...iso: string[]) => new Set(iso);
const allDays = new Set(WEEKDAYS.map((d) => d.iso));

describe("hari tayang", () => {
  it("menganggap kosong sebagai tayang tiap hari", () => {
    expect(parseDays(null).size).toBe(7);
    expect(parseDays("").size).toBe(7);
  });

  it("membaca daftar hari ISO", () => {
    expect([...parseDays("1,3,5")]).toEqual(["1", "3", "5"]);
  });

  it("mengabaikan nilai yang bukan hari", () => {
    expect([...parseDays("1,9,abc,3")]).toEqual(["1", "3"]);
  });

  it("kembali ke tiap hari kalau tidak ada satu pun hari yang sah", () => {
    // Daftar yang isinya sampah tidak boleh berarti "tidak pernah tayang" —
    // itu akan menyembunyikan menu dari tamu tanpa ada yang memutuskannya.
    expect(parseDays("9,abc").size).toBe(7);
  });

  it("menyimpan null saat semua hari terpilih", () => {
    // "1,2,3,4,5,6,7" membuat jadwal terlihat ada padahal tidak membatasi apa
    // pun, dan pemilik yang membacanya nanti mengira ada aturan yang dijaga.
    expect(serializeDays(allDays)).toBeNull();
    expect(serializeDays(new Set())).toBeNull();
  });

  it("menyimpan urutan hari yang stabil", () => {
    expect(serializeDays(days("5", "1", "3"))).toBe("1,3,5");
  });
});

describe("kalimat jadwal", () => {
  it("mengatakan akibatnya saat item dimatikan", () => {
    expect(describeSchedule({ isActive: false, days: allDays, start: null, end: null })).toContain(
      "tidak melihat item ini"
    );
  });

  it("menyebut sepanjang jam buka saat jamnya kosong", () => {
    const text = describeSchedule({ isActive: true, days: allDays, start: null, end: null });
    expect(text).toContain("setiap hari");
    expect(text).toContain("sepanjang jam buka");
  });

  it("menyebut hari yang dipilih dengan singkatannya", () => {
    const text = describeSchedule({ isActive: true, days: days("6", "7"), start: null, end: null });
    expect(text).toContain("St, Mg");
  });

  it("menandai jadwal yang melewati tengah malam", () => {
    // Tanpa ini, 22:00–02:00 terbaca sebagai jadwal yang tidak pernah aktif.
    const text = describeSchedule({ isActive: true, days: allDays, start: "22:00", end: "02:00" });
    expect(text).toContain("melewati tengah malam");
  });

  it("tidak menandai jadwal biasa sebagai melewati tengah malam", () => {
    const text = describeSchedule({ isActive: true, days: allDays, start: "15:00", end: "21:00" });
    expect(text).toContain("15:00–21:00");
    expect(text).not.toContain("tengah malam");
  });
});

describe("pratinjau harga", () => {
  it("menampilkan angka yang benar-benar dibayar tamu", () => {
    // Persentase abstrak adalah cara paling mudah salah ketik tanpa sadar.
    expect(pricePreview(20000, 20)).toBe(16000);
    expect(pricePreview(18000, null)).toBe(18000);
  });

  it("membulatkan sama seperti perhitungan database", () => {
    expect(pricePreview(21250, 15)).toBe(Math.round(21250 * 0.85));
  });

  it("menjepit diskon ke rentang yang masuk akal", () => {
    expect(pricePreview(10000, 150)).toBe(0);
    expect(pricePreview(10000, -50)).toBe(10000);
  });
});
