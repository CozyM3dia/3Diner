import { describe, expect, it } from "vitest";
import {
  TARGET_MENIT,
  bakiTarget,
  cocokPencarian,
  durasi,
  hitungSemuaItem,
  kunciProduksi,
  labelMeja,
  lajuPanas,
  masihDiPapan,
  tiketDariPayloadRealtime,
  panasDari,
  ringkasVarian,
  tahapDari,
  umurMs,
  urutkanPapan,
  type TiketDapur,
} from "@/lib/kitchen-model";
import type { OrderItem, OrderStatus } from "@/types";

const MENIT = 60_000;
const SEKARANG = Date.parse("2026-09-02T12:00:00.000Z");

function item(nama: string, qty = 1, extra: Partial<OrderItem> = {}): OrderItem {
  return { id_menu: nama, nama_menu: nama, harga_menu: 10_000, qty, ...extra };
}

function tiket(over: Partial<TiketDapur> = {}): TiketDapur {
  return {
    id_order: "abcdef1234",
    created_at: new Date(SEKARANG - 5 * MENIT).toISOString(),
    status: "received",
    payment_status: "paid",
    table_number: "7",
    notes: null,
    items: [item("Nasi Goreng")],
    ...over,
  };
}

describe("tahapDari", () => {
  it("memetakan setiap status dapur ke tahap kerjanya", () => {
    expect(tahapDari("awaiting")).toBe("tahan");
    expect(tahapDari("received")).toBe("antre");
    expect(tahapDari("preparing")).toBe("masak");
    expect(tahapDari("ready")).toBe("siap");
  });
});

describe("panasDari", () => {
  it("memisahkan urgensi dari tahap kerja", () => {
    // Regresi papan lama: di sana pesanan yang sedang dimasak DAN terlambat
    // kehilangan tahapnya, karena cabang telat diperiksa lebih dulu dan
    // menimpa "Di Dapur". Tahap dan urgensi sekarang dua sumbu terpisah.
    const umur = (TARGET_MENIT + 5) * MENIT;
    expect(tahapDari("preparing")).toBe("masak");
    expect(panasDari("masak", umur)).toBe("telat");
  });

  it("menaikkan tingkat sesuai umur", () => {
    expect(panasDari("antre", 1 * MENIT)).toBe("aman");
    expect(panasDari("antre", 20 * MENIT)).toBe("waspada");
    expect(panasDari("antre", TARGET_MENIT * MENIT)).toBe("telat");
  });

  it("membekukan tiket yang sudah siap di aman", () => {
    // Masakannya sudah keluar; menyalakannya merah hanya menambah alarm palsu,
    // dan papan yang penuh alarm palsu berhenti dibaca.
    expect(panasDari("siap", 99 * MENIT)).toBe("aman");
  });

  it("tidak menebak sebelum klien punya jamnya sendiri", () => {
    expect(panasDari("masak", null)).toBe("aman");
  });
});

describe("umurMs", () => {
  it("mengembalikan null sebelum jam klien berjalan", () => {
    expect(umurMs(tiket(), null)).toBeNull();
  });

  it("tidak pernah negatif walau jam perangkat tertinggal", () => {
    const masaDepan = tiket({ created_at: new Date(SEKARANG + 5 * MENIT).toISOString() });
    expect(umurMs(masaDepan, SEKARANG)).toBe(0);
  });
});

describe("lajuPanas", () => {
  it("terpotong di 1 supaya rel tidak meluap", () => {
    expect(lajuPanas(0)).toBe(0);
    expect(lajuPanas(15 * MENIT)).toBeCloseTo(0.5);
    expect(lajuPanas(120 * MENIT)).toBe(1);
  });
});

describe("durasi", () => {
  it("memakai mm:ss di bawah satu jam", () => {
    expect(durasi(0)).toBe("00:00");
    expect(durasi(9 * 60_000 + 5_000)).toBe("09:05");
  });

  it("membuang detik setelah satu jam", () => {
    expect(durasi(3 * 3600_000 + 7 * MENIT)).toBe("3j 07m");
  });

  it("beralih ke hari supaya tidak terbaca sebagai menit", () => {
    // "51:20" pada pesanan berumur dua hari terbaca sebagai lima puluh satu
    // menit oleh mata yang sedang buru-buru.
    expect(durasi(2 * 86400_000 + 3 * 3600_000)).toBe("2h 3j");
  });

  it("menampilkan placeholder saat jam klien belum jalan", () => {
    expect(durasi(null)).toBe("--:--");
  });
});

describe("bakiTarget", () => {
  it("menghitung sisa waktu menuju target", () => {
    expect(bakiTarget(10 * MENIT)).toEqual({ mode: "sisa", menit: 20 });
  });

  it("beralih ke lewat setelah target terlampaui", () => {
    expect(bakiTarget((TARGET_MENIT + 4) * MENIT)).toEqual({ mode: "lewat", menit: 4 });
  });

  it("tidak pernah melaporkan nol menit", () => {
    // "Sisa 0m" dan "Lewat 0m" sama-sama tidak memberi tahu apa pun.
    expect(bakiTarget(TARGET_MENIT * MENIT - 1)?.menit).toBe(1);
    expect(bakiTarget(TARGET_MENIT * MENIT + 1)?.menit).toBe(1);
  });
});

describe("ringkasVarian & kunciProduksi", () => {
  it("meringkas varian jadi satu baris", () => {
    const opsi = [
      { id_option_value: "b", group_name: "Gula", name: "Tanpa gula", price_delta: 0 },
      { id_option_value: "a", group_name: "Ukuran", name: "Large", price_delta: 3000 },
    ];
    expect(ringkasVarian(opsi)).toBe("Tanpa gula · Large");
    expect(ringkasVarian(undefined)).toBe("");
  });

  it("memisahkan menu yang sama dengan varian berbeda", () => {
    const tanpaGula = item("Kopi", 1, {
      options: [{ id_option_value: "no-sugar", group_name: "Gula", name: "Tanpa gula", price_delta: 0 }],
    });
    const biasa = item("Kopi", 1);
    expect(kunciProduksi(tanpaGula)).not.toBe(kunciProduksi(biasa));
  });

  it("tidak terpengaruh urutan varian yang dipilih pelanggan", () => {
    const a = item("Kopi", 1, {
      options: [
        { id_option_value: "x", group_name: "g", name: "X", price_delta: 0 },
        { id_option_value: "y", group_name: "g", name: "Y", price_delta: 0 },
      ],
    });
    const b = item("Kopi", 1, {
      options: [
        { id_option_value: "y", group_name: "g", name: "Y", price_delta: 0 },
        { id_option_value: "x", group_name: "g", name: "X", price_delta: 0 },
      ],
    });
    expect(kunciProduksi(a)).toBe(kunciProduksi(b));
  });

  it("memisahkan baris dengan catatan berbeda", () => {
    expect(kunciProduksi(item("Kopi", 1, { notes: "panas" }))).not.toBe(kunciProduksi(item("Kopi")));
  });
});

describe("hitungSemuaItem", () => {
  it("menjumlahkan menu yang sama dari tiket berbeda", () => {
    const papan = [
      tiket({ id_order: "a", items: [item("Nasi Goreng", 1)] }),
      tiket({ id_order: "b", items: [item("Nasi Goreng", 2)] }),
      tiket({ id_order: "c", status: "preparing", items: [item("Nasi Goreng", 1), item("Es Teh", 4)] }),
    ];
    const hasil = hitungSemuaItem(papan);
    const nasi = hasil.find(b => b.nama === "Nasi Goreng");
    expect(nasi?.total).toBe(4);
    expect(nasi?.perTahap).toEqual({ tahan: 0, antre: 3, masak: 1, siap: 0 });
  });

  it("tidak menggabungkan varian berbeda jadi satu wajan", () => {
    const papan = [
      tiket({
        id_order: "a",
        items: [
          item("Kopi", 1, {
            options: [{ id_option_value: "no", group_name: "Gula", name: "Tanpa gula", price_delta: 0 }],
          }),
          item("Kopi", 1),
        ],
      }),
    ];
    const hasil = hitungSemuaItem(papan);
    expect(hasil).toHaveLength(2);
    expect(hasil.every(b => b.total === 1)).toBe(true);
  });

  it("mengurutkan dari yang paling banyak", () => {
    const papan = [tiket({ items: [item("Sedikit", 1), item("Banyak", 9)] })];
    expect(hitungSemuaItem(papan)[0].nama).toBe("Banyak");
  });

  it("memperlakukan qty kosong sebagai satu porsi", () => {
    const papan = [tiket({ items: [item("Roti", 0)] })];
    expect(hitungSemuaItem(papan)[0].total).toBe(1);
  });
});

describe("cocokPencarian", () => {
  const t = tiket({
    table_number: "12",
    notes: "alergi kacang",
    items: [
      item("Pasta Meatball", 1, {
        notes: "tanpa bawang",
        options: [{ id_option_value: "l3", group_name: "Level", name: "Level 3", price_delta: 0 }],
      }),
    ],
  });

  it("mencocokkan meja, menu, varian, dan catatan", () => {
    expect(cocokPencarian(t, "12")).toBe(true);
    expect(cocokPencarian(t, "pasta")).toBe(true);
    expect(cocokPencarian(t, "level 3")).toBe(true);
    expect(cocokPencarian(t, "bawang")).toBe(true);
    expect(cocokPencarian(t, "kacang")).toBe(true);
  });

  it("mengembalikan semua saat kueri kosong", () => {
    expect(cocokPencarian(t, "   ")).toBe(true);
  });

  it("menolak yang tidak cocok", () => {
    expect(cocokPencarian(t, "rendang")).toBe(false);
  });
});

describe("urutkanPapan", () => {
  it("mendahulukan yang paling lama menunggu", () => {
    const lama = tiket({ id_order: "lama", created_at: new Date(SEKARANG - 40 * MENIT).toISOString() });
    const baru = tiket({ id_order: "baru", created_at: new Date(SEKARANG - 2 * MENIT).toISOString() });
    expect(urutkanPapan([baru, lama]).map(t => t.id_order)).toEqual(["lama", "baru"]);
  });

  it("membuang tiket tertahan ke belakang berapa pun umurnya", () => {
    // Dapur tidak bisa mengerjakannya sampai kasir check-in; menaruhnya di
    // depan hanya menutupi pekerjaan yang benar-benar bisa dimulai sekarang.
    const tertahanTua = tiket({
      id_order: "tahan",
      status: "awaiting",
      created_at: new Date(SEKARANG - 90 * MENIT).toISOString(),
    });
    const siapKerja = tiket({ id_order: "kerja", created_at: new Date(SEKARANG - 1 * MENIT).toISOString() });
    expect(urutkanPapan([tertahanTua, siapKerja]).map(t => t.id_order)).toEqual(["kerja", "tahan"]);
  });
});

describe("masihDiPapan", () => {
  it("melepas status terminal", () => {
    const terbuka: OrderStatus[] = ["awaiting", "received", "preparing", "ready"];
    terbuka.forEach(s => expect(masihDiPapan(s)).toBe(true));
    expect(masihDiPapan("completed")).toBe(false);
    expect(masihDiPapan("cancelled")).toBe(false);
  });
});

describe("tiketDariPayloadRealtime", () => {
  it("tidak menghapus item saat payload UPDATE hanya membawa status", () => {
    const lama = tiket({ items: [item("Es Kopi Susu", 2)], payment_status: "unpaid" });
    const next = tiketDariPayloadRealtime(lama, {
      id_order: lama.id_order,
      status: "preparing",
      payment_status: "paid",
    });
    expect(next.items).toEqual(lama.items);
    expect(next.created_at).toBe(lama.created_at);
    expect(next.table_number).toBe("7");
    expect(next.status).toBe("preparing");
    expect(next.payment_status).toBe("paid");
  });

  it("membentuk tiket baru dari INSERT lengkap", () => {
    const next = tiketDariPayloadRealtime(undefined, {
      id_order: "baru",
      created_at: "2026-09-02T12:00:00.000Z",
      status: "awaiting",
      payment_status: "unpaid",
      table_number: "E2E",
      notes: "tanpa gula",
      items: [item("Pasta")],
    });
    expect(next.id_order).toBe("baru");
    expect(next.items).toHaveLength(1);
    expect(next.table_number).toBe("E2E");
    expect(next.notes).toBe("tanpa gula");
  });
});

describe("labelMeja", () => {
  it("membedakan makan di tempat dari bawa pulang", () => {
    expect(labelMeja(tiket({ table_number: "9" }))).toBe("Meja 9");
    expect(labelMeja(tiket({ table_number: null }))).toBe("Bawa Pulang");
  });
});
