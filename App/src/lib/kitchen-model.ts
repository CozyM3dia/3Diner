/** Model domain papan dapur. Murni — tanpa React, tanpa Supabase, tanpa DOM.
 *
 *  Papan lama mencampur dua hal berbeda ke dalam satu enum: "Pesanan Baru",
 *  "Di Dapur", "Siap" adalah tahap kerja, tapi "Lewat 30 Menit" adalah umur.
 *  Sebuah pesanan bisa sekaligus sedang dimasak DAN terlambat, jadi satu enum
 *  memaksa salah satunya hilang — dan yang hilang selalu tahap kerjanya,
 *  karena cabang telat diperiksa duluan. Itu sebabnya layar lama bisa
 *  melaporkan "Di Dapur 00" padahal ada 23 pesanan yang sedang dimasak.
 *
 *  Di sini keduanya dipisah jadi dua sumbu:
 *    tahap — di mana pesanan berada dalam alur kerja (menentukan aksi)
 *    panas — seberapa mendesak (menentukan warna yang terbaca dari jauh)
 */

import type { OrderItem, OrderStatus, SelectedOption } from "@/types";

/** Menit sampai sebuah pesanan dianggap terlambat.
 *
 *  30 bukan angka baru: ambang yang sama dipakai peringatan "macet-dapur" di
 *  metrik dashboard. Mengubahnya di sini tanpa mengubah di sana akan membuat
 *  dua layar melaporkan keterlambatan yang berbeda untuk pesanan yang sama. */
export const TARGET_MENIT = 30;

/** Umur saat kartu mulai memberi peringatan, sebelum benar-benar telat.
 *  Setengah jalan ke target: masih bisa dikejar kalau dilihat sekarang. */
export const WASPADA_MENIT = 15;

/** Tahap kerja — menjawab "apa yang harus dilakukan pada pesanan ini". */
export type Tahap = "tahan" | "antre" | "masak" | "siap";

/** Tingkat urgensi — menjawab "seberapa mendesak", terbaca dari seberang dapur. */
export type Panas = "aman" | "waspada" | "telat";

export interface TahapInfo {
  /** Label di layar. Kata kerja keadaan, bukan istilah database. */
  label: string;
  /** Kalimat pendek untuk pembaca layar dan tooltip. */
  arti: string;
  /** Teks tombol aksi, atau null kalau tahap ini tidak bisa dimajukan dari dapur. */
  aksi: string | null;
  /** Status berikutnya yang akan dikirim ke `advance_order_status`. */
  lanjut: Exclude<OrderStatus, "awaiting" | "received" | "cancelled"> | null;
  /** Aksi ini mengeluarkan tiket dari papan, jadi salah tekan tidak terlihat
   *  lagi setelah terjadi — satu-satunya tahap yang butuh jeda batal. */
  terminal: boolean;
}

export const TAHAP: Record<Tahap, TahapInfo> = {
  tahan: {
    label: "Tertahan",
    arti: "Menunggu check-in di Kasir",
    aksi: null,
    lanjut: null,
    terminal: false,
  },
  antre: {
    label: "Antre",
    arti: "Sudah diterima, belum mulai dimasak",
    aksi: "Mulai Masak",
    lanjut: "preparing",
    terminal: false,
  },
  masak: {
    label: "Dimasak",
    arti: "Sedang dikerjakan di dapur",
    aksi: "Tandai Siap",
    lanjut: "ready",
    terminal: false,
  },
  siap: {
    label: "Siap",
    arti: "Matang, menunggu diantar",
    aksi: "Serahkan",
    lanjut: "completed",
    terminal: true,
  },
};

/** Urutan tetap untuk chip penyaring dan kolom ringkasan. Mengikuti alur kerja
 *  kiri-ke-kanan, bukan abjad — mata staf menyusuri papan searah alur. */
export const URUTAN_TAHAP: Tahap[] = ["tahan", "antre", "masak", "siap"];

/** Satu tiket di papan. Bentuknya sengaja lebih kaya dari papan lama, yang
 *  hanya menarik `nama_menu` + `qty` dan karena itu membuang justru informasi
 *  yang paling sering menyebabkan piring salah: varian dan catatan per baris. */
export interface TiketDapur {
  id_order: string;
  created_at: string;
  status: OrderStatus;
  payment_status: string;
  table_number: string | null;
  /** Catatan tingkat pesanan — berlaku untuk seluruh tiket. */
  notes: string | null;
  items: OrderItem[];
}

export function tahapDari(status: OrderStatus | string): Tahap {
  switch (status) {
    case "preparing":
      return "masak";
    case "ready":
      return "siap";
    case "awaiting":
      return "tahan";
    default:
      return "antre";
  }
}

/** Umur tiket dalam milidetik, atau null sebelum klien punya jamnya sendiri.
 *
 *  null bukan nilai malas: jam server dan jam tablet tidak pernah sama persis,
 *  jadi umur yang dirender di server selalu berbeda dari hitungan pertama di
 *  klien, dan React membuang seluruh pohonnya karena teksnya tidak cocok. */
export function umurMs(tiket: TiketDapur, sekarang: number | null): number | null {
  if (sekarang === null) return null;
  return Math.max(0, sekarang - Date.parse(tiket.created_at));
}

/** Tingkat urgensi dari umur.
 *
 *  Tiket yang sudah siap dibekukan di "aman": masakannya sudah keluar, jadi
 *  membuatnya menyala merah hanya menambah warna merah yang harus diabaikan —
 *  dan papan yang penuh alarm palsu adalah papan yang berhenti dibaca. */
export function panasDari(tahap: Tahap, umur: number | null): Panas {
  if (tahap === "siap" || umur === null) return "aman";
  const menit = umur / 60_000;
  if (menit >= TARGET_MENIT) return "telat";
  if (menit >= WASPADA_MENIT) return "waspada";
  return "aman";
}

/** Sejauh mana tiket berjalan menuju target, 0–1. Dipakai mengisi rel panas. */
export function lajuPanas(umur: number | null): number {
  if (umur === null) return 0;
  return Math.min(1, umur / (TARGET_MENIT * 60_000));
}

/** Durasi dalam bentuk yang terbaca sekilas dari jauh.
 *
 *  Di bawah sejam: mm:ss, karena di situlah dapur hidup dan detik masih berarti.
 *  Lewat sejam: jam + menit tanpa detik — detik yang berkedip pada pesanan
 *  berumur tiga jam hanya menarik mata ke angka yang tidak menentukan apa pun.
 *  Lewat sehari: hari + jam, karena "51:20" terbaca sebagai lima puluh satu
 *  menit oleh mata yang sedang buru-buru. */
export function durasi(ms: number | null): string {
  if (ms === null) return "--:--";
  const detikTotal = Math.max(0, Math.floor(ms / 1000));
  const dua = (n: number) => String(n).padStart(2, "0");
  const hari = Math.floor(detikTotal / 86400);
  if (hari > 0) return `${hari}h ${Math.floor((detikTotal % 86400) / 3600)}j`;
  const jam = Math.floor(detikTotal / 3600);
  if (jam > 0) return `${jam}j ${dua(Math.floor((detikTotal % 3600) / 60))}m`;
  return `${dua(Math.floor(detikTotal / 60))}:${dua(detikTotal % 60)}`;
}

/** Sisa waktu menuju target, atau seberapa jauh sudah terlewat.
 *
 *  Dibulatkan ke menit penuh: detik berguna pada timer utama yang memang
 *  dipandangi, tapi "sisa 6 menit 43 detik" adalah presisi yang tidak dipakai
 *  siapa pun untuk memutuskan apa pun. */
export function bakiTarget(umur: number | null): { mode: "sisa" | "lewat"; menit: number } | null {
  if (umur === null) return null;
  const selisih = TARGET_MENIT * 60_000 - umur;
  if (selisih >= 0) return { mode: "sisa", menit: Math.max(1, Math.ceil(selisih / 60_000)) };
  return { mode: "lewat", menit: Math.max(1, Math.floor(-selisih / 60_000)) };
}

/** Jam masuk pesanan. Tanggal hanya ikut kalau bukan hari ini — di dapur yang
 *  sibuk, "11 Agu" pada setiap kartu adalah sebelas karakter yang tidak pernah
 *  dibaca, tapi pada pesanan kemarin yang belum ditutup ia satu-satunya
 *  petunjuk bahwa kartu itu memang bukan dari shift ini. */
export function jamMasuk(iso: string, sekarang: number | null): string {
  const t = new Date(iso);
  const waktu = t.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (sekarang === null) return waktu;
  const hariIni = new Date(sekarang);
  const samaHari =
    t.getFullYear() === hariIni.getFullYear() &&
    t.getMonth() === hariIni.getMonth() &&
    t.getDate() === hariIni.getDate();
  if (samaHari) return waktu;
  return `${t.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} ${waktu}`;
}

/** Empat digit terakhir id pesanan. Cukup untuk dipanggil dengan suara di
 *  dapur yang berisik, dan pendek supaya muat di satu baris bersama nomor meja. */
export function kodeTiket(id: string): string {
  return id.slice(-4).toUpperCase();
}

export function labelMeja(tiket: TiketDapur): string {
  return tiket.table_number ? `Meja ${tiket.table_number}` : "Bawa Pulang";
}

/** Varian yang dipilih pelanggan, diringkas jadi satu baris.
 *
 *  Ini yang di papan lama tidak pernah sampai ke dapur. Riset KDS menyebutnya
 *  penyebab piring salah nomor satu: bukan nama menunya yang terbaca keliru,
 *  tapi "tanpa gula" yang tidak pernah muncul di layar sama sekali. */
export function ringkasVarian(options: SelectedOption[] | undefined): string {
  if (!options?.length) return "";
  return options.map(o => o.name).join(" · ");
}

/** Kunci identitas sebuah baris produksi: menu yang sama dengan varian dan
 *  catatan yang sama boleh digabung, yang berbeda tidak boleh. Menggabungkan
 *  "Kopi tanpa gula" dengan "Kopi biasa" jadi "Kopi ×2" menghasilkan satu
 *  gelas yang salah setiap kali. */
export function kunciProduksi(item: OrderItem): string {
  const varian = (item.options ?? [])
    .map(o => o.id_option_value)
    .sort()
    .join(",");
  return `${item.nama_menu}|${varian}|${item.notes?.trim() ?? ""}`;
}

export interface BarisProduksi {
  kunci: string;
  nama: string;
  varian: string;
  catatan: string;
  total: number;
  /** Berapa banyak yang masih tertahan / antre / dimasak / siap. Seorang juru
   *  masak yang melihat "Nasi Goreng 9" perlu tahu mana yang sudah di wajan. */
  perTahap: Record<Tahap, number>;
}

/** Semua item di papan, digabung per baris produksi dan diurutkan dari yang
 *  paling banyak.
 *
 *  Ini pandangan yang hilang dari papan lama dan justru paling dicari juru
 *  masak saat ramai: sembilan tiket yang masing-masing memesan satu Nasi
 *  Goreng adalah satu wajan berisi sembilan, bukan sembilan wajan. Membacanya
 *  dari grid tiket berarti menghitung manual sambil memegang spatula. */
export function hitungSemuaItem(tiket: TiketDapur[]): BarisProduksi[] {
  const peta = new Map<string, BarisProduksi>();

  for (const t of tiket) {
    const tahap = tahapDari(t.status);
    for (const item of t.items) {
      const kunci = kunciProduksi(item);
      let baris = peta.get(kunci);
      if (!baris) {
        baris = {
          kunci,
          nama: item.nama_menu || "Item tanpa nama",
          varian: ringkasVarian(item.options),
          catatan: item.notes?.trim() ?? "",
          total: 0,
          perTahap: { tahan: 0, antre: 0, masak: 0, siap: 0 },
        };
        peta.set(kunci, baris);
      }
      const qty = Math.max(1, item.qty ?? 1);
      baris.total += qty;
      baris.perTahap[tahap] += qty;
    }
  }

  return [...peta.values()].sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama, "id"));
}

/** Pencarian bebas atas satu tiket. Mencakup varian dan catatan, bukan cuma
 *  nama menu — saat tamu menelepon menanyakan "yang tanpa kacang", itulah kata
 *  yang diketik staf. */
export function cocokPencarian(tiket: TiketDapur, kueri: string): boolean {
  const q = kueri.trim().toLowerCase();
  if (!q) return true;
  if (tiket.id_order.toLowerCase().includes(q)) return true;
  if ((tiket.table_number ?? "").toLowerCase().includes(q)) return true;
  if ((tiket.notes ?? "").toLowerCase().includes(q)) return true;
  return tiket.items.some(item => {
    if ((item.nama_menu ?? "").toLowerCase().includes(q)) return true;
    if ((item.notes ?? "").toLowerCase().includes(q)) return true;
    return (item.options ?? []).some(o => o.name.toLowerCase().includes(q));
  });
}

/** Urutan papan: yang paling lama menunggu lebih dulu.
 *
 *  Tiket tertahan dikumpulkan di belakang berapa pun umurnya — dapur tidak
 *  bisa mengerjakannya sampai kasir melakukan check-in, jadi menaruhnya di
 *  depan hanya menutupi pekerjaan yang benar-benar bisa dimulai sekarang. */
export function urutkanPapan(tiket: TiketDapur[]): TiketDapur[] {
  return [...tiket].sort((a, b) => {
    const ta = tahapDari(a.status) === "tahan" ? 1 : 0;
    const tb = tahapDari(b.status) === "tahan" ? 1 : 0;
    if (ta !== tb) return ta - tb;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

/** Status yang masih menjadi urusan dapur. `completed` dan `cancelled` sudah
 *  lepas, jadi tiketnya harus hilang dari papan begitu Realtime mengabarkannya. */
export function masihDiPapan(status: OrderStatus | string): boolean {
  return status === "awaiting" || status === "received" || status === "preparing" || status === "ready";
}
