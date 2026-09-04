/** Fixture untuk harness visual konsol (`/dev-preview`).
 *
 *  Keadaan langka pada Dashboard — kafe yang baru dibuka, rentang tanpa satu
 *  pun pembayaran lunas, tumpukan pesanan yang tertinggal — nyaris mustahil
 *  dipentaskan di database sungguhan tanpa mengotorinya. Tanpa fixture,
 *  empty state dan panel peringatan tidak pernah benar-benar dilihat sampai
 *  seorang owner menemuinya lebih dulu di produksi.
 *
 *  Modul ini TIDAK diimpor oleh rute mana pun selain harness dev-only.
 */

import type { MenuRow, OrderRow } from "@/lib/dashboard-metrics";
import type { PeristiwaTamu } from "@/lib/dashboard-query";
import type { PosCategoryChip, PosMenu, PosMenuOption, PosRecent } from "@/components/pos/PosBoard";
import type { BoardOrder } from "@/components/dp/OrdersBoard";

export type Skenario = "ramai" | "sepi" | "baru" | "tertinggal";

export const SKENARIO: { key: Skenario; label: string; jelas: string }[] = [
  { key: "ramai", label: "Ramai", jelas: "Tujuh hari berjalan normal dengan penjualan naik" },
  { key: "sepi", label: "Belum lunas", jelas: "Ada pesanan masuk, belum satu pun dibayar" },
  { key: "baru", label: "Kafe baru", jelas: "Belum pernah ada pesanan sama sekali" },
  { key: "tertinggal", label: "Tertinggal", jelas: "Tagihan menua dan pesanan macet di dapur" },
];

const MENUS: MenuRow[] = [
  { id_menu: "m1", nama_menu: "Pasta Meatball", harga_menu: 40000, image_url: null, category: "Main Course", is_active: true },
  { id_menu: "m2", nama_menu: "Grilled Salmon Steak", harga_menu: 48000, image_url: null, category: "Main Course", is_active: true },
  { id_menu: "m3", nama_menu: "Es Kopi Susu", harga_menu: 22000, image_url: null, category: "Minuman", is_active: true },
  { id_menu: "m4", nama_menu: "Butter Croissant", harga_menu: 21250, image_url: null, category: "Pastry", is_active: true },
  { id_menu: "m5", nama_menu: "Nasi Goreng Kampung", harga_menu: 35000, image_url: null, category: "Main Course", is_active: true },
  { id_menu: "m6", nama_menu: "Matcha Latte", harga_menu: 28000, image_url: null, category: "Minuman", is_active: true },
  { id_menu: "m7", nama_menu: "Cinnamon Roll", harga_menu: 24000, image_url: null, category: "Pastry", is_active: false },
  { id_menu: "m8", nama_menu: "Affogato Musiman", harga_menu: 32000, image_url: null, category: "Minuman", is_active: false },
];

const byId = new Map(MENUS.map((m) => [m.id_menu, m]));

/** Metode bayar bergilir deterministik: QRIS mendominasi, tunai kedua —
 *  proporsi yang lazim di kafe kota. */
const METODE = ["qris", "qris", "cash", "qris", "gopay", "cash", "shopeepay", "qris", "bank_transfer"];

function buat(
  n: number,
  opsi: {
    menitLalu: number;
    isi: [string, number][];
    status: string;
    bayar: string;
    meja?: string | null;
  },
  now: number,
): OrderRow {
  const items = opsi.isi.map(([id, qty]) => {
    const m = byId.get(id)!;
    return { id_menu: id, nama_menu: m.nama_menu, harga_menu: m.harga_menu, qty };
  });
  return {
    id_order: `demo-${n}`,
    total: items.reduce((s, it) => s + it.harga_menu * it.qty, 0),
    status: opsi.status,
    payment_status: opsi.bayar,
    payment_method: opsi.bayar === "paid" ? METODE[n % METODE.length] : null,
    table_number: opsi.meja === undefined ? String(((n * 7) % 12) + 1) : opsi.meja,
    items,
    created_at: new Date(now - opsi.menitLalu * 60000).toISOString(),
  };
}

/** Kombinasi item yang berulang deterministik, supaya tangkapan layar dari dua
 *  sesi berbeda bisa dibandingkan tanpa derau acak. */
const POLA: [string, number][][] = [
  [["m1", 1], ["m3", 2]],
  [["m2", 1]],
  [["m3", 1], ["m4", 1]],
  [["m5", 2], ["m6", 1]],
  [["m1", 1], ["m2", 1], ["m3", 1]],
  [["m4", 2]],
  [["m6", 1], ["m3", 1]],
];

export function fixture(skenario: Skenario, now = new Date()): { orders: OrderRow[]; menus: MenuRow[] } {
  const t = now.getTime();
  const menus = MENUS;

  if (skenario === "baru") return { orders: [], menus };

  if (skenario === "sepi") {
    // Pesanan masuk tapi belum ada yang lunas: grafik harus kosong dengan
    // penjelasan yang berbeda dari kafe baru.
    const orders = Array.from({ length: 6 }, (_, i) =>
      buat(i, {
        menitLalu: 40 + i * 90,
        isi: POLA[i % POLA.length],
        status: i % 2 ? "received" : "preparing",
        bayar: "unpaid",
      }, t),
    );
    return { orders, menus };
  }

  if (skenario === "tertinggal") {
    const orders: OrderRow[] = [
      buat(0, { menitLalu: 190, isi: POLA[0], status: "received", bayar: "unpaid" }, t),
      buat(1, { menitLalu: 145, isi: POLA[1], status: "ready", bayar: "awaiting_payment" }, t),
      buat(2, { menitLalu: 96, isi: POLA[4], status: "received", bayar: "pending", meja: null }, t),
      buat(3, { menitLalu: 74, isi: POLA[3], status: "preparing", bayar: "paid" }, t),
      buat(4, { menitLalu: 52, isi: POLA[2], status: "preparing", bayar: "paid" }, t),
      buat(5, { menitLalu: 18, isi: POLA[5], status: "awaiting", bayar: "paid" }, t),
    ];
    // Sedikit riwayat lunas supaya grafik tetap punya isi di belakang.
    for (let d = 1; d < 7; d++) {
      orders.push(
        buat(10 + d, { menitLalu: d * 1440 + 200, isi: POLA[d % POLA.length], status: "completed", bayar: "paid" }, t),
      );
    }
    return { orders, menus };
  }

  // "ramai": tujuh hari berisi, dengan periode sebelumnya lebih rendah supaya
  // delta terbaca positif dan bisa diperiksa mata. Jam pesanan mengikuti
  // ritme kafe (sarapan, makan siang, sore, malam; akhir pekan lebih padat)
  // supaya peta Jam ramai punya bentuk yang bisa dinilai, bukan derau.
  const orders: OrderRow[] = [];
  let n = 0;
  const jamKafe = [9, 12, 13, 15, 19, 20, 11, 17];
  const tengahMalam = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (let hari = 0; hari < 14; hari++) {
    const periodeIni = hari < 7;
    const hariIni = new Date(tengahMalam - hari * 864e5);
    const akhirPekan = hariIni.getDay() === 0 || hariIni.getDay() === 6;
    const jumlah = (periodeIni ? 3 + (hari % 3) : 2 + (hari % 2)) + (akhirPekan ? 2 : 0);
    for (let k = 0; k < jumlah; k++) {
      const jam = jamKafe[(hari + k) % jamKafe.length];
      const menit = (k * 17) % 60;
      // Hari ini: hanya jam yang sudah lewat, supaya tak ada pesanan "dari masa depan".
      const kapan = hariIni.getTime() + jam * 3600e3 + menit * 60e3;
      if (kapan > t) continue;
      orders.push(
        buat(n++, {
          menitLalu: Math.round((t - kapan) / 60000),
          isi: POLA[(hari + k) % POLA.length],
          status: hari === 0 && k < 2 ? (k === 0 ? "preparing" : "ready") : "completed",
          bayar: "paid",
        }, t),
      );
    }
  }
  // Satu tagihan menua supaya panel Butuh perhatian tidak pernah kosong palsu,
  // dan satu pembatalan supaya komposisi status punya irisan merah.
  orders.push(buat(n++, { menitLalu: 128, isi: POLA[1], status: "ready", bayar: "unpaid" }, t));
  orders.push(buat(n++, { menitLalu: 2 * 1440 + 300, isi: POLA[5], status: "cancelled", bayar: "unpaid" }, t));
  return { orders, menus };
}

/** Peristiwa tamu (Analytics_Logs) untuk harness — bentuknya sama dengan
 *  hasil `muatPeristiwa`, tanpa menyentuh RPC. */
/** Pesanan untuk harness papan Pesanan. Diturunkan dari fixture yang sama
 *  dengan lembar analitik, lalu dilengkapi rincian harga & catatan supaya
 *  panel detail, chip pembayaran, dan kolom "Dibatalkan" semuanya terisi —
 *  keadaan yang tidak bisa diperiksa kalau fixture hanya berisi total. */
export function pesananFixture(skenario: Skenario = "ramai", now = new Date()): BoardOrder[] {
  const { orders } = fixture(skenario, now);
  const CATATAN: Record<number, string> = {
    1: "Tanpa bawang, saus dipisah.",
    4: "Pelanggan: Budi — tolong antar cepat, ada rapat.",
    9: "Pedas level 3.",
  };
  // Fixture analitik hampir seluruhnya "completed" — berguna untuk grafik
  // pendapatan, tak berguna untuk papan pipeline. Status di-siklus di sini
  // supaya keempat kolom kanban, keenam chip, dan keadaan belum-bayar semuanya
  // punya isi yang bisa diperiksa.
  const SIKLUS = ["awaiting", "awaiting", "preparing", "ready", "completed", "completed", "awaiting", "preparing"];
  return orders.slice(0, 22).map((o, i) => {
    const subtotal = o.total ?? 0;
    const servicePct = 5;
    const taxPct = 10;
    const service = Math.round((subtotal * servicePct) / 100);
    const tax = Math.round(((subtotal + service) * taxPct) / 100);
    const batal = i === 6;
    return {
      id_order: `0f1e2d3c-4b5a-4c6d-8e7f-${(0xa10c0 + i * 977).toString(16).padStart(12, "0")}`,
      created_at: o.created_at,
      status: batal ? "cancelled" : SIKLUS[i % SIKLUS.length],
      payment_status: i % 3 === 0 ? "paid" : "unpaid",
      payment_method: i % 3 === 0 ? o.payment_method ?? "cash" : null,
      table_number: i % 5 === 3 ? "Bungkus" : o.table_number,
      total: subtotal + service + tax,
      subtotal,
      tax_pct: taxPct,
      tax_amount: tax,
      service_pct: servicePct,
      service_amount: service,
      prices_include_tax: false,
      items: o.items ?? [],
      notes: CATATAN[i] ?? null,
      cancelled_reason: batal ? "Stok bahan habis" : null,
    };
  });
}

export function peristiwaFixture(skenario: Skenario): PeristiwaTamu {
  if (skenario === "baru") {
    return { kini: { click_menu: 0, view_3d: 0, click_order: 0 }, lalu: { click_menu: 0, view_3d: 0, click_order: 0 }, perMenu: [], perJam: Array(24).fill(0), gagal: false };
  }
  const perJam = Array(24).fill(0);
  for (const [h, v] of [[9, 12], [11, 18], [12, 41], [13, 36], [15, 22], [17, 15], [19, 33], [20, 27]]) perJam[h] = v;
  const perMenu = MENUS.slice(0, 6).map((m, i) => ({
    id: m.id_menu,
    nama: m.nama_menu,
    thumb: m.image_url,
    klik: 68 - i * 9,
    lihat3d: 40 - i * 6,
    pesan: 14 - i * 2,
  }));
  return {
    kini: { click_menu: 204, view_3d: 121, click_order: 47 },
    lalu: { click_menu: 168, view_3d: 90, click_order: 39 },
    perMenu,
    perJam,
    gagal: false,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   POS — fixture untuk harness.
   Panel keranjang POS berada di balik gerbang auth, sehingga cacat visual
   di sana (medan nomor meja yang terpotong, kolom tipe pesanan yang punya
   satu kolom hantu) hanya ketahuan lewat tangkapan layar pengguna. Fixture
   ini membuatnya bisa diperiksa langsung.

   Catatan: keranjang sengaja dibiarkan kosong saat dimuat. Menambah item
   memicu panggilan quote ke server yang tidak berlaku di luar sesi login —
   dan chrome yang perlu diperiksa (tipe pesanan, nomor meja, tombol aksi)
   sudah tampil pada keranjang kosong.
   ══════════════════════════════════════════════════════════════════════ */

const POS_MENUS: PosMenu[] = MENUS.map((m, i) => ({
  id: m.id_menu,
  name: m.nama_menu,
  price: m.harga_menu,
  discountPct: i === 3 ? 10 : null,
  imageUrl: null,
  category: m.category,
  isActive: m.is_active !== false,
  description: null,
}));

/** Grup opsi untuk dua menu pertama — harness harus melewati modal Item
 *  Details juga, bukan hanya jalur tambah-langsung. */
const POS_OPTION_GROUPS: PosMenuOption[] = POS_MENUS.slice(0, 2).flatMap((m, i) => [
  {
    id: `og-size-${i}`,
    menuId: m.id,
    name: "Ukuran",
    minSelect: 1,
    maxSelect: 1,
    values: [
      { id: `ov-size-${i}-r`, name: "Regular", priceDelta: 0 },
      { id: `ov-size-${i}-l`, name: "Large", priceDelta: 5000 },
    ],
  },
  {
    id: `og-add-${i}`,
    menuId: m.id,
    name: "Add-ons",
    minSelect: 0,
    maxSelect: 3,
    values: [
      { id: `ov-add-${i}-t`, name: "Extra Topping", priceDelta: 4000 },
      { id: `ov-add-${i}-s`, name: "Saus Terpisah", priceDelta: 0 },
    ],
  },
]);

export function posFixture(): {
  menus: PosMenu[];
  optionGroups: PosMenuOption[];
  categories: PosCategoryChip[];
  recent: PosRecent[];
  tables: string[];
} {
  const aktif = POS_MENUS.filter(m => m.isActive);
  const hitung = new Map<string, number>();
  for (const m of aktif) {
    const k = m.category ?? "Lainnya";
    hitung.set(k, (hitung.get(k) ?? 0) + 1);
  }
  const now = Date.now();
  const recent: PosRecent[] = [
    { id: "1a4c07d1-1111-4a5b-8c9d-000000000001", table: "4", total: 78000, status: "received", paymentStatus: "unpaid", createdAt: new Date(now - 3 * 60_000).toISOString(), menuCount: 2, itemCount: 3 },
    { id: "2b7e19f2-2222-4a5b-8c9d-000000000002", table: "Bungkus", total: 45000, status: "preparing", paymentStatus: "paid", createdAt: new Date(now - 34 * 60_000).toISOString(), menuCount: 1, itemCount: 1 },
    { id: "3c9a52e3-3333-4a5b-8c9d-000000000003", table: "12", total: 132000, status: "ready", paymentStatus: "unpaid", createdAt: new Date(now - 71 * 60_000).toISOString(), menuCount: 4, itemCount: 6 },
  ];
  return {
    menus: POS_MENUS,
    optionGroups: POS_OPTION_GROUPS,
    // "Semua Menu" adalah kategori awal yang dipilih PosBoard — tanpa itu
    // harness membuka dengan grid kosong dan tak ada chip yang menyala.
    categories: [
      { name: "Semua Menu", count: aktif.length },
      ...[...hitung.entries()].map(([name, count]) => ({ name, count })),
    ],
    recent,
    tables: ["1", "2", "4", "5", "10", "12", "A1", "A2"],
  };
}
