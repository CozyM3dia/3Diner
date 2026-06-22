import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus, Box, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatRupiah } from "@/lib/format";
import type { Menu } from "@/types";

export const dynamic = "force-dynamic";

export default async function MenuListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null };

  const { data: menus } = cafe
    ? await supabaseAdmin.from("Menus").select("*").eq("cafe_id", cafe.id_cafe).order("created_at", { ascending: false })
    : { data: [] };

  const list = (menus ?? []) as Menu[];

  return (
    <div className="p-5 lg:p-8 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>Menu</h1>
          <p className="text-sm mt-1" style={{ color: "#5A7898" }}>{list.length} item terdaftar</p>
        </div>
        <Link
          href="/dashboard/menu/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#FD5002" }}
        >
          <Plus size={16} /> Tambah Menu
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Box size={38} style={{ color: "#5A7898" }} strokeWidth={1.2} />
          <p className="mt-4 font-semibold" style={{ color: "#E9EEF6" }}>Belum ada menu</p>
          <p className="text-sm mt-1 mb-6" style={{ color: "#5A7898" }}>Tambah menu pertama untuk kafe kamu</p>
          <Link href="/dashboard/menu/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#FD5002" }}>
            <Plus size={15} /> Tambah Menu
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["", "Nama", "Kategori", "Harga", "3D", "Status", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((menu, i) => (
                <tr key={menu.id_menu} style={{ borderBottom: i < list.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: "#132136" }}>
                      {menu.image_url ? (
                        <Image src={menu.image_url} alt="" width={40} height={40} className="object-cover w-full h-full" />
                      ) : (
                        <Box size={16} style={{ color: "#5A7898" }} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium" style={{ color: "#E9EEF6" }}>{menu.nama_menu}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#132136", color: "#5A7898" }}>
                      {menu.category ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums" style={{ color: "#E9EEF6" }}>
                    {formatRupiah(menu.harga_menu)}
                  </td>
                  <td className="px-4 py-3">
                    {menu.model_3d_url ? (
                      <span className="text-xs font-bold" style={{ color: "#00C2A8" }}>3D</span>
                    ) : (
                      <span style={{ color: "#5A7898" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: menu.is_active !== false ? "#22D3A6" : "#5A7898" }} />
                      <span style={{ color: menu.is_active !== false ? "#22D3A6" : "#5A7898" }}>
                        {menu.is_active !== false ? "Aktif" : "Nonaktif"}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/menu/${menu.id_menu}/edit`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                      style={{ background: "#132136", color: "#E9EEF6" }}
                    >
                      <Pencil size={12} /> Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
