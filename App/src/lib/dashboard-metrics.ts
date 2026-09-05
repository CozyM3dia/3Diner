/** Perhitungan angka Dashboard konsol owner.
 *
 *  Fungsi murni, tanpa I/O: halaman mengambil baris dari Supabase lalu
 *  menyerahkannya ke sini. Dipisah dari komponen supaya delta, agregasi,
 *  dan ambang "butuh perhatian" bisa diuji tanpa merender apa pun.
 *
 *  Skema nyata (STATE-REBUILD §5 — jangan menebak kolom):
 *    Orders.total, .status, .payment_status, .table_number, .created_at,
 *           .items = JSONB [{ id_menu, nama_menu, harga_menu, qty }]
 *    Menus.id_menu, .nama_menu, .harga_menu, .category (teks), .is_active
 */

export type OrderItemJson = {
  id_menu?: string;
  nama_menu?: string;
  harga_menu?: number;
  qty?: number;
};

export type OrderRow = {
  id_order: string;
  total: number | null;
  status: string | null;
  payment_status: string | null;
  table_number: string | null;
  items: OrderItemJson[] | null;
  created_at: string;
  /** cash | qris | gopay | shopeepay | bank_transfer — null bila belum dibayar. */
  payment_method?: string | null;
};

export type MenuRow = {
  id_menu: string;
  nama_menu: string;
  harga_menu: number;
  image_url: string | null;
  category: string | null;
  is_active: boolean | null;
};

/** Ambang "butuh perhatian". Angka-angka ini adalah kebijakan produk, bukan
 *  detail teknis — ditaruh di satu tempat supaya bisa disetel tanpa berburu. */
export const AMBANG = {
  /** Pesanan belum lunas yang lebih tua dari ini dianggap tertinggal. */
  belumLunasMenit: 45,
  /** Pesanan yang masih di dapur melewati ini dianggap macet. */
  dapurMenit: 30,
  /** Baris maksimum yang ditampilkan pada panel Butuh perhatian. */
  maksBaris: 6,
} as const;

/** Status yang berarti pesanan masih hidup di alur kerja. */
const STATUS_BERJALAN = new Set(["awaiting", "received", "preparing", "ready"]);
/** Status yang berarti dapur sedang memegangnya. */
const STATUS_DAPUR = new Set(["received", "preparing"]);
/** payment_status yang berarti uang belum masuk. */
const BELUM_LUNAS = new Set(["unpaid", "awaiting_payment", "awaiting_checkin", "pending"]);

export type Delta = {
  /** Persentase perubahan. `null` bila periode pembanding nol — pertumbuhan
   *  dari nol tidak punya persentase yang jujur. */
  pct: number | null;
  arah: "up" | "down" | "flat";
  sebelum: number;
};

export function hitungDelta(sekarang: number, sebelum: number): Delta {
  if (sebelum === 0) {
    return { pct: null, arah: sekarang > 0 ? "up" : "flat", sebelum };
  }
  const pct = ((sekarang - sebelum) / sebelum) * 100;
  // Ambang 0,05% supaya pembulatan tidak menampilkan panah untuk perubahan nol.
  const arah = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  return { pct, arah, sebelum };
}

export type Ringkas = {
  pendapatan: number;
  pesanan: number;
  /** Pesanan yang uangnya sudah masuk. */
  pesananLunas: number;
  nilaiRata: number;
  belumLunasNilai: number;
  belumLunasJumlah: number;
  /** Rasio pesanan yang mencapai `completed`, 0–1. */
  rasioSelesai: number;
  /** Porsi yang terjual pada pesanan lunas. */
  itemTerjual: number;
  dibatalkan: number;
};

function ringkas(orders: OrderRow[]): Ringkas {
  const lunas = orders.filter((o) => o.payment_status === "paid");
  const pendapatan = lunas.reduce((s, o) => s + (o.total ?? 0), 0);
  const belumLunas = orders.filter(
    (o) => BELUM_LUNAS.has(o.payment_status ?? "") && o.status !== "cancelled",
  );
  const selesai = orders.filter((o) => o.status === "completed").length;
  return {
    pendapatan,
    pesanan: orders.length,
    pesananLunas: lunas.length,
    nilaiRata: lunas.length ? pendapatan / lunas.length : 0,
    belumLunasNilai: belumLunas.reduce((s, o) => s + (o.total ?? 0), 0),
    belumLunasJumlah: belumLunas.length,
    rasioSelesai: orders.length ? selesai / orders.length : 0,
    itemTerjual: lunas.reduce((s, o) => s + (o.items ?? []).reduce((a, it) => a + (it.qty ?? 1), 0), 0),
    dibatalkan: orders.filter((o) => o.status === "cancelled").length,
  };
}

/** Satu hari pada deret. `prev*` adalah hari yang bersesuaian di periode
 *  pembanding (hari ke-i dari awal periode itu), supaya perbandingan sejajar
 *  posisi, bukan sejajar tanggal — Senin dibandingkan dengan Senin sebelumnya,
 *  bukan dengan tanggal yang kebetulan sama. */
export type TitikHari = {
  iso: string;
  label: string;
  value: number;
  valuePrev: number;
  orders: number;
  ordersPrev: number;
};

export type BarisPeringkat = {
  id: string;
  nama: string;
  nilai: number;
  qty: number;
  thumb: string | null;
};

export type AlasanPerhatian = "belum-lunas" | "macet-dapur" | "menu-nonaktif";

export type BarisPerhatian = {
  key: string;
  alasan: AlasanPerhatian;
  judul: string;
  detail: string;
  sisi: string;
  href: string;
  tone: "bad" | "warn";
};

/** Satu titik deret kumulatif: total berjalan sampai hari ke-i, kedua periode. */
export type TitikKumulatif = {
  iso: string;
  label: string;
  kini: number;
  lalu: number;
  /** Hari ini dan sesudahnya belum "terjadi" penuh — pembaca harus tahu
   *  garisnya berhenti karena waktu, bukan karena penjualan berhenti. */
  masaDepan: boolean;
};

/** Sel jam × hari-minggu. `hari` 0=Senin … 6=Minggu (ISO), `jam` 0–23 WIB-lokal. */
export type SelJam = { hari: number; jam: number; nilai: number; pesanan: number };

export type JamRamai = {
  /** 7 × 24 — pendapatan lunas per sel. */
  sel: SelJam[];
  /** Profil 24 jam (semua hari dijumlah). */
  profil: { jam: number; nilai: number; pesanan: number }[];
  /** Sel terpadat, atau null bila tak ada penjualan lunas. */
  puncak: SelJam | null;
  /** Jam buka efektif: jam pertama dan terakhir yang pernah mencatat pesanan. */
  rentangJam: [number, number] | null;
};

export type IrisanMix = { key: string; label: string; jumlah: number; nilai: number };

export type Corong = {
  langkah: { key: string; label: string; nilai: number; lalu: number }[];
};

export type Metrik = {
  kini: Ringkas;
  lalu: Ringkas;
  deltaPendapatan: Delta;
  deltaPesanan: Delta;
  deltaNilaiRata: Delta;
  deltaItem: Delta;
  harian: TitikHari[];
  /** Indeks hari puncak di `harian`, atau -1 bila semua nol. */
  puncak: number;
  kumulatif: TitikKumulatif[];
  jam: JamRamai;
  /** Komposisi metode bayar pada pesanan lunas — terurut nilai turun. */
  metodeBayar: IrisanMix[];
  /** Komposisi status seluruh pesanan masuk — urutan alur kerja, bukan besar. */
  statusMix: IrisanMix[];
  terlaris: BarisPeringkat[];
  kategori: BarisPeringkat[];
  berjalan: OrderRow[];
  /** Transaksi lunas terbaru — untuk tabel rincian. */
  transaksi: OrderRow[];
  perhatian: BarisPerhatian[];
  /** Benar bila kafe belum pernah punya pesanan sama sekali pada kedua
   *  periode — empty state "kafe baru" berbeda dari "rentang ini sepi". */
  kafeBaru: boolean;
};

export const LABEL_METODE: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  bank_transfer: "Transfer bank",
};

export const LABEL_STATUS: { key: string; label: string }[] = [
  { key: "awaiting", label: "Menunggu" },
  { key: "received", label: "Diterima" },
  { key: "preparing", label: "Dimasak" },
  { key: "ready", label: "Siap" },
  { key: "completed", label: "Selesai" },
  { key: "cancelled", label: "Dibatalkan" },
];

export const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Corong tamu: dari membuka menu sampai uang masuk. Tiga langkah pertama
 *  datang dari Analytics_Logs (peristiwa di ponsel tamu), dua terakhir dari
 *  Orders — kedua sumber disatukan supaya owner melihat satu alur, bukan dua
 *  dashboard yang saling tak kenal. */
export function hitungCorong(input: {
  kini: { click_menu: number; view_3d: number; click_order: number };
  lalu: { click_menu: number; view_3d: number; click_order: number };
  pesananKini: number;
  pesananLalu: number;
  lunasKini: number;
  lunasLalu: number;
}): Corong {
  return {
    langkah: [
      { key: "buka", label: "Buka menu", nilai: input.kini.click_menu, lalu: input.lalu.click_menu },
      { key: "3d", label: "Lihat 3D", nilai: input.kini.view_3d, lalu: input.lalu.view_3d },
      { key: "mulai", label: "Mulai pesan", nilai: input.kini.click_order, lalu: input.lalu.click_order },
      { key: "masuk", label: "Pesanan masuk", nilai: input.pesananKini, lalu: input.pesananLalu },
      { key: "lunas", label: "Lunas", nilai: input.lunasKini, lalu: input.lunasLalu },
    ],
  };
}

const ZONA_DASHBOARD = "Asia/Jakarta";
const WIB_OFFSET_MS = 7 * 3600_000;
const fmtHari = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: ZONA_DASHBOARD });
const fmtJam = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: ZONA_DASHBOARD });

function bagianWib(d: Date) {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
  };
}

/** Rasio bagian terhadap total yang aman untuk ditampilkan sebagai persen.
 *
 *  Event analytics dapat terduplikasi atau tertinggal dari Orders. Karena itu
 *  pembilang tidak boleh membuat rasio bagian melewati 100%, dan penyebut nol
 *  berarti rasionya memang tidak tersedia (bukan 0%).
 */
export function hitungRasioTerbatas(pembilang: number, penyebut: number): number | null {
  if (!Number.isFinite(pembilang) || !Number.isFinite(penyebut) || penyebut <= 0) return null;
  return Math.min(Math.max(pembilang, 0), penyebut) / penyebut;
}

/** Kunci hari bisnis WIB, independen dari zona waktu proses Node. */
function kunciHari(d: Date): string {
  const wib = bagianWib(d);
  return `${wib.year}-${String(wib.month).padStart(2, "0")}-${String(wib.date).padStart(2, "0")}`;
}

/** "2j 15m lalu" — cukup untuk menilai urgensi tanpa membaca jam dinding. */
export function usia(sejak: Date, sekarang: Date): string {
  const menit = Math.max(0, Math.round((sekarang.getTime() - sejak.getTime()) / 60000));
  if (menit < 60) return `${menit}m lalu`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam < 24) return sisa ? `${jam}j ${sisa}m lalu` : `${jam}j lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

const rupiahRingkas = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export function hitungMetrik(input: {
  /** Pesanan pada rentang terpilih. */
  kini: OrderRow[];
  /** Pesanan pada rentang setara tepat sebelumnya — dasar delta. */
  lalu: OrderRow[];
  menus: MenuRow[];
  fromIso: string;
  spanDays: number;
  /** Disuntik supaya perhitungan usia deterministik saat diuji. */
  now?: Date;
}): Metrik {
  const { kini: oKini, lalu: oLalu, menus, fromIso, spanDays } = input;
  const now = input.now ?? new Date();

  const rKini = ringkas(oKini);
  const rLalu = ringkas(oLalu);

  // ── Deret harian. Hari kosong tetap hadir sebagai 0 supaya sumbu waktu
  // tidak memampat dan grafik tidak berbohong soal jeda. Pendapatan hanya
  // menghitung pesanan lunas; cacah pesanan menghitung semuanya.
  const kumpul = (rows: OrderRow[]) => {
    const uang = new Map<string, number>();
    const cacah = new Map<string, number>();
    for (const o of rows) {
      const k = kunciHari(new Date(o.created_at));
      cacah.set(k, (cacah.get(k) ?? 0) + 1);
      if (o.payment_status === "paid") uang.set(k, (uang.get(k) ?? 0) + (o.total ?? 0));
    }
    return { uang, cacah };
  };
  const kiniHari = kumpul(oKini);
  const laluHari = kumpul(oLalu);

  const mulai = new Date(`${fromIso}T00:00:00+07:00`);
  const mulaiLalu = new Date(mulai.getTime() - spanDays * 864e5);
  const harian: TitikHari[] = [];
  for (let i = 0; i < spanDays; i++) {
    const d = new Date(mulai.getTime() + i * 864e5);
    const iso = kunciHari(d);
    const isoLalu = kunciHari(new Date(mulaiLalu.getTime() + i * 864e5));
    harian.push({
      iso,
      label: fmtHari.format(d),
      value: kiniHari.uang.get(iso) ?? 0,
      valuePrev: laluHari.uang.get(isoLalu) ?? 0,
      orders: kiniHari.cacah.get(iso) ?? 0,
      ordersPrev: laluHari.cacah.get(isoLalu) ?? 0,
    });
  }
  const maxHarian = Math.max(...harian.map((h) => h.value), 0);
  const puncak = maxHarian > 0 ? harian.findIndex((h) => h.value === maxHarian) : -1;

  // ── Kumulatif: total berjalan kedua periode, sejajar posisi hari. Garis
  // periode ini berhenti di hari ini — hari yang belum lewat ditandai supaya
  // pembaca tidak mengira penjualan mendatar.
  const kunciHariIni = kunciHari(now);
  let aKum = 0;
  let bKum = 0;
  const kumulatif: TitikKumulatif[] = harian.map((h) => {
    aKum += h.value;
    bKum += h.valuePrev;
    return { iso: h.iso, label: h.label, kini: aKum, lalu: bKum, masaDepan: h.iso > kunciHariIni };
  });

  // ── Jam ramai: pendapatan lunas per (hari-minggu × jam). Sumber staffing
  // paling berguna untuk kafe — kapan kasir dan dapur harus penuh.
  const sel: SelJam[] = [];
  for (let hari = 0; hari < 7; hari++)
    for (let jam = 0; jam < 24; jam++) sel.push({ hari, jam, nilai: 0, pesanan: 0 });
  const profil = Array.from({ length: 24 }, (_, jam) => ({ jam, nilai: 0, pesanan: 0 }));
  let jamMin = 24;
  let jamMax = -1;
  for (const o of oKini) {
    if (o.status === "cancelled") continue;
    const d = new Date(o.created_at);
    const wib = bagianWib(d);
    const hari = (wib.day + 6) % 7; // Minggu(0) → 6, Senin(1) → 0
    const jam = wib.hour;
    const s = sel[hari * 24 + jam];
    s.pesanan += 1;
    profil[jam].pesanan += 1;
    jamMin = Math.min(jamMin, jam);
    jamMax = Math.max(jamMax, jam);
    if (o.payment_status === "paid") {
      s.nilai += o.total ?? 0;
      profil[jam].nilai += o.total ?? 0;
    }
  }
  const selPuncak = sel.reduce<SelJam | null>((b, s) => (s.nilai > (b?.nilai ?? 0) ? s : b), null);
  const jam: JamRamai = {
    sel,
    profil,
    puncak: selPuncak,
    rentangJam: jamMax >= 0 ? [jamMin, jamMax] : null,
  };

  // ── Metode bayar: hanya pesanan lunas, diurut oleh uang. Metode yang tak
  // dipakai tidak muncul — nol bukan informasi di komposisi.
  const perMetode = new Map<string, IrisanMix>();
  for (const o of oKini) {
    if (o.payment_status !== "paid") continue;
    const key = o.payment_method?.trim() || "lainnya";
    const cur = perMetode.get(key) ?? { key, label: LABEL_METODE[key] ?? "Lainnya", jumlah: 0, nilai: 0 };
    cur.jumlah += 1;
    cur.nilai += o.total ?? 0;
    perMetode.set(key, cur);
  }
  const metodeBayar = [...perMetode.values()].sort((a, b) => b.nilai - a.nilai);

  // ── Status: urutan alur kerja dipertahankan supaya komposisi terbaca
  // sebagai perjalanan pesanan, bukan tangga besar-kecil.
  const statusMix: IrisanMix[] = LABEL_STATUS.map(({ key, label }) => {
    const rows = oKini.filter((o) => (o.status ?? "received") === key);
    return { key, label, jumlah: rows.length, nilai: rows.reduce((s, o) => s + (o.total ?? 0), 0) };
  }).filter((s) => s.jumlah > 0);

  const transaksi = oKini
    .filter((o) => o.payment_status === "paid")
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 8);

  // ── Terlaris: diperingkat oleh KONTRIBUSI PENDAPATAN, bukan jumlah unit.
  // Sepuluh kopi murah bukan berarti mengalahkan dua steak.
  const perMenu = new Map<string, { nama: string; nilai: number; qty: number }>();
  for (const o of oKini) {
    if (o.payment_status !== "paid") continue;
    for (const it of o.items ?? []) {
      if (!it.id_menu) continue;
      const qty = it.qty ?? 1;
      const cur = perMenu.get(it.id_menu) ?? { nama: it.nama_menu ?? "Menu", nilai: 0, qty: 0 };
      cur.nilai += (it.harga_menu ?? 0) * qty;
      cur.qty += qty;
      perMenu.set(it.id_menu, cur);
    }
  }
  const byId = new Map(menus.map((m) => [m.id_menu, m]));
  const terlaris: BarisPeringkat[] = [...perMenu.entries()]
    .map(([id, v]) => ({ id, nama: v.nama, nilai: v.nilai, qty: v.qty, thumb: byId.get(id)?.image_url ?? null }))
    .sort((a, b) => b.nilai - a.nilai)
    .slice(0, 5);

  // ── Kategori diukur dengan PENDAPATAN, bukan cacah menu. Berapa banyak
  // item ada di sebuah kategori bukan pertanyaan yang dipunyai owner.
  const perKategori = new Map<string, { nilai: number; qty: number }>();
  for (const [id, v] of perMenu) {
    const kat = byId.get(id)?.category?.trim() || "Lainnya";
    const cur = perKategori.get(kat) ?? { nilai: 0, qty: 0 };
    cur.nilai += v.nilai;
    cur.qty += v.qty;
    perKategori.set(kat, cur);
  }
  const kategori: BarisPeringkat[] = [...perKategori.entries()]
    .map(([nama, v]) => ({ id: nama, nama, nilai: v.nilai, qty: v.qty, thumb: null }))
    .sort((a, b) => b.nilai - a.nilai)
    .slice(0, 6);

  const berjalan = oKini
    .filter((o) => STATUS_BERJALAN.has(o.status ?? ""))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 5);

  // ── Butuh perhatian. Tiap baris menjawab "apa yang lepas dari pengawasan",
  // dan menautkan ke tempat tindakannya — konsol ini tidak memutasi status.
  const perhatian: BarisPerhatian[] = [];

  for (const o of oKini) {
    if (o.status === "cancelled") continue;
    const umurMenit = (now.getTime() - +new Date(o.created_at)) / 60000;
    const meja = o.table_number ? `Meja ${o.table_number}` : "Tamu";

    if (BELUM_LUNAS.has(o.payment_status ?? "") && umurMenit > AMBANG.belumLunasMenit) {
      perhatian.push({
        key: `pay-${o.id_order}`,
        alasan: "belum-lunas",
        judul: `${meja} belum lunas`,
        detail: `${rupiahRingkas(o.total ?? 0)} · masuk ${fmtJam.format(new Date(o.created_at))}`,
        sisi: usia(new Date(o.created_at), now),
        href: "/kasir",
        tone: "bad",
      });
      continue; // Satu pesanan hanya boleh muncul sekali.
    }

    if (STATUS_DAPUR.has(o.status ?? "") && umurMenit > AMBANG.dapurMenit) {
      perhatian.push({
        key: `kds-${o.id_order}`,
        alasan: "macet-dapur",
        judul: `${meja} lama di dapur`,
        detail: `${(o.items ?? []).reduce((s, it) => s + (it.qty ?? 1), 0)} item · masuk ${fmtJam.format(new Date(o.created_at))}`,
        sisi: usia(new Date(o.created_at), now),
        href: "/dashboard-v2/dapur",
        tone: "warn",
      });
    }
  }

  // Terlama dulu: yang paling tertinggal paling butuh dilihat.
  perhatian.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1));

  const nonaktif = menus.filter((m) => m.is_active === false);
  if (nonaktif.length) {
    perhatian.push({
      key: "menu-off",
      alasan: "menu-nonaktif",
      judul: `${nonaktif.length} menu tidak tayang`,
      detail: nonaktif.slice(0, 3).map((m) => m.nama_menu).join(", ") + (nonaktif.length > 3 ? ", …" : ""),
      sisi: "Atur",
      href: "/dashboard-v2/items",
      tone: "warn",
    });
  }

  return {
    kini: rKini,
    lalu: rLalu,
    deltaPendapatan: hitungDelta(rKini.pendapatan, rLalu.pendapatan),
    deltaPesanan: hitungDelta(rKini.pesanan, rLalu.pesanan),
    deltaNilaiRata: hitungDelta(rKini.nilaiRata, rLalu.nilaiRata),
    deltaItem: hitungDelta(rKini.itemTerjual, rLalu.itemTerjual),
    harian,
    puncak,
    kumulatif,
    jam,
    metodeBayar,
    statusMix,
    terlaris,
    kategori,
    berjalan,
    transaksi,
    perhatian: perhatian.slice(0, AMBANG.maksBaris),
    kafeBaru: oKini.length === 0 && oLalu.length === 0,
  };
}
