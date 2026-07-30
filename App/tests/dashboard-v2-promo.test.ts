import { describe, expect, it } from "vitest";

import {
  filterPromos,
  KIND_LABEL,
  parsePromoTab,
  promoCounts,
  PROMO_TABS,
  sortPromos,
  type PromoRow,
} from "@/lib/dashboard-v2-promo";

const row = (o: Partial<PromoRow>): PromoRow => ({
  id: o.name ?? "p1",
  kind: "diskon",
  name: "Promo",
  scope: "1 menu",
  when: "Tayang setiap hari.",
  activeNow: true,
  enabled: true,
  href: "/dashboard-v2/menu/x",
  actionLabel: "Ubah",
  ...o,
});

describe("penggabungan tiga jenis", () => {
  it("menamai ketiganya dalam satu kosakata", () => {
    // Dulu tiga rute terpisah. Kolom Jenis yang membedakan, bukan navigasi.
    expect(Object.keys(KIND_LABEL).sort()).toEqual(["diskon", "jadwal", "pengumuman"]);
  });

  it("punya tiga tab keadaan, bukan tiga tab jenis", () => {
    // Pemilik bertanya "apa yang tamu lihat sekarang", bukan "mana yang
    // pengumuman" — jadi tab menyaring keadaan, dan jenis jadi kolom.
    expect([...PROMO_TABS]).toEqual(["berjalan", "terjadwal", "mati"]);
  });
});

describe("saringan keadaan", () => {
  const rows = [
    row({ name: "tampil", enabled: true, activeNow: true }),
    row({ name: "menunggu", enabled: true, activeNow: false }),
    row({ name: "mati", enabled: false, activeNow: false }),
  ];

  it("memisahkan yang tampil dari yang menunggu jadwalnya", () => {
    expect(filterPromos(rows, "berjalan").map((r) => r.name)).toEqual(["tampil"]);
    expect(filterPromos(rows, "terjadwal").map((r) => r.name)).toEqual(["menunggu"]);
  });

  it("menganggap yang dimatikan bukan terjadwal", () => {
    // Dimatikan berarti tidak akan tampil kapan pun, jadi ia bukan "menunggu".
    expect(filterPromos(rows, "mati").map((r) => r.name)).toEqual(["mati"]);
  });

  it("menghitung tiap tab", () => {
    expect(promoCounts(rows)).toEqual({ berjalan: 1, terjadwal: 1, mati: 1 });
  });

  it("default ke berjalan", () => {
    expect(parsePromoTab(undefined)).toBe("berjalan");
    expect(parsePromoTab("ngawur")).toBe("berjalan");
  });
});

describe("urutan", () => {
  it("menaruh yang sedang tampil di atas", () => {
    // Layar ini dibuka untuk memeriksa apa yang tamu lihat sekarang.
    const sorted = sortPromos([
      row({ name: "menunggu", activeNow: false }),
      row({ name: "tampil", activeNow: true }),
    ]);
    expect(sorted[0].name).toBe("tampil");
  });

  it("mengelompokkan jenis yang sama berdekatan", () => {
    const sorted = sortPromos([
      row({ name: "b", kind: "pengumuman" }),
      row({ name: "a", kind: "diskon" }),
      row({ name: "c", kind: "jadwal" }),
    ]);
    expect(sorted.map((r) => r.kind)).toEqual(["diskon", "jadwal", "pengumuman"]);
  });
});
