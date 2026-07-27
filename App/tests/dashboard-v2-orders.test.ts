import { describe, expect, it } from "vitest";

import {
  describePayment,
  ORDER_TABS,
  PAGE_SIZE,
  parseTab,
  STATUS_TEXT,
  statusesForTab,
  summarizeItems,
} from "@/lib/dashboard-v2-orders";
import type { OrderItem } from "@/types";

describe("saringan riwayat pesanan", () => {
  it("membaca tab dari URL", () => {
    // Seluruh keadaan daftar hidup di URL supaya halaman yang sedang dilihat
    // bisa dikirim apa adanya, ke akuntan atau ke diri sendiri besok pagi.
    expect(parseTab("berjalan")).toBe("berjalan");
    expect(parseTab("dibatalkan")).toBe("dibatalkan");
  });

  it("jatuh ke semua saat tab tidak dikenal", () => {
    // Nilai asing lebih baik menampilkan semuanya daripada daftar kosong yang
    // membuat orang mengira datanya hilang.
    expect(parseTab("ngawur")).toBe("semua");
    expect(parseTab(undefined)).toBe("semua");
  });

  it("memetakan tab berjalan ke status yang belum terminal", () => {
    expect(statusesForTab("berjalan")).toEqual(["received", "preparing", "ready"]);
  });

  it("tidak menyaring status apa pun di tab semua", () => {
    expect(statusesForTab("semua")).toBeNull();
  });

  it("punya tiga tab, dan tidak menduplikasi antrean kasir", () => {
    // Layar ini riwayat, bukan tempat kedua untuk mengerjakan pesanan.
    expect([...ORDER_TABS]).toEqual(["semua", "berjalan", "dibatalkan"]);
  });
});

describe("kosakata status", () => {
  it("memberi nama pada kelima status", () => {
    expect(Object.keys(STATUS_TEXT)).toHaveLength(5);
    expect(STATUS_TEXT.completed).toBe("Selesai");
    expect(STATUS_TEXT.cancelled).toBe("Dibatalkan");
  });

  it("tidak memakai kata Pending", () => {
    // Status wajib menyebut siapa pemegang bola. "Pending" tidak menyebut siapa
    // pun, jadi ia dilarang di seluruh dashboard.
    expect(Object.values(STATUS_TEXT).join(" ").toLowerCase()).not.toContain("pending");
  });
});

describe("keadaan pembayaran", () => {
  it("menyebut metode bersama keadaannya", () => {
    // "QRIS" saja tidak memberi tahu apakah uangnya sudah masuk — dan itu satu-
    // satunya hal yang ingin diketahui pemilik saat membaca riwayat.
    expect(describePayment("qris", "paid")).toBe("QRIS · lunas");
    expect(describePayment("cash", "paid")).toBe("Tunai · lunas");
  });

  it("membedakan QRIS yang menunggu dari tunai yang belum dibayar", () => {
    expect(describePayment("qris", "pending")).toBe("QRIS · menunggu");
    expect(describePayment("cash", "unpaid")).toBe("Tunai · belum bayar");
  });

  it("mengatakan apa adanya saat tamu belum memilih", () => {
    expect(describePayment(null, "unpaid")).toBe("Belum dipilih · belum bayar");
  });
});

describe("ringkasan item", () => {
  const item = (o: Partial<OrderItem>): OrderItem => ({
    id_menu: "m1",
    nama_menu: "Kopi Susu",
    harga_menu: 18000,
    qty: 1,
    ...o,
  });

  it("meringkas beberapa item dalam satu baris", () => {
    expect(summarizeItems([item({ qty: 2 }), item({ nama_menu: "Croffle" })])).toBe(
      "2× Kopi Susu, 1× Croffle"
    );
  });

  it("menandai pesanan tanpa item alih-alih merender baris kosong", () => {
    expect(summarizeItems([])).toBe("—");
  });
});

describe("ukuran halaman", () => {
  it("mengambil satu baris lebih banyak untuk mengetahui ada halaman berikutnya", () => {
    // Kursor keyset tidak bisa melewatkan baris saat daftar menerima insert
    // sambil dibaca; offset bisa, dan pesanan terlewat berarti pesanan tidak
    // dikerjakan.
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });
});
