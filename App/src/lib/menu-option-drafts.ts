import type { RecipeDraftInput } from "./dashboard-actions";

/** Bentuk varian saat masih diedit di form, sebelum dikirim ke database.
 *
 *  Modul ini sengaja terpisah dari dashboard-actions: berkas itu memakai
 *  "use server", yang hanya mengizinkan ekspor fungsi async. Validator di bawah
 *  harus bisa dipanggil langsung dari komponen klien. */
export interface OptionValueDraft {
  name: string;
  price_delta: number;
  is_active: boolean;
  recipes: RecipeDraftInput[];
}

export interface OptionGroupDraft {
  name: string;
  min_select: number;
  max_select: number;
  values: OptionValueDraft[];
}

/** Aturan yang sama ditegakkan di editor dan di server action, supaya pesan
 *  yang dilihat pemilik persis sama dengan yang menolak simpanannya. */
export function optionGroupsValidationError(groups: OptionGroupDraft[]): string | undefined {
  if (groups.length > 10) return "Maksimal 10 grup varian per menu.";

  for (const group of groups) {
    if (!group.name.trim()) return "Setiap grup varian harus punya nama.";
    if (group.values.length === 0) {
      return `Grup "${group.name.trim()}" belum punya pilihan.`;
    }
    if (group.values.length > 20) {
      return `Grup "${group.name.trim()}" melebihi 20 pilihan.`;
    }
    if (group.values.some((value) => !value.name.trim())) {
      return `Setiap pilihan di grup "${group.name.trim()}" harus punya nama.`;
    }
    if (group.values.some((value) => !Number.isInteger(value.price_delta))) {
      return "Selisih harga harus berupa angka bulat rupiah.";
    }
    if (group.min_select < 0 || group.max_select < 1 || group.min_select > group.max_select) {
      return `Batas pilihan grup "${group.name.trim()}" tidak masuk akal.`;
    }
    if (group.max_select > group.values.length) {
      return `Grup "${group.name.trim()}" tidak bisa meminta lebih banyak pilihan daripada yang tersedia.`;
    }

    const names = new Set<string>();
    for (const value of group.values) {
      const key = value.name.trim().toLowerCase();
      if (names.has(key)) return `Pilihan "${value.name.trim()}" muncul dua kali dalam satu grup.`;
      names.add(key);
    }

    for (const value of group.values) {
      const items = new Set<string>();
      for (const recipe of value.recipes) {
        if (!Number.isFinite(recipe.qty_per_menu) || recipe.qty_per_menu <= 0) {
          return `Jumlah bahan untuk "${value.name.trim()}" harus lebih dari 0.`;
        }
        if (items.has(recipe.inventory_item_id)) {
          return `Satu bahan tidak boleh muncul dua kali di pilihan "${value.name.trim()}".`;
        }
        items.add(recipe.inventory_item_id);
      }
    }
  }

  return undefined;
}
