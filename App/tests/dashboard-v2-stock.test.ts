import { describe, expect, it } from "vitest";

import {
  countsByTab,
  filterByTab,
  parseQty,
  parseStockTab,
  sortByUrgency,
  STOCK_LEVEL_LABEL,
  stockLevel,
  summarize,
  type StockRow,
} from "@/lib/dashboard-v2-stock";

const row = (o: Partial<StockRow>): StockRow => ({
  id_inventory_item: o.name ?? "i1",
  name: "Bahan",
  unit: "kg",
  current_qty: 10,
  minimum_qty: 2,
  affectedMenus: 0,
  ...o,
});

describe("keadaan bahan", () => {
  it("membedakan habis dari menipis", () => {
    expect(stockLevel({ current_qty: 0, minimum_qty: 2 })).toBe("habis");
    expect(stockLevel({ current_qty: 2, minimum_qty: 2 })).toBe("menipis");
    expect(stockLevel({ current_qty: 3, minimum_qty: 2 })).toBe("aman");
  });

  it("memberi kata pada tiap keadaan", () => {
    // Merah-hijau sebagai pembeda utama dilarang; barisnya harus tetap terbaca
    // saat dicetak hitam-putih.
    expect(STOCK_LEVEL_LABEL.habis).toBe("Habis");
    expect(STOCK_LEVEL_LABEL.menipis).toBe("Menipis");
  });

  it("menganggap stok nol sebagai habis walau minimumnya nol", () => {
    expect(stockLevel({ current_qty: 0, minimum_qty: 0 })).toBe("habis");
  });
});

describe("urutan paling mendesak", () => {
  it("memakai rasio terhadap ambang, bukan selisih", () => {
    // Sisa 1 dari minimum 2 lebih genting daripada sisa 8 dari minimum 10,
    // walau selisihnya sama-sama membuatnya lewat ambang.
    const sorted = sortByUrgency([
      row({ name: "hampir-cukup", current_qty: 8, minimum_qty: 10 }),
      row({ name: "genting", current_qty: 1, minimum_qty: 2 }),
    ]);
    expect(sorted[0].name).toBe("genting");
  });

  it("menaruh yang habis paling atas", () => {
    const sorted = sortByUrgency([
      row({ name: "menipis", current_qty: 1, minimum_qty: 4 }),
      row({ name: "habis", current_qty: 0, minimum_qty: 4 }),
    ]);
    expect(sorted[0].name).toBe("habis");
  });

  it("mendahulukan bahan yang mematikan lebih banyak menu saat rasionya seri", () => {
    const sorted = sortByUrgency([
      row({ name: "sepi", current_qty: 1, minimum_qty: 2, affectedMenus: 1 }),
      row({ name: "ramai", current_qty: 1, minimum_qty: 2, affectedMenus: 9 }),
    ]);
    expect(sorted[0].name).toBe("ramai");
  });

  it("tidak menaruh bahan aman di atas bahan menipis", () => {
    // Abjad menyembunyikan yang genting di huruf Z; daftar ini dibuka justru
    // untuk menemukannya.
    const sorted = sortByUrgency([
      row({ name: "Aman", current_qty: 100, minimum_qty: 1 }),
      row({ name: "Zebra", current_qty: 0, minimum_qty: 1 }),
    ]);
    expect(sorted[0].name).toBe("Zebra");
  });
});

describe("saringan tab", () => {
  const rows = [
    row({ name: "habis", current_qty: 0, minimum_qty: 2 }),
    row({ name: "menipis", current_qty: 2, minimum_qty: 2 }),
    row({ name: "aman", current_qty: 9, minimum_qty: 2 }),
  ];

  it("memasukkan yang habis ke dalam tab menipis", () => {
    // Bahan habis juga menipis; memisahkannya total akan membuat tab pertama
    // menyembunyikan yang paling genting.
    expect(filterByTab(rows, "menipis").map((r) => r.name)).toEqual(["habis", "menipis"]);
  });

  it("menyaring tab habis ke yang benar-benar nol", () => {
    expect(filterByTab(rows, "habis").map((r) => r.name)).toEqual(["habis"]);
  });

  it("menghitung tiap tab", () => {
    expect(countsByTab(rows)).toEqual({ menipis: 2, habis: 1, semua: 3 });
  });

  it("default ke menipis, bukan semua", () => {
    // Layar ini dibuka untuk mencari masalah, jadi tampilan pertamanya adalah
    // masalahnya — bukan seluruh gudang.
    expect(parseStockTab(undefined)).toBe("menipis");
    expect(parseStockTab("ngawur")).toBe("menipis");
  });
});

describe("jumlah yang diketik", () => {
  it("menolak kolom kosong alih-alih membacanya sebagai nol", () => {
    // Number("") menghasilkan 0, bukan NaN. Tanpa penjaga ini, menekan Simpan
    // dengan kolom kosong menyetel stok ke NOL — kehilangan diam-diam yang baru
    // ketahuan saat menu mati sendiri.
    expect(parseQty("")).toBeNull();
    expect(parseQty("   ")).toBeNull();
  });

  it("menerima koma sebagai pemisah desimal", () => {
    // Papan ketik Indonesia menuliskannya begitu.
    expect(parseQty("1,5")).toBe(1.5);
    expect(parseQty("1.5")).toBe(1.5);
  });

  it("menolak yang bukan angka", () => {
    expect(parseQty("dua")).toBeNull();
    expect(parseQty("5kg")).toBeNull();
  });

  it("membedakan nol yang benar-benar diketik", () => {
    // Menghitung rak dan menemukannya kosong adalah penyesuaian yang sah.
    expect(parseQty("0")).toBe(0);
  });
});

describe("ringkasan kaki tabel", () => {
  it("menghitung menu unik, bukan menjumlahkan satuan yang berbeda", () => {
    // Menjumlahkan kilogram ke liter menghasilkan angka palsu. Menu unik yang
    // terdampak bisa dijumlah dan menentukan seberapa mendesak belanjanya.
    const map = new Map([
      ["susu", new Set(["kopi", "latte"])],
      ["gula", new Set(["kopi"])],
    ]);
    const result = summarize(
      [row({ name: "susu", id_inventory_item: "susu" }), row({ name: "gula", id_inventory_item: "gula" })],
      map
    );
    expect(result).toEqual({ itemCount: 2, affectedMenus: 2 });
  });

  it("tidak menghitung bahan yang belum dipakai resep apa pun", () => {
    const result = summarize([row({ id_inventory_item: "sendiri" })], new Map());
    expect(result.affectedMenus).toBe(0);
  });
});
