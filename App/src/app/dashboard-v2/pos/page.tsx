import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";
import PosBoard, {
  type PosMenu,
  type PosMenuOption,
  type PosCategoryChip,
  type PosRecent,
} from "@/components/pos/PosBoard";
import "../../pos-item-details.css";
import "../../pos.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "POS · 3Diner" };

/** POS — recreate `pos.html` Dream POS dengan data & tulis-path nyata.
 *  Semua tombol bekerja: tambah/kurang item + varian + catatan, kartu,
 *  simpan draf (pending), kirim dapur, tunai, QRIS, struk, batalkan.
 *  Write-path direuse dari jalur pelanggan (quote/commit RPC) & kasir
 *  (mark_order_cash_paid, cancel), bukan jalur baru. */
export default async function PosPage() {
  const ctx = await getStaffContext();
  // POS dipakai owner & kasir; selain itu (atau nonaktif) tidak ada di sini.
  if (!ctx.role || ctx.is_active === false) redirect("/kasir");

  const cafeId = ctx.cafe_id ?? "";

  const since = startOfTodayWIB();

  const [menusRes, groupsRes, cafeRes, recentRes, tablesRes] = await Promise.all([
    supabaseAdmin
      .from("Menus")
      .select("id_menu,nama_menu,harga_menu,discount_pct,image_url,category,is_active,description_menu")
      .eq("cafe_id", cafeId)
      .order("nama_menu", { ascending: true })
      .limit(200),
    supabaseAdmin
      .from("Menu_Option_Groups")
      .select(
        "id_option_group,menu_id,name,min_select,max_select,sort_order," +
          "values:Menu_Option_Values(id_option_value,name,price_delta,is_active,sort_order)",
      )
      .eq("cafe_id", cafeId)
      .order("sort_order", { ascending: true })
      .limit(200),
    supabaseAdmin
      .from("Cafes")
      .select("nama_cafe,alamat_cafe,tax_configured_at,receipt_settings,logo_url")
      .eq("id_cafe", cafeId)
      .single(),
    supabaseAdmin
      .from("Orders")
      .select("id_order,table_number,total,status,payment_status,created_at,items")
      .eq("cafe_id", cafeId)
      .not("status", "in", "(completed,cancelled)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(6),
    // Daftar meja untuk combobox "Lokasi Meja". Tidak ada tabel Meja di skema,
    // jadi sumber kebenarannya adalah meja yang benar-benar pernah dipakai.
    supabaseAdmin
      .from("Orders")
      .select("table_number")
      .eq("cafe_id", cafeId)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const cafe = cafeRes.data;

  // Cast eksplisit: tanpa generic Database, embed bersarang diinfer PostgREST
  // sebagai GenericStringError (pola sama dengan menu-options.ts).
  type RawValue = { id_option_value: string; name: string; price_delta: number | null; is_active: boolean; sort_order: number };
  type RawGroup = {
    id_option_group: string; menu_id: string; name: string;
    min_select: number; max_select: number; sort_order: number;
    values: RawValue[] | null;
  };

  const menus: PosMenu[] = ((menusRes.data ?? []) as unknown as Array<{
    id_menu: string; nama_menu: string; harga_menu: number | null; discount_pct: number | null;
    image_url: string | null; category: string | null; is_active: boolean;
    description_menu: string | null;
  }>).map(m => ({
    id: m.id_menu,
    name: m.nama_menu,
    price: m.harga_menu ?? 0,
    discountPct: m.discount_pct,
    imageUrl: m.image_url,
    category: m.category,
    isActive: m.is_active,
    description: m.description_menu,
  }));

  const optionGroups: PosMenuOption[] = ((groupsRes.data ?? []) as unknown as RawGroup[]).map(g => ({
    id: g.id_option_group,
    menuId: g.menu_id,
    name: g.name,
    minSelect: g.min_select,
    maxSelect: g.max_select,
    values: (g.values ?? [])
      .filter(v => v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(v => ({ id: v.id_option_value, name: v.name, priceDelta: v.price_delta ?? 0 })),
  }));

  const seenCat = new Map<string, number>();
  for (const m of menus) {
    const c = (m.category ?? "").trim();
    if (!c) continue;
    seenCat.set(c, (seenCat.get(c) ?? 0) + 1);
  }
  const categories: PosCategoryChip[] = [
    { name: "Semua Menu", count: menus.length },
    ...[...seenCat.entries()].map(([name, count]) => ({ name, count })),
  ];

  const recent: PosRecent[] = ((recentRes.data ?? []) as unknown as Array<{
    id_order: string; table_number: string; total: number; status: PosRecent["status"];
    payment_status: string; created_at: string; items: Array<{ qty?: number }> | null;
  }>).map(o => ({
    id: o.id_order,
    table: o.table_number,
    total: o.total,
    status: o.status,
    paymentStatus: o.payment_status,
    createdAt: o.created_at,
    menuCount: (o.items ?? []).length,
    itemCount: (o.items ?? []).reduce((s, it) => s + (it.qty ?? 1), 0),
  }));

  // Meja unik, tanpa label bawa-pulang, urut manusiawi (2 sebelum 10).
  const tables = [
    ...new Set(
      ((tablesRes.data ?? []) as unknown as Array<{ table_number: string | null }>)
        .map(r => (r.table_number ?? "").trim())
        .filter(t => t.length > 0 && !/^(bungkus|delivery|take ?away)$/i.test(t)),
    ),
  ].sort((a, b) => a.localeCompare(b, "id", { numeric: true, sensitivity: "base" }));

  return (
    <PosBoard
      cafeId={cafeId}
      cafeName={cafe?.nama_cafe ?? "Kafe"}
      cafeAddress={cafe?.alamat_cafe ?? null}
      taxConfigured={Boolean(cafe?.tax_configured_at)}
      receiptSettings={(cafe?.receipt_settings as Record<string, unknown> | null) ?? null}
      staffName={ctx.full_name ?? "Kasir"}
      menus={menus}
      optionGroups={optionGroups}
      categories={categories}
      recent={recent}
      tables={tables}
    />
  );
}
