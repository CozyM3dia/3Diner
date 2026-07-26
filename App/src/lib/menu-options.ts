import { supabaseAdmin } from "./supabase-admin";
import type { MenuOptionGroup, MenuOptionValue } from "@/types";

interface RawValue {
  id_option_value: string;
  cafe_id: string;
  option_group_id: string;
  name: string;
  price_delta: number;
  is_active: boolean;
  sort_order: number;
  recipes?: { inventory_item_id: string; qty_per_menu: number }[] | null;
}

interface RawGroup {
  id_option_group: string;
  cafe_id: string;
  menu_id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  values?: RawValue[] | null;
}

const GROUP_SELECT = `
  id_option_group, cafe_id, menu_id, name, min_select, max_select, sort_order,
  values:Menu_Option_Values(
    id_option_value, cafe_id, option_group_id, name, price_delta, is_active, sort_order,
    recipes:Menu_Option_Recipes(inventory_item_id, qty_per_menu)
  )
`;

/** Diekspor untuk pengujian: penjepitan min/max di sini yang menentukan apakah
 *  tamu punya jalan keluar saat sebagian pilihan dinonaktifkan. */
export function shapeOptionGroups(rows: RawGroup[], activeOnly: boolean): MenuOptionGroup[] {
  return rows
    .map((group) => {
      const values: MenuOptionValue[] = (group.values ?? [])
        .filter((value) => (activeOnly ? value.is_active : true))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((value) => ({
          id_option_value: value.id_option_value,
          cafe_id: value.cafe_id,
          option_group_id: value.option_group_id,
          name: value.name,
          price_delta: value.price_delta,
          is_active: value.is_active,
          sort_order: value.sort_order,
          recipes: (value.recipes ?? []).map((recipe) => ({
            inventory_item_id: recipe.inventory_item_id,
            qty_per_menu: recipe.qty_per_menu,
          })),
        }));

      return {
        id_option_group: group.id_option_group,
        cafe_id: group.cafe_id,
        menu_id: group.menu_id,
        name: group.name,
        // Grup yang sebagian pilihannya dinonaktifkan tidak boleh menuntut lebih
        // banyak pilihan daripada yang tersisa, atau tamu terkunci tanpa jalan
        // keluar. Batas bawah ikut dijepit: grup dengan min_select 2 yang hanya
        // menyisakan satu pilihan aktif membuat tombol "Tambah" mati selamanya.
        min_select: Math.min(group.min_select, values.length),
        max_select: Math.max(1, Math.min(group.max_select, values.length || 1)),
        sort_order: group.sort_order,
        values,
      };
    })
    // Grup yang semua pilihannya nonaktif tidak punya arti bagi tamu.
    .filter((group) => (activeOnly ? group.values.length > 0 : true))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Varian sebuah menu untuk editor dashboard: pilihan nonaktif ikut terbawa
 *  supaya pemilik bisa mengaktifkannya kembali. */
export async function getMenuOptionsForOwner(
  cafeId: string,
  menuId: string
): Promise<{ groups: MenuOptionGroup[]; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("Menu_Option_Groups")
    .select(GROUP_SELECT)
    .eq("cafe_id", cafeId)
    .eq("menu_id", menuId)
    .order("sort_order", { ascending: true });

  if (error) return { groups: [], error: error.message };
  return { groups: shapeOptionGroups((data ?? []) as unknown as RawGroup[], false), error: null };
}

/** Varian untuk halaman menu pelanggan: hanya yang aktif, dan tanpa resep —
 *  komposisi bahan bukan urusan tamu. */
export async function getMenuOptionsForCustomer(
  cafeId: string,
  menuId: string
): Promise<MenuOptionGroup[]> {
  const { data, error } = await supabaseAdmin
    .from("Menu_Option_Groups")
    .select(GROUP_SELECT)
    .eq("cafe_id", cafeId)
    .eq("menu_id", menuId)
    .order("sort_order", { ascending: true });

  if (error) return [];

  return shapeOptionGroups((data ?? []) as unknown as RawGroup[], true).map((group) => ({
    ...group,
    values: group.values?.map((value) => {
      const stripped = { ...value };
      delete stripped.recipes;
      return stripped;
    }),
  }));
}
