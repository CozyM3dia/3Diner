/** Bentuk "tambahan" (grup varian + pilihannya) selagi disunting di editor menu.
 *
 *  Modul ini SENGAJA murni dan bebas `"use server"`: aturan yang sama harus
 *  bisa dijalankan di dua tempat — sebagai lampu merah langsung di formulir,
 *  dan sebagai penolakan di server action. Kalau aturannya ditulis dua kali,
 *  suatu hari yang satu akan mengizinkan apa yang satunya tolak, dan pemilik
 *  yang formulirnya hijau akan tetap kehilangan simpanannya.
 *
 *  Hubungan dengan basis data: satu `AddonGroupDraft` = satu baris
 *  `Menu_Option_Groups`, satu `AddonValueDraft` = satu baris
 *  `Menu_Option_Values`. Urutan array menjadi `sort_order`. Penyimpanan lewat
 *  RPC `replace_menu_options` yang menghapus-lalu-menulis ulang seluruh grup
 *  sebuah menu — karena itu `recipes` ikut dibawa apa adanya meski editor ini
 *  tidak menyuntingnya: menjatuhkannya diam-diam akan memutus potongan stok
 *  otomatis yang sudah dipasang pemilik di editor menu lama. */

export type AddonRecipeDraft = {
  inventory_item_id: string;
  qty_per_menu: number;
};

export type AddonValueDraft = {
  /** Identitas SEMENTARA untuk key React & pemindahan baris — bukan id basis
   *  data. Baris disimpan ulang dengan id baru tiap kali menu disimpan. */
  key: string;
  name: string;
  /** Selisih rupiah terhadap harga menu. Boleh negatif (mis. "Tanpa Keju"). */
  price_delta: number;
  is_active: boolean;
  recipes: AddonRecipeDraft[];
};

export type AddonGroupDraft = {
  key: string;
  name: string;
  min_select: number;
  max_select: number;
  values: AddonValueDraft[];
};

/** Tiga aturan yang benar-benar dipakai rumah makan, diterjemahkan ke pasangan
 *  min/max. Angka mentah min_select/max_select tidak pernah dihadapkan langsung
 *  ke pemilik: "min 1 maks 1" tidak memberi tahu siapa pun bahwa tamu WAJIB
 *  memilih ukuran sebelum bisa memesan. */
export type AddonRule = "wajib" | "opsional" | "banyak";

export const MAX_GROUPS = 10;
export const MAX_VALUES_PER_GROUP = 20;
/** RPC memotong nama di 60 karakter; batasi di formulir agar tak ada kejutan. */
export const MAX_ADDON_NAME = 60;

let seq = 0;
/** Kunci baris yang stabil selama satu sesi editor. */
export function addonKey(prefix = "a"): string {
  seq += 1;
  return `${prefix}${seq}`;
}

export function emptyValue(name = "", price_delta = 0): AddonValueDraft {
  return { key: addonKey("v"), name, price_delta, is_active: true, recipes: [] };
}

export function emptyGroup(name = ""): AddonGroupDraft {
  return { key: addonKey("g"), name, min_select: 0, max_select: 1, values: [emptyValue()] };
}

/** Beri kunci pada grup yang baru datang dari server (tanpa kunci). */
export function withKeys(
  groups: Array<Omit<AddonGroupDraft, "key" | "values"> & {
    values: Array<Omit<AddonValueDraft, "key">>;
  }>,
): AddonGroupDraft[] {
  return groups.map(g => ({
    key: addonKey("g"),
    name: g.name,
    min_select: g.min_select,
    max_select: g.max_select,
    values: g.values.map(v => ({
      key: addonKey("v"),
      name: v.name,
      price_delta: v.price_delta,
      is_active: v.is_active,
      recipes: v.recipes ?? [],
    })),
  }));
}

export function ruleOf(group: AddonGroupDraft): AddonRule {
  if (group.max_select > 1) return "banyak";
  return group.min_select > 0 ? "wajib" : "opsional";
}

export function applyRule(group: AddonGroupDraft, rule: AddonRule): AddonGroupDraft {
  if (rule === "wajib") return { ...group, min_select: 1, max_select: 1 };
  if (rule === "opsional") return { ...group, min_select: 0, max_select: 1 };
  const ruang = Math.min(Math.max(group.values.length, 2), MAX_VALUES_PER_GROUP);
  return { ...group, min_select: 0, max_select: ruang };
}

/** Jepit min/max ke jumlah pilihan yang benar-benar ada. Dipanggil tiap kali
 *  daftar pilihan berubah: grup yang meminta 3 pilihan padahal tinggal 2
 *  membuat tombol "Tambah ke Pesanan" tamu mati selamanya. */
export function normalizeGroup(group: AddonGroupDraft): AddonGroupDraft {
  const n = group.values.length;
  if (n === 0) return { ...group, min_select: 0, max_select: 1 };
  const max = Math.min(Math.max(group.max_select, 1), n);
  const min = Math.min(Math.max(group.min_select, 0), max);
  if (max === group.max_select && min === group.min_select) return group;
  return { ...group, min_select: min, max_select: max };
}

function kosong(v: AddonValueDraft): boolean {
  return v.name.trim() === "" && v.price_delta === 0 && v.recipes.length === 0;
}

/** Buang baris yang jelas belum diisi sebelum divalidasi.
 *
 *  Tanpa ini, sekali klik "Tambah grup" karena penasaran akan MENGUNCI tombol
 *  simpan menu — grup kosong melanggar aturan server. Formulir yang menghukum
 *  rasa ingin tahu bukan formulir yang baik; yang belum diisi cukup dianggap
 *  tidak ada. */
export function pruneAddonDrafts(groups: AddonGroupDraft[]): AddonGroupDraft[] {
  return groups
    .map(g => ({ ...g, values: g.values.filter(v => !kosong(v)) }))
    .filter(g => g.name.trim() !== "" || g.values.length > 0)
    .map(normalizeGroup);
}

export type AddonIssue = { groupKey: string; valueKey?: string; message: string };

/** Cerminan `optionGroupsValidationError` + `replace_menu_options`, tapi
 *  mengembalikan SEMUA masalah beserta baris pemiliknya, bukan kalimat pertama
 *  saja — pemilik yang punya tiga grup berhak melihat ketiganya sekaligus. */
export function addonIssues(groups: AddonGroupDraft[]): AddonIssue[] {
  const issues: AddonIssue[] = [];
  if (groups.length > MAX_GROUPS) {
    issues.push({ groupKey: groups[MAX_GROUPS].key, message: `Maksimal ${MAX_GROUPS} grup per menu.` });
  }

  const namaGrup = new Set<string>();
  for (const g of groups) {
    const nama = g.name.trim();
    if (!nama) {
      issues.push({ groupKey: g.key, message: "Grup butuh nama — tamu melihatnya sebagai judul pilihan." });
    } else if (nama.length > MAX_ADDON_NAME) {
      issues.push({ groupKey: g.key, message: `Nama grup maksimal ${MAX_ADDON_NAME} karakter.` });
    } else {
      const kunci = nama.toLowerCase();
      if (namaGrup.has(kunci)) {
        issues.push({ groupKey: g.key, message: `Sudah ada grup bernama "${nama}".` });
      }
      namaGrup.add(kunci);
    }

    if (g.values.length === 0) {
      issues.push({ groupKey: g.key, message: "Grup ini belum punya pilihan." });
    }
    if (g.values.length > MAX_VALUES_PER_GROUP) {
      issues.push({ groupKey: g.key, message: `Maksimal ${MAX_VALUES_PER_GROUP} pilihan per grup.` });
    }
    if (g.min_select < 0 || g.max_select < 1 || g.min_select > g.max_select) {
      issues.push({ groupKey: g.key, message: "Batas jumlah pilihan tidak masuk akal." });
    }
    if (g.max_select > g.values.length && g.values.length > 0) {
      issues.push({ groupKey: g.key, message: "Grup tidak bisa meminta lebih banyak pilihan daripada yang tersedia." });
    }
    if (g.min_select > 0 && g.values.filter(v => v.is_active).length < g.min_select) {
      issues.push({
        groupKey: g.key,
        message: "Pilihan aktifnya kurang dari jumlah yang diwajibkan — tamu akan terkunci.",
      });
    }

    const namaNilai = new Set<string>();
    for (const v of g.values) {
      const nama = v.name.trim();
      if (!nama) {
        issues.push({ groupKey: g.key, valueKey: v.key, message: "Pilihan butuh nama." });
        continue;
      }
      if (nama.length > MAX_ADDON_NAME) {
        issues.push({ groupKey: g.key, valueKey: v.key, message: `Maksimal ${MAX_ADDON_NAME} karakter.` });
      }
      const kunci = nama.toLowerCase();
      if (namaNilai.has(kunci)) {
        issues.push({ groupKey: g.key, valueKey: v.key, message: "Nama ini sudah dipakai di grup yang sama." });
      }
      namaNilai.add(kunci);
      if (!Number.isInteger(v.price_delta)) {
        issues.push({ groupKey: g.key, valueKey: v.key, message: "Selisih harga harus rupiah bulat." });
      }
    }
  }

  return issues;
}

/** Rentang harga yang benar-benar bisa dibayar tamu, dari konfigurasi termurah
 *  sampai termahal.
 *
 *  Ini angka yang tidak bisa dihitung pemilik sambil mengetik: grup wajib
 *  MENAIKKAN lantai harga, grup opsional hanya menaikkan langit-langitnya, dan
 *  selisih negatif ("Tanpa Keju −2.000") bisa menurunkan keduanya. Karena satu
 *  grup wajib yang termurahnya +5.000 diam-diam mengubah menu Rp25.000 menjadi
 *  Rp30.000 di mata tamu, angkanya ditampilkan, bukan dibiarkan ditebak. */
export function addonPriceSpan(
  base: number,
  groups: AddonGroupDraft[],
): { min: number; max: number; adaRentang: boolean } {
  let bawah = 0;
  let atas = 0;

  for (const g of groups) {
    const delta = g.values.filter(v => v.is_active).map(v => v.price_delta);
    if (delta.length === 0) continue;

    const naik = [...delta].sort((a, b) => a - b);
    const turun = [...naik].reverse();
    const minK = Math.min(Math.max(g.min_select, 0), naik.length);
    const maxK = Math.min(Math.max(g.max_select, minK), naik.length);

    // Termurah: ambil sebanyak yang diwajibkan dari yang paling murah, lalu
    // teruskan selama menambah masih menurunkan total (selisih negatif).
    let jalan = naik.slice(0, minK).reduce((s, n) => s + n, 0);
    let terendah = jalan;
    for (let i = minK; i < maxK; i++) {
      jalan += naik[i];
      if (jalan < terendah) terendah = jalan;
    }

    // Termahal: cermin dari atas.
    let naikJalan = turun.slice(0, minK).reduce((s, n) => s + n, 0);
    let tertinggi = naikJalan;
    for (let i = minK; i < maxK; i++) {
      naikJalan += turun[i];
      if (naikJalan > tertinggi) tertinggi = naikJalan;
    }

    bawah += terendah;
    atas += tertinggi;
  }

  const min = base + bawah;
  const max = base + atas;
  return { min, max, adaRentang: min !== max };
}

/** Cetakan grup siap pakai untuk kasus yang paling sering muncul di kafe &
 *  resto Indonesia. Bukan hiasan: layar kosong yang menuntut pemilik mengarang
 *  struktur dari nol adalah tempat fitur ini biasanya ditinggalkan. */
export const ADDON_PRESETS: Array<{
  label: string;
  rule: AddonRule;
  values: Array<[string, number]>;
}> = [
  { label: "Ukuran", rule: "wajib", values: [["Reguler", 0], ["Large", 5000]] },
  { label: "Tingkat Gula", rule: "wajib", values: [["Normal", 0], ["Less Sugar", 0], ["No Sugar", 0]] },
  { label: "Suhu", rule: "wajib", values: [["Panas", 0], ["Dingin", 3000]] },
  {
    label: "Level Pedas",
    rule: "wajib",
    values: [["Tidak Pedas", 0], ["Sedang", 0], ["Pedas", 0], ["Extra Pedas", 2000]],
  },
  { label: "Topping", rule: "banyak", values: [["Keju", 5000], ["Telur", 4000], ["Sosis", 6000]] },
  { label: "Tanpa Bahan", rule: "banyak", values: [["Tanpa Bawang", 0], ["Tanpa Sambal", 0]] },
];

export function presetToGroup(preset: (typeof ADDON_PRESETS)[number]): AddonGroupDraft {
  const group: AddonGroupDraft = {
    key: addonKey("g"),
    name: preset.label,
    min_select: 0,
    max_select: 1,
    values: preset.values.map(([nama, harga]) => emptyValue(nama, harga)),
  };
  return normalizeGroup(applyRule(group, preset.rule));
}
