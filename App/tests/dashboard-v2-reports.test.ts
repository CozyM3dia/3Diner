import { describe, expect, it } from "vitest";

import {
  buildDailySeries,
  buildFunnel,
  describeFunnel,
  describePeak,
  parseMode,
  parsePeriod,
  peakIndex,
  summarizeTax,
  tallyMenus,
} from "@/lib/dashboard-v2-reports";
import type { OrderItem } from "@/types";

const NOW = new Date("2026-07-30T05:00:00.000Z"); // 12:00 WIB

const item = (o: Partial<OrderItem>): OrderItem => ({
  id_menu: "m1",
  nama_menu: "Kopi Susu",
  harga_menu: 20000,
  qty: 1,
  ...o,
});

describe("periode dan mode", () => {
  it("tidak lagi mengunci periode di satu nilai", () => {
    // Analitik lama terkunci mati di 14 hari, jadi "bulan ini bagaimana" tidak
    // pernah bisa dijawab dari dashboard.
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("90")).toBe(90);
  });

  it("jatuh ke 30 hari untuk nilai yang tidak dikenal", () => {
    expect(parsePeriod(undefined)).toBe(30);
    expect(parsePeriod("999")).toBe(30);
  });

  it("punya empat mode dalam satu rute", () => {
    // Menambah scope, bukan rute: dua rute datar akan jadi enam begitu ada
    // laporan pajak dan laporan staf.
    expect(parseMode("pajak")).toBe("pajak");
    expect(parseMode("ngawur")).toBe("penjualan");
  });
});

describe("deret harian", () => {
  it("memuat hari kosong, bukan melewatinya", () => {
    // Melewati hari tanpa transaksi memadatkan waktu: dua batang bersebelahan
    // bisa berjarak seminggu, dan bentuknya berbohong tentang tren.
    const series = buildDailySeries([{ created_at: NOW.toISOString(), value: 100 }], 7, NOW);
    expect(series).toHaveLength(7);
    expect(series.filter((p) => p.value === 0)).toHaveLength(6);
  });

  it("menjumlahkan beberapa transaksi di hari yang sama", () => {
    const series = buildDailySeries(
      [
        { created_at: NOW.toISOString(), value: 100 },
        { created_at: NOW.toISOString(), value: 50 },
      ],
      7,
      NOW
    );
    expect(series[series.length - 1].value).toBe(150);
  });

  it("mengabaikan transaksi di luar periode", () => {
    const lama = new Date("2026-01-01T05:00:00.000Z").toISOString();
    const series = buildDailySeries([{ created_at: lama, value: 999 }], 7, NOW);
    expect(series.every((p) => p.value === 0)).toBe(true);
  });
});

describe("sorotan grafik", () => {
  const pts = (...v: number[]) => v.map((value, i) => ({ day: `d${i}`, label: `d${i}`, value }));

  it("menyorot tepat satu batang, yang tertinggi", () => {
    expect(peakIndex(pts(1, 9, 3))).toBe(1);
  });

  it("tidak menyorot apa pun saat semuanya nol", () => {
    // Menyorot batang nol akan menandai hari kosong sebagai hari terbaik.
    expect(peakIndex(pts(0, 0, 0))).toBe(-1);
  });

  it("menjelaskan bentuknya dengan kalimat, bukan hanya menggambar", () => {
    const text = describePeak(pts(10, 10, 30), "rupiah");
    expect(text).toContain("tertinggi");
    expect(text).toContain("omzet");
  });

  it("mengatakan apa adanya saat belum ada transaksi", () => {
    expect(describePeak(pts(0, 0), "count")).toContain("Belum ada transaksi");
  });
});

describe("menu teratas", () => {
  it("memakai harga dari baris pesanan, bukan harga hari ini", () => {
    // Item yang harganya naik bulan lalu tidak boleh membuat penjualan lama
    // ikut naik saat laporan dibuka ulang.
    const rows = tallyMenus([{ items: [item({ harga_menu: 10000, qty: 2 })] }]);
    expect(rows[0].revenue).toBe(20000);
  });

  it("menggabungkan item yang sama lintas pesanan", () => {
    const rows = tallyMenus([{ items: [item({ qty: 2 })] }, { items: [item({ qty: 3 })] }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].qty).toBe(5);
  });

  it("mengurutkan menurut omzet, bukan jumlah", () => {
    // Sepuluh es teh bukan berarti lebih penting daripada dua steak.
    const rows = tallyMenus([
      { items: [item({ nama_menu: "Es Teh", harga_menu: 5000, qty: 10 })] },
      { items: [item({ nama_menu: "Steak", harga_menu: 50000, qty: 2 })] },
    ]);
    expect(rows[0].name).toBe("Steak");
  });
});

describe("corong tamu", () => {
  it("menghitung tiap langkah sebagai bagian dari yang membuka menu", () => {
    const steps = buildFunnel({ open: 200, view3d: 50, order: 20 });
    expect(steps[1].ratio).toBeCloseTo(0.25);
    expect(steps[2].ratio).toBeCloseTo(0.1);
  });

  it("tidak membagi dengan nol", () => {
    const steps = buildFunnel({ open: 0, view3d: 0, order: 0 });
    expect(steps.every((s) => Number.isFinite(s.ratio))).toBe(true);
  });

  it("menjelaskan corong sebagai kalimat per seratus tamu", () => {
    // "Conversion rate 10%" tidak memberi tahu apa pun tentang orangnya.
    const text = describeFunnel(buildFunnel({ open: 100, view3d: 24, order: 14 }));
    expect(text).toContain("24 melihat model 3D");
    expect(text).toContain("14 mulai memesan");
  });
});

describe("ringkasan pajak", () => {
  it("menjumlahkan dari potret tiap pesanan", () => {
    // Itu sebabnya potretnya ada: laporan bulan lalu harus tetap menjumlah ke
    // angka yang sama walau tarifnya berubah minggu ini.
    const t = summarizeTax([
      { subtotal: 60000, service_amount: 3000, tax_amount: 6300, total: 69300, tax_pct: 10 },
      { subtotal: 50000, service_amount: 0, tax_amount: 0, total: 50000, tax_pct: 0 },
    ]);
    expect(t.tax).toBe(6300);
    expect(t.subtotal).toBe(110000);
    expect(t.total).toBe(119300);
  });

  it("menghitung pesanan yang dihitung tanpa tarif sama sekali", () => {
    const t = summarizeTax([
      { total: 10000, tax_pct: 0 },
      { total: 10000, tax_pct: 10, tax_amount: 1000 },
    ]);
    expect(t.untaxedOrders).toBe(1);
    expect(t.orders).toBe(2);
  });

  it("memakai total sebagai subtotal untuk pesanan sebelum potret ada", () => {
    // Pesanan lama tidak punya kolom subtotal; membacanya sebagai nol akan
    // membuat dasar pengenaan pajak terlihat menyusut.
    const t = summarizeTax([{ total: 21250 }]);
    expect(t.subtotal).toBe(21250);
  });
});
