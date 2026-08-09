import { describe, expect, it } from "vitest";

import {
  AGE_LABEL,
  ageLevel,
  belongsInQueue,
  formatAge,
  itemSummary,
  LATE_MINUTES,
  minutesSince,
  NEARING_MINUTES,
  needsCash,
} from "@/lib/kasir-queue-rules";
import { canOpenCashierConsole, canOpenOwnerConsole } from "@/lib/staff-context";
import type { OrderItem } from "@/types";

describe("tingkat umur pesanan", () => {
  it("memetakan durasi ke tiga tingkat bernama", () => {
    expect(ageLevel(0)).toBe("normal");
    expect(ageLevel(NEARING_MINUTES - 1)).toBe("normal");
    expect(ageLevel(NEARING_MINUTES)).toBe("nearing");
    expect(ageLevel(LATE_MINUTES - 1)).toBe("nearing");
    expect(ageLevel(LATE_MINUTES)).toBe("late");
    expect(ageLevel(120)).toBe("late");
  });

  it("memberi kata pada tiap tingkat yang menuntut perhatian", () => {
    // Kegentingan tidak boleh dibawa warna saja: baris harus tetap terbaca
    // saat dicetak hitam-putih atau di layar yang silau.
    expect(AGE_LABEL.nearing).toBe("Mendekati");
    expect(AGE_LABEL.late).toBe("Terlambat");
    expect(AGE_LABEL.normal).toBe("");
  });

  it("tidak pernah menghasilkan umur negatif", () => {
    // Jam tablet konter bisa meleset di depan jam server.
    const now = Date.now();
    const masaDepan = new Date(now + 5 * 60_000).toISOString();
    expect(minutesSince(masaDepan, now)).toBe(0);
  });

  it("menghitung umur dalam menit penuh", () => {
    const now = Date.now();
    expect(minutesSince(new Date(now - 90_000).toISOString(), now)).toBe(1);
    expect(minutesSince(new Date(now - 18 * 60_000).toISOString(), now)).toBe(18);
  });

  it("menulis umur dalam satuan yang masih terbaca sekilas", () => {
    // "3883 mnt" secara teknis benar dan praktis tidak berarti apa-apa: mata
    // harus membagi sendiri sebelum tahu itu hampir tiga hari.
    expect(formatAge(0)).toBe("0 mnt");
    expect(formatAge(59)).toBe("59 mnt");
    expect(formatAge(60)).toBe("1 jam");
    expect(formatAge(1439)).toBe("23 jam");
    expect(formatAge(1440)).toBe("1 hari");
    expect(formatAge(3883)).toBe("2 hari");
  });

  it("mempertahankan menit di rentang yang justru dipakai kasir", () => {
    // Di bawah satu jam, menit adalah satuan yang berguna — di situlah ambang
    // "mendekati" dan "terlambat" berada.
    expect(formatAge(NEARING_MINUTES)).toBe("10 mnt");
    expect(formatAge(LATE_MINUTES)).toBe("15 mnt");
  });
});

describe("uang yang masih harus diterima kasir", () => {
  it("meminta terima tunai untuk pesanan yang belum lunas", () => {
    expect(needsCash({ payment_status: "unpaid", payment_method: "cash" })).toBe(true);
    // null method = pesanan online (belum ada method tercatat) — bukan tagihan kasir
    expect(needsCash({ payment_status: "unpaid", payment_method: null })).toBe(false);
  });

  it("tidak pernah meminta kasir melunasi QRIS", () => {
    // Hanya webhook Midtrans yang boleh menyatakan QRIS lunas — kasir tidak
    // bisa melihat dananya benar-benar masuk.
    expect(needsCash({ payment_status: "pending", payment_method: "qris" })).toBe(false);
    expect(needsCash({ payment_status: "unpaid", payment_method: "qris" })).toBe(false);
  });

  it("melewati pesanan yang sudah lunas", () => {
    expect(needsCash({ payment_status: "paid", payment_method: "cash" })).toBe(false);
  });
});

describe("ringkasan item satu baris", () => {
  const item = (o: Partial<OrderItem>): OrderItem => ({
    id_menu: "m1",
    nama_menu: "Kopi Susu",
    harga_menu: 18000,
    qty: 1,
    ...o,
  });

  it("menampilkan catatan per item, tidak menyembunyikannya", () => {
    // Catatan mengubah cara memasak, jadi harus terbaca sebelum baris dibuka.
    expect(itemSummary([item({ notes: "tanpa gula" })])).toContain("tanpa gula");
  });

  it("menampilkan varian terpilih", () => {
    const summary = itemSummary([
      item({ options: [{ id_option_value: "o1", group_name: "Ukuran", name: "Large", price_delta: 5000 }] }),
    ]);
    expect(summary).toContain("Large");
  });

  it("memisahkan beberapa item dengan koma", () => {
    expect(itemSummary([item({ qty: 2 }), item({ nama_menu: "Croffle" })])).toBe(
      "2× Kopi Susu, 1× Croffle"
    );
  });
});

describe("keanggotaan antrean", () => {
  it("menyimpan hanya pesanan yang belum selesai", () => {
    expect(belongsInQueue("received")).toBe(true);
    expect(belongsInQueue("preparing")).toBe(true);
    expect(belongsInQueue("ready")).toBe(true);
  });

  it("mengeluarkan pesanan terminal supaya antrean bisa mencapai nol", () => {
    // Antrean yang tidak bisa dikosongkan mengajari mata bahwa memindainya
    // tidak mengubah apa pun, lalu pemindaian berhenti sama sekali.
    expect(belongsInQueue("completed")).toBe(false);
    expect(belongsInQueue("cancelled")).toBe(false);
  });
});

describe("hak membuka konsol", () => {
  it("mengizinkan pemilik membuka konsol kasir", () => {
    // Di kafe satu orang, pemiliklah kasirnya. Memaksanya membuat akun kedua
    // hanya untuk melayani meja adalah pekerjaan yang tidak menghasilkan apa-apa.
    expect(canOpenCashierConsole("owner")).toBe(true);
    expect(canOpenCashierConsole("cashier")).toBe(true);
    expect(canOpenCashierConsole(null)).toBe(false);
  });

  it("tidak mengizinkan kasir membuka konsol pemilik", () => {
    expect(canOpenOwnerConsole("cashier")).toBe(false);
    expect(canOpenOwnerConsole("owner")).toBe(true);
    expect(canOpenOwnerConsole(null)).toBe(false);
  });
});
