import { describe, expect, it } from "vitest";

import {
  AMBANG,
  hitungCorong,
  hitungMetrik,
  usia,
  type MenuRow,
  type OrderRow,
} from "@/lib/dashboard-metrics";

/** Kontrak angka Dashboard konsol owner.
 *
 *  Layar sebelumnya menampilkan delta yang ditulis tangan (`+12,5%` / `-8,5%`)
 *  dan memeringkat menu memakai jumlah unit. Test ini mengunci penggantinya:
 *  delta yang lahir dari periode pembanding sungguhan, peringkat berdasarkan
 *  uang, dan ambang "butuh perhatian" yang jelas batasnya.
 */

const NOW = new Date("2026-09-02T12:00:00");
const HARI = 864e5;

const MENUS: MenuRow[] = [
  { id_menu: "kopi", nama_menu: "Es Kopi Susu", harga_menu: 20_000, image_url: null, category: "Minuman", is_active: true },
  { id_menu: "steak", nama_menu: "Steak", harga_menu: 150_000, image_url: null, category: "Main Course", is_active: true },
  { id_menu: "roti", nama_menu: "Croissant", harga_menu: 25_000, image_url: null, category: "Pastry", is_active: false },
];

let seq = 0;
function order(over: Partial<OrderRow> & { menitLalu?: number }): OrderRow {
  const { menitLalu = 5, ...rest } = over;
  return {
    id_order: `o${seq++}`,
    total: 0,
    status: "completed",
    payment_status: "paid",
    table_number: "1",
    items: [],
    created_at: new Date(NOW.getTime() - menitLalu * 60_000).toISOString(),
    ...rest,
  };
}

function metrik(kini: OrderRow[], lalu: OrderRow[] = [], menus: MenuRow[] = MENUS) {
  return hitungMetrik({
    kini,
    lalu,
    menus,
    fromIso: "2026-08-27",
    spanDays: 7,
    now: NOW,
  });
}

describe("delta terhadap periode pembanding", () => {
  it("menghitung persentase dari pendapatan periode sebelumnya", () => {
    const m = metrik([order({ total: 150_000 })], [order({ total: 100_000, menitLalu: 8 * 24 * 60 })]);
    expect(m.kini.pendapatan).toBe(150_000);
    expect(m.lalu.pendapatan).toBe(100_000);
    expect(m.deltaPendapatan.pct).toBeCloseTo(50);
    expect(m.deltaPendapatan.arah).toBe("up");
  });

  it("melaporkan penurunan dengan tanda negatif", () => {
    const m = metrik([order({ total: 40_000 })], [order({ total: 80_000, menitLalu: 8 * 24 * 60 })]);
    expect(m.deltaPendapatan.pct).toBeCloseTo(-50);
    expect(m.deltaPendapatan.arah).toBe("down");
  });

  it("menolak mengarang persentase ketika pembandingnya nol", () => {
    // Pertumbuhan dari nol tidak punya basis. "+100%" maupun "∞" sama-sama
    // mengarang; kontraknya adalah null supaya UI menulis "Tanpa pembanding".
    const m = metrik([order({ total: 90_000 })], []);
    expect(m.deltaPendapatan.pct).toBeNull();
    expect(m.deltaPendapatan.arah).toBe("up");
  });

  it("menyebut perubahan sangat kecil sebagai datar, bukan naik", () => {
    const m = metrik([order({ total: 100_000 })], [order({ total: 100_000, menitLalu: 8 * 24 * 60 })]);
    expect(m.deltaPendapatan.arah).toBe("flat");
  });

  it("hanya menghitung pesanan lunas sebagai pendapatan", () => {
    const m = metrik([
      order({ total: 100_000, payment_status: "paid" }),
      order({ total: 999_000, payment_status: "unpaid", status: "ready" }),
    ]);
    expect(m.kini.pendapatan).toBe(100_000);
    expect(m.kini.pesanan).toBe(2);
  });
});

describe("deret harian", () => {
  it("menyediakan satu titik per hari dalam rentang, termasuk hari kosong", () => {
    const m = metrik([order({ total: 50_000, menitLalu: 12 * 60 })]);
    expect(m.harian).toHaveLength(7);
    expect(m.harian.filter((h) => h.value === 0)).toHaveLength(6);
  });

  it("menandai indeks hari puncak, dan -1 saat tak ada penjualan lunas", () => {
    const kosong = metrik([order({ total: 10_000, payment_status: "unpaid", status: "ready" })]);
    expect(kosong.puncak).toBe(-1);

    const isi = metrik([order({ total: 10_000, menitLalu: 12 * 60 })]);
    expect(isi.puncak).toBeGreaterThanOrEqual(0);
    expect(isi.harian[isi.puncak].value).toBe(10_000);
  });
});

describe("peringkat", () => {
  it("memeringkat menu berdasarkan uang, bukan jumlah unit terjual", () => {
    // Inti perubahannya: sepuluh kopi murah tidak boleh mengalahkan dua steak.
    const m = metrik([
      order({ total: 200_000, items: [{ id_menu: "kopi", nama_menu: "Es Kopi Susu", harga_menu: 20_000, qty: 10 }] }),
      order({ total: 300_000, items: [{ id_menu: "steak", nama_menu: "Steak", harga_menu: 150_000, qty: 2 }] }),
    ]);
    expect(m.terlaris.map((t) => t.id)).toEqual(["steak", "kopi"]);
    expect(m.terlaris[0].nilai).toBe(300_000);
    expect(m.terlaris[0].qty).toBe(2);
    expect(m.terlaris[1].qty).toBe(10);
  });

  it("mengukur kategori dengan pendapatan, bukan cacah menu", () => {
    const m = metrik([
      order({ items: [{ id_menu: "kopi", harga_menu: 20_000, qty: 3 }] }),
      order({ items: [{ id_menu: "steak", harga_menu: 150_000, qty: 1 }] }),
    ]);
    expect(m.kategori.map((k) => k.nama)).toEqual(["Main Course", "Minuman"]);
    expect(m.kategori[0].nilai).toBe(150_000);
    expect(m.kategori[1].nilai).toBe(60_000);
  });

  it("menempatkan menu tanpa kategori di bawah label Lainnya", () => {
    const m = metrik(
      [order({ items: [{ id_menu: "x", harga_menu: 10_000, qty: 1 }] })],
      [],
      [{ id_menu: "x", nama_menu: "X", harga_menu: 10_000, image_url: null, category: null, is_active: true }],
    );
    expect(m.kategori[0].nama).toBe("Lainnya");
  });
});

describe("butuh perhatian", () => {
  it("mengangkat tagihan yang lebih tua daripada ambang", () => {
    const m = metrik([
      order({ payment_status: "unpaid", status: "ready", total: 75_000, menitLalu: AMBANG.belumLunasMenit + 10 }),
    ]);
    const baris = m.perhatian.filter((p) => p.alasan === "belum-lunas");
    expect(baris).toHaveLength(1);
    expect(baris[0].tone).toBe("bad");
    expect(baris[0].href).toBe("/kasir");
  });

  it("membiarkan tagihan yang masih muda", () => {
    const m = metrik([
      order({ payment_status: "unpaid", status: "ready", total: 75_000, menitLalu: AMBANG.belumLunasMenit - 5 }),
    ]);
    expect(m.perhatian.filter((p) => p.alasan === "belum-lunas")).toHaveLength(0);
  });

  it("mengangkat pesanan yang menua di dapur", () => {
    const m = metrik([
      order({ status: "preparing", payment_status: "paid", menitLalu: AMBANG.dapurMenit + 5 }),
    ]);
    const baris = m.perhatian.filter((p) => p.alasan === "macet-dapur");
    expect(baris).toHaveLength(1);
    expect(baris[0].href).toBe("/dashboard-v2/dapur");
  });

  it("menyebut satu pesanan paling banyak sekali", () => {
    // Pesanan tua yang belum lunas DAN masih di dapur memenuhi dua syarat;
    // menampilkannya dua kali membuat panel ini terasa lebih genting
    // daripada kenyataannya.
    const m = metrik([
      order({ status: "preparing", payment_status: "unpaid", menitLalu: 240 }),
    ]);
    const pesanan = m.perhatian.filter((p) => p.alasan !== "menu-nonaktif");
    expect(pesanan).toHaveLength(1);
    expect(pesanan[0].alasan).toBe("belum-lunas");
  });

  it("mengabaikan pesanan yang sudah dibatalkan", () => {
    const m = metrik([
      order({ status: "cancelled", payment_status: "unpaid", menitLalu: 600 }),
    ]);
    expect(m.perhatian.filter((p) => p.alasan === "belum-lunas")).toHaveLength(0);
  });

  it("melaporkan menu yang tidak tayang", () => {
    const m = metrik([]);
    const baris = m.perhatian.find((p) => p.alasan === "menu-nonaktif");
    expect(baris?.judul).toBe("1 menu tidak tayang");
    expect(baris?.detail).toContain("Croissant");
  });

  it("mendahulukan yang paling genting dan membatasi panjang daftar", () => {
    const banyak = Array.from({ length: 12 }, (_, i) =>
      order({
        status: i % 2 ? "preparing" : "ready",
        payment_status: i % 2 ? "paid" : "unpaid",
        menitLalu: 300 + i,
      }),
    );
    const m = metrik(banyak);
    expect(m.perhatian.length).toBeLessThanOrEqual(AMBANG.maksBaris);
    expect(m.perhatian[0].tone).toBe("bad");
  });
});

describe("keadaan kafe", () => {
  it("membedakan kafe yang belum pernah punya pesanan dari rentang yang sepi", () => {
    expect(metrik([], []).kafeBaru).toBe(true);
    expect(metrik([], [order({ total: 10_000, menitLalu: 8 * 24 * 60 })]).kafeBaru).toBe(false);
  });

  it("menghitung rasio selesai terhadap seluruh pesanan masuk", () => {
    const m = metrik([
      order({ status: "completed" }),
      order({ status: "completed" }),
      order({ status: "preparing", menitLalu: 2 }),
      order({ status: "ready", menitLalu: 2 }),
    ]);
    expect(m.kini.rasioSelesai).toBeCloseTo(0.5);
  });

  it("menjumlahkan nilai pesanan yang belum dibayar", () => {
    const m = metrik([
      order({ payment_status: "unpaid", status: "ready", total: 30_000, menitLalu: 2 }),
      order({ payment_status: "awaiting_payment", status: "ready", total: 20_000, menitLalu: 2 }),
      order({ payment_status: "paid", total: 99_000 }),
    ]);
    expect(m.kini.belumLunasJumlah).toBe(2);
    expect(m.kini.belumLunasNilai).toBe(50_000);
  });

  it("hanya menampilkan pesanan yang masih berjalan", () => {
    const m = metrik([
      order({ status: "completed" }),
      order({ status: "cancelled" }),
      order({ status: "preparing", menitLalu: 2 }),
    ]);
    expect(m.berjalan).toHaveLength(1);
    expect(m.berjalan[0].status).toBe("preparing");
  });
});

describe("deret kumulatif", () => {
  it("menjumlahkan total berjalan kedua periode, sejajar posisi hari", () => {
    // Rentang 27 Agu–2 Sep; NOW = 2 Sep 12:00. Dua penjualan: 28 Agu & 30 Agu.
    const m = metrik(
      [
        order({ total: 100_000, menitLalu: 5 * 24 * 60 }), // 28 Agu
        order({ total: 50_000, menitLalu: 3 * 24 * 60 }), // 30 Agu
      ],
      [order({ total: 80_000, menitLalu: 12 * 24 * 60 })], // 21 Agu = hari ke-2 periode lalu
    );
    expect(m.kumulatif.map((k) => k.kini)).toEqual([0, 100_000, 100_000, 150_000, 150_000, 150_000, 150_000]);
    expect(m.kumulatif.map((k) => k.lalu)).toEqual([0, 80_000, 80_000, 80_000, 80_000, 80_000, 80_000]);
  });

  it("menandai hari yang belum tiba supaya garis berhenti karena waktu, bukan karena penjualan", () => {
    const m = hitungMetrik({ kini: [], lalu: [], menus: MENUS, fromIso: "2026-09-01", spanDays: 5, now: NOW });
    expect(m.kumulatif.map((k) => k.masaDepan)).toEqual([false, false, true, true, true]);
  });
});

describe("jam ramai", () => {
  it("menempatkan pendapatan lunas pada sel hari-minggu × jam yang benar", () => {
    // NOW = Rabu 2 Sep 12:00 → 5 menit lalu = Rabu (hari 2) jam 11.
    const m = metrik([order({ total: 30_000, menitLalu: 5 })]);
    const sel = m.jam.sel.find((s) => s.hari === 2 && s.jam === 11);
    expect(sel?.nilai).toBe(30_000);
    expect(sel?.pesanan).toBe(1);
    expect(m.jam.profil[11].nilai).toBe(30_000);
    expect(m.jam.puncak).toMatchObject({ hari: 2, jam: 11 });
  });

  it("menghitung pesanan belum lunas ke cacah tapi tidak ke uang, dan mengabaikan yang batal", () => {
    const m = metrik([
      order({ total: 30_000, payment_status: "unpaid", status: "ready", menitLalu: 5 }),
      order({ total: 999_000, status: "cancelled", payment_status: "unpaid", menitLalu: 5 }),
    ]);
    expect(m.jam.profil[11]).toMatchObject({ nilai: 0, pesanan: 1 });
    expect(m.jam.puncak).toBeNull();
    expect(m.jam.rentangJam).toEqual([11, 11]);
  });
});

describe("komposisi", () => {
  it("mengurutkan metode bayar berdasarkan uang dan memberi label bahasa manusia", () => {
    const m = metrik([
      order({ total: 20_000, payment_method: "cash" }),
      order({ total: 20_000, payment_method: "cash" }),
      order({ total: 90_000, payment_method: "qris" }),
      order({ total: 10_000, payment_status: "unpaid", status: "ready", payment_method: null }),
    ]);
    expect(m.metodeBayar.map((x) => [x.label, x.jumlah, x.nilai])).toEqual([
      ["QRIS", 1, 90_000],
      ["Tunai", 2, 40_000],
    ]);
  });

  it("menyusun status dalam urutan alur kerja dan membuang status yang kosong", () => {
    const m = metrik([
      order({ status: "completed" }),
      order({ status: "cancelled", payment_status: "unpaid" }),
      order({ status: "preparing", menitLalu: 2 }),
    ]);
    expect(m.statusMix.map((s) => s.key)).toEqual(["preparing", "completed", "cancelled"]);
  });

  it("menghitung item terjual hanya dari pesanan lunas, dan pembatalan dari statusnya", () => {
    const m = metrik([
      order({ items: [{ id_menu: "kopi", harga_menu: 20_000, qty: 3 }] }),
      order({ items: [{ id_menu: "kopi", harga_menu: 20_000, qty: 5 }], payment_status: "unpaid", status: "ready" }),
      order({ status: "cancelled", payment_status: "unpaid" }),
    ]);
    expect(m.kini.itemTerjual).toBe(3);
    expect(m.kini.dibatalkan).toBe(1);
    expect(m.kini.pesananLunas).toBe(1);
  });

  it("hanya memuat transaksi lunas, terbaru dulu, maksimum delapan", () => {
    const rows = Array.from({ length: 10 }, (_, i) => order({ total: 1000 * (i + 1), menitLalu: i * 10 }));
    rows.push(order({ total: 5, payment_status: "unpaid", status: "ready", menitLalu: 1 }));
    const m = metrik(rows);
    expect(m.transaksi).toHaveLength(8);
    expect(m.transaksi.every((o) => o.payment_status === "paid")).toBe(true);
    expect(m.transaksi[0].total).toBe(1000);
  });
});

describe("corong tamu", () => {
  it("menyatukan peristiwa ponsel tamu dan pesanan menjadi lima langkah berurutan", () => {
    const c = hitungCorong({
      kini: { click_menu: 200, view_3d: 120, click_order: 40 },
      lalu: { click_menu: 150, view_3d: 90, click_order: 30 },
      pesananKini: 30,
      pesananLalu: 20,
      lunasKini: 28,
      lunasLalu: 19,
    });
    expect(c.langkah.map((l) => l.nilai)).toEqual([200, 120, 40, 30, 28]);
    expect(c.langkah.map((l) => l.lalu)).toEqual([150, 90, 30, 20, 19]);
    expect(c.langkah[4].label).toBe("Lunas");
  });
});

describe("usia", () => {
  it("menulis menit, jam, lalu hari", () => {
    const t = (ms: number) => usia(new Date(NOW.getTime() - ms), NOW);
    expect(t(20 * 60_000)).toBe("20m lalu");
    expect(t(2 * 3600_000)).toBe("2j lalu");
    expect(t(2 * 3600_000 + 15 * 60_000)).toBe("2j 15m lalu");
    expect(t(3 * HARI)).toBe("3 hari lalu");
  });

  it("tidak pernah menghasilkan usia negatif untuk stempel waktu masa depan", () => {
    expect(usia(new Date(NOW.getTime() + 60_000), NOW)).toBe("0m lalu");
  });
});
