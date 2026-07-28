import { describe, expect, it } from "vitest";

import {
  countCategories,
  filterMenus,
  liveState,
  menuCounts,
  MENU_TABS,
  modelState,
  MODEL_STATE_LABEL,
  parseMenuTab,
  sortByManualOrder,
  type MenuRow,
} from "@/lib/dashboard-v2-menu";

const row = (o: Partial<MenuRow>): MenuRow => ({
  id_menu: o.nama_menu ?? "m1",
  nama_menu: "Kopi Susu",
  category: "Kopi",
  harga_menu: 18000,
  discount_pct: null,
  is_active: true,
  has3d: true,
  hasAr: false,
  scheduled: false,
  outOfStock: false,
  liveNow: true,
  sort_order: 0,
  ...o,
});

describe("urutan menu", () => {
  it("memakai urutan manual pemilik, bukan abjad", () => {
    // Ini urutan yang tamu lihat. Menyortirnya menurut nama akan menampilkan
    // sesuatu yang bukan menu kafe itu.
    const sorted = sortByManualOrder([
      row({ nama_menu: "Americano", sort_order: 2 }),
      row({ nama_menu: "Zebra Cake", sort_order: 1 }),
    ]);
    expect(sorted.map((r) => r.nama_menu)).toEqual(["Zebra Cake", "Americano"]);
  });

  it("menaruh item tanpa urutan di belakang, bukan di depan", () => {
    const sorted = sortByManualOrder([
      row({ nama_menu: "belum-diurut", sort_order: Number.MAX_SAFE_INTEGER }),
      row({ nama_menu: "sudah-diurut", sort_order: 5 }),
    ]);
    expect(sorted[0].nama_menu).toBe("sudah-diurut");
  });
});

describe("keadaan model 3D", () => {
  it("hanya punya dua nilai yang bisa dibuktikan", () => {
    // Kegagalan pembuatan model tidak disimpan di mana pun, jadi "sedang
    // diproses" dan "gagal" tidak punya sumber data — menampilkannya berarti
    // mengarang keadaan.
    expect(Object.keys(MODEL_STATE_LABEL)).toHaveLength(2);
    expect(modelState({ has3d: true })).toBe("siap");
    expect(modelState({ has3d: false })).toBe("belum");
  });

  it("menyebut siapa yang harus bertindak", () => {
    expect(MODEL_STATE_LABEL.belum).toBe("Belum diunggah");
  });
});

describe("keadaan tayang", () => {
  it("menyebut sebab tamu tidak melihatnya, bukan sekadar nonaktif", () => {
    // "Nonaktif" tidak menjawab pertanyaan yang membawa pemilik ke layar ini.
    expect(liveState(row({ is_active: false }))).toBe("Dimatikan");
    expect(liveState(row({ outOfStock: true }))).toBe("Bahan habis");
    expect(liveState(row({ scheduled: true, liveNow: false }))).toBe("Di luar jam tayang");
  });

  it("membedakan tayang biasa dari tayang terjadwal", () => {
    expect(liveState(row({}))).toBe("Tayang");
    expect(liveState(row({ scheduled: true, liveNow: true }))).toBe("Tayang terjadwal");
  });

  it("mendahulukan bahan habis daripada jadwal", () => {
    // Kalau bahannya habis, jam tayang tidak relevan lagi.
    expect(liveState(row({ scheduled: true, liveNow: false, outOfStock: true }))).toBe("Bahan habis");
  });

  it("mendahulukan dimatikan daripada sebab lain", () => {
    expect(liveState(row({ is_active: false, outOfStock: true }))).toBe("Dimatikan");
  });
});

describe("saringan dan hitungan", () => {
  const rows = [
    row({ nama_menu: "a", is_active: true }),
    row({ nama_menu: "b", is_active: false }),
    row({ nama_menu: "c", is_active: true }),
  ];

  it("menghitung tiap tab", () => {
    expect(menuCounts(rows)).toEqual({ aktif: 2, nonaktif: 1, semua: 3 });
  });

  it("menyaring sesuai tab", () => {
    expect(filterMenus(rows, "nonaktif").map((r) => r.nama_menu)).toEqual(["b"]);
    expect(filterMenus(rows, "semua")).toHaveLength(3);
  });

  it("default ke aktif", () => {
    expect(parseMenuTab(undefined)).toBe("aktif");
    expect(parseMenuTab("ngawur")).toBe("aktif");
  });

  it("punya tiga tab", () => {
    expect([...MENU_TABS]).toEqual(["aktif", "nonaktif", "semua"]);
  });
});

describe("hitungan kategori", () => {
  it("tidak menghitung kategori kosong sebagai kategori", () => {
    const n = countCategories([
      row({ nama_menu: "a", category: "Kopi" }),
      row({ nama_menu: "b", category: "  " }),
      row({ nama_menu: "c", category: null }),
      row({ nama_menu: "d", category: "Kopi" }),
    ]);
    expect(n).toBe(1);
  });
});
